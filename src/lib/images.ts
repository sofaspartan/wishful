import { api } from './api';

const MAX_DIMENSION = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Downscale large photos in the browser before upload (keeps uploads small
 * and fast on mobile data). Small PNG/GIF/WebP files are uploaded as-is to
 * preserve transparency and animation.
 */
async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.type === 'image/svg+xml') throw new Error('SVG images are not supported. Try a JPEG or PNG.');
  const keepOriginal = ['image/png', 'image/gif', 'image/webp'].includes(file.type) && file.size < 1.5 * 1024 * 1024;
  if (keepOriginal) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // HEIC or other formats the browser can't decode — let the server decide.
    return file;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const blob = await prepareImage(file);
  if (blob.size > MAX_BYTES) throw new Error('That image is larger than 5 MB. Try a smaller one.');
  const res = await api<{ url: string }>('/api/images', { method: 'POST', raw: blob, contentType: blob.type || 'application/octet-stream' });
  return res.url;
}
