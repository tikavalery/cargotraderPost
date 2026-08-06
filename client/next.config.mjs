import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid picking up a lockfile outside this app (monorepo/home directory).
  outputFileTracingRoot: path.join(__dirname),
  // Existing SPA code lives under src/ and uses relative imports.
  // Keep .js/.jsx resolution consistent with the previous Vite app.
  pageExtensions: ['js', 'jsx'],
  async rewrites() {
    const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
