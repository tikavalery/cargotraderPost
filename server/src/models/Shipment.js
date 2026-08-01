import { createModel } from '../db/createModel.js';

const Shipment = createModel('Shipment', {
  statics: {
    async reconcileIndexes() {}
  }
});

export default Shipment;
