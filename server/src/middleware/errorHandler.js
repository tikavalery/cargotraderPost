import ApiError from '../utils/ApiError.js';

function isDuplicateKeyError(err) {
  return err?.code === 11000 || err?.errorResponse?.code === 11000 || err?.code === 'P2002';
}

export default function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  // Expected client auth / permission failures — avoid noisy stack dumps
  if (status === 401 || status === 403) {
    console.warn(`[${status}] ${req.method} ${req.originalUrl} — ${err.message}`);
  } else {
    console.error(err);
  }
  if (isDuplicateKeyError(err)) {
    const kv = err.keyValue || {};
    const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
    const dupKey =
      kv.returnId ||
      kv.transactionId ||
      kv.shipmentId ||
      kv.docId ||
      kv.purchaseId ||
      kv.saleId ||
      kv.heldId ||
      target.find((k) => k !== 'businessId' && k !== 'business') ||
      Object.entries(kv).find(([k]) => k !== 'business' && k !== 'businessId')?.[1] ||
      Object.values(kv)[0];
    const message = dupKey
      ? `A record with ID "${dupKey}" already exists. Please try again.`
      : 'Duplicate key error. Please try again.';
    return res.status(409).json({ ok: false, message });
  }
  res.status(status).json({
    ok: false,
    message: err.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && status >= 500 && err.stack ? { stack: err.stack } : {})
  });
}

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
