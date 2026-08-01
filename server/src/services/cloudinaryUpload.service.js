import https from 'https';
import http from 'http';
import { cloudinary, isCloudinaryConfigured, configureCloudinary } from '../config/cloudinary.js';

configureCloudinary();

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'afritrade';

/**
 * Windows / corporate antivirus SSL inspection often breaks Cloudinary TLS.
 * Mirror SMTP_TLS_REJECT_UNAUTHORIZED — default relaxed in development.
 */
export function cloudinaryHttpsAgent() {
  const flag = (process.env.CLOUDINARY_TLS_REJECT_UNAUTHORIZED || '').trim().toLowerCase();
  const relax =
    flag === 'false' || flag === '0' || (flag === '' && process.env.NODE_ENV !== 'production');
  if (!relax) return undefined;
  return new https.Agent({ rejectUnauthorized: false });
}

/**
 * Parse a data URL or raw base64 string into a Buffer + mime.
 */
export function parseDataUrl(data) {
  if (!data || typeof data !== 'string') return null;
  if (data.startsWith('http://') || data.startsWith('https://')) {
    return { kind: 'url', url: data };
  }
  if (data.startsWith('data:')) {
    const match = data.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return null;
    return {
      kind: 'buffer',
      mime: match[1],
      buf: Buffer.from(match[2], 'base64'),
      dataUrl: data
    };
  }
  try {
    return {
      kind: 'buffer',
      mime: 'image/jpeg',
      buf: Buffer.from(data, 'base64'),
      dataUrl: `data:image/jpeg;base64,${data}`
    };
  } catch {
    return null;
  }
}

function resourceTypeFromMime(mime = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'raw';
  // Office / text docs — store as raw so they download with original bytes
  if (
    mime.startsWith('application/') ||
    mime.startsWith('text/') ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('ms-excel') ||
    mime.includes('ms-powerpoint')
  ) {
    return 'raw';
  }
  return 'auto';
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload a buffer or data URL to Cloudinary.
 * Only falls back to a data URL when Cloudinary credentials are not configured
 * (dev without CLOUDINARY_*). When configured, upload failures are thrown.
 *
 * @returns {{ url: string, publicId?: string, bytes?: number, format?: string, width?: number, height?: number, fallback?: boolean }}
 */
export async function uploadImageBuffer(buf, {
  folder = `${DEFAULT_FOLDER}/photos`,
  mime = 'image/jpeg',
  publicId,
  resourceType
} = {}) {
  if (!isCloudinaryConfigured()) {
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    console.warn('[cloudinary] not configured — storing data URL fallback');
    return { url: dataUrl, bytes: buf.length, fallback: true };
  }

  const type = resourceType || resourceTypeFromMime(mime);
  const agent = cloudinaryHttpsAgent();
  const options = {
    folder,
    resource_type: type,
    overwrite: false,
    unique_filename: true,
    ...(publicId ? { public_id: publicId } : {}),
    ...(agent ? { agent } : {})
  };

  // Images: let Cloudinary compress (q_auto) on delivery; upload as-is with light transform limit
  if (type === 'image') {
    options.transformation = [
      { width: 1600, height: 1600, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ];
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
    stream.end(buf);
  });

  if (!result?.secure_url) {
    throw new Error('Cloudinary upload returned no URL');
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format,
    width: result.width,
    height: result.height,
    resourceType: result.resource_type
  };
}

/**
 * Upload from a data URL / https URL / raw base64 string.
 * Existing Cloudinary/https URLs are returned as-is (no re-upload).
 */
export async function uploadFromDataUrl(input, options = {}) {
  const parsed = parseDataUrl(input);
  if (!parsed) {
    const err = new Error('Invalid image data');
    err.code = 'INVALID_IMAGE';
    throw err;
  }
  if (parsed.kind === 'url') {
    // Already a remote URL (Cloudinary or other) — keep it
    if (parsed.url.includes('res.cloudinary.com') || parsed.url.startsWith('https://')) {
      return { url: parsed.url, skipped: true };
    }
  }
  return uploadImageBuffer(parsed.buf, {
    ...options,
    mime: parsed.mime || options.mime || 'image/jpeg'
  });
}

/**
 * Upload many images; continues on individual failures when `soft` is true.
 */
export async function uploadManyFromDataUrls(inputs = [], options = {}) {
  const results = [];
  const errors = [];
  for (let i = 0; i < inputs.length; i += 1) {
    try {
      const uploaded = await uploadFromDataUrl(inputs[i], {
        ...options,
        folder: options.folder || `${DEFAULT_FOLDER}/photos`
      });
      results.push(uploaded);
    } catch (err) {
      errors.push({ index: i, message: err.message });
      if (!options.soft) throw err;
    }
  }
  return { results, errors };
}

/**
 * Upload a document (PDF/image) for shipping docs.
 */
export async function uploadDocumentBuffer(buf, { mime, fileName, folder } = {}) {
  const safeName = String(fileName || 'document')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .slice(0, 120);
  const uploaded = await uploadImageBuffer(buf, {
    folder: folder || `${DEFAULT_FOLDER}/documents`,
    mime: mime || 'application/pdf',
    resourceType: mime?.startsWith('image/') ? 'image' : 'raw',
    publicId: undefined
  });
  return {
    ...uploaded,
    fileName: safeName || 'document',
    fileSize: formatBytes(uploaded.bytes || buf.length)
  };
}

/**
 * Fetch a remote file (e.g. Cloudinary) into a Buffer for authenticated download proxy.
 */
export function fetchRemoteFileBuffer(url, { redirectsLeft = 5 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') {
      reject(new Error('Missing file URL'));
      return;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid file URL'));
      return;
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const agent = parsed.protocol === 'https:' ? cloudinaryHttpsAgent() : undefined;
    const req = lib.get(
      url,
      {
        agent,
        headers: { Accept: '*/*', 'User-Agent': 'CargoTrader/1.0' }
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          fetchRemoteFileBuffer(res.headers.location, { redirectsLeft: redirectsLeft - 1 }).then(resolve, reject);
          return;
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          res.resume();
          reject(new Error(`Remote file fetch failed (${res.statusCode})`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            buf: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || 'application/octet-stream'
          });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

export { formatBytes };
