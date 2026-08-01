import RegisterSession from '../models/RegisterSession.js';
import FinanceEntry from '../models/FinanceEntry.js';
import { ensureFinanceSynced } from '../services/financeSync.service.js';
import { toXaf } from '../utils/financeHelpers.js';
import { decrementInventory } from './posHelpers.js';

/**
 * Finalize a POS sale after payment is confirmed (inventory, finance, register).
 * Idempotent — skips side effects if already finalized.
 */
export async function finalizePaidTransaction(txn, { storeName } = {}) {
  const lines = txn.lines || [];

  if (!txn.inventoryFinalized && lines.length) {
    await decrementInventory(txn.business, lines);
    txn.inventoryFinalized = true;
  }

  const existingFinance = await FinanceEntry.findOne({
    business: txn.business,
    linkedId: `pos-${txn.transactionId}`
  }).lean();

  if (!existingFinance) {
    await FinanceEntry.create({
      business: txn.business,
      type: 'revenue',
      date: txn.date || new Date(),
      source: 'POS',
      amount: txn.total,
      currency: 'XAF',
      amountXaf: toXaf(txn.total, 'XAF'),
      linkedId: `pos-${txn.transactionId}`,
      description: `POS sale · ${storeName || txn.storeName || 'Store'}`,
      reference: txn.transactionId,
      auto: true
    });
    await ensureFinanceSynced(txn.business, { force: true });
  }

  if (txn.paymentStatus !== 'paid') {
    let register = await RegisterSession.findOne({
      business: txn.business,
      storeId: txn.storeId,
      open: true
    });

    if (!register) {
      register = await RegisterSession.create({
        business: txn.business,
        storeId: txn.storeId,
        cashierId: txn.cashierId,
        open: true
      });
    }

    register.dayTotal += txn.total || 0;
    register.transactionCount += 1;
    await register.save();
  }

  txn.paymentStatus = 'paid';
  txn.status = 'completed';
  if (txn.mobileMoney) {
    txn.mobileMoney.paidAt = txn.mobileMoney.paidAt || new Date();
  }
  await txn.save();

  return txn;
}
