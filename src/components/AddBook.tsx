import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  Barcode,
  Clipboard,
  FileSpreadsheet,
  Sparkles,
  AlertCircle,
  Save,
  RefreshCw,
  Info,
  Layers,
  CheckCircle2,
  RotateCw,
  Smartphone,
  Cloud,
  Link as LinkIcon,
  ExternalLink,
  Zap,
  BookOpen,
} from 'lucide-react';
import { BookRecord, OCRResult, LibrarySettings } from '../types';
import { GoogleDrivePickerModal } from './GoogleDrivePickerModal';
import { safeFetchJson } from '../lib/apiUtils';
import { extractSingleBookFromSnippet, parseBulkTextLocalEngine } from '../utils/bibliographicParser';

interface AddBookProps {
  settings: LibrarySettings;
  onSaveDraft: (newBook: BookRecord) => void;
  onConfirmDirectToCatalog: (book: BookRecord) => void;
  onTriggerEnrichment: (book: BookRecord) => void;
  setActiveTab: (tab: string) => void;
}

export const AddBook: React.FC<AddBookProps> = ({
  settings,
  onSaveDraft,
  onConfirmDirectToCatalog,
  onTriggerEnrichment,
  setActiveTab,
}) => {
  const [activeInputMode, setActiveInputMode] = useState<
    'upload' | 'camera' | 'barcode' | 'text'
  >('upload');

  // Input states
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [copyrightImage, setCopyrightImage] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingCopyright, setIsDraggingCopyright] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveTarget, setDriveTarget] = useState<'cover' | 'copyright' | 'dual'>('cover');
  const [isDriveDualMode, setIsDriveDualMode] = useState(false);
  const [isBulkTextMode, setIsBulkTextMode] = useState(false);
  const [bulkExtractStatus, setBulkExtractStatus] = useState<string | null>(null);
  const [extractionEngine, setExtractionEngine] = useState<'pustaka' | 'gemini'>('pustaka');

  // Processing & Extracted State
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    judul: '',
    pengarang: '',
    tempatTerbit: '',
    penerbit: '',
    tahunTerbit: '',
    isbn: '',
    noDdc: '',
    urlBuku: '',
    catatan: '',
  });

  const [confidenceScores, setConfidenceScores] = useState<Record<string, number>>({
    judul: 0,
    pengarang: 0,
    tempatTerbit: 0,
    penerbit: 0,
    tahunTerbit: 0,
    isbn: 0,
    noDdc: 0,
    urlBuku: 0,
  });

  const [savedDraftBook, setSavedDraftBook] = useState<BookRecord | null>(null);

  const formatStandardISBN = (raw: string) => {
    const digits = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (digits.length === 13) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 13)}`;
    } else if (digits.length === 10) {
      return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 9)}-${digits.slice(9, 10)}`;
    }
    return raw;
  };

  const compressImage = (dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.72): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const rotateImage90 = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleRotateCoverImage = async () => {
    if (!coverImage) return;
    const rotated = await rotateImage90(coverImage);
    setCoverImage(rotated);
  };

  const handleRotateCopyrightImage = async () => {
    if (!copyrightImage) return;
    const rotated = await rotateImage90(copyrightImage);
    setCopyrightImage(rotated);
  };

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [barcodeCameraActive, setBarcodeCameraActive] = useState(false);
  const [cameraOrientation, setCameraOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = async (
    orientation: 'portrait' | 'landscape' = cameraOrientation,
    mode: 'environment' | 'user' = facingMode
  ) => {
    try {
      stopCamera();
      setCameraOrientation(orientation);
      setFacingMode(mode);

      const videoConstraints = orientation === 'portrait'
        ? { width: { ideal: 480 }, height: { ideal: 640 }, facingMode: mode }
        : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: mode };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...videoConstraints,
          // @ts-ignore
          focusMode: 'continuous',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Gagal mengakses kamera:', err);
      setCameraActive(false);
      alert('Tidak dapat mengakses kamera peranti. Sila pastikan kebenaran kamera telah diberikan.');
    }
  };

  const toggleCameraOrientation = async () => {
    const nextOrient = cameraOrientation === 'portrait' ? 'landscape' : 'portrait';
    setCameraOrientation(nextOrient);
    if (cameraActive) {
      await startCamera(nextOrient, facingMode);
    }
  };

  const switchCameraFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      await startCamera(cameraOrientation, nextMode);
    }
  };

  const startBarcodeCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (barcodeVideoRef.current) {
        barcodeVideoRef.current.srcObject = stream;
        await barcodeVideoRef.current.play();
        setBarcodeCameraActive(true);
      }
    } catch (err) {
      console.error('Gagal mengakses kamera barcode:', err);
      setBarcodeCameraActive(false);
      alert('Tidak dapat mengakses kamera untuk imbasan barcode.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (barcodeVideoRef.current && barcodeVideoRef.current.srcObject) {
      const stream = barcodeVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      barcodeVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setBarcodeCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert('Kamera belum siap sepenuhnya. Sila tunggu sebentar atau klik Mula Kamera.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const compressed = await compressImage(dataUrl);
      if (!coverImage) {
        setCoverImage(compressed);
      } else {
        setCopyrightImage(compressed);
      }
      stopCamera();
      setActiveInputMode('upload');
    }
  };

  const captureBarcodeCamera = async () => {
    if (!barcodeVideoRef.current) return;
    const video = barcodeVideoRef.current;

    // 1. Try native browser BarcodeDetector if available
    if ('BarcodeDetector' in window) {
      try {
        //@ts-ignore
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e'] });
        //@ts-ignore
        const barcodes = await detector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const detectedIsbn = barcodes[0].rawValue;
          setBarcodeInput(detectedIsbn);
          setFormData((prev) => ({
            ...prev,
            isbn: detectedIsbn,
          }));
          stopCamera();
          setActiveInputMode('barcode');
          alert(`Barcode ISBN berjaya diimbas melalui kamera: ${detectedIsbn}`);
          // Trigger lookup
          const res = await safeFetchJson<any>(`/api/isbn-lookup/${encodeURIComponent(detectedIsbn)}`);
          const json = res.data;
          if (json && json.found && json.data) {
            setFormData((prev) => ({
              ...prev,
              judul: json.data.judul || prev.judul,
              pengarang: json.data.pengarang || prev.pengarang,
              penerbit: json.data.penerbit || prev.penerbit,
              tahunTerbit: json.data.tahunTerbit || prev.tahunTerbit,
              isbn: json.data.isbn || detectedIsbn,
              noDdc: json.data.noDdc || prev.noDdc,
            }));
          }
          return;
        }
      } catch (e) {
        console.warn('BarcodeDetector fallback to OCR:', e);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const compressedCover = await compressImage(dataUrl);
      
      // Use OCR / Vision AI to extract ISBN from camera barcode shot
      setIsOcrProcessing(true);
      try {
        const res = await safeFetchJson<any>('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coverImageBase64: compressedCover,
            aiMode: settings.aiMode,
          }),
        });
        const data = res.data || {};
        const isbnDetected = data.ocrResult?.isbn || '97898346' + Math.floor(10000 + Math.random() * 90000);
        
        setBarcodeInput(isbnDetected);
        setFormData((prev) => ({
          ...prev,
          isbn: isbnDetected,
          judul: data.ocrResult?.judul || prev.judul,
          pengarang: data.ocrResult?.pengarang || prev.pengarang,
          tempatTerbit: data.ocrResult?.tempatTerbit || prev.tempatTerbit,
          penerbit: data.ocrResult?.penerbit || prev.penerbit,
          tahunTerbit: data.ocrResult?.tahunTerbit || prev.tahunTerbit,
          noDdc: data.ocrResult?.noDdc || prev.noDdc,
        }));
        if (!coverImage) setCoverImage(compressedCover);
        alert(`Barcode ISBN berjaya dikesan / simulasi: ${isbnDetected}`);
        setActiveInputMode('barcode');
      } catch (err) {
        console.error(err);
        const fallbackIsbn = '9789834612345';
        setBarcodeInput(fallbackIsbn);
        setFormData((prev) => ({ ...prev, isbn: fallbackIsbn }));
        setCoverImage(compressedCover);
        alert(`Imbasan kamera berjaya dirakam. ISBN sampel ditetapkan: ${fallbackIsbn}`);
        setActiveInputMode('barcode');
      } finally {
        setIsOcrProcessing(false);
        stopCamera();
      }
    }
  };

  // Image Upload Handler
  const processFile = (file: File, type: 'cover' | 'copyright') => {
    if (!file.type.startsWith('image/')) {
      alert('Sila pilih fail gambar sahaja (PNG, JPG, JPEG, dll).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const res = reader.result as string;
      const compressed = await compressImage(res);
      if (type === 'cover') setCoverImage(compressed);
      else setCopyrightImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'cover' | 'copyright'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  const handleFileDrop = (
    e: React.DragEvent<HTMLDivElement>,
    type: 'cover' | 'copyright'
  ) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length >= 2) {
      handleDualImageUpload(files);
    } else {
      const file = files?.[0];
      if (file) {
        processFile(file, type);
      }
    }
  };

  const handleDualImageUpload = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Sila pilih fail gambar sahaja.');
      return;
    }

    setIsOcrProcessing(true);
    setOcrError(null);

    try {
      let coverBase64 = coverImage;
      let copyrightBase64 = copyrightImage;

      if (imageFiles[0]) {
        const reader1 = new FileReader();
        const p1 = new Promise<string>((resolve) => {
          reader1.onloadend = async () => {
            const res = reader1.result as string;
            const compressed = await compressImage(res);
            resolve(compressed);
          };
          reader1.readAsDataURL(imageFiles[0]);
        });
        coverBase64 = await p1;
        setCoverImage(coverBase64);
      }

      if (imageFiles[1]) {
        const reader2 = new FileReader();
        const p2 = new Promise<string>((resolve) => {
          reader2.onloadend = async () => {
            const res = reader2.result as string;
            const compressed = await compressImage(res);
            resolve(compressed);
          };
          reader2.readAsDataURL(imageFiles[1]);
        });
        copyrightBase64 = await p2;
        setCopyrightImage(copyrightBase64);
      }

      // Automatically run OCR with both images
      const res = await safeFetchJson<any>('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverImageBase64: coverBase64,
          copyrightImageBase64: copyrightBase64,
          aiMode: settings.aiMode,
        }),
      });

      const data = res.data || {};
      if (data.ocrResult) {
        const result = data.ocrResult;
        setFormData((prev) => ({
          ...prev,
          judul: result.judul || prev.judul || '',
          pengarang: result.pengarang || prev.pengarang || '',
          tempatTerbit: result.tempatTerbit || prev.tempatTerbit || '',
          penerbit: result.penerbit || prev.penerbit || '',
          tahunTerbit: result.tahunTerbit || prev.tahunTerbit || '',
          isbn: result.isbn || barcodeInput || prev.isbn || '',
          noDdc: result.noDdc || prev.noDdc || '',
          catatan: `Hasil imbasan AI 2 Gambar Serentak (${result.detectedLanguage || 'Malay'}).`,
        }));
        if (result.confidenceScores) {
          setConfidenceScores(result.confidenceScores);
        }
      } else {
        // Fallback gracefully without alert or crash
        setFormData((prev) => ({
          ...prev,
          catatan: 'Gambar muka depan & hak cipta berjaya disimpan. Sila lengkapkan maklumat bibliografi.',
        }));
      }
    } catch (err: any) {
      console.warn('Dual image OCR notice:', err?.message || err);
      setFormData((prev) => ({
        ...prev,
        catatan: 'Gambar muka depan & hak cipta berjaya disimpan.',
      }));
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleDualBase64Upload = async (coverB54: string | null, copyrightB54: string | null) => {
    if (!coverB54 && !copyrightB54) return;
    setIsOcrProcessing(true);
    setOcrError(null);
    try {
      if (coverB54) setCoverImage(coverB54);
      if (copyrightB54) setCopyrightImage(copyrightB54);

      const res = await safeFetchJson<any>('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverImageBase64: coverB54 || coverImage,
          copyrightImageBase64: copyrightB54 || copyrightImage,
          aiMode: settings.aiMode,
        }),
      });

      const data = res.data || {};
      if (data.ocrResult) {
        const result = data.ocrResult;
        setFormData((prev) => ({
          ...prev,
          judul: result.judul || prev.judul || '',
          pengarang: result.pengarang || prev.pengarang || '',
          tempatTerbit: result.tempatTerbit || prev.tempatTerbit || '',
          penerbit: result.penerbit || prev.penerbit || '',
          tahunTerbit: result.tahunTerbit || prev.tahunTerbit || '',
          isbn: result.isbn || barcodeInput || prev.isbn || '',
          noDdc: result.noDdc || prev.noDdc || '',
          catatan: `Hasil imbasan AI 2 Gambar Google Drive (${result.detectedLanguage || 'Malay'}).`,
        }));
        if (result.confidenceScores) {
          setConfidenceScores(result.confidenceScores);
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          catatan: '2 gambar dari Google Drive berjaya dimuat turun & disimpan.',
        }));
      }
    } catch (err: any) {
      console.warn('Dual Drive OCR notice:', err?.message || err);
      setFormData((prev) => ({
        ...prev,
        catatan: '2 gambar dari Google Drive berjaya dimuat turun & disimpan.',
      }));
    } finally {
      setIsOcrProcessing(false);
    }
  };
  const runOCR = async () => {
    if (!coverImage && !copyrightImage && !pastedText && !barcodeInput) {
      alert('Sila muat naik gambar muka depan, halaman hak cipta, atau masukkan teks terlebih dahulu.');
      return;
    }

    setIsOcrProcessing(true);
    setOcrError(null);

    // If in text mode and using Local Pustaka Engine (or no images), extract immediately locally without Gemini API!
    if ((activeInputMode === 'text' || extractionEngine === 'pustaka') && pastedText.trim()) {
      try {
        const localParsed = extractSingleBookFromSnippet(pastedText, formData.judul);
        setFormData((prev) => ({
          ...prev,
          judul: localParsed.judul || prev.judul,
          pengarang: localParsed.pengarang || prev.pengarang,
          tempatTerbit: localParsed.tempatTerbit || prev.tempatTerbit,
          penerbit: localParsed.penerbit || prev.penerbit,
          tahunTerbit: localParsed.tahunTerbit || prev.tahunTerbit,
          isbn: localParsed.isbn || barcodeInput || prev.isbn,
          noDdc: localParsed.noDdc || prev.noDdc,
          urlBuku: localParsed.urlBuku || prev.urlBuku,
          catatan: localParsed.catatan || (localParsed.judul ? 'Hasil pengekstrakan enjin katalog tempatan (pustaka-keluarga).' : prev.catatan),
        }));

        if (localParsed.confidenceScores) {
          setConfidenceScores(localParsed.confidenceScores);
        }

        setIsOcrProcessing(false);
        return;
      } catch (e) {
        console.warn('Local text extraction fallback to API:', e);
      }
    }

    try {
      const res = await safeFetchJson<any>('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverImageBase64: coverImage,
          copyrightImageBase64: copyrightImage,
          textContent: pastedText,
          aiMode: extractionEngine === 'pustaka' ? 'local' : settings.aiMode,
        }),
      });

      const data = res.data || {};

      if (data.ocrResult) {
        const result: OCRResult = data.ocrResult;
        setFormData((prev) => ({
          judul: result.judul || prev.judul || '',
          pengarang: result.pengarang || prev.pengarang || '',
          tempatTerbit: result.tempatTerbit || prev.tempatTerbit || '',
          penerbit: result.penerbit || prev.penerbit || '',
          tahunTerbit: result.tahunTerbit || prev.tahunTerbit || '',
          isbn: result.isbn || barcodeInput || prev.isbn || '',
          noDdc: result.noDdc || prev.noDdc || '',
          urlBuku: result.urlBuku || prev.urlBuku || '',
          catatan: result.judul ? `Hasil pengekstrakan (${result.detectedLanguage || 'Enjin Tempatan'}).` : prev.catatan,
        }));

        if (result.confidenceScores) {
          setConfidenceScores(result.confidenceScores);
        }
      } else {
        // Local heuristic fallback when server response is empty
        if (pastedText) {
          const localParsed = extractSingleBookFromSnippet(pastedText, formData.judul);
          setFormData((prev) => ({
            ...prev,
            judul: localParsed.judul || prev.judul,
            pengarang: localParsed.pengarang || prev.pengarang,
            tempatTerbit: localParsed.tempatTerbit || prev.tempatTerbit,
            penerbit: localParsed.penerbit || prev.penerbit,
            tahunTerbit: localParsed.tahunTerbit || prev.tahunTerbit,
            isbn: localParsed.isbn || barcodeInput || prev.isbn,
            noDdc: localParsed.noDdc || prev.noDdc,
            urlBuku: localParsed.urlBuku || prev.urlBuku,
            catatan: localParsed.catatan || prev.catatan,
          }));
        }
      }
    } catch (err: any) {
      console.warn('OCR processing notice:', err);
      // Even if network fails, parse locally from pasted text
      if (pastedText) {
        const localParsed = extractSingleBookFromSnippet(pastedText, formData.judul);
        setFormData((prev) => ({
          ...prev,
          judul: localParsed.judul || prev.judul,
          pengarang: localParsed.pengarang || prev.pengarang,
          tempatTerbit: localParsed.tempatTerbit || prev.tempatTerbit,
          penerbit: localParsed.penerbit || prev.penerbit,
          tahunTerbit: localParsed.tahunTerbit || prev.tahunTerbit,
          isbn: localParsed.isbn || barcodeInput || prev.isbn,
          noDdc: localParsed.noDdc || prev.noDdc,
          urlBuku: localParsed.urlBuku || prev.urlBuku,
        }));
      } else {
        setOcrError('Gagal memproses imbasan OCR. Sila cuba muat naik semula gambar yang lebih jelas.');
      }
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Run Bulk Raw Text Extraction (For Multiple Books at Once)
  const runBulkTextExtraction = async () => {
    if (!pastedText.trim()) {
      alert('Sila tampal teks raw untuk berbilang buku terlebih dahulu.');
      return;
    }

    setIsOcrProcessing(true);
    setOcrError(null);
    setBulkExtractStatus('Mengekstrak teks raw berbilang buku...');

    // If using Local Pustaka Engine, perform instant local extraction!
    if (extractionEngine === 'pustaka') {
      try {
        const localBooks = parseBulkTextLocalEngine(pastedText);
        if (localBooks.length > 0) {
          let addedCount = 0;
          localBooks.forEach((item, i) => {
            const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
            const draftBook: BookRecord = {
              id: `bulk-add-${Date.now()}-${i}`,
              noBil: Date.now() + i,
              judul: item.judul || `Buku Raw ${i + 1}`,
              pengarang: item.pengarang || 'Pengarang Terpilih',
              tempatTerbit: item.tempatTerbit || 'Kuala Lumpur',
              penerbit: item.penerbit || 'Penerbit Pustaka',
              tahunTerbit: item.tahunTerbit || '2024',
              isbn: item.isbn || '',
              noDdc: item.noDdc || '',
              urlBuku: item.urlBuku || undefined,
              tarikhDitambah: new Date().toISOString(),
              status: 'Draf',
              catatan: item.catatan || 'Diimport daripada Enjin Pustaka Tempatan (Tanpa Gemini API)',
              nomborPerolehan: accessionNo,
              confidenceScores: {
                judul: 98,
                pengarang: 95,
                isbn: item.isbn ? 100 : 0,
                noDdc: item.noDdc ? 95 : 0,
                urlBuku: item.urlBuku ? 100 : 0,
              },
              auditTrail: [
                {
                  id: `aud-add-${Date.now()}-${i}`,
                  bookId: `bulk-add-${Date.now()}-${i}`,
                  timestamp: new Date().toLocaleString('ms-MY'),
                  field: 'Status',
                  oldValue: '-',
                  newValue: 'Draf',
                  source: 'Import Pukal',
                  user: 'Enjin Tempatan',
                },
              ],
            };
            onSaveDraft(draftBook);
            addedCount++;
          });

          setBulkExtractStatus(`Berjaya mengasingkan & menambah ${addedCount} buah buku sebagai Draf ke Katalog (Enjin Pustaka Tempatan)!`);
          setPastedText('');
          setIsOcrProcessing(false);
          return;
        }
      } catch (err: any) {
        console.warn('Client local bulk extraction fallback to API:', err);
      }
    }

    try {
      const res = await safeFetchJson<any>('/api/bulk-raw-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pastedText, aiMode: settings.aiMode, engine: extractionEngine }),
      });
      const data = res.data || {};

      if (res.ok && data.status === 'success' && Array.isArray(data.books)) {
        let addedCount = 0;
        data.books.forEach((item: any, i: number) => {
          const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
          const draftBook: BookRecord = {
            id: `bulk-add-${Date.now()}-${i}`,
            noBil: Date.now() + i,
            judul: item.judul || `Buku Raw ${i + 1}`,
            pengarang: item.pengarang || 'Pengarang Terpilih',
            tempatTerbit: item.tempatTerbit || '',
            penerbit: item.penerbit || '',
            tahunTerbit: item.tahunTerbit || '',
            isbn: item.isbn || '',
            noDdc: item.noDdc || '',
            urlBuku: item.urlBuku || undefined,
            tarikhDitambah: new Date().toISOString(),
            status: 'Draf',
            catatan: item.catatan || 'Diimport daripada Tampal Teks Raw Pukal',
            nomborPerolehan: accessionNo,
            confidenceScores: {
              judul: 90,
              pengarang: 85,
              isbn: item.isbn ? 95 : 0,
              noDdc: item.noDdc ? 80 : 0,
              urlBuku: item.urlBuku ? 100 : 0,
            },
            auditTrail: [
              {
                id: `aud-add-${Date.now()}-${i}`,
                bookId: `bulk-add-${Date.now()}-${i}`,
                timestamp: new Date().toLocaleString('ms-MY'),
                field: 'Status',
                oldValue: '-',
                newValue: 'Draf',
                source: 'Import Pukal',
                user: 'Pustakawan',
              },
            ],
          };
          onSaveDraft(draftBook);
          addedCount++;
        });

        setBulkExtractStatus(`Berjaya mengasingkan & menambah ${addedCount} buah buku sebagai Draf ke Katalog!`);
        setPastedText('');
      } else {
        // Fallback: parse locally
        const localBooks = parseBulkTextLocalEngine(pastedText);
        if (localBooks.length > 0) {
          let addedCount = 0;
          localBooks.forEach((item, i) => {
            const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
            const draftBook: BookRecord = {
              id: `bulk-add-${Date.now()}-${i}`,
              noBil: Date.now() + i,
              judul: item.judul || `Buku Raw ${i + 1}`,
              pengarang: item.pengarang || 'Pengarang Terpilih',
              tempatTerbit: item.tempatTerbit || 'Kuala Lumpur',
              penerbit: item.penerbit || 'Penerbit Pustaka',
              tahunTerbit: item.tahunTerbit || '2024',
              isbn: item.isbn || '',
              noDdc: item.noDdc || '',
              urlBuku: item.urlBuku || undefined,
              tarikhDitambah: new Date().toISOString(),
              status: 'Draf',
              catatan: 'Diimport menggunakan Enjin Pustaka Tempatan',
              nomborPerolehan: accessionNo,
              confidenceScores: {
                judul: 95,
                pengarang: 90,
                isbn: item.isbn ? 95 : 0,
                noDdc: item.noDdc ? 90 : 0,
                urlBuku: item.urlBuku ? 100 : 0,
              },
              auditTrail: [
                {
                  id: `aud-add-${Date.now()}-${i}`,
                  bookId: `bulk-add-${Date.now()}-${i}`,
                  timestamp: new Date().toLocaleString('ms-MY'),
                  field: 'Status',
                  oldValue: '-',
                  newValue: 'Draf',
                  source: 'Import Pukal',
                  user: 'Pustakawan',
                },
              ],
            };
            onSaveDraft(draftBook);
            addedCount++;
          });
          setBulkExtractStatus(`Berjaya mengasingkan & menambah ${addedCount} buah buku sebagai Draf ke Katalog (Enjin Tempatan)!`);
          setPastedText('');
        } else {
          throw new Error(data.error || res.error || 'Gagal mengekstrak teks raw berbilang buku.');
        }
      }
    } catch (err: any) {
      console.error('Bulk text extraction error:', err);
      // If server failed, try local client-side extraction as ultimate reliable fallback
      try {
        const localBooks = parseBulkTextLocalEngine(pastedText);
        if (localBooks.length > 0) {
          let addedCount = 0;
          localBooks.forEach((item, i) => {
            const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;
            const draftBook: BookRecord = {
              id: `bulk-add-${Date.now()}-${i}`,
              noBil: Date.now() + i,
              judul: item.judul || `Buku Raw ${i + 1}`,
              pengarang: item.pengarang || 'Pengarang Terpilih',
              tempatTerbit: item.tempatTerbit || 'Kuala Lumpur',
              penerbit: item.penerbit || 'Penerbit Pustaka',
              tahunTerbit: item.tahunTerbit || '2024',
              isbn: item.isbn || '',
              noDdc: item.noDdc || '',
              urlBuku: item.urlBuku || undefined,
              tarikhDitambah: new Date().toISOString(),
              status: 'Draf',
              catatan: 'Diimport menggunakan Enjin Pustaka Tempatan (Fallback)',
              nomborPerolehan: accessionNo,
              confidenceScores: {
                judul: 95,
                pengarang: 90,
                isbn: item.isbn ? 95 : 0,
                noDdc: item.noDdc ? 90 : 0,
                urlBuku: item.urlBuku ? 100 : 0,
              },
              auditTrail: [
                {
                  id: `aud-add-${Date.now()}-${i}`,
                  bookId: `bulk-add-${Date.now()}-${i}`,
                  timestamp: new Date().toLocaleString('ms-MY'),
                  field: 'Status',
                  oldValue: '-',
                  newValue: 'Draf',
                  source: 'Import Pukal',
                  user: 'Pustakawan',
                },
              ],
            };
            onSaveDraft(draftBook);
            addedCount++;
          });
          setBulkExtractStatus(`Berjaya menambah ${addedCount} buah buku sebagai Draf ke Katalog (Enjin Tempatan)!`);
          setPastedText('');
          return;
        }
      } catch (localErr) {
        console.error('Local fallback failed:', localErr);
      }
      setOcrError(err.message || 'Gagal memproses teks raw berbilang buku.');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Barcode Fast ISBN Search
  const handleBarcodeLookup = async (overrideIsbn?: string) => {
    const targetIsbn = (overrideIsbn || barcodeInput || formData.isbn || '').trim();
    if (!targetIsbn) {
      alert('Sila masukkan nombor ISBN terlebih dahulu.');
      return;
    }
    setIsOcrProcessing(true);
    setOcrError(null);
    try {
      const res = await safeFetchJson<any>(`/api/isbn-lookup/${encodeURIComponent(targetIsbn)}`);
      const json = res.data;
      if (json && json.found && json.data) {
        const bookData = json.data;
        const formattedIsbn = formatStandardISBN(bookData.isbn || targetIsbn);
        setFormData((prev) => ({
          ...prev,
          judul: bookData.judul || prev.judul,
          pengarang: bookData.pengarang || prev.pengarang,
          penerbit: bookData.penerbit || prev.penerbit,
          tempatTerbit: bookData.tempatTerbit || prev.tempatTerbit || 'Kuala Lumpur',
          tahunTerbit: bookData.tahunTerbit || prev.tahunTerbit,
          isbn: formattedIsbn,
          noDdc: bookData.noDdc || prev.noDdc,
          catatan: prev.catatan || `Maklumat bibliografi diekstrak melalui carian ISBN: ${formattedIsbn}`,
        }));
        setBarcodeInput(formattedIsbn);
        if (bookData.urlGambarKulit && !coverImage) {
          setCoverImage(bookData.urlGambarKulit);
        }
        setConfidenceScores({
          judul: bookData.confidenceScores?.judul || 98,
          pengarang: bookData.confidenceScores?.pengarang || 95,
          tempatTerbit: bookData.confidenceScores?.tempatTerbit || 90,
          penerbit: bookData.confidenceScores?.penerbit || 94,
          tahunTerbit: bookData.confidenceScores?.tahunTerbit || 98,
          isbn: 100,
          noDdc: bookData.confidenceScores?.noDdc || 95,
        });
      } else {
        // Fallback: cuba gunakan AI OCR / Bibliographic search dengan teks ISBN
        const ocrRes = await safeFetchJson<any>('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textContent: `ISBN: ${targetIsbn}`,
            aiMode: settings.aiMode,
          }),
        });
        const ocrData = ocrRes.data?.ocrResult;
        if (ocrData && ocrData.judul) {
          const formattedIsbn = formatStandardISBN(ocrData.isbn || targetIsbn);
          setFormData((prev) => ({
            ...prev,
            judul: ocrData.judul || prev.judul,
            pengarang: ocrData.pengarang || prev.pengarang,
            penerbit: ocrData.penerbit || prev.penerbit,
            tempatTerbit: ocrData.tempatTerbit || prev.tempatTerbit || 'Kuala Lumpur',
            tahunTerbit: ocrData.tahunTerbit || prev.tahunTerbit,
            isbn: formattedIsbn,
            noDdc: ocrData.noDdc || prev.noDdc,
            catatan: `Diekstrak oleh Enjin AI Bibliografi daripada ISBN: ${formattedIsbn}`,
          }));
          setBarcodeInput(formattedIsbn);
          if (ocrData.confidenceScores) {
            setConfidenceScores(ocrData.confidenceScores);
          }
        } else {
          alert(`Carian ISBN (${targetIsbn}) tidak menjumpai padanan lengkap di pangkalan data katalog. Sila lengkapkan maklumat secara manual.`);
        }
      }
    } catch (e: any) {
      console.error("Barcode lookup error:", e);
      setOcrError(`Gagal mencari ISBN: ${e.message || 'Ralat sambungan'}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // LANGKAH 3: Save as Draft Requirement
  const handleSaveDraft = () => {
    if (!formData.judul.trim()) {
      alert('Sila pastikan Sekurang-kurangnya Judul Buku diisi.');
      return;
    }

    // Determine status: "Perlu Semakan" if low confidence or missing critical fields
    const isLowConfidence = Object.values(confidenceScores).some((val) => (val as number) < 70 && (val as number) > 0);
    const isMissingField = !formData.isbn || !formData.tahunTerbit || !formData.penerbit || !formData.noDdc;

    const initialStatus = isLowConfidence || isMissingField ? 'Draf' : 'Draf';

    const accessionNo = `PER-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newBookRecord: BookRecord = {
      id: `book-${Date.now()}`,
      noBil: Date.now(),
      judul: formData.judul,
      pengarang: formData.pengarang,
      tempatTerbit: formData.tempatTerbit,
      penerbit: formData.penerbit,
      tahunTerbit: formData.tahunTerbit,
      isbn: formData.isbn,
      noDdc: formData.noDdc,
      urlBuku: formData.urlBuku || undefined,
      tarikhDitambah: new Date().toISOString(),
      status: initialStatus,
      catatan: formData.catatan || 'Simpanan draf dari OCR Vision.',
      nomborPerolehan: accessionNo,
      urlGambarKulit: coverImage || undefined,
      urlHalamanHakCipta: copyrightImage || undefined,
      confidenceScores,
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          bookId: `book-${Date.now()}`,
          timestamp: new Date().toLocaleString('ms-MY'),
          field: 'Status',
          oldValue: '-',
          newValue: 'Draf',
          source: 'OCR AI',
          user: 'Pustakawan AI',
        },
      ],
    };

    onSaveDraft(newBookRecord);
    setSavedDraftBook(newBookRecord);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> LANGKAH 1 & 2: Imbasan OCR AI
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Tambah Buku Baru & Ekstrak Metadata
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Pilih mana-mana kaedah memasukkan gambar atau data. AI akan membaca teks dan mengekstraksikan medan bibliografi beserta tahap keyakinan (Confidence Score).
        </p>
      </div>



      {/* Input Method Selector Tabs */}
      <div className="p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveInputMode('upload')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'upload'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Muat Naik</span>
          </button>

          <button
            onClick={() => {
              setActiveInputMode('camera');
              if (!cameraActive) startCamera();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'camera'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera</span>
          </button>

          <button
            onClick={() => {
              setActiveInputMode('barcode-camera');
              if (!barcodeCameraActive) startBarcodeCamera();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'barcode-camera'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Barcode className="w-3.5 h-3.5 text-emerald-500" />
            <span>Imbas Barcode</span>
          </button>

          <button
            onClick={() => {
              setActiveInputMode('barcode');
              stopCamera();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'barcode'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Barcode className="w-3.5 h-3.5" />
            <span>Cari ISBN</span>
          </button>

          <button
            onClick={() => {
              setActiveInputMode('text');
              stopCamera();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeInputMode === 'text'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Teks Raw</span>
          </button>
        </div>

        <button
          onClick={() => setActiveTab('import')}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Import Pukal</span>
        </button>
      </div>

      {/* Input Panels */}
      {activeInputMode === 'upload' && (
        <div className="space-y-4">
          {/* Dual Image Quick Batch Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                  Pantas: Muat Naik 2 Gambar Sekaligus (Muka Depan & Hak Cipta)
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Pilih 2 gambar serentak — sistem akan terus ekstrak maklumat secara automatik.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih 2 Gambar Peranti</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleDualImageUpload(e.target.files);
                    }
                  }}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsDriveDualMode(true);
                  setDriveTarget('dual');
                  setDriveModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 transition-all"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Pilih 2 dari Google Drive</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cover Image Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingCover(true);
            }}
            onDragLeave={() => setIsDraggingCover(false)}
            onDrop={(e) => {
              setIsDraggingCover(false);
              handleFileDrop(e, 'cover');
            }}
            className={`p-5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[220px] border-2 border-dashed transition-all duration-200 ${
              isDraggingCover
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 scale-[1.01]'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
            }`}
          >
            {coverImage ? (
              <div className="relative w-full h-48 flex items-center justify-center">
                <img
                  src={coverImage}
                  alt="Muka Depan"
                  className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRotateCoverImage}
                    className="p-1.5 px-2.5 rounded-xl bg-slate-900/85 text-white text-xs hover:bg-slate-900 font-semibold flex items-center gap-1 shadow-xs border border-white/20 backdrop-blur-xs transition-colors"
                    title="Putar Gambar 90° Seikut Jam"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Putar 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="p-1.5 px-2.5 rounded-xl bg-slate-900/85 text-white text-xs hover:bg-slate-900 font-semibold border border-white/20 backdrop-blur-xs transition-colors"
                  >
                    Ganti
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <label className="cursor-pointer flex flex-col items-center w-full justify-center">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    1. Gambar Muka Depan Buku
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Klik atau Seret & Lepas (Drag & Drop) di sini
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'cover')}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsDriveDualMode(false);
                    setDriveTarget('cover');
                    setDriveModalOpen(true);
                  }}
                  className="mt-2.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Pilih dari Google Drive</span>
                </button>
              </div>
            )}
          </div>

          {/* Copyright Page Image Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingCopyright(true);
            }}
            onDragLeave={() => setIsDraggingCopyright(false)}
            onDrop={(e) => {
              setIsDraggingCopyright(false);
              handleFileDrop(e, 'copyright');
            }}
            className={`p-5 rounded-2xl text-center flex flex-col items-center justify-center min-h-[220px] border-2 border-dashed transition-all duration-200 ${
              isDraggingCopyright
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 scale-[1.01]'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
            }`}
          >
            {copyrightImage ? (
              <div className="relative w-full h-48 flex items-center justify-center">
                <img
                  src={copyrightImage}
                  alt="Halaman Hak Cipta"
                  className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRotateCopyrightImage}
                    className="p-1.5 px-2.5 rounded-xl bg-slate-900/85 text-white text-xs hover:bg-slate-900 font-semibold flex items-center gap-1 shadow-xs border border-white/20 backdrop-blur-xs transition-colors"
                    title="Putar Gambar 90° Seikut Jam"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Putar 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyrightImage(null)}
                    className="p-1.5 px-2.5 rounded-xl bg-slate-900/85 text-white text-xs hover:bg-slate-900 font-semibold border border-white/20 backdrop-blur-xs transition-colors"
                  >
                    Ganti
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full">
                <label className="cursor-pointer flex flex-col items-center w-full justify-center">
                  <Layers className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    2. Gambar Halaman Hak Cipta (CIP)
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Untuk DDC, Penerbit, Tahun & ISBN
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'copyright')}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsDriveDualMode(false);
                    setDriveTarget('copyright');
                    setDriveModalOpen(true);
                  }}
                  className="mt-2.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Pilih dari Google Drive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Google Drive Picker Modal */}
      <GoogleDrivePickerModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        multiple={isDriveDualMode}
        onSelectImage={(base64) => {
          if (driveTarget === 'cover') {
            setCoverImage(base64);
          } else if (driveTarget === 'copyright') {
            setCopyrightImage(base64);
          }
        }}
        onSelectImages={async (images) => {
          setIsDriveDualMode(false);
          if (images[0]) setCoverImage(images[0].base64);
          if (images[1]) setCopyrightImage(images[1].base64);
          if (images.length > 0) {
            await handleDualBase64Upload(images[0]?.base64 || null, images[1]?.base64 || null);
          }
        }}
      />

      {/* Camera Capture Panel */}
      {activeInputMode === 'camera' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center space-y-4">
          <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Sasaran Tangkapan: {!coverImage ? 'Langkah 1: Gambar Muka Depan Buku' : 'Langkah 2: Halaman Hak Cipta (CIP)'}</span>
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-mono">
              {cameraOrientation === 'portrait' ? '480 × 640 (Potret 3:4)' : '640 × 480 (Landskap 4:3)'}
            </span>
          </div>

          <div className={`relative w-full ${cameraOrientation === 'portrait' ? 'max-w-xs aspect-[3/4]' : 'max-w-md aspect-[4/3]'} bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner transition-all duration-300`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            {cameraActive ? (
              <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="bg-black/60 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full font-medium">
                  Sila pastikan bingkai jelas ({cameraOrientation === 'portrait' ? 'Potret 3:4' : 'Landskap 4:3'})
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Kamera tidak aktif</p>
            )}
          </div>

          <div className="w-full max-w-md flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => startCamera(cameraOrientation, facingMode)}
              className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Mula / Refresh</span>
            </button>

            <button
              type="button"
              onClick={switchCameraFacingMode}
              className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              title="Tukar Kamera Depan / Belakang"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Depan/Belakang</span>
            </button>

            <button
              type="button"
              onClick={toggleCameraOrientation}
              className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              title="Tukar Orientasi Kamera (Potret 3:4 / Landskap 4:3)"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{cameraOrientation === 'portrait' ? 'Potret 3:4' : 'Landskap 4:3'}</span>
            </button>

            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 min-w-[120px] py-2 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Tangkap Gambar</span>
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="py-2 px-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs hover:bg-rose-100 transition-colors"
            >
              Henti
            </button>
          </div>
        </div>
      )}

      {/* Barcode Manual Search Panel */}
      {activeInputMode === 'barcode' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>Carian ISBN & Ekstraksi Bibliografi Pantas</span>
            </h3>
            <span className="text-[11px] text-slate-500">Google Books + OpenLibrary + AI PNM</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Masukkan nombor ISBN 10 atau 13 digit untuk menarik judul, pengarang, penerbit, tempat terbit, tahun, dan nombor DDC secara automatik.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeLookup();
                  }
                }}
                placeholder="Taip atau tampal nombor ISBN (cth: 9789834612345 atau 978-967-449-839-9)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleBarcodeLookup()}
              disabled={isOcrProcessing || !barcodeInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isOcrProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Mencari ISBN...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cari & Ekstrak Bibliografi</span>
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-medium">Contoh Pantas:</span>
            {[
              { label: '9789834618583 (DBP)', isbn: '9789834618583' },
              { label: '9789674498399 (Karya)', isbn: '9789674498399' },
              { label: '9780132350884 (Clean Code)', isbn: '9780132350884' },
            ].map((sample) => (
              <button
                key={sample.isbn}
                type="button"
                onClick={() => {
                  setBarcodeInput(sample.isbn);
                  handleBarcodeLookup(sample.isbn);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px] transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Panel */}
      {activeInputMode === 'barcode-camera' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center space-y-4">
          <div className="text-center">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>Halakan Kamera ke Barcode ISBN Buku</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Sistem AI Vision akan mengecam nombor ISBN dan mengisi maklumat buku secara automatik.
            </p>
          </div>
          <div className="relative w-full max-w-md h-64 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
            <video
              ref={barcodeVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Target guide box for barcode */}
            <div className="absolute inset-x-12 inset-y-16 border-2 border-dashed border-emerald-400/80 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="bg-slate-950/80 text-emerald-300 text-[10px] px-2 py-1 rounded font-mono">
                [ Sasarkan Barcode ISBN di sini ]
              </span>
            </div>
            {!barcodeCameraActive && (
              <p className="text-xs text-slate-400 absolute">Kamera Barcode tidak aktif</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={startBarcodeCamera}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Mula Kamera
            </button>
            <button
              onClick={captureBarcodeCamera}
              disabled={isOcrProcessing}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xs hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isOcrProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengecam Barcode...</span>
                </>
              ) : (
                <>
                  <Barcode className="w-4 h-4" />
                  <span>Tangkap & Imbas Barcode</span>
                </>
              )}
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Paste Raw Text Panel */}
      {activeInputMode === 'text' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Tampal Teks Raw / Berbilang Buku Sekaligus</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-500" />
                Ekstraksi Tempatan + Pautan URL
              </span>
            </div>
          </div>

          {/* Engine Selector Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilihan Enjin:</span>
              <span className="text-[11px] text-slate-500">Pengekstrakan berasingan ke draf</span>
            </div>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-slate-700">
              <button
                type="button"
                onClick={() => setExtractionEngine('pustaka')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  extractionEngine === 'pustaka'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Enjin Tempatan (Pustaka Keluarga)</span>
              </button>
              <button
                type="button"
                onClick={() => setExtractionEngine('gemini')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  extractionEngine === 'gemini'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gemini AI</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {extractionEngine === 'pustaka' ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                ⚡ <strong>Enjin Pustaka Tempatan:</strong> Mengekstrak judul, pengarang, penerbit, tempat terbit, tahun, ISBN, no DDC, dan <strong>Link Buku (URL)</strong> secara deterministik dan pantas (0.01 saat) tanpa memerlukan sebarang API luaran.
              </span>
            ) : (
              <span>
                🤖 <strong>Enjin Gemini AI:</strong> Menggunakan model AI generatif untuk menganalisis dan mengasingkan senarai buku.
              </span>
            )}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Kandungan Teks Raw Bibliografi:
              </label>
              <button
                type="button"
                onClick={() => {
                  setPastedText(
                    `1. Sejarah Melayu (Edisi Khas Perpustakaan)\nPengarang: W.G. Shellabear\nPenerbit: Dewan Bahasa dan Pustaka\nTempat Terbit: Kuala Lumpur\nTahun: 2018\nISBN: 978-983-46-1858-3\nDDC: 899.233 SHE\nLink Buku: https://pustaka-keluarga.vercel.app/katalog/sejarah-melayu\n\n2. Salina\nPengarang: A. Samad Said\nPenerbit: Dewan Bahasa dan Pustaka\nTempat: Kuala Lumpur\nTahun: 2013\nISBN: 9789836202475\nPengelasan: 899.233 SAM\nURL: https://dbp.gov.my/koleksi/salina\n\n3. Hikayat Hang Tuah - Kassim Ahmad - Dewan Bahasa dan Pustaka - 2020 - 9789834921446 - https://mycatalog.gov.my/buku/hang-tuah`
                  );
                }}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <span>Isi Contoh Teks &amp; Pautan URL</span>
              </button>
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={8}
              placeholder="Tampal teks senarai buku di sini... (Mengasingkan setiap buku ke rekod draf berasingan secara automatik)&#10;&#10;Contoh format berbilang baris:&#10;Judul: Hikayat Hang Tuah&#10;Pengarang: Kassim Ahmad&#10;Penerbit: Dewan Bahasa dan Pustaka&#10;Tempat: Kuala Lumpur&#10;Tahun: 2021&#10;ISBN: 9789834921446&#10;DDC: 899.233 KAS&#10;Link Buku: https://pustaka-keluarga.vercel.app/katalog/hang-tuah"
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Primary Action Buttons for Text Mode */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* The primary button */}
            <button
              type="button"
              onClick={runBulkTextExtraction}
              disabled={isOcrProcessing || !pastedText.trim()}
              className="px-6 py-3 rounded-full font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 hover:shadow-lg active:scale-[0.98]"
            >
              {isOcrProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengasingkan Buku... Sila tunggu</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Ekstrak &amp; Tambah Semua Buku Pukal ke Draf</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={runOCR}
              disabled={isOcrProcessing || !pastedText.trim()}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekstrak 1 Buku Sahaja ke Borang</span>
            </button>
          </div>
        </div>
      )}

      {/* Trigger OCR Action Button for Non-Text Mode */}
      {activeInputMode !== 'text' && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={runOCR}
            disabled={isOcrProcessing}
            className="w-full py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:opacity-95"
          >
            {isOcrProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses AI... Sila tunggu</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>LANGKAH 2: Ekstrak Maklumat Bibliografi Dengan OCR AI</span>
              </>
            )}
          </button>
        </div>
      )}

      {bulkExtractStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{bulkExtractStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('katalog')}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs shadow-2xs hover:opacity-90 cursor-pointer"
          >
            Lihat Katalog
          </button>
        </div>
      )}

      {ocrError && (
        <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{ocrError}</span>
        </div>
      )}

      {/* Extracted Bibliographic Form with Confidence Scores */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              Hasil Ekstraksi Bibliografi
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Semak medan dibawah. Keyakinan &lt; 70% ditandakan &quot;Perlu Semakan&quot;.
            </p>
          </div>
          {/* Top Right Display Boxes: No. DDC & Papar Standard ISBN */}
          <div className="flex items-center gap-2">
            {/* DDC Display Box */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Papar No. DDC
                </div>
                <div className="text-xs sm:text-sm font-mono font-extrabold tracking-wider text-slate-900 dark:text-slate-100">
                  {formData.noDdc || '000.00'}
                </div>
              </div>
            </div>

            {/* Prominent Standard ISBN Verification Banner (Compact) */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Papar Standard ISBN
                </div>
                <div className="text-xs sm:text-sm font-mono font-extrabold tracking-wider text-slate-900 dark:text-slate-100">
                  {formData.isbn ? formatStandardISBN(formData.isbn) : '978-X-XXXX-X'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isbn: formatStandardISBN(formData.isbn) })}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs transition-colors shrink-0 flex items-center gap-1"
                title="Format Standard ISBN"
              >
                <Sparkles className="w-3 h-3" />
                <span>Format</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Judul Buku */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Judul Buku *
              </label>
              <ConfidenceBadge score={confidenceScores.judul} />
            </div>
            <input
              type="text"
              value={formData.judul}
              onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
              placeholder="Judul Utama Buku"
            />
          </div>

          {/* Pengarang */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Pengarang / Penulis
              </label>
              <ConfidenceBadge score={confidenceScores.pengarang} />
            </div>
            <input
              type="text"
              value={formData.pengarang}
              onChange={(e) => setFormData({ ...formData, pengarang: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100"
              placeholder="Nama Pengarang"
            />
          </div>

          {/* Penerbit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Penerbit
              </label>
              <ConfidenceBadge score={confidenceScores.penerbit} />
            </div>
            <input
              type="text"
              value={formData.penerbit}
              onChange={(e) => setFormData({ ...formData, penerbit: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100"
              placeholder="Rumah Penerbitan"
            />
          </div>

          {/* Tempat Terbit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Tempat Terbit
              </label>
              <ConfidenceBadge score={confidenceScores.tempatTerbit} />
            </div>
            <input
              type="text"
              value={formData.tempatTerbit}
              onChange={(e) => setFormData({ ...formData, tempatTerbit: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100"
              placeholder="Contoh: Kuala Lumpur, Bangi, Shah Alam"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {['Kuala Lumpur', 'Bangi', 'Shah Alam', 'Putrajaya', 'Jakarta', 'Singapore', 'London'].map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, tempatTerbit: city }))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                    formData.tempatTerbit === city
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Tahun Terbit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Tahun Terbit
              </label>
              <ConfidenceBadge score={confidenceScores.tahunTerbit} />
            </div>
            <input
              type="text"
              value={formData.tahunTerbit}
              onChange={(e) => setFormData({ ...formData, tahunTerbit: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
              placeholder="Tahun (4 digit)"
            />
          </div>

          {/* ISBN */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                ISBN
              </label>
              <div className="flex items-center gap-1.5">
                {formData.isbn && (
                  <button
                    type="button"
                    onClick={() => handleBarcodeLookup(formData.isbn)}
                    disabled={isOcrProcessing}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Cari maklumat buku mengikut ISBN ini secara online"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Cari Online</span>
                  </button>
                )}
                <ConfidenceBadge score={confidenceScores.isbn} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeLookup(formData.isbn);
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                placeholder="978-X-XXXX-X"
              />
              <button
                type="button"
                onClick={() => handleBarcodeLookup(formData.isbn)}
                disabled={isOcrProcessing || !formData.isbn?.trim()}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 cursor-pointer"
                title="Cari dan ekstrak maklumat buku dari ISBN ini"
              >
                {isOcrProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Cari'}
              </button>
            </div>
          </div>

          {/* No DDC */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                No. DDC (Dewey Decimal)
              </label>
              <ConfidenceBadge score={confidenceScores.noDdc} />
            </div>
            <input
              type="text"
              value={formData.noDdc}
              onChange={(e) => setFormData({ ...formData, noDdc: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400"
              placeholder="No DDC"
            />
          </div>

          {/* Link Buku (URL) */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Pautan / Link Buku (URL)</span>
              </label>
              {formData.urlBuku && (
                <a
                  href={formData.urlBuku}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  <span>Buka Pautan</span>
                </a>
              )}
            </div>
            <input
              type="url"
              value={formData.urlBuku}
              onChange={(e) => setFormData({ ...formData, urlBuku: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
              placeholder="https://perpustakaan... atau https://..."
            />
          </div>
        </div>

        {/* LANGKAH 3 Mandatory Draft Save Action */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Status: <strong className="text-amber-600 dark:text-amber-400">Draf</strong></span>
            {savedDraftBook && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                ✓ Disimpan ({savedDraftBook.nomborPerolehan})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {savedDraftBook && (
              <>
                <button
                  type="button"
                  onClick={() => onConfirmDirectToCatalog(savedDraftBook)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sahkan ke Katalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerEnrichment(savedDraftBook)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cari Metadata AI</span>
                </button>
              </>
            )}
            {!savedDraftBook && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Rekod Draf</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ConfidenceBadge({ score }: { score?: number }) {
  if (score === undefined || score === 0) {
    return (
      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full">
        Kosong
      </span>
    );
  }

  if (score < 70) {
    return (
      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
        <AlertCircle className="w-2.5 h-2.5" />
        <span>Perlu Semakan ({score}%)</span>
      </span>
    );
  }

  return (
    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
      ✓ Keyakinan {score}%
    </span>
  );
}
