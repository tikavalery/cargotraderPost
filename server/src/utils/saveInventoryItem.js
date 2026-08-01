import Item from '../models/Item.js';

/**
 * Create an inventory item via .save() so Mongoose middleware runs.
 * Item.create() / insertMany() skips validate hooks.
 */
export async function saveNewInventoryItem(data) {
  const doc = new Item(data);
  await doc.save();
  return doc;
}
