const MAX_DIMENSION = 1280;
const TARGET_MAX_BYTES = 900 * 1024;
const START_QUALITY = 0.82;
const MIN_QUALITY = 0.5;

export function estimateDataUrlBytes(dataUrl = '') {
  const comma = String(dataUrl).indexOf(',');
  if (comma < 0) return 0;
  return Math.ceil((String(dataUrl).length - comma - 1) * 0.75);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

function loadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function resizedCanvas(img) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function encodeCompressed(canvas) {
  let quality = START_QUALITY;
  let output = canvas.toDataURL('image/jpeg', quality);

  while (estimateDataUrlBytes(output) > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08);
    output = canvas.toDataURL('image/jpeg', quality);
  }

  return output;
}

async function normalizeLoadedImage(src) {
  const img = await loadImage(src);
  const canvas = resizedCanvas(img);
  return encodeCompressed(canvas);
}

export async function normalizeImageFile(file) {
  const dataUrl = await loadFileAsDataUrl(file);
  return normalizeLoadedImage(dataUrl);
}

export async function normalizeImageDataUrl(dataUrl) {
  return normalizeLoadedImage(dataUrl);
}
