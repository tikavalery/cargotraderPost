import ApiError, { asyncHandler } from '../utils/ApiError.js';
import {
  parseDataUrl,
  uploadFromDataUrl,
  uploadManyFromDataUrls,
  uploadDocumentBuffer,
  formatBytes
} from '../services/cloudinaryUpload.service.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

const MAX_FILES = 12;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB before Cloudinary compression

/**
 * POST /api/uploads/photos
 * Body: { files: [dataUrl|httpsUrl, ...] } or { images: [...] }
 * Returns Cloudinary secure URLs (or data-URL fallback if Cloudinary unset).
 */
export const uploadPhotos = asyncHandler(async (req, res) => {
  const incoming = req.body?.files || req.body?.images || [];
  if (!Array.isArray(incoming) || !incoming.length) {
    throw new ApiError(400, 'No files provided');
  }

  const businessId = String(req.businessId || 'shared');
  const folder = `afritrade/${businessId}/photos`;

  const valid = [];
  for (const entry of incoming.slice(0, MAX_FILES)) {
    const raw = typeof entry === 'string' ? entry : entry?.data || entry?.base64 || entry?.url;
    const parsed = parseDataUrl(raw);
    if (!parsed) continue;
    if (parsed.kind === 'buffer' && parsed.buf.length > MAX_BYTES) continue;
    valid.push(raw);
  }

  if (!valid.length) {
    throw new ApiError(400, 'No valid images (max 5 MB each, up to 12 files)');
  }

  try {
    const { results, errors } = await uploadManyFromDataUrls(valid, { folder, soft: false });
    const urls = results.map((r) => r.url).filter(Boolean);
    if (!urls.length) {
      throw new ApiError(400, errors[0]?.message || 'Upload failed for all images');
    }
    if (isCloudinaryConfigured() && results.some((r) => r.fallback || String(r.url || '').startsWith('data:'))) {
      throw new ApiError(502, 'Cloudinary upload failed — images were not stored remotely');
    }
    res.json({
      ok: true,
      urls,
      provider: isCloudinaryConfigured() ? 'cloudinary' : 'fallback',
      errors: errors.length ? errors : undefined
    });
  } catch (err) {
    console.error('[uploads/photos]', err.message);
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, err.message || 'Cloudinary upload failed');
  }
});

/**
 * POST /api/uploads/document
 * Body: { file: dataUrl, fileName?: string }
 * For shipping PDFs / images.
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const raw = req.body?.file || req.body?.data || req.body?.base64;
  if (!raw || typeof raw !== 'string') {
    throw new ApiError(400, 'No document file provided');
  }

  const parsed = parseDataUrl(raw);
  if (!parsed || parsed.kind !== 'buffer') {
    // Already a remote URL
    if (parsed?.kind === 'url') {
      return res.json({
        ok: true,
        url: parsed.url,
        fileUrl: parsed.url,
        fileName: req.body?.fileName || 'document',
        fileSize: '—',
        provider: 'remote'
      });
    }
    throw new ApiError(400, 'Invalid document data');
  }

  if (parsed.buf.length > 10 * 1024 * 1024) {
    throw new ApiError(400, 'Document too large (max 10 MB)');
  }

  const businessId = String(req.businessId || 'shared');
  try {
    const uploaded = await uploadDocumentBuffer(parsed.buf, {
      mime: parsed.mime,
      fileName: req.body?.fileName,
      folder: `afritrade/${businessId}/documents`
    });
    if (isCloudinaryConfigured() && (uploaded.fallback || String(uploaded.url || '').startsWith('data:'))) {
      throw new ApiError(502, 'Cloudinary upload failed — document was not stored remotely');
    }
    res.json({
      ok: true,
      url: uploaded.url,
      fileUrl: uploaded.url,
      fileName: uploaded.fileName || req.body?.fileName || 'document',
      fileSize: uploaded.fileSize || formatBytes(parsed.buf.length),
      publicId: uploaded.publicId,
      provider: uploaded.fallback ? 'fallback' : 'cloudinary'
    });
  } catch (err) {
    console.error('[uploads/document]', err.message);
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, err.message || 'Document upload failed');
  }
});

/**
 * POST /api/uploads/migrate-photos
 * Body: { urls: [dataUrl, ...] } — migrate legacy base64 to Cloudinary.
 * HTTPS Cloudinary URLs are left unchanged.
 */
export const migratePhotos = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Cloudinary is not configured');
  }
  const incoming = req.body?.urls || req.body?.files || [];
  if (!Array.isArray(incoming) || !incoming.length) {
    throw new ApiError(400, 'No URLs provided');
  }

  const businessId = String(req.businessId || 'shared');
  const folder = `afritrade/${businessId}/migrated`;
  const mapped = [];

  for (const url of incoming.slice(0, 50)) {
    if (typeof url !== 'string') {
      mapped.push(url);
      continue;
    }
    if (url.startsWith('https://res.cloudinary.com/') || (url.startsWith('https://') && !url.startsWith('data:'))) {
      mapped.push(url);
      continue;
    }
    if (!url.startsWith('data:')) {
      mapped.push(url);
      continue;
    }
    try {
      const uploaded = await uploadFromDataUrl(url, { folder });
      mapped.push(uploaded.url);
    } catch (err) {
      console.warn('[uploads/migrate] keep original:', err.message);
      mapped.push(url);
    }
  }

  res.json({ ok: true, urls: mapped, provider: 'cloudinary' });
});

/**
 * POST /api/uploads/migrate-legacy
 * Scans Items, Purchases, and ShipmentDocuments for this business and
 * rewrites data-URL media to Cloudinary secure URLs.
 */
export const migrateLegacyMedia = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Cloudinary is not configured. Set CLOUDINARY_* env vars and restart.');
  }

  const Item = (await import('../models/Item.js')).default;
  const { Purchase } = await import('../models/Purchase.js');
  const ShipmentDocument = (await import('../models/ShipmentDocument.js')).default;
  const { ensureCloudPhotos } = await import('../utils/ensureCloudPhotos.js');

  const businessId = req.businessId;
  const stats = { items: 0, purchases: 0, documents: 0, skipped: 0 };

  const items = await Item.find({
    business: businessId,
    photos: { $elemMatch: { $regex: /^data:/ } }
  }).limit(200);

  for (const item of items) {
    const next = await ensureCloudPhotos(item.photos, { businessId, folderSuffix: 'migrated' });
    if (JSON.stringify(next) !== JSON.stringify(item.photos)) {
      item.photos = next;
      await item.save();
      stats.items += 1;
    } else {
      stats.skipped += 1;
    }
  }

  const purchases = await Purchase.find({
    business: businessId,
    photos: { $elemMatch: { $regex: /^data:/ } }
  }).limit(200);

  for (const purchase of purchases) {
    const next = await ensureCloudPhotos(purchase.photos, { businessId, folderSuffix: 'migrated' });
    if (JSON.stringify(next) !== JSON.stringify(purchase.photos)) {
      purchase.photos = next;
      await purchase.save();
      stats.purchases += 1;
    } else {
      stats.skipped += 1;
    }
  }

  const docs = await ShipmentDocument.find({
    business: businessId,
    fileUrl: { $regex: /^data:/ }
  }).limit(100);

  for (const doc of docs) {
    try {
      const uploaded = await uploadFromDataUrl(doc.fileUrl, {
        folder: `afritrade/${businessId}/documents`
      });
      if (uploaded.url && uploaded.url !== doc.fileUrl) {
        doc.fileUrl = uploaded.url;
        await doc.save();
        stats.documents += 1;
      }
    } catch (err) {
      console.warn('[migrate-legacy] document', doc.docId, err.message);
      stats.skipped += 1;
    }
  }

  res.json({
    ok: true,
    message: 'Legacy media migration complete (batch limit applied)',
    stats,
    provider: 'cloudinary'
  });
});
