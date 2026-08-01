import { createModel } from '../db/createModel.js';
import { enforceInventoryItemLimit } from '../utils/inventoryPlanEnforcement.js';

const Item = createModel('Item', {
  statics: {
    async reconcileIndexes() {},
    async saveNew(data) {
      const doc = new Item(data);
      await doc.save();
      return doc;
    }
  }
});

export default Item;
