/**
 * End-to-end API smoke test — register temp business, exercise modules + sync.
 * Usage: node scripts/smoke-test.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';
const results = [];
const stamp = Date.now();
const email = `smoketest_${stamp}@afritrade.test`;
const password = 'SmokeTest123!';

function pass(name, ok, detail = '') {
  results.push({ name, pass: !!ok, detail: String(detail).slice(0, 240) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`);
}

async function api(method, path, { token, businessId, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (businessId) headers['X-Business-Id'] = String(businessId);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { status: res.status, data };
}

function isOkCreate(r) {
  return (r.status === 200 || r.status === 201) && r.data?.ok !== false;
}

async function main() {
  let r = await api('GET', '/health');
  pass('Health + DB', r.status === 200 && r.data.status === 'ok', r.data.db?.state);

  r = await api('POST', '/auth/register', {
    body: {
      name: 'Smoke Tester',
      identifier: email,
      password,
      businessName: `Smoke Biz ${stamp}`,
      country: 'Cameroon',
      currency: 'XAF',
      role: 'Business Owner'
    }
  });
  pass('Register new business owner', r.status === 201 && r.data.ok && r.data.token, r.data.message || email);
  if (!r.data?.token) {
    console.error('Abort: register failed', r);
    process.exit(1);
  }
  let token = r.data.token;
  let businessId = r.data.user?.defaultBusinessId;
  pass('Business ID on register', !!businessId, businessId);

  r = await api('POST', '/auth/login', { body: { identifier: email, password } });
  pass('Login after register', r.status === 200 && r.data.token, r.data.message);
  token = r.data.token || token;
  businessId = r.data.user?.defaultBusinessId || businessId;

  r = await api('GET', '/auth/me', { token, businessId });
  pass('GET /auth/me', r.status === 200 && r.data.ok, r.data.user?.email);

  r = await api('GET', '/subscriptions/plans', { token, businessId });
  const plans = r.data?.plans || r.data?.data?.plans || [];
  pass('List plans', r.status === 200 && plans.length >= 3, `n=${plans.length}`);

  r = await api('GET', '/subscriptions/current', { token, businessId });
  const planId = r.data?.data?.id || r.data?.data?.plan;
  pass('Current plan is Free', r.status === 200 && (planId === 'free' || r.data?.data?.name === 'Free'), JSON.stringify(r.data?.data).slice(0, 120));

  r = await api('GET', '/subscriptions/usage', { token, businessId });
  pass('Usage payload', r.status === 200, JSON.stringify(r.data).slice(0, 140));

  r = await api('POST', '/warehouses', {
    token,
    businessId,
    body: { name: 'Smoke Warehouse', country: 'Cameroon', address: 'Yaoundé', capacityM3: 100 }
  });
  pass('Create warehouse', isOkCreate(r), r.data.message || JSON.stringify(r.data?.data).slice(0, 100));
  const wh = r.data?.data;
  const whKey = wh?.warehouseId || wh?._id;
  const whMongo = wh?._id;
  pass('Warehouse ids present', !!whKey, `warehouseId=${whKey} _id=${whMongo}`);

  r = await api('POST', '/inventory/items', {
    token,
    businessId,
    body: {
      name: 'Smoke Multimeter',
      category: 'Tools & Hardware',
      group: 'Electronics',
      qty: 10,
      warehouse: whMongo,
      purchasePrice: 15000,
      targetPrice: 25000
    }
  });
  pass('Create inventory item in warehouse', isOkCreate(r), r.data.message || JSON.stringify(r.data?.data).slice(0, 120));
  const item = r.data?.data;
  const itemId = item?._id || item?.itemId;
  pass('Item created with qty 10', item && Number(item.qty) === 10, `qty=${item?.qty} sku=${item?.sku}`);

  r = await api('GET', '/inventory/items', { token, businessId });
  const inv = r.data?.data || [];
  pass(
    'List inventory contains item',
    r.status === 200 && inv.some((i) => String(i._id) === String(itemId) || i.sku === item?.sku),
    `invCount=${inv.length}`
  );

  r = await api('GET', `/warehouses/${encodeURIComponent(whKey)}/stock`, { token, businessId });
  const stock = r.data?.data || [];
  const inStock = stock.find(
    (s) => String(s._id) === String(itemId) || s.sku === item?.sku || s.name === 'Smoke Multimeter'
  );
  pass(
    'SYNC: item appears in warehouse stock',
    r.status === 200 && !!inStock,
    inStock ? `qty=${inStock.qty}` : `stockCount=${stock.length}`
  );

  r = await api('POST', '/stores', {
    token,
    businessId,
    body: { name: 'Smoke Store Yaoundé', city: 'Yaoundé' }
  });
  pass('Create store', isOkCreate(r), r.data.message || JSON.stringify(r.data?.data).slice(0, 100));
  const store = r.data?.data;
  const storeId = store?.storeId || store?._id;
  pass('Store id present', !!storeId, storeId);

  r = await api('POST', '/warehouses/transfer', {
    token,
    businessId,
    body: {
      sourceType: 'warehouse',
      fromWarehouseId: whKey,
      destinationType: 'store',
      toDestinationId: storeId,
      items: [{ itemId, qty: 3 }]
    }
  });
  pass('Transfer warehouse → store (3 units)', r.status === 200 && r.data.ok !== false, r.data.message || JSON.stringify(r.data).slice(0, 140));

  r = await api('GET', '/inventory/items', { token, businessId });
  const afterInv = r.data?.data || [];
  const related = afterInv.filter((i) => (i.name || '').includes('Multimeter') || i.sku === item?.sku);
  const totalQty = related.reduce((s, i) => s + Number(i.qty || 0), 0);
  pass(
    'SYNC: Multimeter total qty conserved (=10)',
    totalQty === 10,
    `rows=${related.length} totalQty=${totalQty} detail=${JSON.stringify(related.map((i) => ({ qty: i.qty, loc: i.location })))}`
  );

  const atStore = related.filter(
    (i) =>
      String(i.location || '')
        .toLowerCase()
        .includes('store') || String(i.location || '').includes(store?.name || '___')
  );
  const storeUnits = atStore.reduce((s, i) => s + Number(i.qty || 0), 0);
  pass('SYNC: store holds transferred units', storeUnits === 3 || storeUnits > 0, `storeUnits=${storeUnits}`);

  const atWh = related.filter(
    (i) =>
      String(i.location || '')
        .toLowerCase()
        .includes('warehouse') || String(i.location || '').includes(wh?.name || '___')
  );
  const whUnits = atWh.reduce((s, i) => s + Number(i.qty || 0), 0);
  pass('SYNC: warehouse retains remaining units', whUnits === 7 || totalQty - storeUnits === 7, `whUnits=${whUnits}`);

  r = await api('GET', `/warehouses/${encodeURIComponent(whKey)}/stock`, { token, businessId });
  pass('Warehouse stock list after transfer', r.status === 200, `n=${(r.data?.data || []).length}`);

  // Try store inventory endpoints
  let storeInvHit = false;
  for (const p of [`/stores/${encodeURIComponent(storeId)}/inventory`, `/stores/${encodeURIComponent(storeId)}`]) {
    const sr = await api('GET', p, { token, businessId });
    if (sr.status === 200) {
      storeInvHit = true;
      pass(`GET ${p}`, true, `status=${sr.status}`);
      break;
    }
  }
  if (!storeInvHit) pass('Store detail/inventory endpoint', false, 'no matching store inventory route responded 200');

  r = await api('POST', '/shipping/shipments', {
    token,
    businessId,
    body: { origin: 'Guangzhou, CN', dest: 'Yaoundé, CM', carrier: 'DHL', status: 'In Transit' }
  });
  pass('Create shipment (1st on Free)', isOkCreate(r), r.data.message || JSON.stringify(r.data?.data).slice(0, 100));

  r = await api('POST', '/shipping/shipments', {
    token,
    businessId,
    body: { origin: 'Dubai', dest: 'Douala', carrier: 'FedEx' }
  });
  const blocked =
    r.status === 403 ||
    r.status === 400 ||
    /limit|plan|upgrade/i.test(r.data?.message || '');
  pass('2nd shipment blocked by Free yearly limit', blocked, `status=${r.status} msg=${r.data?.message || ''}`);

  r = await api('POST', '/shipments', {
    token,
    businessId,
    body: { origin: 'Lagos', dest: 'Yaoundé' }
  });
  const legacyBlocked =
    r.status === 403 ||
    r.status === 400 ||
    /limit|plan|upgrade/i.test(r.data?.message || '');
  pass('Legacy POST /shipments enforces same limit', legacyBlocked, `status=${r.status} msg=${r.data?.message || ''}`);

  r = await api('GET', '/shipping/shipments', { token, businessId });
  pass('List shipping shipments', r.status === 200, `n=${r.data?.data?.length ?? '?'}`);

  r = await api('GET', '/suppliers', { token, businessId });
  pass('GET /suppliers', r.status === 200, `n=${r.data?.data?.length ?? 0}`);
  r = await api('GET', '/purchases', { token, businessId });
  pass('GET /purchases', r.status === 200, `n=${r.data?.data?.length ?? 0}`);

  for (const p of [
    '/finance/dashboard',
    '/finance/revenue/summary',
    '/finance/expenses/summary',
    '/finance/cash-flow',
    '/finance/profit-loss',
    '/dashboard/summary'
  ]) {
    r = await api('GET', p, { token, businessId });
    pass(`GET ${p}`, r.status === 200, `status=${r.status}`);
  }

  r = await api('POST', '/finance/expenses', {
    token,
    businessId,
    body: {
      category: 'Rent / Storage',
      amount: 50000,
      description: 'Smoke rent',
      date: new Date().toISOString().slice(0, 10)
    }
  });
  pass('Create finance expense', isOkCreate(r), `status=${r.status} msg=${r.data?.message || ''}`);

  r = await api('POST', '/finance/revenue', {
    token,
    businessId,
    body: {
      source: 'Other',
      amount: 100000,
      description: 'Smoke revenue',
      date: new Date().toISOString().slice(0, 10)
    }
  });
  pass('Create finance revenue', isOkCreate(r), `status=${r.status} msg=${r.data?.message || ''}`);

  r = await api('POST', '/finance/sync', { token, businessId, body: {} });
  pass('Finance sync endpoint', r.status === 200 || r.status === 201, `status=${r.status}`);

  const saleCandidate =
    related.find((i) => Number(i.qty) > 0 && String(i.location || '').toLowerCase().includes('store')) ||
    related.find((i) => Number(i.qty) > 0) ||
    afterInv.find((i) => Number(i.qty) > 0);

  if (saleCandidate && storeId) {
    r = await api('POST', '/pos/transactions', {
      token,
      businessId,
      body: {
        storeId,
        storeName: store?.name,
        lines: [
          {
            sku: saleCandidate.sku,
            productId: saleCandidate._id,
            qty: 1,
            price: saleCandidate.targetPrice || 25000
          }
        ],
        tendered: 50000,
        customerName: 'Walk-in'
      }
    });
    pass('POS create transaction', isOkCreate(r), r.data.message || JSON.stringify(r.data).slice(0, 140));

    r = await api('GET', '/inventory/items', { token, businessId });
    const afterSale = (r.data?.data || []).filter(
      (i) => (i.name || '').includes('Multimeter') || i.sku === item?.sku || i.sku === saleCandidate.sku
    );
    const qtyAfterSale = afterSale.reduce((s, i) => s + Number(i.qty || 0), 0);
    pass(
      'SYNC: inventory qty decreases after POS sale',
      qtyAfterSale === totalQty - 1 || qtyAfterSale < totalQty,
      `before=${totalQty} after=${qtyAfterSale}`
    );
  } else {
    pass('POS create transaction', false, 'no stocked item for POS');
  }

  r = await api('GET', '/pos/transactions', { token, businessId });
  pass('List POS transactions', r.status === 200, `n=${r.data?.data?.length ?? 0}`);

  r = await api('GET', '/users/me/profile', { token, businessId });
  pass('GET profile', r.status === 200, `status=${r.status}`);
  r = await api('GET', '/locations', { token, businessId });
  pass('GET locations', r.status === 200, `n=${r.data?.data?.length ?? r.data?.locations?.length ?? 0}`);
  r = await api('GET', '/notifications', { token, businessId });
  pass('GET notifications', r.status === 200, `status=${r.status}`);
  r = await api('GET', '/invitations/roles', { token, businessId });
  pass('GET invitation roles', r.status === 200, `status=${r.status}`);
  r = await api('GET', '/auth/google/config');
  pass('GET google auth config', r.status === 200, `configured=${r.data?.configured}`);

  for (const p of ['/', '/login', '/terms', '/privacy', '/contact']) {
    const cres = await fetch(`${CLIENT}${p}`);
    const html = await cres.text();
    pass(`Client page ${p}`, cres.status === 200 && html.includes('id="root"'), `status=${cres.status}`);
  }
  const idx = await (await fetch(`${CLIENT}/`)).text();
  pass(
    'Tab title without ERP',
    idx.includes('AfriTrade Manager') && !idx.includes('— ERP') && !idx.includes('- ERP'),
    'title check'
  );

  r = await api('POST', '/warehouses', {
    token,
    businessId,
    body: { name: 'Second WH should fail' }
  });
  pass(
    'Free plan blocks 2nd warehouse',
    r.status === 403 || r.status === 400,
    `status=${r.status} msg=${r.data?.message || ''}`
  );

  const failed = results.filter((x) => !x.pass);
  console.log('\n==== SUMMARY ====');
  console.log(`Passed: ${results.filter((x) => x.pass).length} / ${results.length}`);
  console.log(`Failed: ${failed.length}`);
  failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
