import rateLimit from 'express-rate-limit';

/** Auth endpoints — blunt credential stuffing / reset abuse */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many auth attempts — try again later' }
});

/** Uploads — limit burst size abuse */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many uploads — try again later' }
});

/** General API — light protection for public-ish routes */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests — try again later' }
});
