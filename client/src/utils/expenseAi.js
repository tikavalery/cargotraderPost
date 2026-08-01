import { resolveExpenseCategory } from '../constants/financeConstants';

/** Apply AI receipt analysis to expense form state (keeps existing receipts). */
export function applyAiToExpenseForm(form, data) {
  if (!data) return form;
  const amount = Number(data.amount);
  return {
    ...form,
    date: data.date || form.date,
    category: resolveExpenseCategory(data.category) || form.category,
    description: data.description || form.description,
    amount: amount > 0 ? String(amount) : form.amount,
    currency: data.currency || form.currency,
    reference: data.reference != null && data.reference !== '' ? data.reference : form.reference,
    shipmentId: data.shipmentId != null && data.shipmentId !== '' ? data.shipmentId : form.shipmentId
  };
}
