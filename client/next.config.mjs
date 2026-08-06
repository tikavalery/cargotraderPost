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
    // beforeFiles: must run before the App Router catch-all [[...slug]],
    // otherwise /api/* is served as HTML and auth/config calls fail.
    const apiOrigin = (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.VITE_API_URL ||
      'http://localhost:5000'
    ).replace(/\/$/, '');
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiOrigin}/api/:path*`
        }
      ]
    };
  }
};

export default nextConfig;
