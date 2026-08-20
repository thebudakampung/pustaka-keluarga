/**
 * Image Optimizer and Payload Guard for Firestore
 * Prevents Firestore 1MB (1,048,576 byte) document size limit violations
 * by compressing base64 images to web-optimized catalog thumbnails.
 */

import { BookRecord } from '../types';

export function compressImageBase64(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.72
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return Promise.resolve(dataUrl);
  }

  // If already very small (< 40KB base64), return directly
  if (dataUrl.length < 40000) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
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
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } else {
            resolve(dataUrl);
          }
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Calculates rough byte size of JSON stringified object
 */
export function estimateObjectByteSize(obj: any): number {
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return new Blob([str]).size;
  } catch {
    return JSON.stringify(obj).length * 2;
  }
}

/**
 * Ensures a book record strictly fits into Firestore's 1MB document size limit (target: < 600KB)
 */
export async function sanitizeBookForFirestore(book: BookRecord): Promise<BookRecord> {
  if (!book) return book;

  let sanitized: BookRecord = { ...book };

  // 1. Compress cover image if it is base64 and large (> 120KB)
  if (sanitized.urlGambarKulit && sanitized.urlGambarKulit.startsWith('data:image')) {
    if (sanitized.urlGambarKulit.length > 120000) {
      sanitized.urlGambarKulit = await compressImageBase64(sanitized.urlGambarKulit, 640, 640, 0.7);
    }
  }

  // 2. Compress copyright/CIP image if it is base64 and large (> 120KB)
  if (sanitized.urlHalamanHakCipta && sanitized.urlHalamanHakCipta.startsWith('data:image')) {
    if (sanitized.urlHalamanHakCipta.length > 120000) {
      sanitized.urlHalamanHakCipta = await compressImageBase64(sanitized.urlHalamanHakCipta, 640, 640, 0.7);
    }
  }

  // 3. Check overall size. If still above 700KB, perform second aggressive compression pass
  let size = estimateObjectByteSize(sanitized);
  if (size > 700000) {
    if (sanitized.urlGambarKulit && sanitized.urlGambarKulit.startsWith('data:image')) {
      sanitized.urlGambarKulit = await compressImageBase64(sanitized.urlGambarKulit, 450, 450, 0.55);
    }
    if (sanitized.urlHalamanHakCipta && sanitized.urlHalamanHakCipta.startsWith('data:image')) {
      sanitized.urlHalamanHakCipta = await compressImageBase64(sanitized.urlHalamanHakCipta, 450, 450, 0.55);
    }
    size = estimateObjectByteSize(sanitized);
  }

  // 4. Emergency fallback: If still somehow exceeding 900KB, trim raw data to avoid hard crash
  if (size > 900000) {
    if (sanitized.urlHalamanHakCipta && sanitized.urlHalamanHakCipta.startsWith('data:image')) {
      delete sanitized.urlHalamanHakCipta;
    }
  }

  return sanitized;
}
