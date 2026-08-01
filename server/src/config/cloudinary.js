import { v2 as cloudinary } from 'cloudinary';

let configured = false;

/** Values from .env.example / copy-paste templates — not real credentials. */
const PLACEHOLDER_RE =
  /^(your[_-]?|xxx|changeme|replace|todo|example|dummy|test[_-]?(key|secret|name)?)$/i;

function isUsableCredential(value) {
  if (value == null) return false;
  const v = String(value).trim();
  if (!v) return false;
  if (PLACEHOLDER_RE.test(v)) return false;
  if (/^your[_-]?[a-z0-9_-]+$/i.test(v)) return false; // your_api_key, your_cloud_name, …
  return true;
}

export function configureCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!isUsableCredential(cloud_name) || !isUsableCredential(api_key) || !isUsableCredential(api_secret)) {
    configured = false;
    return false;
  }

  cloudinary.config({
    cloud_name: String(cloud_name).trim(),
    api_key: String(api_key).trim(),
    api_secret: String(api_secret).trim(),
    secure: true
  });
  configured = true;
  return true;
}

export function isCloudinaryConfigured() {
  if (!configured) configureCloudinary();
  return configured;
}

export { cloudinary };
