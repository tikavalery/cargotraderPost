import { OAuth2Client } from 'google-auth-library';
import ApiError from './ApiError.js';
import { getGoogleClientId, isValidGoogleClientId } from './googleClientId.js';

let oauthClient;

function getClient() {
  if (!oauthClient) {
    const clientId = getGoogleClientId();
    if (!isValidGoogleClientId(clientId)) return null;
    oauthClient = new OAuth2Client(clientId);
  }
  return oauthClient;
}

/** Verify a Google ID token from the client and return the payload. */
export async function verifyGoogleIdToken(idToken) {
  const clientId = getGoogleClientId();
  if (!isValidGoogleClientId(clientId)) {
    throw new ApiError(
      503,
      'Google sign-in is not configured. Set GOOGLE_CLIENT_ID in server/.env to your OAuth Web Client ID.'
    );
  }

  const client = getClient();
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new ApiError(401, 'Invalid Google token');
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const message =
      err?.message?.includes('audience') || err?.message?.includes('Audience')
        ? 'Google sign-in failed — client ID mismatch between app and Google Cloud Console.'
        : 'Google sign-in failed — invalid or expired token';
    throw new ApiError(401, message);
  }
}

export { isGoogleAuthConfigured } from './googleClientId.js';
