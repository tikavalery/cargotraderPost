import { createModel } from '../db/createModel.js';

export const Warehouse = createModel('Warehouse');
export const StockMovement = createModel('StockMovement');
export const WarehouseStaff = createModel('WarehouseStaff');
export const WarehouseLog = createModel('WarehouseLog');
export const WarehouseDamage = createModel('WarehouseDamage');

export default Warehouse;
