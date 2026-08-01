import '../config/env.js';
import { connectDB, disconnectDB, getDbStatus } from '../config/db.js';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Item from '../models/Item.js';
import { Warehouse } from '../models/Warehouse.js';

export async function deleteUsersByEmail(emails) {
  const list = (emails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  if (!list.length) {
    console.log('No emails provided');
    return { deleted: [], missing: [] };
  }

  const users = await User.find({ email: { $in: list } });
  const found = new Set(users.map((u) => u.email));
  const missing = list.filter((e) => !found.has(e));
  const deleted = [];

  console.log(
    'Found users:',
    users.map((u) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role }))
  );
  if (missing.length) console.log('Not found:', missing);

  for (const user of users) {
    const uid = String(user._id);

    const businesses = await Business.find({}).lean();
    for (const biz of businesses) {
      const members = Array.isArray(biz.members) ? biz.members : [];
      const nextMembers = members.filter((m) => String(m.user) !== uid);
      if (nextMembers.length !== members.length) {
        await Business.updateOne({ _id: biz._id }, { members: nextMembers });
        console.log(`Pulled ${user.email} from business ${biz.name}`);
      }
    }

    const owned = await Business.find({ owner: uid });
    for (const full of owned) {
      const remaining = (full.members || []).filter((m) => String(m.user) !== uid);
      if (remaining.length) {
        full.owner = remaining[0].user;
        full.members = remaining;
        await full.save();
        console.log(`Reassigned owner of "${full.name}" to ${full.owner}`);
      } else {
        const itemCount = await Item.countDocuments({ business: full._id });
        const whCount = await Warehouse.countDocuments({ business: full._id });
        console.log(`Owned business "${full.name}" items=${itemCount} warehouses=${whCount}`);
        if (itemCount === 0 && whCount === 0) {
          await Business.deleteOne({ _id: full._id });
          console.log(`Deleted empty owned business "${full.name}"`);
        } else {
          full.owner = null;
          full.members = [];
          await full.save();
          console.log(`Cleared owner on business "${full.name}" (kept data)`);
        }
      }
    }

    await User.deleteOne({ _id: uid });
    deleted.push(user.email);
    console.log('Deleted user', user.email);
  }

  return { deleted, missing };
}

async function main() {
  const { assertDestructiveOpsAllowed } = await import('./productionChecks.js');
  assertDestructiveOpsAllowed('Delete users');
  const emails = process.argv.slice(2).filter(Boolean);
  if (!emails.length) {
    console.error('Usage: node src/utils/deleteUsers.js email1@example.com [email2...]');
    process.exit(1);
  }
  await connectDB();
  console.log('Connected:', getDbStatus());
  const result = await deleteUsersByEmail(emails);
  console.log('Result:', result);
  await disconnectDB();
  console.log('Done');
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('deleteUsers.js') || process.argv[1].includes('deleteUsers'));

if (isDirectRun) {
  main().catch(async (err) => {
    console.error('Failed:', err.message);
    try {
      await disconnectDB();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}
