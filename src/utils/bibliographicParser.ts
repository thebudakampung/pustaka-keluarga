// Comprehensive bibliographic extraction engine (Pustaka Tempatan - Tanpa Gemini API)

export interface ParsedBookItem {
  judul: string;
  pengarang: string;
  tempatTerbit: string;
  penerbit: string;
  tahunTerbit: string;
  isbn: string;
  noDdc: string;
  urlBuku: string;
  catatan: string;
  confidenceScores?: Record<string, number>;
}

const KNOWN_MALAYSIAN_CITIES = [
  'Kuala Lumpur', 'Shah Alam', 'Petaling Jaya', 'Bangi', 'Batu Caves', 'Subang Jaya',
  'Putrajaya', 'Cyberjaya', 'Klang', 'Kajang', 'Serdang', 'Rawang', 'Ampang',
  'Johor Bahru', 'Skudai', 'Batu Pahat', 'Muar', 'Kluang', 'Kota Tinggi', 'Segamat',
  'George Town', 'Georgetown', 'Pulau Pinang', 'Penang', 'Butterworth', 'Bukit Mertajam',
  'Ipoh', 'Taiping', 'Tanjung Malim', 'Teluk Intan', 'Kuala Kangsar', 'Sitiawan',
  'Alor Setar', 'Sintok', 'Sungai Petani', 'Kulim', 'Langkawi', 'Jitra',
  'Kota Bharu', 'Kubang Kerian', 'Bachok', 'Pasir Mas', 'Tumpat', 'Tanah Merah',
  'Kuala Terengganu', 'Gong Badak', 'Dungun', 'Kemaman', 'Besut', 'Chukai',
  'Kuantan', 'Pekan', 'Temerloh', 'Bentong', 'Raub', 'Gambang',
  'Seremban', 'Nilai', 'Port Dickson', 'Rembau', 'Kuala Pilah',
  'Melaka', 'Bandaraya Melaka', 'Ayer Keroh', 'Alor Gajah', 'Jasin',
  'Kangar', 'Arau', 'Padang Besar',
  'Kuching', 'Kota Samarahan', 'Miri', 'Sibu', 'Bintulu',
  'Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Keningau', 'Labuan',
  'Singapore', 'Singapura', 'Jakarta', 'Bandung', 'Yogyakarta', 'Surabaya', 'Brunei', 'Bandar Seri Begawan',
  'London', 'New York', 'Boston', 'Oxford', 'Cambridge', 'Princeton', 'Chicago', 'San Francisco', 'Amsterdam', 'Cairo', 'Riyadh', 'Makkah', 'Madinah', 'Beirut', 'Amman'
];

const KNOWN_PUBLISHERS = [
  'Dewan Bahasa dan Pustaka', 'DBP',
  'Penerbit Universiti Malaya', 'Penerbit UM',
  'Penerbit Universiti Kebangsaan Malaysia', 'Penerbit UKM',
  'Penerbit Universiti Sains Malaysia', 'Penerbit USM',
  'Penerbit Universiti Teknologi Malaysia', 'Penerbit UTM',
  'Penerbit Universiti Putra Malaysia', 'Penerbit UPM',
  'Penerbit Universiti Pendidikan Sultan Idris', 'Penerbit UPSI',
  'Penerbit Universiti Teknologi MARA', 'Penerbit UiTM', 'UiTM Press',
  'Penerbit Universiti Utara Malaysia', 'UUM Press',
  'Penerbit Universiti Islam Antarabangsa Malaysia', 'IIUM Press',
  'Penerbit Universiti Malaysia Sabah', 'UMS Press',
  'Penerbit Universiti Malaysia Sarawak', 'UNIMAS Publisher',
  'Penerbit Universiti Tun Hussein Onn Malaysia', 'UTHM Publisher',
  'Penerbit Universiti Teknikal Malaysia Melaka', 'UTeM Press',
  'Penerbit Universiti Malaysia Terengganu', 'UMT Publisher',
  'Penerbit Universiti Sains Islam Malaysia', 'USIM Publisher',
  'PTS Publishing House', 'PTS Media Group', 'PTS Darul Furqan', 'PTS Millennia', 'PTS Islamika', 'PTS Professional',
  'Kumpulan Media Karangkraf', 'Alaf 21', 'Buku Prima', 'Karya Bestari',
  'Telaga Biru', 'Telaga Biru Sdn Bhd',
  'Galeri Ilmu', 'Galeri Ilmu Media Group',
  'Must Read', 'Must Read Sdn Bhd',
  'Buku Fixi', 'Fixi',
  'Karisma Publications',
  'Pustaka Salam', 'Pustaka Mukjizat', 'Kalam Pustaka', 'Darul Nu\'man', 'Darul Numan',
  'Ilmu Bakti', 'Penerbitan Pelangi', 'Pelangi', 'Sasbadi', 'Oxford Fajar', 'Fajar Bakti', 'Pan Asia Publications',
  'Kaseh Aries', 'Penulisan2u', 'Fajar Pakeer', 'Love Novel',
  'Institut Terjemahan & Buku Malaysia', 'ITBM', 'ITNM',
  'Pustaka Warisan', 'Pustaka Antara', 'Marwilis Publisher', 'Pustaka Melayu',
  'O\'Reilly', 'Pearson', 'McGraw-Hill', 'Wiley', 'Routledge', 'Springer', 'Cambridge University Press', 'Oxford University Press', 'MIT Press', 'Elsevier'
];

export function get3LetterAuthorCode(author: string | undefined | null): string {
  if (!author || !author.trim()) return 'UNK';
  let name = author.trim();

  // Remove common author prefix words
  name = name.replace(/^(oleh|by|diselenggarakan oleh|disusun oleh|editor:?|penulis:?|karya)\s+/i, '').trim();

  // Remove titles
  const titleRegex = /^(prof\.?(esor)?|dr\.?|drs\.?|drh\.?|ph\.?d\.?|m\.?a\.?|haji|hj\.?|hajah|hjh\.?|ustaz|ustazah|ust\.?|sayyid|syed|sharifah|syarifah|sheikh|syeikh|syaikh|shaykh|ir\.?|ts\.?|sr\.?|dato'?|datuk|datin|tan sri|puan sri|tun|toh puan|tunku|tengku|raja|engku|ungku|nik|wan|megat|puteri|tuan guru|tg\.?|tuan|puan|encik|cik|sir|lord|lady|dame|maulana|kiyai|kyai|k\.?h\.?|kh\.?|imam|mufti)\b[\.\s]*/i;
  let prev = '';
  while (name !== prev) {
    prev = name;
    name = name.replace(titleRegex, '').trim();
  }

  const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'UNK';

  const targetWord = words.find((w) => w.length >= 3) || words[0];
  if (targetWord.length >= 3) {
    return targetWord.substring(0, 3).toUpperCase();
  }
  const combined = words.join('');
  if (combined.length >= 3) {
    return combined.substring(0, 3).toUpperCase();
  }
  return combined.padEnd(3, 'X').toUpperCase();
}

export function classifyDeweyDecimal(title: string, contextText: string = '', authorName: string = ''): string {
  const combined = `${title} ${contextText}`.toLowerCase();
  const author3 = get3LetterAuthorCode(authorName);
  let ddcNum = '020.2';

  if (/agama|islam|solat|hadis|hadith|quran|al-quran|surah|fiqh|feqah|tauhid|akidah|sirah|rasulullah|tasawuf|dakwah|doa|zikir|puasa|zakat|haji|syariah|fatwa|sunnah|akhlak|tasawwuf/i.test(combined)) {
    if (/sirah|rasulullah|nabi/i.test(combined)) ddcNum = '297.63';
    else if (/hadis|hadith/i.test(combined)) ddcNum = '297.125';
    else if (/quran|al-quran|tafsir/i.test(combined)) ddcNum = '297.122';
    else if (/fiqh|feqah|hukum|syariah|solat|puasa|zakat|haji/i.test(combined)) ddcNum = '297.5';
    else if (/akidah|tauhid|iman/i.test(combined)) ddcNum = '297.2';
    else ddcNum = '297';
  } else if (/novel|cerpen|puisi|sajak|pantun|drama|sastera|komsas|antologi|teater|cerita|hikayat/i.test(combined)) {
    ddcNum = '899.233';
  } else if (/bahasa|kamus|tatabahasa|morfologi|sintaksis|linguistik|peribahasa|idiom/i.test(combined)) {
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

export function formatCleanIsbn(rawIsbn: string): string {
  const digits = rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (digits.length === 13) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 13)}`;
  } else if (digits.length === 10) {
    return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 9)}-${digits.slice(9, 10)}`;
  }
  return digits;
}

export function cleanBookUrl(url: string | undefined | null): string {
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

  // 5. Extract the first or last clean HTTP(S) URL
  const allHttp = str.match(/https?:\/\/[^\s"'<>\)\]\[]+/gi);
  if (allHttp && allHttp.length > 0) {
    str = allHttp[0];
  }

  // 6. Strip any leftover trailing/leading junk or markdown brackets
  str = str.replace(/^[^\w]*https?:\/\//i, (match) => match.replace(/^[^\w]*/, ''));
  str = str.replace(/[\)\]\}>,"'\.;]+$/, '').trim();

  // 7. Test URL validity
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

export function cleanUrl(url: string): string {
  return cleanBookUrl(url);
}

/**
 * Extracts a single book record from a text snippet without calling Gemini API
 */
export function extractSingleBookFromSnippet(snippet: string, defaultTitle: string = ''): ParsedBookItem {
  const rawText = snippet.trim();
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let judul = defaultTitle || '';
  let pengarang = '';
  let tempatTerbit = '';
  let penerbit = '';
  let tahunTerbit = '';
  let isbn = '';
  let noDdc = '';
  let urlBuku = '';
  let catatan = '';

  // 1. Direct URL detection anywhere in text
  const urlMatch = rawText.match(/https?:\/\/[^\s\)\],>"']+/i);
  if (urlMatch) {
    urlBuku = cleanUrl(urlMatch[0]);
  }

  // 2. Direct ISBN detection
  const isbnMatch = rawText.match(/ISBN[-:\s]*([0-9X-]{10,20})/i) ||
                    rawText.match(/(?:97[89][-\s]?)?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX]/i);
  if (isbnMatch) {
    const rawVal = isbnMatch[1] || isbnMatch[0];
    const cleanDigs = rawVal.replace(/[^0-9Xx]/g, '');
    if (cleanDigs.length === 10 || cleanDigs.length === 13) {
      isbn = formatCleanIsbn(cleanDigs);
    }
  }

  // 3. Direct Year detection
  const yearMatch = rawText.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    tahunTerbit = yearMatch[0];
  }

  // 4. Line by line key-value or positional parsing
  lines.forEach((line) => {
    const lower = line.toLowerCase();

    // Check URL prefixes
    if (/^(?:link\s*buku|link|url|pautan|web|laman\s*web)\s*[:=]\s*/i.test(line)) {
      const u = line.replace(/^(?:link\s*buku|link|url|pautan|web|laman\s*web)\s*[:=]\s*/i, '');
      urlBuku = cleanUrl(u);
    }
    // Check Judul / Title prefixes
    else if (/^(?:judul|tajuk|title|nama\s*buku|book\s*title)\s*[:=]\s*/i.test(line)) {
      judul = line.replace(/^(?:judul|tajuk|title|nama\s*buku|book\s*title)\s*[:=]\s*/i, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    }
    // Check Pengarang / Author prefixes
    else if (/^(?:pengarang|penulis|author|oleh|karya|ditulis\s*oleh|disusun\s*oleh|editor)\s*[:=]\s*/i.test(line)) {
      pengarang = line.replace(/^(?:pengarang|penulis|author|oleh|karya|ditulis\s*oleh|disusun\s*oleh|editor)\s*[:=]\s*/i, '').trim();
    }
    // Check Penerbit / Publisher prefixes
    else if (/^(?:penerbit|publisher|publishing|diterbitkan\s*oleh|cetakan)\s*[:=]\s*/i.test(line)) {
      penerbit = line.replace(/^(?:penerbit|publisher|publishing|diterbitkan\s*oleh|cetakan)\s*[:=]\s*/i, '').trim();
    }
    // Check Tempat Terbit / City prefixes
    else if (/^(?:tempat|tempat\s*terbit|lokasi|bandar|place|city|place\s*of\s*publication)\s*[:=]\s*/i.test(line)) {
      tempatTerbit = line.replace(/^(?:tempat|tempat\s*terbit|lokasi|bandar|place|city|place\s*of\s*publication)\s*[:=]\s*/i, '').trim();
    }
    // Check Tahun / Year prefixes
    else if (/^(?:tahun|tahun\s*terbit|year|published\s*year|tarikh\s*terbit)\s*[:=]\s*/i.test(line)) {
      const y = line.replace(/^(?:tahun|tahun\s*terbit|year|published\s*year|tarikh\s*terbit)\s*[:=]\s*/i, '').trim();
      const m = y.match(/\b(19\d{2}|20\d{2})\b/);
      if (m) tahunTerbit = m[0];
    }
    // Check ISBN prefixes
    else if (/^(?:isbn(?:-1[03])?|no\.?\s*isbn)\s*[:=]\s*/i.test(line)) {
      const isb = line.replace(/^(?:isbn(?:-1[03])?|no\.?\s*isbn)\s*[:=]\s*/i, '').trim();
      if (isb) isbn = formatCleanIsbn(isb);
    }
    // Check DDC prefixes
    else if (/^(?:no\.?\s*ddc|ddc|pengelasan|dewey|panggilan|call\s*no|classification)\s*[:=]\s*/i.test(line)) {
      noDdc = line.replace(/^(?:no\.?\s*ddc|ddc|pengelasan|dewey|panggilan|call\s*no|classification)\s*[:=]\s*/i, '').trim();
    }
    // Check Catatan / Notes prefixes
    else if (/^(?:catatan|nota|remark|note|keterangan)\s*[:=]\s*/i.test(line)) {
      catatan = line.replace(/^(?:catatan|nota|remark|note|keterangan)\s*[:=]\s*/i, '').trim();
    }
  });

  // If title is still missing, take the first non-key, non-URL line
  if (!judul && lines.length > 0) {
    const candidate = lines.find((l) => !l.startsWith('http') && !l.includes(':') && l.length > 2);
    if (candidate) {
      judul = candidate.replace(/^\d+[\.\)]\s*/, '').replace(/^Buku\s+\d+:?\s*/i, '').trim();
    } else {
      judul = lines[0].replace(/^\d+[\.\)]\s*/, '').replace(/^Buku\s+\d+:?\s*/i, '').trim();
    }
  }

  // If author is missing, look for candidate lines
  if (!pengarang && lines.length > 1) {
    const candidate = lines.find((l) =>
      l !== judul &&
      !l.startsWith('http') &&
      !l.includes('978') &&
      (l.toLowerCase().includes('oleh') ||
       l.toLowerCase().includes('karya') ||
       /^(dr\.|prof\.|ustaz|syed|sheikh|haji|hjh|hj\.)/i.test(l) ||
       (l.split(' ').length >= 2 && l.split(' ').length <= 5 && !/\d/.test(l) && !l.includes(':')))
    );
    if (candidate) {
      pengarang = candidate.replace(/^(oleh|karya|penulis)\s+/i, '').trim();
    }
  }

  // Search for known publishers in raw text if not identified
  if (!penerbit) {
    const foundPub = KNOWN_PUBLISHERS.find((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(rawText));
    if (foundPub) {
      penerbit = foundPub;
    }
  }

  // Search for known cities in raw text if not identified
  if (!tempatTerbit) {
    const foundCity = KNOWN_MALAYSIAN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(rawText));
    if (foundCity) {
      tempatTerbit = foundCity;
    } else {
      tempatTerbit = 'Kuala Lumpur';
    }
  }

  // Ensure DDC has 3-letter author code
  const author3 = get3LetterAuthorCode(pengarang);
  if (noDdc) {
    const parts = noDdc.trim().split(/\s+/);
    if (parts.length >= 2) {
      const classNum = parts[0].replace(/[^0-9.]/g, '');
      const code = parts[parts.length - 1].toUpperCase();
      if (code.length !== 3 || /^(DR|PR|HJ|US|SY|TN|PN)/i.test(code)) {
        noDdc = `${classNum || parts[0]} ${author3}`;
      }
    } else {
      const classNum = noDdc.replace(/[^0-9.]/g, '');
      noDdc = `${classNum || '020.2'} ${author3}`;
    }
  } else {
    // Classify using Dewey Decimal algorithm
    noDdc = classifyDeweyDecimal(judul, rawText, pengarang);
  }

  return {
    judul: judul.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim(),
    pengarang: pengarang.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim() || 'Pengarang Terpilih',
    tempatTerbit: tempatTerbit.trim() || 'Kuala Lumpur',
    penerbit: penerbit.trim() || 'Penerbit Pustaka',
    tahunTerbit: tahunTerbit || '2024',
    isbn: isbn || '',
    noDdc,
    urlBuku: urlBuku || '',
    catatan: catatan || '',
    confidenceScores: {
      judul: judul ? 98 : 60,
      pengarang: pengarang ? 95 : 60,
      tempatTerbit: tempatTerbit ? 90 : 70,
      penerbit: penerbit ? 92 : 65,
      tahunTerbit: tahunTerbit ? 98 : 60,
      isbn: isbn ? 100 : 0,
      noDdc: noDdc ? 95 : 75,
      urlBuku: urlBuku ? 100 : 0,
    },
  };
}

/**
 * Splits and extracts multiple books from raw pasted text (Pustaka Tempatan - Pukal)
 */
export function parseBulkTextLocalEngine(rawText: string): ParsedBookItem[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize line breaks
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Split into chunks by:
  // 1. Double empty lines
  // 2. Explicit dividers: ---, ===, ___
  // 3. Book headers: "Buku 1:", "Buku 2:", "Book 1:", "[1]", "1.", "2." at line start
  let chunks: string[] = [];

  const explicitBlocks = normalized.split(/(?:\n\s*\n)+|(?:\n\s*[-=_]{3,}\s*\n)/);
  
  explicitBlocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    // Check if the block has multiple numbered list entries e.g. "1. Tajuk ... \n2. Tajuk ..."
    const numberedSplit = trimmed.split(/(?=^\s*(?:\d+[\.\)]|Buku\s+\d+:?|Book\s+\d+:?|\[\d+\])\s+)/m).map((s) => s.trim()).filter(Boolean);
    if (numberedSplit.length > 1) {
      chunks.push(...numberedSplit);
    } else {
      chunks.push(trimmed);
    }
  });

  if (chunks.length === 0) {
    chunks = [normalized];
  }

  const results: ParsedBookItem[] = [];

  chunks.forEach((chunk, idx) => {
    // Check if chunk is a single line with delimiters like " - ", " / ", " | ", ";"
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length === 1 && (chunk.includes(' - ') || chunk.includes(' / ') || chunk.includes(' | ') || chunk.includes(';'))) {
      const parts = chunk
        .replace(/^\s*(?:\d+[\.\)]|Buku\s+\d+:?|Book\s+\d+:?|\[\d+\])\s*/i, '')
        .split(/\s+[-–|/]\s+|\s*;\s*/)
        .map((p) => p.trim())
        .filter(Boolean);

      let judul = parts[0] || `Buku ${idx + 1}`;
      let pengarang = parts[1] || '';
      let penerbit = parts[2] || '';
      let tahunTerbit = '';
      let isbn = '';
      let noDdc = '';
      let urlBuku = '';

      for (let i = 3; i < parts.length; i++) {
        const p = parts[i];
        if (/^https?:\/\//i.test(p)) {
          urlBuku = cleanUrl(p);
        } else if (/^\d{4}$/.test(p)) {
          tahunTerbit = p;
        } else if (/978|979|ISBN/i.test(p) || /^[0-9Xx-]{10,20}$/.test(p)) {
          isbn = formatCleanIsbn(p);
        } else if (/\d{3}(?:\.\d+)?/.test(p)) {
          noDdc = p;
        } else if (!penerbit) {
          penerbit = p;
        }
      }

      // Check URL inside any part
      const urlMatch = chunk.match(/https?:\/\/[^\s\)\],>"']+/i);
      if (urlMatch && !urlBuku) {
        urlBuku = cleanUrl(urlMatch[0]);
      }

      const item = extractSingleBookFromSnippet(chunk, judul);
      if (pengarang) item.pengarang = pengarang;
      if (penerbit) item.penerbit = penerbit;
      if (tahunTerbit) item.tahunTerbit = tahunTerbit;
      if (isbn) item.isbn = isbn;
      if (noDdc) item.noDdc = noDdc;
      if (urlBuku) item.urlBuku = urlBuku;

      results.push(item);
    } else {
      const item = extractSingleBookFromSnippet(chunk, `Buku ${idx + 1}`);
      results.push(item);
    }
  });

  return results;
}
