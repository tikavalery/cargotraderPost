const FLW_BASE = 'https://api.flutterwave.com/v3';

function secretKey() {
  return process.env.FLUTTERWAVE_SECRET_KEY || '';
}

export function isFlutterwaveConfigured() {
  return Boolean(secretKey());
}

function authHeaders() {
  return {
    Authorization: `Bearer ${secretKey()}`,
    'Content-Type': 'application/json'
  };
}

/** Map POS payment label to Flutterwave francophone network code. */
export function paymentToFlutterwaveNetwork(payment) {
  if (payment === 'Orange Money') return 'ORANGEMONEY';
  return 'MTN';
}

/** Normalize Cameroon mobile numbers to digits without country code prefix. */
export function normalizeCameroonPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length >= 12) return digits.slice(3);
  if (digits.startsWith('00237') && digits.length >= 14) return digits.slice(5);
  return digits;
}

export function isValidCameroonMobile(phone) {
  const local = normalizeCameroonPhone(phone);
  return /^6[0-9]{8}$/.test(local);
}

/**
 * Initiate a Francophone mobile money charge (Cameroon XAF — MTN, Orange).
 * @see https://developer.flutterwave.com/docs/francophone
 */
export async function initiateFrancophoneCharge({
  amount,
  currency = 'XAF',
  phoneNumber,
  email,
  txRef,
  country = 'CM',
  network = 'MTN',
  meta = {}
}) {
  const payload = {
    phone_number: normalizeCameroonPhone(phoneNumber),
    amount: Math.round(Number(amount)),
    currency,
    country,
    email: email || 'pos@cargotrader.local',
    tx_ref: txRef,
    network,
    meta
  };

  const res = await fetch(`${FLW_BASE}/charges?type=mobile_money_franco`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== 'success') {
    const msg = body.message || body.error || `Flutterwave charge failed (${res.status})`;
    const err = new Error(msg);
    err.flutterwave = body;
    err.statusCode = res.status;
    throw err;
  }

  return body.data;
}

/** Verify a charge by Flutterwave transaction id. */
export async function verifyTransaction(transactionId) {
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    method: 'GET',
    headers: authHeaders()
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== 'success') {
    const msg = body.message || `Flutterwave verify failed (${res.status})`;
    const err = new Error(msg);
    err.flutterwave = body;
    throw err;
  }

  return body.data;
}

/** Verify a charge by tx_ref. */
export async function verifyByTxRef(txRef) {
  const res = await fetch(
    `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    { method: 'GET', headers: authHeaders() }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== 'success') {
    const msg = body.message || `Flutterwave verify_by_reference failed (${res.status})`;
    const err = new Error(msg);
    err.flutterwave = body;
    throw err;
  }

  return body.data;
}

/** Validate Flutterwave webhook using verif-hash header. */
export function verifyWebhookSignature(headerHash) {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || '';
  if (!secretHash) {
    console.warn('[flutterwave webhook] FLUTTERWAVE_SECRET_HASH not set — skipping verification');
    return process.env.NODE_ENV !== 'production';
  }
  return headerHash === secretHash;
}

export function isSuccessfulCharge(data) {
  const status = String(data?.status || '').toLowerCase();
  return status === 'successful' || status === 'success';
}
