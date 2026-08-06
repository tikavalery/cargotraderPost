'use client';

/**
 * Catch-all Next.js page that mounts the existing React Router app.
 * All routes, guards, and screens stay identical; Next.js owns the shell,
 * tooling, and /api rewrite to the Express backend.
 */
import App from '../../App';

export default function CatchAllPage() {
  return <App />;
}
