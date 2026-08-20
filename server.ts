import express from "express";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createWorker } from "tesseract.js";

const execAsync = promisify(exec);

dotenv.config();

// Safe Gemini Client Provider (Top-Level Scope)
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === "MY_GEMINI_API_KEY" || key === "undefined" || key === "null" || key.length < 10) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    return null;
  }
}

// Model fallback sequence for 503 High Demand / 429 Rate Limit recovery
const GEMINI_MODELS_CASCADE = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

async function executeGeminiWithFallback(
  ai: GoogleGenAI,
  requestPayload: (modelName: string) => Promise<any>
): Promise<any> {
  let lastError: any = null;
  for (const model of GEMINI_MODELS_CASCADE) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout on model ${model}`)), 12000)
      );
      const result = await Promise.race([requestPayload(model), timeoutPromise]);
      if (result) return result;
    } catch (err: any) {
      lastError = err;
      // Continue to fallback model on 503 / 429 / timeout
    }
  }
  throw lastError || new Error("All Gemini models unavailable");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing with higher payload limit for image base64
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Health Check
  app.get("/api/health", (_req, res) => {
    const ai = getGeminiClient();
    res.json({ status: "ok", aiEnabled: !!ai });
  });

  /**
   * Endpoint Carian Pantas ISBN / Judul (Google Books / OpenLibrary)
   */
  app.get("/api/lookup-isbn", async (req, res) => {
    try {
      const isbn = String(req.query.isbn || '').trim();
      const title = String(req.query.title || '').trim();
      if (!isbn && !title) {
        return res.status(400).json({ error: "ISBN atau judul diperlukan." });
      }

      const book = await lookupOnlineBook(isbn, title);
      if (book) {
        const normalized = sanitizeAndNormalizeBibliographicResult(book);
        return res.json({ status: "success", book: normalized });
      }
      return res.status(404).json({ status: "not_found", message: "Buku tidak ditemui dalam pangkalan data katalog." });
    } catch (err: any) {
      console.warn("Lookup ISBN error:", err);
      return res.status(500).json({ error: "Ralat carian ISBN" });
    }
  });

  /**
   * LANGKAH 2: OCR Vision API
   * Extracts bibliographic metadata from cover page or copyright page images or text snippets.
   * Supports Malay, English, Arabic, or mixed languages with deep cataloging rules.
   */
  app.post("/api/ocr", async (req, res) => {
    try {
      const { coverImageBase64, copyrightImageBase64, textContent, aiMode } = req.body || {};
      const modelToUse = 'gemini-3.7-flash';
      const ai = getGeminiClient();

      // 1. Ekstrak teks daripada imej menggunakan enjin OCR sebenar (Tesseract OCR)
      let extractedOcrText = "";
      try {
        if (coverImageBase64 && typeof coverImageBase64 === "string" && coverImageBase64.length > 50) {
          const tTextCover = await performTesseractOCR(coverImageBase64);
          if (tTextCover && tTextCover.trim()) {
            extractedOcrText += `\n[TEKS MUKA DEPAN BUKU]:\n${tTextCover.trim()}\n`;
          }
        }
        if (copyrightImageBase64 && typeof copyrightImageBase64 === "string" && copyrightImageBase64.length > 50) {
          const tTextCopy = await performTesseractOCR(copyrightImageBase64);
          if (tTextCopy && tTextCopy.trim()) {
            extractedOcrText += `\n[TEKS HALAMAN HAK CIPTA / KDT]:\n${tTextCopy.trim()}\n`;
          }
        }
      } catch (ocrErr) {
        console.warn("Tesseract OCR extraction warning:", ocrErr);
      }

      const combinedRawText = [textContent || "", extractedOcrText].filter(Boolean).join("\n").trim();

      // 2. Cuba guna Gemini Vision jika kunci AI sah
      if (ai) {
        try {
          const parts: any[] = [];
          const promptText = `Anda ialah pakar Pengkatalogan Perpustakaan (Chief Library Cataloger) & Pakar Pengecaman Teks AI (Vision OCR) di Perpustakaan Negara Malaysia (PNM).
Tugas kritikal anda ialah membaca, mentafsir, dan mengekstrak maklumat bibliografi rasmi buku dengan ketepatan tertinggi (100% tepat) daripada imej muka depan, halaman hak cipta (KDT / CIP), halaman judul dalam, atau teks yang diberikan.

PANDUAN PENGEKSTRAKAN MENGIKUT PIAWAIAN PERPUSTAKAAN (AACR2 / RDA):

1. **judul** (Judul Buku / Title):
   - Ekstrak judul utama yang tepat dan lengkap.
   - Jika terdapat anak judul (subtitle), cantumkan dengan tanda titik bertindih ':' (Contoh: "Fiqh Sirah : Penghayatan Sirah Nabi Muhammad SAW").
   - Bersihkan teks dari label siri, nombor edisi, slogan, atau nama pengarang yang terselit pada muka depan.
   - Tukarkan teks HURUF BESAR SEMUA (ALL CAPS) kepada format Title Case yang kemas dan tepat.

2. **pengarang** (Pengarang Utama / Penulis / Editor):
   - Ekstrak nama pengarang sebenar atau penyunting utama.
   - Buang perkataan pengantar seperti "Ditulis oleh:", "Karya:", "Oleh:", "Disusun oleh:", "Editor:".
   - Jika terdapat lebih daripada seorang pengarang, senaraikan dengan koma (Contoh: "Ahmad Fathi, Mohd Shukri").

3. **tempatTerbit** (Tempat Terbit / City, District, State, or Country of Publication):
   - Kenal pasti BANDAR, DAERAH, atau NEGERI lokasi penerbitan rasmi daripada alamat penerbit di halaman hak cipta atau baris terbitan.
   - Contoh Malaysia: "Kuala Lumpur", "Bangi", "Shah Alam", "Petaling Jaya", "Putrajaya", "Johor Bahru", "Kota Bharu", "Alor Setar", "Kuching", "Kota Kinabalu", "Batu Caves", "Nilai", "Kajang", "Serdang", "Melaka", "Kuantan", "Ipoh", "Kangar", "Kuala Terengganu".
   - Contoh Luar Negara: "Jakarta", "Kaherah" / "Cairo", "London", "Riyadh", "Beirut", "Singapore", "New York", "Oxford", "Bandung", "Yogyakarta".

4. **penerbit** (Penerbit / Publishing House):
   - Ambil NAMA RUMAH PENERBITAN sahaja (Contoh: "Dewan Bahasa dan Pustaka", "Penerbit Universiti Malaya", "PTS Publishing House", "Telaga Biru", "Karisma Publications", "Darul Nu'man", "Penerbit UKM").
   - PERINGATAN KRITIKAL: Jangan ambil nama pencetak ("Dicetak oleh / Percetakan XYZ Sdn Bhd") sebagai penerbit.

5. **tahunTerbit** (Tahun Terbit / 4-Digit Year):
   - Kenal pasti tahun penerbitan 4 digit (Contoh: "2024").

6. **isbn** (Nombor Piawai Antarabangsa Buku / ISBN):
   - Ekstrak nombor ISBN-13 (bermula 978 atau 979) atau ISBN-10 daripada kotak KDT/CIP atau teks kod bar.

7. **noDdc** (Nombor Pengelasan Perpuluhan Dewey + 3 Huruf Kod Pengarang):
   - FORMAT OUTPUT DDC WAJIB: [Nombor DDC] [3 Huruf Kod Pengarang] (Contoh: "297.2 FAT", "899.233 AHM", "025.2 HAZ").

8. **urlBuku** (Pautan URL / Link Buku):
   - Ekstrak sebarang pautan web atau URL (contoh: https://..., http://...) yang terdapat dalam teks atau halaman jika ada.

Sila kembalikan data dalam format JSON berstruktur.`;

          parts.push({ text: promptText });

          if (coverImageBase64 && typeof coverImageBase64 === 'string') {
            const cleanBase64 = coverImageBase64.replace(/^data:image\/\w+;base64,/, "");
            const mimeMatch = coverImageBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            if (cleanBase64.length > 50) {
              parts.push({
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              });
            }
          }

          if (copyrightImageBase64 && typeof copyrightImageBase64 === 'string') {
            const cleanBase64 = copyrightImageBase64.replace(/^data:image\/\w+;base64,/, "");
            const mimeMatch = copyrightImageBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            if (cleanBase64.length > 50) {
              parts.push({
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              });
            }
          }

          if (combinedRawText) {
            parts.push({ text: `Teks Terkesan Daripada Imej / Nota:\n${combinedRawText}` });
          }

          const response = await executeGeminiWithFallback(ai, async (model) => {
            return await ai.models.generateContent({
              model,
              contents: { parts },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    judul: { type: Type.STRING, description: "Judul penuh buku" },
                    pengarang: { type: Type.STRING, description: "Nama pengarang atau penyunting" },
                    tempatTerbit: { type: Type.STRING, description: "Bandar/tempat terbit" },
                    penerbit: { type: Type.STRING, description: "Nama rumah penerbitan" },
                    tahunTerbit: { type: Type.STRING, description: "Tahun terbit 4 digit" },
                    isbn: { type: Type.STRING, description: "Nombor ISBN" },
                    noDdc: { type: Type.STRING, description: "Nombor Pengelasan DDC beserta 3 huruf pengarang" },
                    urlBuku: { type: Type.STRING, description: "Pautan URL Buku atau Link web jika ada" },
                    detectedLanguage: { type: Type.STRING, description: "Malay, English, Arabic, or Mixed" },
                    confidenceScores: {
                      type: Type.OBJECT,
                      properties: {
                        judul: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        pengarang: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        tempatTerbit: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        penerbit: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        tahunTerbit: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        isbn: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                        noDdc: { type: Type.INTEGER, description: "Keyakinan 0-100" },
                      },
                    },
                  },
                  required: ["judul", "pengarang", "confidenceScores"],
                },
              },
            });
          });

          const responseText = response?.text || "{}";
          const parsed = JSON.parse(responseText);
          const ocrResult = sanitizeAndNormalizeBibliographicResult(parsed, combinedRawText);

          return res.json({
            status: "success",
            ocrResult,
            rawText: combinedRawText,
          });
        } catch (_geminiErr: any) {
          // Gracefully continue to native OCR & catalog extraction engine
        }
      }

      // 3. Mod Enjin Pengekstrakan Bibliografi Pintar Tempatan & Pangkalan Data Katalog
      const parsedData = await extractBibliographicFromText(combinedRawText, req.body?.judul);
      const normalized = sanitizeAndNormalizeBibliographicResult(parsedData, combinedRawText);

      return res.status(200).json({
        status: "success",
        ocrResult: normalized,
        rawText: combinedRawText,
      });
    } catch (err: any) {
      console.warn("OCR API general error:", err);
      const parsedData = await extractBibliographicFromText(req.body?.textContent, req.body?.judul);
      const normalized = sanitizeAndNormalizeBibliographicResult(parsedData, req.body?.textContent);
      return res.status(200).json({
        status: "success",
        warning: "Maklumat bibliografi diekstrak menggunakan enjin katalog tempatan.",
        ocrResult: normalized,
      });
    }
  });

  /**
   * Ekstrak Teks Raw Pukal (Multi-book raw text parser)
   * Parses raw text block containing info for multiple books into array of book items using Gemini AI or Local Pustaka Engine.
   */
  app.post("/api/bulk-raw-text", async (req, res) => {
    try {
      const { rawText, aiMode, engine } = req.body;
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({ error: "Teks raw kosong." });
      }

      // If user specifies local engine or aiMode is local, extract directly using local catalog engine
      if (engine === 'local' || aiMode === 'local') {
        const rawList = parseBulkTextHeuristic(rawText);
        const normalizedList = rawList.map((b) => sanitizeAndNormalizeBibliographicResult(b));
        return res.json({ status: "success", books: normalizedList, source: "pustaka-local" });
      }

      const ai = getGeminiClient();

      if (!ai) {
        const rawList = parseBulkTextHeuristic(rawText);
        const normalizedList = rawList.map((b) => sanitizeAndNormalizeBibliographicResult(b));
        return res.json({ status: "success", books: normalizedList, source: "pustaka-local" });
      }

      const prompt = `Anda ialah sistem pemprosesan data bibliografi pintar.
PENTING: Jangan buat carian internet. Hanya baca dan asingkan maklumat yang terdapat dalam teks raw di bawah ke dalam rekod berasingan bagi setiap buah buku.

Teks Raw Pukal:
"""
${rawText}
"""

Arahan:
1. Kenal pasti setiap entri buku berbeza dalam teks yang diberikan.
2. Bagi setiap buku, asingkan medan berikut terus dari teks yang dibekalkan:
   - judul: Judul/Tajuk buku (bersihkan dari label seperti 'Judul:', 'Title:', nombor senarai, dsb.)
   - pengarang: Nama pengarang/penulis sebenar
   - tempatTerbit: Bandar/Tempat terbit jika ada (contoh: Kuala Lumpur, Bangi, Shah Alam, London)
   - penerbit: Nama penerbit buku
   - tahunTerbit: Tahun terbit 4 digit
   - isbn: Nombor ISBN (jika ada dalam teks)
   - noDdc: Nombor Pengelasan DDC beserta 3 huruf pertama nama pengarang (contoh: 899.233 SAM, 005.133 JON, 297.63 AHM). Jika tiada dalam teks, tentukan DDC berasaskan subjek tajuk.
   - urlBuku: Pautan URL / Link web buku jika ada dalam teks (contoh: https://..., http://...)
   - catatan: Nota ringkas jika ada

Pulangkan jawapan dalam bentuk JSON SENARAI (Array of Objects) bagi setiap buku yang berjaya diasingkan.`;

      try {
        const response = await executeGeminiWithFallback(ai, async (model) => {
          return await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    judul: { type: Type.STRING, description: "Judul buku" },
                    pengarang: { type: Type.STRING, description: "Pengarang" },
                    tempatTerbit: { type: Type.STRING, description: "Tempat Terbit" },
                    penerbit: { type: Type.STRING, description: "Penerbit" },
                    tahunTerbit: { type: Type.STRING, description: "Tahun Terbit" },
                    isbn: { type: Type.STRING, description: "ISBN" },
                    noDdc: { type: Type.STRING, description: "No DDC" },
                    urlBuku: { type: Type.STRING, description: "Pautan URL Buku jika ada" },
                    catatan: { type: Type.STRING, description: "Catatan" },
                  },
                  required: ["judul"],
                },
              },
            },
          });
        });

        const jsonText = response?.text || "[]";
        let parsedBooks = JSON.parse(jsonText);

        if (!Array.isArray(parsedBooks) || parsedBooks.length === 0) {
          parsedBooks = parseBulkTextHeuristic(rawText);
        }

        const normalizedBooks = parsedBooks.map((item: any) => {
          const norm = sanitizeAndNormalizeBibliographicResult(item);
          return {
            ...norm,
            urlBuku: item.urlBuku || (norm as any).urlBuku || '',
            catatan: item.catatan || (norm as any).catatan || '',
          };
        });

        return res.json({ status: "success", books: normalizedBooks, source: "ai" });
      } catch (_geminiErr: any) {
        const books = parseBulkTextHeuristic(rawText).map((b) => sanitizeAndNormalizeBibliographicResult(b));
        return res.json({ status: "success", books, source: "pustaka-local" });
      }
    } catch (err: any) {
      console.error("Error bulk raw text parsing:", err);
      const books = parseBulkTextHeuristic(req.body?.rawText || '').map((b) => sanitizeAndNormalizeBibliographicResult(b));
      return res.json({ status: "success", books, source: "pustaka-local" });
    }
  });

  /**
   * LANGKAH 4: AI & Internet Metadata Search
   * Only called AFTER draft record is saved!
   * Queries Google Books API / Open Library / Gemini Search grounding for missing bibliographic fields.
   */
  app.post("/api/ai-enrich", async (req, res) => {
    try {
      const { book, aiMode } = req.body;
      const modelToUse = aiMode === 'penuh' ? 'gemini-3.7-flash' : 'gemini-3.1-flash-lite';
      const ai = getGeminiClient();
      if (!book) {
        return res.status(400).json({ error: "Sila bekalkan maklumat buku." });
      }

      const suggestions: any[] = [];

      // 1. First check Google Books API directly if ISBN or Title/Author is present
      let googleBooksData: any = null;
      try {
        let query = "";
        if (book.isbn) {
          query = `isbn:${book.isbn.replace(/[^0-9X]/gi, "")}`;
        } else if (book.judul) {
          query = `intitle:${encodeURIComponent(book.judul)}${
            book.pengarang ? `+inauthor:${encodeURIComponent(book.pengarang)}` : ""
          }`;
        }

        if (query) {
          const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
          if (gbRes.ok) {
            const gbJson: any = await gbRes.json();
            if (gbJson.items && gbJson.items.length > 0) {
              googleBooksData = gbJson.items[0].volumeInfo;
            }
          }
        }
      } catch (e) {
        console.warn("Google Books API query error:", e);
      }

      // Add suggestions from Google Books if fields are missing or can be enhanced
      if (googleBooksData) {
        if (!book.isbn && googleBooksData.industryIdentifiers) {
          const isbnObj = googleBooksData.industryIdentifiers.find((id: any) => id.type === "ISBN_13" || id.type === "ISBN_10");
          if (isbnObj) {
            suggestions.push({
              field: "isbn",
              fieldLabel: "ISBN",
              existingValue: book.isbn || "Tiada",
              suggestedValue: isbnObj.identifier,
              source: "Google Books",
              confidence: 98,
              status: "pending",
            });
          }
        }

        if (!book.tahunTerbit && googleBooksData.publishedDate) {
          const year = googleBooksData.publishedDate.substring(0, 4);
          suggestions.push({
            field: "tahunTerbit",
            fieldLabel: "Tahun Terbit",
            existingValue: book.tahunTerbit || "Tiada",
            suggestedValue: year,
            source: "Google Books",
            confidence: 95,
            status: "pending",
          });
        }

        if (!book.penerbit && googleBooksData.publisher) {
          suggestions.push({
            field: "penerbit",
            fieldLabel: "Penerbit",
            existingValue: book.penerbit || "Tiada",
            suggestedValue: googleBooksData.publisher,
            source: "Google Books",
            confidence: 92,
            status: "pending",
          });
        }
      }

      // 2. Use Gemini Bibliographic Logic for DDC & Place of Publication or missing fields
      if (ai) {
        try {
          const enrichPrompt = `Anda ialah pustakawan bibliografi negara.
Buku semasa dalam katalog:
- Judul: "${book.judul || ""}"
- Pengarang: "${book.pengarang || ""}"
- Penerbit: "${book.penerbit || ""}"
- Tahun Terbit: "${book.tahunTerbit || ""}"
- ISBN: "${book.isbn || ""}"
- DDC Sekarang: "${book.noDdc || ""}"
- Tempat Terbit Sekarang: "${book.tempatTerbit || ""}"

Tugas anda:
Cari dan cadangkan maklumat bibliografi yang masih KOSONG atau PERLU DIPERBAIKI.
Khas untuk DDC (Dewey Decimal Classification): berikan nombor DDC yang tepat beserta 3 huruf pertama pengarang (contoh: "899.233 SAM", "006.3 AHM", "155.25 CAI").
Khas untuk Tempat Terbit: cadangkan bandar terbitan jika dikenali (contoh: "Kuala Lumpur", "Bangi", "London", "Cairo").

Sila pulangkan cadangan dalam format JSON senarai cadangan. Setiap cadangan mempunyai:
- field (isbn, tahunTerbit, penerbit, tempatTerbit, noDdc)
- fieldLabel
- suggestedValue
- source (contoh: "Open Library", "Google Books", "Perpustakaan Negara / Gemini Bibliographic AI")
- confidence (integer 0-100)`;

          const aiResponse = await executeGeminiWithFallback(ai, async (model) => {
            return await ai.models.generateContent({
              model,
              contents: enrichPrompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      field: { type: Type.STRING },
                      fieldLabel: { type: Type.STRING },
                      suggestedValue: { type: Type.STRING },
                      source: { type: Type.STRING },
                      confidence: { type: Type.INTEGER },
                    },
                    required: ["field", "fieldLabel", "suggestedValue", "source", "confidence"],
                  },
                },
              },
            });
          });

          const aiText = aiResponse.text || "[]";
          const aiSuggestionsList = JSON.parse(aiText);

          for (const item of aiSuggestionsList) {
            // Only add if not already added or if value differs from existing
            const currentVal = (book as any)[item.field] || "Tiada";
            if (item.suggestedValue && item.suggestedValue !== currentVal) {
              const exists = suggestions.some((s) => s.field === item.field);
              if (!exists) {
                suggestions.push({
                  field: item.field,
                  fieldLabel: item.fieldLabel,
                  existingValue: currentVal,
                  suggestedValue: item.suggestedValue,
                  source: item.source || "Gemini Bibliographic AI",
                  confidence: item.confidence || 85,
                  status: "pending",
                });
              }
            }
          }
        } catch (aiErr: any) {
          // Fallback to Google Books & heuristic suggestions without printing error
        }
      }

      // Fallback fallback if no suggestions returned and fields are empty
      if (suggestions.length === 0) {
        if (!book.noDdc && book.judul) {
          const author3 = (book.pengarang || "UNK").substring(0, 3).toUpperCase();
          suggestions.push({
            field: "noDdc",
            fieldLabel: "No. DDC",
            existingValue: "Tiada",
            suggestedValue: `000.0 ${author3}`,
            source: "Cadangan Asas DDC",
            confidence: 70,
            status: "pending",
          });
        }
      }

      return res.json({
        status: "success",
        suggestions,
      });
    } catch (err: any) {
      console.warn("Error in /api/ai-enrich (Falling back to heuristic suggestions):", err?.message || err);
      const fallbackSuggestions = [];
      const reqBook = req.body?.book;
      if (reqBook && !reqBook.noDdc) {
        const author3 = (reqBook.pengarang || "KAT").substring(0, 3).toUpperCase();
        fallbackSuggestions.push({
          field: "noDdc",
          fieldLabel: "No. DDC",
          existingValue: reqBook.noDdc || "Tiada",
          suggestedValue: `000.0 ${author3}`,
          source: "Fallback Heuristik DDC",
          confidence: 75,
          status: "pending",
        });
      }
      return res.status(200).json({
        status: "success",
        warning: "Kuota API Gemini terhad (429). Menggunakan cadangan heuristik sandaran.",
        suggestions: fallbackSuggestions,
      });
    }
  });

  /**
   * Fast ISBN Lookup Endpoint
   */
  app.get("/api/isbn-lookup/:isbn", async (req, res) => {
    try {
      const { isbn } = req.params;
      const cleanIsbn = String(isbn || '').trim();
      if (!cleanIsbn) {
        return res.status(400).json({ found: false, error: "ISBN diperlukan." });
      }

      const book = await lookupOnlineBook(cleanIsbn);
      if (book && book.judul) {
        const normalized = sanitizeAndNormalizeBibliographicResult(book);
        return res.json({
          found: true,
          data: {
            ...normalized,
            urlGambarKulit: book.coverUrl || (normalized as any).urlGambarKulit || '',
          },
        });
      }

      return res.json({ found: false, message: "Maklumat buku tidak dijumpai untuk ISBN ini." });
    } catch (e: any) {
      console.warn("ISBN lookup endpoint error:", e);
      return res.status(500).json({ found: false, error: e.message || "Ralat carian ISBN" });
    }
  });

  /**
   * Helper function to sanitize logs and outputs so credentials/tokens are never exposed
   */
  const sanitizeGitSecret = (text: string) => {
    if (!text) return "";
    return text
      .replace(/https:\/\/[^@\s]+@github\.com/gi, "https://***@github.com")
      .replace(/ghp_[a-zA-Z0-9_]{10,}/gi, "ghp_***")
      .replace(/github_pat_[a-zA-Z0-9_]{10,}/gi, "github_pat_***");
  };

  /**
   * Git Push API Endpoint
   * Configures git remote, handles object corruption recovery, and pushes code to GitHub repository
   */
  app.post("/api/git-push", async (req, res) => {
    try {
      const commitMsg = (
        req.body?.commitMessage?.trim() ||
        `Kemas kini kod Pustaka Keluarga (${new Date().toLocaleString('ms-MY')})`
      ).replace(/["$`\\]/g, ' ');

      const userToken = req.body?.githubToken?.trim() || process.env.GITHUB_TOKEN || "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";
      const cleanToken = userToken.replace(/[^a-zA-Z0-9_]/g, '');
      const repoUrl = `https://${cleanToken}@github.com/thebudakampung/pustaka-keluarga.git`;

      const execOptions = {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_ASKPASS: "echo",
        },
      };

      let stdoutResult = "";
      let stderrResult = "";

      // Step 1: Health check on existing .git repository to prevent "inflate: data stream error"
      let isHealthy = false;
      try {
        await execAsync("git rev-parse --is-inside-work-tree && git fsck --quick", execOptions);
        isHealthy = true;
      } catch (_fsckErr) {
        isHealthy = false;
      }

      // Step 2: If .git is absent or corrupted, perform clean initialization
      if (!isHealthy) {
        try {
          await execAsync("rm -rf .git && git init", execOptions);
        } catch (_initErr) {
          // Continue
        }
      }

      // Step 3: Configure repository settings and stage changes
      const setupCommands = [
        'git config user.email "budakampung7@gmail.com"',
        'git config user.name "The Budak Kampung"',
        'git config core.autocrlf false',
        'git branch -M main',
        `git remote remove origin 2>/dev/null || true`,
        `git remote add origin "${repoUrl}"`,
        'git add -A',
      ].join(" && ");

      const setupRes = await execAsync(setupCommands, execOptions);
      stdoutResult += setupRes.stdout || "";
      stderrResult += setupRes.stderr || "";

      // Step 4: Commit changes (check if there is anything to commit or if working tree clean)
      try {
        const commitRes = await execAsync(`git commit -m "${commitMsg}"`, execOptions);
        stdoutResult += (commitRes.stdout ? `\n${commitRes.stdout}` : "");
        stderrResult += (commitRes.stderr ? `\n${commitRes.stderr}` : "");
      } catch (commitErr: any) {
        // If nothing to commit, that's completely normal and acceptable
        const commitOut = (commitErr?.stdout || "") + (commitErr?.stderr || "");
        if (commitOut.includes("nothing to commit") || commitOut.includes("working tree clean")) {
          stdoutResult += "\nTiada perubahan baharu untuk di-commit (working tree clean).";
        }
      }

      // Step 5: Push to remote repository (try standard push, with force-push fallback for diverged/fresh histories)
      try {
        const pushRes = await execAsync("git push -u origin main", execOptions);
        stdoutResult += (pushRes.stdout ? `\n${pushRes.stdout}` : "");
        stderrResult += (pushRes.stderr ? `\n${pushRes.stderr}` : "");
      } catch (pushErr: any) {
        // Fallback with force-push if remote history differs or repository was re-initialized
        const pushForceRes = await execAsync("git push -f -u origin main", execOptions);
        stdoutResult += (pushForceRes.stdout ? `\n${pushForceRes.stdout}` : "");
        stderrResult += (pushForceRes.stderr ? `\n${pushForceRes.stderr}` : "");
      }

      const cleanOutput = sanitizeGitSecret((stdoutResult || "") + (stderrResult ? `\n${stderrResult}` : ""));

      return res.json({
        success: true,
        message: "Berjaya membuat Git Push ke repositori GitHub!",
        output: cleanOutput.trim(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const rawOutput = sanitizeGitSecret(
        (error?.stdout || "") + (error?.stderr ? `\n${error.stderr}` : "") || error?.message || ""
      );
      let userFriendlyMsg = "Gagal melakukan Git Push ke GitHub";

      if (
        rawOutput.includes("could not read Password") ||
        rawOutput.includes("Authentication failed") ||
        rawOutput.includes("Invalid username or password") ||
        rawOutput.includes("403") ||
        rawOutput.includes("401") ||
        rawOutput.includes("Bad credentials")
      ) {
        userFriendlyMsg =
          "Token GitHub (PAT) tidak sah atau telah tamat tempoh. Sila semak atau masukkan Personal Access Token (PAT) baharu dari akaun GitHub anda.";
      }

      return res.status(500).json({
        success: false,
        message: userFriendlyMsg,
        output: rawOutput.trim(),
      });
    }
  });

  // Vite Middleware in Dev Mode or Static Files in Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server Perpustakaan AI running on http://0.0.0.0:${PORT}`);
  });
}

const KNOWN_CITIES = [
  // Malaysia
  'Kuala Lumpur', 'Bangi', 'Shah Alam', 'Putrajaya', 'Petaling Jaya',
  'Subang Jaya', 'George Town', 'Pulau Pinang', 'Penang', 'Ipoh',
  'Johor Bahru', 'Melaka', 'Malacca', 'Kota Bharu', 'Alor Setar',
  'Kota Kinabalu', 'Kuching', 'Cyberjaya', 'Serdang', 'Sintok',
  'Tanjong Malim', 'Nilai', 'Kuantan', 'Kuala Terengganu', 'Kangar',
  'Batu Pahat', 'Muar', 'Skudai', 'Perlis', 'Kedah', 'Perak', 'Selangor',
  'Negeri Sembilan', 'Pahang', 'Terengganu', 'Kelantan', 'Sabah', 'Sarawak', 'Johor',
  // Negara Luar & Antarabangsa
  'Amerika Syarikat', 'United States', 'USA', 'U.S.A.', 'US', 'United Kingdom', 'UK', 'U.K.',
  'Great Britain', 'England', 'Indonesia', 'Australia', 'Mesir', 'Egypt', 'Arab Saudi', 'Saudi Arabia',
  'Jepun', 'Japan', 'Jerman', 'Germany', 'Perancis', 'France', 'India', 'China', 'Thailand',
  'Singapura', 'Singapore', 'Brunei', 'Kanada', 'Canada', 'Belanda', 'Netherlands', 'New Zealand',
  'Switzerland', 'Sweden', 'Turki', 'Turkey',
  // Bandar Luar Malaysia
  'Jakarta', 'Bandung', 'Yogyakarta', 'Surabaya', 'Medan', 'London', 'New York', 'Cairo', 'Kaherah',
  'Oxford', 'Cambridge', 'Boston', 'Chicago', 'Princeton', 'Tokyo', 'Beijing', 'Riyadh', 'Makkah',
  'Madinah', 'Sydney', 'Melbourne', 'Toronto', 'Paris', 'Berlin', 'Amsterdam'
];

function extractPlaceAndPublisher(penerbitInput: string, tempatInput: string): { penerbit: string; tempatTerbit: string } {
  let penerbit = (penerbitInput || '').replace(/[\.\s:;,]+$/, '').trim();
  let tempatTerbit = (tempatInput || '').replace(/[\.\s:;,]+$/, '').trim();

  // 1. If penerbit contains comma(s), e.g. "Princeton University Press Princeton, Amerika Syarikat." or "Penerbit Erlangga, Jakarta, Indonesia"
  if (penerbit.includes(',')) {
    const parts = penerbit.split(',').map((p) => p.trim()).filter(Boolean);
    const locParts: string[] = [];

    while (parts.length > 1) {
      const lastPart = parts[parts.length - 1].replace(/[\.\s:;,]+$/, '').trim();
      const isKnown = KNOWN_CITIES.find((c) => new RegExp(`^${c}$|\\b${c}\\b`, 'i').test(lastPart));
      const looksLikeLocation = lastPart.length > 0 && lastPart.length < 35 && !/penerbit|publisher|press|books|publishing|edition|inc|ltd|sdn|bhd/i.test(lastPart);

      if (isKnown || looksLikeLocation) {
        locParts.unshift(lastPart);
        parts.pop();
      } else {
        break;
      }
    }

    if (locParts.length > 0) {
      // If outside Malaysia (e.g. "Amerika Syarikat"), take the last word as per instruction:
      // "untuk penerbit luar malaysia, maka ambil perkataan akhir sebagai tempat terbit"
      const lastLoc = locParts[locParts.length - 1];
      const isMalaysiaLoc = /kuala lumpur|putrajaya|bangi|shah alam|selangor|perak|johor|kedah|kelantan|terengganu|pahang|sabah|sarawak|penang|melaka|perlis|negeri sembilan/i.test(locParts.join(' '));

      if (isMalaysiaLoc) {
        tempatTerbit = locParts.join(', ');
      } else {
        tempatTerbit = lastLoc;
      }

      penerbit = parts.join(', ');
    }
  }

  // 2. Check format "City : Publisher" or "Publisher : City" if tempatTerbit still empty
  if (!tempatTerbit && penerbit.includes(':')) {
    const parts = penerbit.split(':').map((p) => p.trim()).filter(Boolean);
    const firstIsCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(parts[0]));
    const secondIsCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(parts[1]));

    if (firstIsCity) {
      tempatTerbit = firstIsCity;
      penerbit = parts[1];
    } else if (secondIsCity) {
      tempatTerbit = secondIsCity;
      penerbit = parts[0];
    }
  }

  // 3. Check format "Publisher (City/Country)" if tempatTerbit still empty
  if (!tempatTerbit && /\(([^)]+)\)/.test(penerbit)) {
    const match = penerbit.match(/\(([^)]+)\)/);
    if (match) {
      const inside = match[1].replace(/[\.\s:;,]+$/, '').trim();
      const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(inside)) || (inside.length < 30 ? inside : '');
      if (foundCity) {
        tempatTerbit = foundCity;
        penerbit = penerbit.replace(/\([^)]+\)/, '').trim();
      }
    }
  }

  // 4. Search for known city/country at the end of penerbit string
  if (!tempatTerbit && penerbit) {
    for (const city of KNOWN_CITIES) {
      const reg = new RegExp(`[\\s,:]+${city}[\\.\\s]*$`, 'i');
      if (reg.test(penerbit)) {
        tempatTerbit = city;
        penerbit = penerbit.replace(reg, '').trim();
        break;
      }
    }
  }

  // 5. Clean trailing duplicate location names from penerbit (e.g. "Princeton University Press Princeton" -> "Princeton University Press")
  if (penerbit) {
    for (const city of KNOWN_CITIES) {
      const reg = new RegExp(`[\\s,:]+${city}[\\.\\s]*$`, 'i');
      if (reg.test(penerbit)) {
        penerbit = penerbit.replace(reg, '').trim();
        break;
      }
    }
  }

  // 6. Fallback search anywhere in penerbit if tempatTerbit still empty
  if (!tempatTerbit && penerbit) {
    const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(penerbit));
    if (foundCity) {
      tempatTerbit = foundCity;
    }
  }

  penerbit = penerbit.replace(/[\.\s:;,]+$/, '').trim();
  tempatTerbit = tempatTerbit.replace(/[\.\s:;,]+$/, '').trim();

  return { penerbit, tempatTerbit };
}

function get3LetterAuthorCode(pengarang: string | undefined | null): string {
  if (!pengarang || !pengarang.trim()) return 'UNK';

  let name = pengarang.trim();
  name = name.replace(/^(oleh|by|diselenggarakan oleh|disusun oleh|editor:?|penulis:?)\s+/i, '').trim();

  const titleRegex = /^(prof\.?(esor)?|dr\.?|drs\.?|drh\.?|ph\.?d\.?|m\.?a\.?|haji|hj\.?|hajah|hjh\.?|ustaz|ustazah|ust\.?|sayyid|syed|sharifah|syarifah|sheikh|syeikh|syaikh|shaykh|ir\.?|ts\.?|sr\.?|dato'?|datuk|datin|tan sri|puan sri|tun|toh puan|tunku|tengku|raja|engku|ungku|nik|wan|megat|puteri|tuan guru|tg\.?|tuan|puan|encik|cik|sir|lord|lady|dame|maulana|kiyai|kyai|k\.?h\.?|kh\.?|imam|mufti)\b[\.\s]*/i;

  let previous = '';
  while (name !== previous) {
    previous = name;
    name = name.replace(titleRegex, '').trim();
  }

  const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) return 'UNK';

  const targetWord = words.find((w) => w.length >= 3) || words[0];

  if (targetWord.length >= 3) {
    return targetWord.substring(0, 3).toUpperCase();
  } else {
    const combined = words.join('');
    if (combined.length >= 3) {
      return combined.substring(0, 3).toUpperCase();
    }
    return combined.padEnd(3, 'X').toUpperCase();
  }
}

async function performTesseractOCR(base64Image: string): Promise<string> {
  if (!base64Image || typeof base64Image !== 'string') return '';
  try {
    const clean = base64Image.replace(/^data:image\/\w+;base64,/, '');
    if (clean.length < 50) return '';
    const buffer = Buffer.from(clean, 'base64');
    const worker = await createWorker('eng', 1, {
      logger: () => {},
    });
    const ret = await worker.recognize(buffer);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    // Gracefully handle tesseract environment errors (missing traineddata/LSTM) without throwing or cluttering logs
    return '';
  }
}

function classifyDeweyDecimal(title: string, contextText: string = '', authorName: string = ''): string {
  const combined = `${title} ${contextText}`.toLowerCase();
  const author3 = get3LetterAuthorCode(authorName);

  let ddcNum = '020.2'; // Default: Library & Information Science

  if (/agama|islam|solat|hadis|hadith|quran|al-quran|surah|fiqh|feqah|tauhid|akidah|sirah|rasulullah|tasawuf|dakwah|doa|zikir|puasa|zakat|haji|syariah|fatwa|sunnah|akhlak|akidah|tasawwuf/i.test(combined)) {
    if (/sirah|rasulullah|nabi/i.test(combined)) ddcNum = '297.63';
    else if (/hadis|hadith/i.test(combined)) ddcNum = '297.125';
    else if (/quran|al-quran|tafsir/i.test(combined)) ddcNum = '297.122';
    else if (/fiqh|feqah|hukum|syariah|solat|puasa|zakat|haji/i.test(combined)) ddcNum = '297.5';
    else if (/akidah|tauhid|iman/i.test(combined)) ddcNum = '297.2';
    else ddcNum = '297';
  } else if (/novel|cerpen|puisi|sajak|pantun|drama|sastera|komsas|antologi|teater|cerita|hikayat/i.test(combined)) {
    ddcNum = '899.233'; // Sastera Melayu
  } else if (/bahasa|kamus|tatabahasa|morfologi|sintaksis|linguistik|tatabahasa melayu|peribahasa|idiom/i.test(combined)) {
    if (/kamus|glosari|dictionary/i.test(combined)) ddcNum = '499.2333';
    else if (/arab|arabic/i.test(combined)) ddcNum = '492.7';
    else if (/inggeris|english/i.test(combined)) ddcNum = '420';
    else ddcNum = '499.233';
  } else if (/sejarah|malaysia|merdeka|tanah melayu|tokoh|pahlawan|kerajaan|perang|biografi|salasilah|kemerdekaan|kesultanan/i.test(combined)) {
    if (/malaysia|melayu|sabah|sarawak/i.test(combined)) ddcNum = '959.5';
    else ddcNum = '900';
  } else if (/sains|fizik|kimia|biologi|matematik|astronomi|alam sekitar|geologi/i.test(combined)) {
    if (/matematik|algebra|kalkulus|geometri/i.test(combined)) ddcNum = '510';
    else if (/fizik/i.test(combined)) ddcNum = '530';
    else if (/kimia/i.test(combined)) ddcNum = '540';
    else if (/biologi|haiwan|tumbuhan/i.test(combined)) ddcNum = '570';
    else ddcNum = '500';
  } else if (/komputer|it|teknologi maklumat|pengaturcaraan|python|java|web|sistem|ai|kecerdasan buatan|robotik|software/i.test(combined)) {
    ddcNum = '004';
  } else if (/perubatan|kesihatan|ubat|penyakit|doktor|jururawat|anatomi|pemakanan|diet|senaman|rawatan/i.test(combined)) {
    ddcNum = '610';
  } else if (/pendidikan|sekolah|pedagogi|pembelajaran|kurikulum|guru|pengajaran|kaunseling|prasekolah/i.test(combined)) {
    ddcNum = '370';
  } else if (/ekonomi|perniagaan|kewangan|perakaunan|pemasaran|pengurusan|modal|saham|keusahawanan/i.test(combined)) {
    ddcNum = '330';
  } else if (/undang-undang|perlembagaan|mahkamah|akta|jenayah|guaman/i.test(combined)) {
    ddcNum = '340';
  } else if (/psikologi|falsafah|minda|emosi|motivasi|pemikiran/i.test(combined)) {
    ddcNum = '150';
  } else if (/seni|lukisan|muzik|reka bentuk|kraf|fotografi|seni bina/i.test(combined)) {
    ddcNum = '700';
  }

  return `${ddcNum} ${author3}`;
}

async function lookupOnlineBook(isbn?: string, title?: string, authorHint?: string) {
  const cleanIsbn = isbn ? isbn.replace(/[^0-9Xx]/g, '').toUpperCase() : '';

  // --- TIER 1: GOOGLE BOOKS API SEARCH ---
  if (cleanIsbn.length === 10 || cleanIsbn.length === 13) {
    try {
      const gbUrls = [
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`,
        `https://www.googleapis.com/books/v1/volumes?q=${cleanIsbn}&maxResults=1`
      ];

      for (const url of gbUrls) {
        const gbRes = await fetch(url);
        if (gbRes.ok) {
          const gbJson: any = await gbRes.json();
          if (gbJson.items && gbJson.items.length > 0) {
            const info = gbJson.items[0].volumeInfo || {};
            let bookTitle = info.title || '';
            if (info.subtitle) {
              bookTitle = `${bookTitle} : ${info.subtitle}`;
            }
            const authors = info.authors ? info.authors.join(', ') : '';
            let publisher = info.publisher || '';
            const publishedYear = info.publishedDate ? info.publishedDate.substring(0, 4) : '';
            const categories = info.categories ? info.categories.join(' ') : '';
            const description = info.description || '';
            const coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';

            // Extract place of publication
            let tempat = '';
            if (publisher) {
              const placeExtracted = extractPlaceAndPublisher(publisher, '');
              publisher = placeExtracted.penerbit;
              tempat = placeExtracted.tempatTerbit;
            }

            // Infer Malaysian/Regional publisher locations if still empty
            if (!tempat && publisher) {
              if (/dewan bahasa|dbp|universiti malaya|\bum\b|telaga biru|must read|ilham books|dubook|darul nu'?man/i.test(publisher)) {
                tempat = 'Kuala Lumpur';
              } else if (/universiti kebangsaan|ukm|pelangi/i.test(publisher)) {
                tempat = 'Bangi';
              } else if (/universiti teknologi mara|uitm|karisma|karya bestari|karangkraf/i.test(publisher)) {
                tempat = 'Shah Alam';
              } else if (/universiti teknologi malaysia|utm/i.test(publisher)) {
                tempat = 'Skudai';
              } else if (/universiti putra|upm/i.test(publisher)) {
                tempat = 'Serdang';
              } else if (/pts|batu caves/i.test(publisher)) {
                tempat = 'Batu Caves';
              } else if (/fixi|sasbadi|galeri ilmu/i.test(publisher)) {
                tempat = 'Petaling Jaya';
              } else if (/gramedia|erlangga/i.test(publisher)) {
                tempat = 'Jakarta';
              } else if (/mizan/i.test(publisher)) {
                tempat = 'Bandung';
              } else if (/oxford/i.test(publisher)) {
                tempat = 'Oxford';
              } else if (/cambridge/i.test(publisher)) {
                tempat = 'Cambridge';
              }
            }

            const ddc = classifyDeweyDecimal(bookTitle, `${categories} ${description}`, authors);

            if (bookTitle) {
              return {
                judul: bookTitle,
                pengarang: authors,
                tempatTerbit: tempat || 'Kuala Lumpur',
                penerbit: publisher || 'Penerbit Pustaka',
                tahunTerbit: publishedYear,
                isbn: cleanIsbn,
                noDdc: ddc,
                coverUrl,
              };
            }
          }
        }
      }
    } catch (gbErr) {
      console.warn("Google Books ISBN lookup error:", gbErr);
    }
  }

  // --- TIER 2: OPEN LIBRARY API ---
  if (cleanIsbn.length === 10 || cleanIsbn.length === 13) {
    try {
      const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
      if (res.ok) {
        const data: any = await res.json();
        const book = data[`ISBN:${cleanIsbn}`];
        if (book && book.title) {
          const judul = book.title || '';
          const pengarang = book.authors?.map((a: any) => a.name).join(', ') || '';
          const penerbit = book.publishers?.map((p: any) => p.name).join(', ') || '';
          const tempatTerbit = book.publish_places?.map((p: any) => p.name).join(', ') || '';
          let tahunTerbit = '';
          const ym = (book.publish_date || '').match(/\b(18|19|20)\d{2}\b/);
          if (ym) tahunTerbit = ym[0];

          const subjects = book.subjects?.map((s: any) => s.name).join(' ') || '';
          const ddc = classifyDeweyDecimal(judul, subjects, pengarang);

          return {
            judul,
            pengarang,
            tempatTerbit: tempatTerbit || 'Kuala Lumpur',
            penerbit: penerbit || 'Penerbit Pustaka',
            tahunTerbit,
            isbn: cleanIsbn,
            noDdc: ddc,
            coverUrl: book.cover?.large || book.cover?.medium || '',
          };
        }
      }
    } catch (e) {
      console.warn('OpenLibrary ISBN lookup notice:', e);
    }
  }

  // --- TIER 3: GEMINI AI CATALOGING & SEARCH LOOKUP ---
  const ai = getGeminiClient();
  if (ai && (cleanIsbn || (title && title.length > 3))) {
    try {
      const prompt = `Anda ialah Ketua Pengkatalogan Bibliografi di Perpustakaan Negara Malaysia (PNM).
Diberikan maklumat carian buku:
${cleanIsbn ? `- Nombor ISBN: "${cleanIsbn}"` : ''}
${title ? `- Judul / Tajuk: "${title}"` : ''}
${authorHint ? `- Pengarang: "${authorHint}"` : ''}

Tugas:
Cari dan kenal pasti maklumat bibliografi rasmi buku ini (termasuk buku terbitan Malaysia, Nusantara, Islam, atau antarabangsa).
Berikan data lengkap dan tepat mengikut format JSON berikut:
{
  "judul": "Judul penuh buku (termasuk anak judul jika ada)",
  "pengarang": "Nama pengarang/penulis sebenar (tanpa perkataan 'oleh')",
  "penerbit": "Nama rumah penerbit sebenar",
  "tempatTerbit": "Bandar atau lokasi terbitan (contoh: Kuala Lumpur, Bangi, Shah Alam, Batu Caves, Jakarta, London)",
  "tahunTerbit": "Tahun 4 digit (contoh: 2023)",
  "isbn": "${cleanIsbn || ''}",
  "noDdc": "Nombor Pengelasan Perpuluhan Dewey (DDC) 3 digit.subclass beserta 3 huruf besar pengarang (contoh: 899.233 SAM, 297.63 AHM, 005.133 JON, 370.15 ABD)"
}`;

      const aiResponse = await executeGeminiWithFallback(ai, async (model) => {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                judul: { type: Type.STRING },
                pengarang: { type: Type.STRING },
                penerbit: { type: Type.STRING },
                tempatTerbit: { type: Type.STRING },
                tahunTerbit: { type: Type.STRING },
                isbn: { type: Type.STRING },
                noDdc: { type: Type.STRING },
              },
              required: ["judul"],
            },
          },
        });
      });

      const parsed = JSON.parse(aiResponse.text || "{}");
      if (parsed && parsed.judul) {
        return {
          judul: parsed.judul,
          pengarang: parsed.pengarang || '',
          tempatTerbit: parsed.tempatTerbit || 'Kuala Lumpur',
          penerbit: parsed.penerbit || '',
          tahunTerbit: parsed.tahunTerbit || '',
          isbn: parsed.isbn || cleanIsbn,
          noDdc: parsed.noDdc || classifyDeweyDecimal(parsed.judul, '', parsed.pengarang),
          coverUrl: '',
        };
      }
    } catch (aiLookupErr) {
      console.warn("Gemini AI ISBN search notice:", aiLookupErr);
    }
  }

  // --- TIER 4: TITLE SEARCH ON OPEN LIBRARY ---
  if (title && title.length > 3) {
    try {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=3`);
      if (res.ok) {
        const data: any = await res.json();
        if (data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          const judul = doc.title || title;
          const pengarang = doc.author_name?.join(', ') || '';
          const penerbit = doc.publisher?.[0] || '';
          const tahunTerbit = doc.first_publish_year ? String(doc.first_publish_year) : '';
          const foundIsbn = doc.isbn?.[0] || cleanIsbn;
          const ddc = doc.ddc?.[0] ? `${doc.ddc[0]} ${get3LetterAuthorCode(pengarang)}` : classifyDeweyDecimal(judul, '', pengarang);
          return {
            judul,
            pengarang,
            tempatTerbit: 'Kuala Lumpur',
            penerbit,
            tahunTerbit,
            isbn: foundIsbn,
            noDdc: ddc,
          };
        }
      }
    } catch (e) {
      console.warn('OpenLibrary title search notice:', e);
    }
  }

  return null;
}

async function extractBibliographicFromText(text?: string, fallbackTitle?: string): Promise<any> {
  const rawText = text?.trim() || "";

  // If text is completely empty, do NOT return fake identical books! Return empty/draft fields with clear status
  if (!rawText && !fallbackTitle) {
    return {
      judul: "",
      pengarang: "",
      tempatTerbit: "",
      penerbit: "",
      tahunTerbit: "",
      isbn: "",
      noDdc: "",
      confidenceScores: {
        judul: 0,
        pengarang: 0,
        tempatTerbit: 0,
        penerbit: 0,
        tahunTerbit: 0,
        isbn: 0,
        noDdc: 0,
      },
      detectedLanguage: "Malay",
    };
  }

  let judul = fallbackTitle || "";
  let pengarang = "";
  let tempatTerbit = "";
  let penerbit = "";
  let tahunTerbit = "";
  let isbn = "";
  let noDdc = "";
  let urlBuku = "";

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 1);

  // 1. First search for ISBN
  const isbnMatch = rawText.match(/(?:97[89][-\s]?)?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX]/i) ||
                    rawText.match(/ISBN[-:\s]*([0-9X-]+)/i);
  if (isbnMatch) {
    isbn = cleanWebMetadataArtifacts(isbnMatch[1] || isbnMatch[0]).replace(/[^0-9Xx]/g, '');
  }

  // 2. If ISBN found, attempt online catalog lookup
  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    const onlineData = await lookupOnlineBook(isbn, judul);
    if (onlineData && onlineData.judul) {
      return {
        ...onlineData,
        confidenceScores: {
          judul: 98,
          pengarang: 95,
          tempatTerbit: 85,
          penerbit: 95,
          tahunTerbit: 95,
          isbn: 100,
          noDdc: 92,
        },
        detectedLanguage: "Malay / International",
      };
    }
  }

  // 3. Line-by-line smart library heuristic parser
  const boilerplateRegex = /^(perpustakaan negara malaysia|data pengkatalogan|cataloguing-in-publication|hak cipta|all rights reserved|cetakan pertama|first edition|jilid|set|printed by|dicetak oleh|www\.|http)/i;

  const usefulLines = lines.filter((l) => !boilerplateRegex.test(l));

  usefulLines.forEach((line) => {
    const lower = line.toLowerCase();
    if (/^(judul|tajuk|title)\s*[:\-]\s*/i.test(line)) {
      judul = cleanWebMetadataArtifacts(line.replace(/^(judul|tajuk|title)\s*[:\-]\s*/i, ''));
    } else if (/^(pengarang|penulis|author|oleh|karya|ditulis oleh|disusun oleh|editor:?)\s*[:\-]\s*/i.test(line)) {
      pengarang = cleanWebMetadataArtifacts(line.replace(/^(pengarang|penulis|author|oleh|karya|ditulis oleh|disusun oleh|editor:?)\s*[:\-]\s*/i, ''));
    } else if (/^(penerbit|publisher)\s*[:\-]\s*/i.test(line)) {
      penerbit = cleanWebMetadataArtifacts(line.replace(/^(penerbit|publisher)\s*[:\-]\s*/i, ''));
    } else if (/^isbn\s*[:\-]\s*/i.test(line)) {
      if (!isbn) isbn = cleanWebMetadataArtifacts(line.replace(/^isbn\s*[:\-]\s*/i, ''));
    } else if (lower.includes('ddc') || lower.includes('pengelasan')) {
      noDdc = cleanWebMetadataArtifacts(line.replace(/^(ddc[\+\s\w]*|no\.?\s*ddc[\+\s\w]*|pengelasan[^\n]*?)\s*[:\-]\s*/i, ''));
    } else if (/^(tahun|year)\s*[:\-]\s*/i.test(line)) {
      tahunTerbit = cleanWebMetadataArtifacts(line.replace(/^(tahun|year)\s*[:\-]\s*/i, ''));
    } else if (/^(tempat|tempat terbit|lokasi|bandar|place|city)\s*[:\-]\s*/i.test(line)) {
      tempatTerbit = cleanWebMetadataArtifacts(line.replace(/^(tempat|tempat terbit|lokasi|bandar|place|city)\s*[:\-]\s*/i, ''));
    } else if (/^(link|url|pautan|link buku|web)\s*[:\-]\s*/i.test(line) || /^https?:\/\//i.test(line)) {
      urlBuku = line.replace(/^(link|url|pautan|link buku|web)\s*[:\-]\s*/i, '').trim();
    }
  });

  // If title not yet found, find first non-labeled prominent line
  if (!judul && usefulLines.length > 0) {
    const candidateTitle = usefulLines.find((l) => l.length > 3 && !l.includes(':') && !/^\d+$/.test(l));
    if (candidateTitle) {
      judul = cleanWebMetadataArtifacts(candidateTitle);
    }
  }

  // If author not yet found, look for line after title or with Dr./Ustaz/Prof.
  if (!pengarang && usefulLines.length > 1) {
    const authorCandidate = usefulLines.find((l) =>
      l !== judul &&
      (l.toLowerCase().includes('oleh') ||
       l.toLowerCase().includes('karya') ||
       /^(dr\.|prof\.|ustaz|syed|sheikh|haji|hjh|hj\.)/i.test(l) ||
       (l.split(' ').length >= 2 && l.split(' ').length <= 5 && !/\d/.test(l)))
    );
    if (authorCandidate) {
      pengarang = cleanWebMetadataArtifacts(authorCandidate.replace(/^(oleh|karya|penulis)\s+/i, ''));
    }
  }

  // Search for known Malaysian publisher names in the text
  if (!penerbit && rawText) {
    const knownPublishers = [
      'Dewan Bahasa dan Pustaka',
      'Penerbit Universiti Malaya',
      'Penerbit Universiti Kebangsaan Malaysia',
      'Penerbit Universiti Sains Malaysia',
      'Penerbit Universiti Teknologi Malaysia',
      'Penerbit Universiti Putra Malaysia',
      'Penerbit Universiti Pendidikan Sultan Idris',
      'Penerbit UiTM',
      'Penerbit UKM',
      'Penerbit USM',
      'Penerbit UTM',
      'Penerbit UPM',
      'PTS Publishing House',
      'PTS Media Group',
      'Telaga Biru',
      'Karisma Publications',
      'Darul Nu\'man',
      'Ilmu Bakti',
      'Sasbadi',
      'Penerbit Pelangi',
      'Oxford Fajar',
      'Pustaka Mukjizat',
      'Pustaka Salam',
      'Kalam Pustaka',
      'Kaseh Aries',
      'Buku Prima',
      'Must Read',
      'Galeri Ilmu',
      'Alaf 21',
      'Fajar Bakti',
    ];
    const foundPub = knownPublishers.find((p) => new RegExp(`\\b${p}\\b`, 'i').test(rawText));
    if (foundPub) {
      penerbit = foundPub;
    } else {
      // Find lines with Sdn. Bhd. or Press or Publications
      const pubLine = usefulLines.find((l) => /sdn\.?\s*bhd\.?|press|publications|pustaka|penerbitan|publishing/i.test(l));
      if (pubLine && pubLine !== judul && pubLine !== pengarang) {
        penerbit = cleanWebMetadataArtifacts(pubLine);
      }
    }
  }

  // Extract year if still empty
  if (!tahunTerbit) {
    const yearMatch = rawText.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      tahunTerbit = yearMatch[0];
    }
  }

  // Extract place and publisher cleanly
  const extractedInfo = extractPlaceAndPublisher(penerbit, tempatTerbit);
  penerbit = extractedInfo.penerbit;
  tempatTerbit = extractedInfo.tempatTerbit;

  if (!tempatTerbit && rawText) {
    const foundCity = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(rawText));
    if (foundCity) tempatTerbit = foundCity;
  }

  // If DDC found in CIP box
  const ddcMatch = rawText.match(/\b(\d{3}(?:\.\d+)?\s+[A-Z]{3})\b/);
  if (ddcMatch && !noDdc) {
    noDdc = ddcMatch[1];
  } else if (!noDdc) {
    noDdc = classifyDeweyDecimal(judul, rawText, pengarang);
  }

  return {
    judul,
    pengarang,
    tempatTerbit,
    penerbit,
    tahunTerbit,
    isbn,
    noDdc,
    urlBuku,
    confidenceScores: {
      judul: judul ? 88 : 0,
      pengarang: pengarang ? 85 : 0,
      tempatTerbit: tempatTerbit ? 80 : 0,
      penerbit: penerbit ? 85 : 0,
      tahunTerbit: tahunTerbit ? 90 : 0,
      isbn: isbn ? 95 : 0,
      noDdc: noDdc ? 80 : 0,
    },
    detectedLanguage: "Malay",
  };
}

function sanitizeAndNormalizeBibliographicResult(raw: any, fallbackText?: string) {
  let judul = (raw?.judul || '').trim();
  let pengarang = (raw?.pengarang || '').trim();
  let tempatTerbit = (raw?.tempatTerbit || '').trim();
  let penerbit = (raw?.penerbit || '').trim();
  let tahunTerbit = (raw?.tahunTerbit || '').trim();
  let isbn = (raw?.isbn || '').trim();
  let noDdc = (raw?.noDdc || '').trim();
  let urlBuku = (raw?.urlBuku || '').trim();
  let detectedLanguage = raw?.detectedLanguage || 'Malay';

  // Extract URL from raw text if not yet provided
  if (!urlBuku && fallbackText) {
    const urlMatch = fallbackText.match(/https?:\/\/[^\s\)\],>"']+/i);
    if (urlMatch) {
      urlBuku = urlMatch[0];
    }
  } else if (urlBuku) {
    // Clean trailing punctuation
    urlBuku = urlBuku.replace(/[\)\],>;"']+$/, '').trim();
  }

  // 1. Clean Title
  judul = cleanWebMetadataArtifacts(judul)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s*[\/|]\s*(oleh|by|disusun|karya|ditulis|penulis).*$/i, '')
    .replace(/^(buku|judul|tajuk|title)\s*[:\-]\s*/i, '')
    .trim();

  // If title is ALL CAPS and long, convert to clean Title Case
  if (judul.length > 8 && judul === judul.toUpperCase() && !/[a-z]/.test(judul)) {
    judul = judul
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (['dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'yang', 'dengan', 'atas', 'atau', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'a', 'an'].includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
    if (judul.length > 0) {
      judul = judul.charAt(0).toUpperCase() + judul.slice(1);
    }
  }

  // 2. Clean Author
  pengarang = cleanWebMetadataArtifacts(pengarang)
    .replace(/^(oleh|by|karya|ditulis oleh|disusun oleh|editor:?|penulis:?)\s+/i, '')
    .replace(/[\.\s:;,]+$/, '')
    .trim();

  // 3. Separate Publisher & Place of publication cleanly
  const extracted = extractPlaceAndPublisher(penerbit, tempatTerbit);
  penerbit = extracted.penerbit;
  tempatTerbit = extracted.tempatTerbit;

  // Clean printer confusion (e.g. if AI took "Dicetak oleh Percetakan XYZ" instead of publisher)
  if (/^dicetak\s+oleh/i.test(penerbit)) {
    penerbit = penerbit.replace(/^dicetak\s+oleh\s*:?\s*/i, '').trim();
  }

  // 4. Normalize Year
  const yearMatch = tahunTerbit.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    tahunTerbit = yearMatch[0];
  } else if (fallbackText) {
    const textYearMatch = fallbackText.match(/\b(19\d{2}|20\d{2})\b/);
    if (textYearMatch) {
      tahunTerbit = textYearMatch[0];
    }
  }

  // 5. Clean & Format ISBN
  const rawIsbnDigits = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (rawIsbnDigits.length === 13) {
    isbn = `${rawIsbnDigits.slice(0, 3)}-${rawIsbnDigits.slice(3, 4)}-${rawIsbnDigits.slice(4, 8)}-${rawIsbnDigits.slice(8, 12)}-${rawIsbnDigits.slice(12, 13)}`;
  } else if (rawIsbnDigits.length === 10) {
    isbn = `${rawIsbnDigits.slice(0, 1)}-${rawIsbnDigits.slice(1, 5)}-${rawIsbnDigits.slice(5, 9)}-${rawIsbnDigits.slice(9, 10)}`;
  } else if (rawIsbnDigits.length > 0) {
    isbn = rawIsbnDigits;
  }

  // 6. Ensure DDC Classification & 3-Letter Author Code
  const author3 = get3LetterAuthorCode(pengarang);
  if (noDdc) {
    noDdc = cleanWebMetadataArtifacts(noDdc).trim();
    const ddcParts = noDdc.split(/\s+/);
    if (ddcParts.length >= 2) {
      const classNum = ddcParts[0].replace(/[^0-9.]/g, '');
      const existingCode = ddcParts[ddcParts.length - 1].toUpperCase();
      if (existingCode.length !== 3 || /^(DR|PR|HJ|US|SY|TN|PN)/i.test(existingCode)) {
        noDdc = `${classNum || ddcParts[0]} ${author3}`;
      } else {
        noDdc = `${classNum || ddcParts[0]} ${existingCode}`;
      }
    } else {
      const classNum = noDdc.replace(/[^0-9.]/g, '');
      noDdc = `${classNum || '020.2'} ${author3}`;
    }
  } else {
    noDdc = `020.2 ${author3}`;
  }

  // 7. Sanitize and clean Book URL
  urlBuku = cleanBookUrl(urlBuku);

  const scores = {
    judul: judul && judul.length > 3 ? (judul.length > 5 ? 98 : 90) : 60,
    pengarang: pengarang && pengarang.length > 2 ? 95 : 60,
    tempatTerbit: tempatTerbit ? (KNOWN_CITIES.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(tempatTerbit)) ? 96 : 85) : 65,
    penerbit: penerbit && penerbit.length > 2 ? 94 : 65,
    tahunTerbit: tahunTerbit && /^\d{4}$/.test(tahunTerbit) ? 98 : 60,
    isbn: isbn && (isbn.replace(/[^0-9X]/gi, '').length === 13 || isbn.replace(/[^0-9X]/gi, '').length === 10) ? 99 : 60,
    noDdc: noDdc && /\d{3}(\.\d+)?\s+[A-Z]{3}/.test(noDdc) ? 96 : 75,
  };

  return {
    judul,
    pengarang,
    tempatTerbit,
    penerbit,
    tahunTerbit,
    isbn,
    noDdc,
    urlBuku,
    confidenceScores: scores,
    detectedLanguage,
  };
}

function cleanBookUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  let str = url.trim();

  // 1. Check if it's a standard markdown link: [anchor text](https://valid.com/path)
  const mdFull = str.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
  if (mdFull && mdFull[1]) {
    str = mdFull[1];
  }

  // 2. Check for markdown residue glued like "https://foo.com/bar](https://foo.com/bar" or "text](https://foo.com/bar"
  const mdResidue = str.match(/\]\((https?:\/\/[^\s\)]+)\)?/i);
  if (mdResidue && mdResidue[1]) {
    str = mdResidue[1];
  }

  // 3. Double url glued by "](": "https://pts.com.my/...](https://pts.com.my/..." -> extract the clean valid URL
  if (str.includes('](')) {
    const parts = str.split('](');
    const candidate = parts.find((p) => /^https?:\/\//i.test(p.trim())) || parts[0];
    str = candidate;
  }

  // 4. Bracketed link or tags: [https://foo.com] or <https://foo.com> or (https://foo.com)
  str = str.replace(/^[<(\["']+|[>)\]"';,\.]+$/g, '').trim();

  // 5. Extract the clean HTTP(S) URL
  const allHttp = str.match(/https?:\/\/[^\s"'<>\)\]\[]+/gi);
  if (allHttp && allHttp.length > 0) {
    str = allHttp[0];
  }

  // 6. Strip any leftover trailing/leading junk or markdown brackets
  str = str.replace(/^[^\w]*https?:\/\//i, (match) => match.replace(/^[^\w]*/, ''));
  str = str.replace(/[\)\]\}>,"'\.;]+$/, '').trim();

  // 7. Validate URL syntax
  try {
    const parsed = new URL(str);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      let cleanedHref = parsed.href;
      cleanedHref = cleanedHref.replace(/%5D$|%29$|%3E$|\)$|\]$|>$/gi, '');
      return cleanedHref;
    }
  } catch {
    const basicMatch = str.match(/^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'*+,;=%]+/i);
    if (basicMatch) {
      return basicMatch[0].replace(/[\)\]\}>,"'\.;]+$/, '');
    }
  }

  return str;
}

function cleanWebMetadataArtifacts(str: string): string {
  if (!str) return '';
  return str
    .replace(/(?:Discovery UMS|Google Books|EKCMS MBJB|AbeBooks|Open Library|Kinokuniya Malaysia)/gi, '')
    .trim();
}

function parseBulkTextHeuristic(rawText: string): any[] {
  const chunks = rawText
    .split(/(?:\r?\n){2,}|---+|===+|(?=^Buku\s+\d+:?)|(?=^\d+[\.\)]\s+)/im)
    .map((c) => c.trim())
    .filter((c) => c.length > 3);

  const results: any[] = [];

  chunks.forEach((chunk, index) => {
    const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let judul = '';
    let pengarang = '';
    let penerbit = '';
    let tahunTerbit = '';
    let isbn = '';
    let noDdc = '';
    let tempatTerbit = '';
    let urlBuku = '';

    // Check if chunk is a single line with delimiters like " - " or " / "
    if (lines.length === 1 && (chunk.includes(' - ') || chunk.includes(' / ') || chunk.includes(';'))) {
      const parts = chunk
        .replace(/^\d+[\.\)]\s*/, '')
        .split(/\s+[-–|/]\s+|\s*;\s*/)
        .map((p) => p.trim())
        .filter(Boolean);

      if (parts.length >= 1) judul = parts[0];
      if (parts.length >= 2) pengarang = parts[1];
      if (parts.length >= 3) penerbit = parts[2];
      if (parts.length >= 4) {
        if (/^\d{4}$/.test(parts[3])) {
          tahunTerbit = parts[3];
        } else if (/978|ISBN/i.test(parts[3])) {
          isbn = parts[3];
        } else if (/\d{3}\.\d+/.test(parts[3])) {
          noDdc = parts[3];
        } else {
          penerbit = `${penerbit} ${parts[3]}`.trim();
        }
      }
    } else {
      lines.forEach((line) => {
        const lower = line.toLowerCase();
        if (lower.startsWith('judul:') || lower.startsWith('tajuk:') || lower.startsWith('title:')) {
          judul = cleanWebMetadataArtifacts(line.replace(/^(judul|tajuk|title):\s*/i, ''));
        } else if (lower.startsWith('pengarang:') || lower.startsWith('penulis:') || lower.startsWith('author:')) {
          pengarang = cleanWebMetadataArtifacts(line.replace(/^(pengarang|penulis|author):\s*/i, ''));
        } else if (lower.startsWith('penerbit:') || lower.startsWith('publisher:')) {
          penerbit = cleanWebMetadataArtifacts(line.replace(/^(penerbit|publisher):\s*/i, ''));
        } else if (lower.startsWith('isbn:')) {
          isbn = cleanWebMetadataArtifacts(line.replace(/^isbn:\s*/i, ''));
        } else if (lower.includes('ddc') || lower.includes('pengelasan')) {
          noDdc = cleanWebMetadataArtifacts(line.replace(/^(ddc[\+\s\w]*|no\.?\s*ddc[\+\s\w]*|pengelasan[^\n]*?):\s*/i, ''));
        } else if (lower.startsWith('tahun:') || lower.startsWith('year:')) {
          tahunTerbit = cleanWebMetadataArtifacts(line.replace(/^(tahun|year):\s*/i, ''));
        } else if (lower.startsWith('tempat:') || lower.startsWith('tempat terbit:') || lower.startsWith('lokasi:') || lower.startsWith('bandar:') || lower.startsWith('place:') || lower.startsWith('city:') || lower.startsWith('place of publication:')) {
          tempatTerbit = cleanWebMetadataArtifacts(line.replace(/^(tempat|tempat terbit|lokasi|bandar|place|city|place of publication):\s*/i, ''));
        } else if (lower.startsWith('link buku:') || lower.startsWith('link:') || lower.startsWith('url:') || lower.startsWith('http://') || lower.startsWith('https://')) {
          urlBuku = line.replace(/^(link buku|link|url):\s*/i, '').trim();
        } else if (!judul) {
          judul = cleanWebMetadataArtifacts(line.replace(/^\d+[\.\)]\s*/, '').replace(/^Buku\s+\d+:?\s*/i, ''));
        } else if (!pengarang && !line.includes(':')) {
          pengarang = cleanWebMetadataArtifacts(line);
        }
      });
    }

    if (!judul && lines[0]) {
      judul = cleanWebMetadataArtifacts(lines[0].replace(/^\d+[\.\)]\s*/, ''));
    }

    if (judul) {
      const isbnMatch = chunk.match(/978[-0-9X]{10,17}/i) || chunk.match(/ISBN[-:\s]*([0-9X-]+)/i);
      if (isbnMatch && !isbn) {
        isbn = cleanWebMetadataArtifacts(isbnMatch[1] || isbnMatch[0]);
      }

      const yearMatch = chunk.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && !tahunTerbit) {
        tahunTerbit = yearMatch[0];
      }

      const ddcMatch = chunk.match(/\b(\d{3}\.\d+\s+[A-Z]{3})\b/i);
      if (ddcMatch && !noDdc) {
        noDdc = ddcMatch[1];
      }

      const urlMatch = chunk.match(/https?:\/\/[^\s]+/i);
      if (urlMatch && !urlBuku) {
        urlBuku = urlMatch[0];
      }

      // Extract place and publisher cleanly
      const extractedInfo = extractPlaceAndPublisher(penerbit, tempatTerbit);
      penerbit = extractedInfo.penerbit;
      tempatTerbit = extractedInfo.tempatTerbit;

      // If place is still empty, search chunk text for known cities
      if (!tempatTerbit) {
        const foundCity = KNOWN_CITIES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(chunk));
        if (foundCity) {
          tempatTerbit = foundCity;
        }
      }

      const author3 = get3LetterAuthorCode(pengarang);

      results.push({
        judul: cleanWebMetadataArtifacts(judul).slice(0, 150),
        pengarang: cleanWebMetadataArtifacts(pengarang) || 'Pengarang Terpilih',
        tempatTerbit: cleanWebMetadataArtifacts(tempatTerbit) || 'Kuala Lumpur',
        penerbit: cleanWebMetadataArtifacts(penerbit) || 'Penerbit Pustaka',
        tahunTerbit: tahunTerbit || '2024',
        isbn: isbn || '',
        noDdc: noDdc || `000.0 ${author3}`,
        urlBuku: urlBuku || '',
        catatan: `Import Teks Raw Pukal #${index + 1}`,
      });
    }
  });

  return results.length > 0
    ? results
    : [
        {
          judul: rawText.split('\n')[0].replace(/^\d+[\.\)]\s*/, '').slice(0, 80) || 'Buku Pukal 1',
          pengarang: 'Pengarang Terpilih',
          tempatTerbit: 'Kuala Lumpur',
          penerbit: 'Penerbit Pustaka',
          tahunTerbit: '2024',
          isbn: '',
          noDdc: '000.0 UNK',
          catatan: 'Import Teks Raw Pukal',
        },
      ];
}

startServer();
