import crypto from 'crypto';
import Store from '../models/Store.js';
import PosTransaction from '../models/PosTransaction.js';
import prisma from '../db/prisma.js';
import { serializeDoc } from '../db/serialize.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import {
  calcCartTotals,
  nextTransactionId
} from '../utils/posHelpers.js';
import { finalizePaidTransaction } from '../utils/posFinalizeTransaction.js';
import {
  initiateFrancophoneCharge,
  isFlutterwaveConfigured,
  isSuccessfulCharge,
  isValidCameroonMobile,
  normalizeCameroonPhone,
  paymentToFlutterwaveNetwork,
  verifyByTxRef,
  verifyWebhookSignature
} from '../services/flutterwaveService.js';
import { assertClerkStoreAccess, clerkStoreFilter } from '../utils/clerkScope.js';

const MOBILE_PAYMENTS = ['MTN MoMo', 'Orange Money'];

/** Lookup POS txn by Flutterwave txRef stored inside JSONB mobileMoney. */
async function findTxnByMobileMoneyTxRef(txRef, businessId = null) {
  const row = await prisma.posTransaction.findFirst({
    where: {
      ...(businessId ? { businessId: String(businessId) } : {}),
      mobileMoney: {
        path: ['txRef'],
        equals: txRef
      }
    }
  });
  if (!row) return null;
  const plain = serializeDoc(row, 'PosTransaction', { lean: true });
  const doc = await PosTransaction.findById(plain._id);
  return doc;
}

function buildFlutterwaveTxRef(businessId, transactionId) {
  const biz = String(businessId).slice(-6);
  return `POS-${biz}-${transactionId}`;
}

function parseFlutterwaveTxRef(txRef) {
  const match = String(txRef || '').match(/^POS-[a-f0-9]+-(TXN-\d+)$/i);
  return match ? match[1] : null;
}

async function markPaymentFailed(txn, message) {
  txn.paymentStatus = 'failed';
  txn.status = 'voided';
  if (txn.mobileMoney) {
    txn.mobileMoney.lastError = message;
  }
  await txn.save();
}

async function confirmMobileMoneyPayment(txn, verification) {
  if (txn.paymentStatus === 'paid') {
    return txn;
  }

  const expectedAmount = Math.round(txn.total || 0);
  const paidAmount = Math.round(Number(verification.amount || verification.charged_amount || 0));
  if (paidAmount < expectedAmount) {
    throw new ApiError(400, `Payment amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
  }

  if (!isSuccessfulCharge(verification)) {
    await markPaymentFailed(txn, verification.processor_response || verification.status);
    throw new ApiError(402, 'Mobile money payment was not successful');
  }

  if (txn.mobileMoney) {
    txn.mobileMoney.chargeId = String(verification.id || txn.mobileMoney.chargeId || '');
    txn.mobileMoney.flwRef = verification.flw_ref || verification.tx_ref;
    txn.mobileMoney.paidAt = new Date();
    txn.mobileMoney.lastError = '';
  }

  const store = await Store.findOne({ business: txn.business, storeId: txn.storeId }).lean();
  return finalizePaidTransaction(txn, { storeName: store?.name || txn.storeName });
}

/**
 * POST /api/pos/mobile-money/initiate
 * Creates a pending POS transaction and sends a MoMo prompt via Flutterwave.
 */
export const initiateMobileMoneyPayment = asyncHandler(async (req, res) => {
  if (!isFlutterwaveConfigured()) {
    throw new ApiError(
      503,
      'Mobile money is not configured. Add FLUTTERWAVE_SECRET_KEY to server/.env'
    );
  }

  const body = req.body || {};
  const storeId = clerkStoreFilter(req, body.storeId);
  if (!storeId) throw new ApiError(400, 'storeId required');
  assertClerkStoreAccess(req, storeId);

  const payment = body.payment || 'MTN MoMo';
  if (!MOBILE_PAYMENTS.includes(payment)) {
    throw new ApiError(400, 'payment must be MTN MoMo or Orange Money');
  }

  const phone = normalizeCameroonPhone(body.momoNumber || body.phone);
  if (!isValidCameroonMobile(phone)) {
    throw new ApiError(400, 'Enter a valid Cameroon mobile number (e.g. 677123456)');
  }

  const lines = body.lines || body.cart || [];
  if (!lines.length) throw new ApiError(400, 'Cart is empty');

  const promoPct = body.promoPct || 0;
  const totals = calcCartTotals(lines, body.discType, body.discVal, promoPct);
  if (totals.total <= 0) throw new ApiError(400, 'Total must be greater than zero');

  const transactionId = await nextTransactionId(req.businessId);
  const flwTxRef = buildFlutterwaveTxRef(req.businessId, transactionId);
  const store = await Store.findOne({ business: req.businessId, storeId }).lean();
  const network = paymentToFlutterwaveNetwork(payment);

  const txn = await PosTransaction.create({
    business: req.businessId,
    storeId,
    storeName: body.storeName || store?.name || 'Store',
    transactionId,
    customerName: body.customerName || 'Walk-in Customer',
    customerId: body.customerId,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    itemCount: totals.itemCount,
    payment,
    tendered: totals.total,
    change: 0,
    promoCode: body.promoCode,
    status: 'pending',
    paymentStatus: 'pending_payment',
    cashierId: req.userDoc._id,
    cashierName: req.userDoc.name || req.user.name,
    mobileMoney: {
      phone,
      network,
      txRef: flwTxRef,
      provider: 'flutterwave',
      initiatedAt: new Date()
    }
  });

  let charge;
  try {
    charge = await initiateFrancophoneCharge({
      amount: totals.total,
      currency: 'XAF',
      phoneNumber: phone,
      email: req.userDoc?.email || req.user?.email,
      txRef: flwTxRef,
      country: process.env.FLUTTERWAVE_COUNTRY || 'CM',
      network,
      meta: {
        businessId: String(req.businessId),
        transactionId,
        storeId,
        payment
      }
    });
  } catch (err) {
    console.error('[mobile-money] Flutterwave initiate failed:', err.message);
    await markPaymentFailed(txn, err.message);
    throw new ApiError(502, err.message || 'Could not initiate mobile money payment');
  }

  txn.mobileMoney.chargeId = String(charge.id || '');
  txn.mobileMoney.processorResponse = charge.processor_response || '';
  await txn.save();

  console.info(
    `[mobile-money] initiated ${transactionId} · ${flwTxRef} · ${payment} · ${phone} · ${totals.total} XAF`
  );

  res.status(201).json({
    ok: true,
    data: {
      transactionId,
      txRef: flwTxRef,
      chargeId: charge.id,
      status: charge.status || 'pending',
      message:
        charge.processor_response ||
        'Payment request sent. Ask the customer to approve on their phone.',
      paymentStatus: 'pending_payment'
    }
  });
});

/**
 * GET /api/pos/mobile-money/status/:txRef
 * Poll payment status (also triggers verify + finalize when Flutterwave reports success).
 */
export const getMobileMoneyPaymentStatus = asyncHandler(async (req, res) => {
  const txRef = req.params.txRef;
  const transactionId = parseFlutterwaveTxRef(txRef);

  const txn = transactionId
    ? await PosTransaction.findOne({ business: req.businessId, transactionId })
    : await findTxnByMobileMoneyTxRef(txRef, req.businessId);

  if (!txn) throw new ApiError(404, 'Payment not found');
  assertClerkStoreAccess(req, txn.storeId);

  if (txn.paymentStatus === 'paid') {
    return res.json({
      ok: true,
      data: {
        transactionId: txn.transactionId,
        txRef: txn.mobileMoney?.txRef,
        paymentStatus: 'paid',
        receipt: {
          transactionId: txn.transactionId,
          total: txn.total,
          payment: txn.payment
        }
      }
    });
  }

  if (txn.paymentStatus === 'failed') {
    return res.json({
      ok: true,
      data: {
        transactionId: txn.transactionId,
        txRef: txn.mobileMoney?.txRef,
        paymentStatus: 'failed',
        message: txn.mobileMoney?.lastError || 'Payment failed'
      }
    });
  }

  if (!isFlutterwaveConfigured()) {
    throw new ApiError(503, 'Flutterwave is not configured');
  }

  try {
    const verification = await verifyByTxRef(txn.mobileMoney?.txRef || txRef);
    if (isSuccessfulCharge(verification)) {
      await confirmMobileMoneyPayment(txn, verification);
      return res.json({
        ok: true,
        data: {
          transactionId: txn.transactionId,
          txRef: txn.mobileMoney?.txRef,
          paymentStatus: 'paid',
          receipt: {
            transactionId: txn.transactionId,
            total: txn.total,
            payment: txn.payment
          }
        }
      });
    }

    const pendingStatus = String(verification.status || 'pending').toLowerCase();
    if (pendingStatus === 'failed' || pendingStatus === 'cancelled') {
      await markPaymentFailed(txn, verification.processor_response || verification.status);
      return res.json({
        ok: true,
        data: {
          transactionId: txn.transactionId,
          paymentStatus: 'failed',
          message: verification.processor_response || 'Payment failed'
        }
      });
    }
  } catch (err) {
    console.warn('[mobile-money] status poll verify:', err.message);
  }

  res.json({
    ok: true,
    data: {
      transactionId: txn.transactionId,
      txRef: txn.mobileMoney?.txRef,
      paymentStatus: 'pending_payment',
      message: 'Waiting for customer to approve payment on their phone…'
    }
  });
});

/**
 * POST /api/pos/mobile-money/webhook
 * Flutterwave charge.completed webhook — mounted with express.json in index.js.
 */
export async function flutterwaveWebhookHandler(req, res) {
  const verifHash = req.headers['verif-hash'];
  if (!verifyWebhookSignature(verifHash)) {
    console.warn('[flutterwave webhook] invalid verif-hash');
    return res.status(401).json({ ok: false, message: 'Invalid signature' });
  }

  const event = req.body?.event;
  const data = req.body?.data;
  const txRef = data?.tx_ref || data?.txRef;

  console.info(`[flutterwave webhook] event=${event} tx_ref=${txRef}`);

  if (!txRef) {
    return res.status(200).json({ ok: true, message: 'ignored — no tx_ref' });
  }

  const transactionId = parseFlutterwaveTxRef(txRef);
  const txn = transactionId
    ? await PosTransaction.findOne({ transactionId })
    : await findTxnByMobileMoneyTxRef(txRef);

  if (!txn) {
    console.warn('[flutterwave webhook] no matching POS transaction for', txRef);
    return res.status(200).json({ ok: true, message: 'ignored — unknown tx_ref' });
  }

  if (txn.paymentStatus === 'paid') {
    return res.status(200).json({ ok: true, message: 'already finalized' });
  }

  try {
    if (event === 'charge.completed' || isSuccessfulCharge(data)) {
      let verification = data;
      if (data?.id && isFlutterwaveConfigured()) {
        try {
          const { verifyTransaction } = await import('../services/flutterwaveService.js');
          verification = await verifyTransaction(data.id);
        } catch (verifyErr) {
          console.warn('[flutterwave webhook] verify fallback to payload:', verifyErr.message);
        }
      }
      await confirmMobileMoneyPayment(txn, verification);
      console.info(`[flutterwave webhook] paid ${txn.transactionId}`);
    } else if (event === 'charge.failed') {
      await markPaymentFailed(txn, data?.processor_response || 'Payment failed');
      console.info(`[flutterwave webhook] failed ${txn.transactionId}`);
    }
  } catch (err) {
    console.error('[flutterwave webhook] handler error:', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }

  res.status(200).json({ ok: true });
}

/** Generate a unique tx_ref for idempotency testing without persisting. */
export function generatePosPaymentRef() {
  return `POS-${crypto.randomBytes(8).toString('hex')}`;
}
