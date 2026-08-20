import React, { useState, useEffect, useRef } from 'react';
import { X, Save, CheckCircle2, Upload, Trash2, Camera, Layers, RefreshCw, Check, Smartphone, Crop, Sparkles, RotateCw, Cloud, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { BookRecord, BookStatus } from '../types';
import { GoogleDrivePickerModal } from './GoogleDrivePickerModal';
import { compressImageBase64 } from '../utils/imageOptimizer';

interface BookEditModalProps {
  book: BookRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (updatedBook: BookRecord) => void;
  focusField?: string | null;
}

export const BookEditModal: React.FC<BookEditModalProps> = ({
  book,
  isOpen,
  onClose,
  onSaveBook,
  focusField,
}) => {
  const [formData, setFormData] = useState<Partial<BookRecord>>({});
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingCip, setIsUploadingCip] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveTarget, setDriveTarget] = useState<'cover' | 'cip'>('cover');

  // Camera States
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'cover' | 'cip' | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraOrientation, setCameraOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [uncroppedPreviewUrl, setUncroppedPreviewUrl] = useState<string | null>(null);
  const [isAutoCropped, setIsAutoCropped] = useState<boolean>(true);
  const editVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const cipInputRef = useRef<HTMLInputElement>(null);
  const ddcInputRef = useRef<HTMLInputElement>(null);
  const isbnInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && book) {
      setFormData({ ...book });
    }
  }, [book, isOpen]);

  useEffect(() => {
    if (isOpen && focusField === 'noDdc') {
      const timer = setTimeout(() => {
        if (ddcInputRef.current) {
          ddcInputRef.current.focus();
          ddcInputRef.current.select();
          ddcInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
    if (isOpen && focusField === 'isbn') {
      const timer = setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
          isbnInputRef.current.select();
          isbnInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, focusField]);

  const stopCameraStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    }
    if (editVideoRef.current) {
      editVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  if (!isOpen || !book) return null;

  const startCamera = async (target: 'cover' | 'cip', mode: 'environment' | 'user' = 'environment', orientation: 'portrait' | 'landscape' = cameraOrientation) => {
    setCameraTarget(target);
    setCameraOrientation(orientation);
    setCapturedPreviewUrl(null);
    setCameraModalOpen(true);
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
      }
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

      // Attempt to apply continuous focus via track constraints if supported
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities() as any;
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          try {
            await videoTrack.applyConstraints({
              // @ts-ignore
              advanced: [{ focusMode: 'continuous' }]
            });
          } catch (e) {
            console.log('Continuous focus constraint not fully applied:', e);
          }
        }
      }
      setMediaStream(stream);
      if (editVideoRef.current) {
        editVideoRef.current.srcObject = stream;
        await editVideoRef.current.play();
      }
    } catch (err) {
      console.error('Kamera ralat:', err);
      alert('Akses kamera diperlukan untuk menangkap gambar. Sila pastikan kebenaran kamera telah diberikan.');
      setCameraModalOpen(false);
    }
  };

  const switchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraTarget) {
      await startCamera(cameraTarget, nextMode, cameraOrientation);
    }
  };

  const toggleOrientation = async () => {
    const nextOrient = cameraOrientation === 'portrait' ? 'landscape' : 'portrait';
    setCameraOrientation(nextOrient);
    if (cameraTarget) {
      await startCamera(cameraTarget, facingMode, nextOrient);
    }
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

  const processAndCropBookEdges = (sourceCanvas: HTMLCanvasElement): string => {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/jpeg', 0.9);

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    // 1. Calculate border color baseline from 4 outer edges
    let totalR = 0, totalG = 0, totalB = 0;
    let borderCount = 0;

    for (let x = 0; x < width; x += 8) {
      for (let y of [2, Math.floor(height * 0.02), Math.floor(height * 0.98), height - 3]) {
        const idx = (y * width + x) * 4;
        totalR += pixels[idx];
        totalG += pixels[idx + 1];
        totalB += pixels[idx + 2];
        borderCount++;
      }
    }
    for (let y = 0; y < height; y += 8) {
      for (let x of [2, Math.floor(width * 0.02), Math.floor(width * 0.98), width - 3]) {
        const idx = (y * width + x) * 4;
        totalR += pixels[idx];
        totalG += pixels[idx + 1];
        totalB += pixels[idx + 2];
        borderCount++;
      }
    }

    const bgR = borderCount ? totalR / borderCount : 128;
    const bgG = borderCount ? totalG / borderCount : 128;
    const bgB = borderCount ? totalB / borderCount : 128;

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let foregroundCount = 0;

    // 2. Scan central 92% region to detect book object pixels
    const startX = Math.floor(width * 0.04);
    const endX = Math.floor(width * 0.96);
    const startY = Math.floor(height * 0.04);
    const endY = Math.floor(height * 0.96);

    const step = 3;
    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (diff > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foregroundCount++;
        }
      }
    }

    const detectedW = maxX - minX;
    const detectedH = maxY - minY;
    const areaRatio = (detectedW * detectedH) / (width * height);

    // If bounding box is well-defined (e.g. covers 15% - 92% of frame)
    if (foregroundCount > 80 && areaRatio > 0.15 && areaRatio < 0.92 && minX < maxX && minY < maxY) {
      const padX = Math.floor(detectedW * 0.03);
      const padY = Math.floor(detectedH * 0.03);

      const cropX = Math.max(0, minX - padX);
      const cropY = Math.max(0, minY - padY);
      const cropMaxX = Math.min(width, maxX + padX);
      const cropMaxY = Math.min(height, maxY + padY);

      const cropW = cropMaxX - cropX;
      const cropH = cropMaxY - cropY;

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (croppedCtx) {
        croppedCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        return croppedCanvas.toDataURL('image/jpeg', 0.92);
      }
    }

    // Fallback crop: crop central 88% guided frame area
    const marginX = Math.floor(width * 0.06);
    const marginY = Math.floor(height * 0.06);
    const targetW = width - marginX * 2;
    const targetH = height - marginY * 2;

    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = targetW;
    fallbackCanvas.height = targetH;
    const fallbackCtx = fallbackCanvas.getContext('2d');
    if (fallbackCtx) {
      fallbackCtx.drawImage(sourceCanvas, marginX, marginY, targetW, targetH, 0, 0, targetW, targetH);
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }

    return sourceCanvas.toDataURL('image/jpeg', 0.9);
  };

  const captureSnapshot = () => {
    if (!editVideoRef.current) return;
    const video = editVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert('Kamera belum siap sepenuhnya. Sila tunggu sebentar.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawUrl = canvas.toDataURL('image/jpeg', 0.92);
      const croppedUrl = processAndCropBookEdges(canvas);

      setUncroppedPreviewUrl(rawUrl);
      setCapturedPreviewUrl(croppedUrl);
      setIsAutoCropped(true);
      stopCameraStream();
    }
  };

  const acceptCapturedPhoto = async () => {
    if (!capturedPreviewUrl || !cameraTarget) return;
    const optimized = await compressImageBase64(capturedPreviewUrl, 800, 800, 0.72);
    if (cameraTarget === 'cover') {
      setFormData((prev) => ({ ...prev, urlGambarKulit: optimized }));
    } else if (cameraTarget === 'cip') {
      setFormData((prev) => ({ ...prev, urlHalamanHakCipta: optimized }));
    }
    closeCameraModal();
  };

  const retakePhoto = async () => {
    setCapturedPreviewUrl(null);
    setUncroppedPreviewUrl(null);
    setIsAutoCropped(true);
    if (cameraTarget) {
      await startCamera(cameraTarget, facingMode);
    }
  };

  const closeCameraModal = () => {
    stopCameraStream();
    setCameraModalOpen(false);
    setCapturedPreviewUrl(null);
    setUncroppedPreviewUrl(null);
    setIsAutoCropped(true);
    setCameraTarget(null);
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const compressed = await compressImageBase64(result, 800, 800, 0.72);
        setFormData((prev) => ({ ...prev, urlGambarKulit: compressed }));
      } catch (err) {
        console.warn('Gagal memampatkan imej:', err);
      } finally {
        setIsUploadingCover(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploadingCover(false);
      alert('Gagal membaca fail imej.');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCip(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const compressed = await compressImageBase64(result, 800, 800, 0.72);
        setFormData((prev) => ({ ...prev, urlHalamanHakCipta: compressed }));
      } catch (err) {
        console.warn('Gagal memampatkan imej:', err);
      } finally {
        setIsUploadingCip(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploadingCip(false);
      alert('Gagal membaca fail imej CIP.');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check changed fields to write audit log
    const updatedAuditTrail = [...(book.auditTrail || [])];
    const fieldsToTrack: (keyof BookRecord)[] = [
      'judul',
      'pengarang',
      'penerbit',
      'tempatTerbit',
      'tahunTerbit',
      'isbn',
      'noDdc',
      'urlBuku',
      'status',
      'urlGambarKulit',
      'urlHalamanHakCipta',
    ];

    fieldsToTrack.forEach((field) => {
      const oldVal = String(book[field] || '');
      const newVal = String((formData as any)[field] || '');
      if (oldVal !== newVal) {
        updatedAuditTrail.push({
          id: `aud-${Date.now()}-${field}`,
          bookId: book.id,
          timestamp: new Date().toLocaleString('ms-MY'),
          field: field === 'urlGambarKulit' ? 'Gambar Muka Depan' : field === 'urlHalamanHakCipta' ? 'Halaman Hak Cipta (CIP)' : field === 'urlBuku' ? 'Pautan / Link URL Buku' : String(field),
          oldValue: oldVal ? (field.startsWith('urlGambar') ? '[Fail Imej]' : oldVal) : 'Kosong',
          newValue: newVal ? (field.startsWith('urlGambar') ? '[Fail Imej]' : newVal) : 'Kosong',
          source: 'Semakan Pengguna',
          user: 'Pustakawan Manual',
        });
      }
    });

    const updatedBookRecord: BookRecord = {
      ...book,
      ...formData,
      auditTrail: updatedAuditTrail,
    } as BookRecord;

    onSaveBook(updatedBookRecord);
    onClose();
  };

  const handleSaveAndVerify = () => {
    const updatedForm = { ...formData, status: 'Lengkap' as BookStatus };
    const updatedAuditTrail = [...(book.auditTrail || [])];
    const fieldsToTrack: (keyof BookRecord)[] = [
      'judul',
      'pengarang',
      'penerbit',
      'tempatTerbit',
      'tahunTerbit',
      'isbn',
      'noDdc',
      'urlBuku',
      'status',
      'urlGambarKulit',
      'urlHalamanHakCipta',
    ];

    fieldsToTrack.forEach((field) => {
      const oldVal = String(book[field] || '');
      const newVal = String((updatedForm as any)[field] || '');
      if (oldVal !== newVal) {
        updatedAuditTrail.push({
          id: `aud-${Date.now()}-${field}-${Math.random().toString(36).substr(2, 4)}`,
          bookId: book.id,
          timestamp: new Date().toLocaleString('ms-MY'),
          field: field === 'urlGambarKulit' ? 'Gambar Muka Depan' : field === 'urlHalamanHakCipta' ? 'Halaman Hak Cipta (CIP)' : field === 'urlBuku' ? 'Pautan / Link URL Buku' : String(field),
          oldValue: oldVal ? (field.startsWith('urlGambar') ? '[Fail Imej]' : oldVal) : 'Kosong',
          newValue: newVal ? (field.startsWith('urlGambar') ? '[Fail Imej]' : newVal) : 'Kosong',
          source: 'Semakan Pengguna',
          user: 'Pustakawan (Sahkan & Simpan)',
        });
      }
    });

    const updatedBookRecord: BookRecord = {
      ...book,
      ...updatedForm,
      status: 'Lengkap',
      auditTrail: updatedAuditTrail,
    } as BookRecord;

    onSaveBook(updatedBookRecord);
    onClose();
    alert('✓ Rekod Telah Berjaya Disahkan dan Dikemaskini!');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm">Sunting Rekod Katalog Buku</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Judul Buku
              </label>
              <input
                type="text"
                value={formData.judul || ''}
                onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pengarang
              </label>
              <input
                type="text"
                value={formData.pengarang || ''}
                onChange={(e) => setFormData({ ...formData, pengarang: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Penerbit
              </label>
              <input
                type="text"
                value={formData.penerbit || ''}
                onChange={(e) => setFormData({ ...formData, penerbit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tempat Terbit
              </label>
              <input
                type="text"
                value={formData.tempatTerbit || ''}
                onChange={(e) => setFormData({ ...formData, tempatTerbit: e.target.value })}
                placeholder="Contoh: Kuala Lumpur, Bangi, Shah Alam"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['Kuala Lumpur', 'Bangi', 'Shah Alam', 'Putrajaya', 'Jakarta', 'Singapore', 'London'].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setFormData({ ...formData, tempatTerbit: city })}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tahun Terbit
              </label>
              <input
                type="text"
                value={formData.tahunTerbit || ''}
                onChange={(e) => setFormData({ ...formData, tahunTerbit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className={focusField === 'isbn' ? 'p-2 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-500 ring-2 ring-indigo-500/20 transition-all' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ISBN (International Standard Book Number)
                </label>
                {focusField === 'isbn' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white animate-pulse">
                    ⚡ Sedang Menyunting ISBN
                  </span>
                )}
              </div>
              <input
                ref={isbnInputRef}
                id="edit-modal-isbn"
                type="text"
                value={formData.isbn || ''}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                placeholder="Contoh: 978-967-12345-6-7"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className={focusField === 'noDdc' ? 'p-2 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border-2 border-emerald-500 ring-2 ring-emerald-500/20 transition-all' : ''}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No. DDC (Dewey Decimal Classification)
                </label>
                {focusField === 'noDdc' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white animate-pulse">
                    ⚡ Sedang Menyunting No. DDC
                  </span>
                )}
              </div>
              <input
                ref={ddcInputRef}
                id="edit-modal-no-ddc"
                type="text"
                value={formData.noDdc || ''}
                onChange={(e) => setFormData({ ...formData, noDdc: e.target.value })}
                placeholder="Contoh: 297.122 atau 899.233"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  { code: '000', label: '000 Karya Am' },
                  { code: '100', label: '100 Falsafah' },
                  { code: '200', label: '200 Agama' },
                  { code: '297', label: '297 Islam' },
                  { code: '300', label: '300 Sains Sosial' },
                  { code: '400', label: '400 Bahasa' },
                  { code: '500', label: '500 Sains' },
                  { code: '600', label: '600 Teknologi' },
                  { code: '700', label: '700 Kesenian' },
                  { code: '800', label: '800 Sastera' },
                  { code: '900', label: '900 Sejarah' },
                ].map((cat) => (
                  <button
                    key={cat.code}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, noDdc: cat.code });
                      if (ddcInputRef.current) ddcInputRef.current.focus();
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors cursor-pointer ${
                      formData.noDdc?.startsWith(cat.code)
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    title={`Tetapkan awalan DDC: ${cat.label}`}
                  >
                    {cat.code}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Rekod
              </label>
              <select
                value={formData.status || 'Draf'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BookStatus })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
              >
                <option value="Draf">Draf (Belum Disahkan)</option>
                <option value="Perlu Semakan">Perlu Semakan</option>
                <option value="Lengkap">Lengkap</option>
              </select>
            </div>



            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombor Perolehan
              </label>
              <input
                type="text"
                value={formData.nomborPerolehan || ''}
                onChange={(e) => setFormData({ ...formData, nomborPerolehan: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
                value={formData.urlBuku || ''}
                onChange={(e) => setFormData({ ...formData, urlBuku: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan
            </label>
            <textarea
              value={formData.catatan || ''}
              onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
              rows={3}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Image Management Section (Cover & CIP) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
              Pengurusan Imej & Halaman Hak Cipta (CIP)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cover Image Manager */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Gambar Muka Depan (Cover)
                  </span>
                  {isUploadingCover && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Memuat naik...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-20 h-28 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center relative">
                    {formData.urlGambarKulit ? (
                      <img
                        src={formData.urlGambarKulit}
                        alt="Muka Depan"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 text-center p-1">Tiada Imej</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={coverInputRef}
                      onChange={handleCoverFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.urlGambarKulit ? 'Muat Naik Fail' : '+ Muat Naik'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('cover')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold text-xs shadow-2xs hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>Ambil Gambar / Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDriveTarget('cover');
                        setDriveModalOpen(true);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Google Drive</span>
                    </button>

                    {formData.urlGambarKulit && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.urlGambarKulit) return;
                            const rotated = await rotateImage90(formData.urlGambarKulit);
                            setFormData((prev) => ({ ...prev, urlGambarKulit: rotated }));
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                          title="Putar gambar 90° seikut jam"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Putar 90°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, urlGambarKulit: '' }))}
                          className="py-1.5 px-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Padam</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Link Input for Cover */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-emerald-500" />
                    <span>Link Direct URL Gambar Cover:</span>
                  </label>
                  <input
                    type="url"
                    value={formData.urlGambarKulit || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, urlGambarKulit: e.target.value }))}
                    placeholder="https://.../gambar-cover.jpg"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* CIP Image Manager */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Halaman Hak Cipta (CIP)
                  </span>
                  {isUploadingCip && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Memuat naik...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-20 h-28 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center relative">
                    {formData.urlHalamanHakCipta ? (
                      <img
                        src={formData.urlHalamanHakCipta}
                        alt="Hak Cipta"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 text-center p-1">Tiada Imej CIP</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={cipInputRef}
                      onChange={handleCipFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => cipInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-2xs hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.urlHalamanHakCipta ? 'Muat Naik Fail' : '+ Muat Naik'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('cip')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold text-xs shadow-2xs hover:opacity-90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
                      <span>Ambil Gambar / Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDriveTarget('cip');
                        setDriveModalOpen(true);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Google Drive</span>
                    </button>

                    {formData.urlHalamanHakCipta && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!formData.urlHalamanHakCipta) return;
                            const rotated = await rotateImage90(formData.urlHalamanHakCipta);
                            setFormData((prev) => ({ ...prev, urlHalamanHakCipta: rotated }));
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                          title="Putar gambar 90° seikut jam"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Putar 90°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, urlHalamanHakCipta: '' }))}
                          className="py-1.5 px-2.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Padam</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Link Input for CIP */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-indigo-500" />
                    <span>Link Direct URL Gambar CIP:</span>
                  </label>
                  <input
                    type="url"
                    value={formData.urlHalamanHakCipta || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, urlHalamanHakCipta: e.target.value }))}
                    placeholder="https://.../gambar-cip.jpg"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Camera Capture Modal Overlay */}
          {cameraModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Tangkap {cameraTarget === 'cover' ? 'Gambar Muka Depan' : 'Halaman Hak Cipta (CIP)'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={closeCameraModal}
                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className={`relative w-full ${cameraOrientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'} rounded-2xl bg-black overflow-hidden flex items-center justify-center shadow-inner transition-all duration-300`}>
                  {capturedPreviewUrl ? (
                    <>
                      <img
                        src={capturedPreviewUrl}
                        alt="Previu Tangkapan"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 pointer-events-none">
                        <span className="bg-slate-900/85 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 border border-white/20 shadow-xs">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isAutoCropped ? 'Pemotongan Bucu Buku Automatik' : 'Gambar Penuh (Asal)'}</span>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <video
                        ref={editVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                      />
                      <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                        <span className="bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full font-medium">
                          Sila pastikan bingkai jelas ({cameraOrientation === 'portrait' ? 'Potret 3:4' : 'Landskap 4:3'})
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="w-full flex items-center justify-between gap-1.5 pt-2">
                  {capturedPreviewUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={retakePhoto}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Semula</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!capturedPreviewUrl) return;
                          const rotatedCaptured = await rotateImage90(capturedPreviewUrl);
                          setCapturedPreviewUrl(rotatedCaptured);
                          if (uncroppedPreviewUrl) {
                            const rotatedUncropped = await rotateImage90(uncroppedPreviewUrl);
                            setUncroppedPreviewUrl(rotatedUncropped);
                          }
                        }}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                        title="Putar gambar 90 darjah"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Putar 90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isAutoCropped && uncroppedPreviewUrl) {
                            setCapturedPreviewUrl(uncroppedPreviewUrl);
                            setIsAutoCropped(false);
                          } else if (!isAutoCropped && uncroppedPreviewUrl) {
                            const tempImg = new Image();
                            tempImg.onload = () => {
                              const tempCanvas = document.createElement('canvas');
                              tempCanvas.width = tempImg.width;
                              tempCanvas.height = tempImg.height;
                              const tCtx = tempCanvas.getContext('2d');
                              if (tCtx) {
                                tCtx.drawImage(tempImg, 0, 0);
                                setCapturedPreviewUrl(processAndCropBookEdges(tempCanvas));
                                setIsAutoCropped(true);
                              }
                            };
                            tempImg.src = uncroppedPreviewUrl;
                          }
                        }}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                        title="Tukar antara imej dipotong automatik & imej asal"
                      >
                        <Crop className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{isAutoCropped ? 'Asal' : 'Potong'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={acceptCapturedPhoto}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 shadow-md"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guna Gambar Ini</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1"
                        title="Tukar Kamera"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={toggleOrientation}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1"
                        title="Tukar Orientasi Potret / Landskap"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>{cameraOrientation === 'portrait' ? 'Potret' : 'Landskap'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={captureSnapshot}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Tangkap</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAndVerify}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xs hover:bg-emerald-700 flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sahkan Rekod & Simpan</span>
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-2xs hover:opacity-90 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Google Drive Picker Modal */}
      <GoogleDrivePickerModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        onSelectImage={(base64) => {
          if (driveTarget === 'cover') {
            setFormData((prev) => ({ ...prev, urlGambarKulit: base64 }));
          } else {
            setFormData((prev) => ({ ...prev, urlHalamanHakCipta: base64 }));
          }
        }}
      />
    </div>
  );
};
