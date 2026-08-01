import { uploadApi } from '../services/purchaseApi';

/**
 * Returns true if the string still needs uploading (local data URL / raw base64).
 * Existing https:// (Cloudinary) URLs are left alone.
 */
export function needsCloudUpload(src) {
  if (!src || typeof src !== 'string') return false;
  if (src.startsWith('https://') || src.startsWith('http://')) return false;
  return src.startsWith('data:') || !src.includes('://');
}

/**
 * Upload any new data-URL photos via /api/uploads/photos.
 * Keeps existing remote URLs in place (graceful for legacy + already-migrated).
 *
 * @param {string[]} photos
 * @returns {Promise<string[]>}
 */
export async function resolvePhotosForSave(photos = []) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : [];
  if (!list.length) return [];

  const pending = list.filter(needsCloudUpload);
  if (!pending.length) return list;

  const up = await uploadApi.photos(pending);
  if (up.data?.provider === 'fallback') {
    throw new Error(
      'Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET, then restart the API.'
    );
  }
  const urls = up.data?.urls || [];
  if (urls.some((u) => typeof u === 'string' && u.startsWith('data:'))) {
    throw new Error('Photo upload did not reach Cloudinary. Check server Cloudinary credentials and try again.');
  }
  let idx = 0;
  return list.map((p) => (needsCloudUpload(p) ? urls[idx++] || p : p));
}

/**
 * Upload a single document (PDF/image data URL) to Cloudinary.
 */
export async function resolveDocumentForSave({ dataUrl, fileName }) {
  if (!dataUrl) return null;
  if (!needsCloudUpload(dataUrl) && dataUrl.startsWith('http')) {
    return { fileUrl: dataUrl, fileName: fileName || 'document', fileSize: '—' };
  }
  const res = await uploadApi.document({ file: dataUrl, fileName });
  if (res.data?.provider === 'fallback') {
    throw new Error(
      'Cloudinary is not configured on the server. Set CLOUDINARY_* env vars, then restart the API.'
    );
  }
  const fileUrl = res.data?.fileUrl || res.data?.url;
  if (!fileUrl || String(fileUrl).startsWith('data:')) {
    throw new Error('Document upload did not reach Cloudinary. Check server credentials and try again.');
  }
  return {
    fileUrl,
    fileName: res.data?.fileName || fileName || 'document',
    fileSize: res.data?.fileSize || '—'
  };
}

/** Prefer remote URL; data URLs still render in <img> for old records. */
export function mediaSrc(src) {
  return src || '';
}
