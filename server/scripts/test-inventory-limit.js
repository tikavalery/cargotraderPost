import '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import Item from '../src/models/Item.js';
import Business from '../src/models/Business.js';
import { countInventoryItems, getBusinessSubscription } from '../src/services/subscriptionService.js';
import { getPlanLimit } from '../src/constants/plans.js';

await connectDB();
const biz = await Business.findOne().sort({ createdAt: -1 });
if (!biz) {
  console.log('NO_BUSINESS');
  process.exit(1);
}
const { planId } = await getBusinessSubscription(biz._id);
const limit = getPlanLimit(planId, 'inventoryItems');
const count = await countInventoryItems(biz._id);
console.log('business', biz._id.toString(), 'plan', planId, 'limit', limit, 'count', count);
try {
  await Item.create({
    business: biz._id,
    sku: `LIMIT-TEST-${Date.now()}`,
    name: 'Limit Test Item',
    qty: 1,
    status: 'Stored'
  });
  console.log('CREATE_SUCCEEDED (should have failed if at limit)');
} catch (e) {
  console.log('CREATE_BLOCKED:', e.message);
}
process.exit(0);
