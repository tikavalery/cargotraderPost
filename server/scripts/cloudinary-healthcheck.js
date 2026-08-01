import '../src/config/env.js';
import { configureCloudinary, isCloudinaryConfigured } from '../src/config/cloudinary.js';
import { uploadImageBuffer } from '../src/services/cloudinaryUpload.service.js';

const ok = configureCloudinary();
console.log('configured=', ok, 'isConfigured=', isCloudinaryConfigured());
console.log('cloud=', process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'missing');

const b64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';
const buf = Buffer.from(b64, 'base64');

try {
  const r = await uploadImageBuffer(buf, { folder: 'afritrade/healthcheck', mime: 'image/jpeg' });
  console.log(
    'upload=',
    JSON.stringify({
      fallback: !!r.fallback,
      isCloudinaryUrl: String(r.url || '').includes('res.cloudinary.com'),
      publicId: r.publicId || null
    })
  );
} catch (e) {
  console.error('upload_error=', e.message);
  process.exit(1);
}
