/** Google OAuth client ID helpers — single source of truth from server .env */

export function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
}

export function isGoogleClientSecret(value) {
  return /^GOCSPX-/i.test(String(value || '').trim());
}

export function isValidGoogleClientId(value) {
  const id = String(value || '').trim();
  if (!id || isGoogleClientSecret(id)) return false;
  return /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(id);
}

export function isGoogleAuthConfigured() {
  return isValidGoogleClientId(getGoogleClientId());
}
