import { uploadFromDataUrl } from '../services/cloudinaryUpload.service.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Normalize an array of photo strings: upload any data URLs to Cloudinary,
 * leave https URLs unchanged. When Cloudinary is configured, upload failures
 * are thrown so saves do not silently store base64 in MongoDB.
 */
export async function ensureCloudPhotos(photos = [], { businessId, folderSuffix = 'photos' } = {}) {
  if (!Array.isArray(photos) || !photos.length) return photos || [];

  const folder = `afritrade/${businessId || 'shared'}/${folderSuffix}`;
  const out = [];
  const configured = isCloudinaryConfigured();

  for (const src of photos) {
    if (!src || typeof src !== 'string') continue;
    if (src.startsWith('https://') || src.startsWith('http://')) {
      out.push(src);
      continue;
    }
    if (!src.startsWith('data:')) {
      out.push(src);
      continue;
    }
    if (!configured) {
      out.push(src);
      continue;
    }
    const uploaded = await uploadFromDataUrl(src, { folder });
    if (!uploaded?.url || uploaded.url.startsWith('data:')) {
      throw new Error('Cloudinary upload did not return a remote URL');
    }
    out.push(uploaded.url);
  }
  return out;
}
