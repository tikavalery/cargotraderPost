/** Merge AI analysis into purchase form notes without duplicating blocks */
export function mergeAiNotes(existing = '', { subCategory, suggestedDescription }) {
  const parts = [];
  if (subCategory) parts.push(`Sub-category: ${subCategory}`);
  if (suggestedDescription) parts.push(suggestedDescription);
  const aiBlock = parts.join('\n');
  const trimmed = String(existing || '').trim();
  if (!aiBlock) return trimmed;
  if (!trimmed) return aiBlock;
  if (trimmed.includes(suggestedDescription) || trimmed.includes(subCategory || '')) return trimmed;
  return `${aiBlock}\n\n${trimmed}`;
}

/** Prepend condition grade to notes when saving */
export function buildPurchaseNotes(notes = '', condition = '') {
  const trimmed = String(notes || '').trim();
  const cond = String(condition || '').trim();
  if (!cond) return trimmed;
  const label = `Condition: ${cond}`;
  if (trimmed.toLowerCase().includes(label.toLowerCase())) return trimmed;
  return trimmed ? `${label}\n\n${trimmed}` : label;
}

/** Apply AI vision response to purchase form state */
export function applyAiToPurchaseForm(form, data) {
  if (!data) return form;
  return {
    ...form,
    itemName: data.itemName || form.itemName,
    category: data.category || form.category,
    condition: data.condition || form.condition,
    purchasePrice:
      data.estimatedPurchasePrice > 0 ? String(data.estimatedPurchasePrice) : form.purchasePrice,
    targetPrice:
      data.suggestedTargetPrice > 0 ? String(data.suggestedTargetPrice) : form.targetPrice,
    notes: mergeAiNotes(form.notes, data)
  };
}
