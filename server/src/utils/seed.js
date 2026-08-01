import '../config/env.js';
import { connectDB, disconnectDB, prisma } from '../config/db.js';
import { assertDestructiveOpsAllowed } from './productionChecks.js';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Item from '../models/Item.js';
import Bale from '../models/Bale.js';
import { Purchase, Supplier } from '../models/Purchase.js';
import { Warehouse, WarehouseStaff, WarehouseLog, WarehouseDamage } from '../models/Warehouse.js';
import Shipment from '../models/Shipment.js';
import ShipmentDocument from '../models/ShipmentDocument.js';
import Store, { StoreLog } from '../models/Store.js';
import PosTransaction from '../models/PosTransaction.js';
import HeldSale from '../models/HeldSale.js';
import RegisterSession from '../models/RegisterSession.js';
import PosCustomer from '../models/PosCustomer.js';
import FinanceEntry from '../models/FinanceEntry.js';
import PromoCode from '../models/PromoCode.js';
import { reconcileInventoryLocations } from './inventoryLocationHelpers.js';
import { syncPurchaseToInventory } from './purchaseHelpers.js';
import { ensureBusinessSubscription } from '../services/subscriptionService.js';

const SAMPLE_ITEMS = [
  { itemId: 'ITM-001', sku: 'CLT-1042', name: 'Vintage Denim Jacket', category: 'Clothes', qty: 24, reorder: 10, location: 'Warehouse A — Yaoundé Hub', status: 'In Store', purchasePrice: 8500, targetPrice: 15000, icon: 'fa-vest', color: '#E85D26' },
  { itemId: 'ITM-002', sku: 'SHO-0887', name: 'Nike AF1 Sneakers', category: 'Shoes', qty: 4, reorder: 6, location: 'Warehouse A — Yaoundé Hub', status: 'In Store', purchasePrice: 28000, targetPrice: 45000, icon: 'fa-shoe-prints', color: '#1A3C5E' },
  { itemId: 'ITM-003', sku: 'ELC-0588', name: 'Samsung Phone A52', category: 'Electronics', qty: 7, reorder: 3, location: 'Warehouse B — Douala Port', status: 'In Store', purchasePrice: 95000, targetPrice: 125000, icon: 'fa-mobile-alt', color: '#27AE60' },
  { itemId: 'ITM-004', sku: 'CLT-0221', name: 'Mixed Summer Clothes', category: 'Clothes', qty: 12, reorder: 5, location: 'Warehouse A — Yaoundé Hub', status: 'Stored', purchasePrice: 5000, targetPrice: 12000, icon: 'fa-tshirt', color: '#E85D26' },
  { itemId: 'ITM-005', sku: 'BAG-0312', name: 'Leather Tote Bag', category: 'Bags', qty: 5, reorder: 8, location: 'Warehouse B — Douala Port', status: 'In Store', purchasePrice: 18500, targetPrice: 35000, icon: 'fa-shopping-bag', color: '#9B59B6' },
  { itemId: 'ITM-006', sku: 'ELC-3301', name: 'Wireless Earbuds', category: 'Electronics', qty: 1, reorder: 8, location: 'Warehouse A — Yaoundé Hub', status: 'In Store', purchasePrice: 12000, targetPrice: 22000, icon: 'fa-headphones', color: '#27AE60' },
  { itemId: 'ITM-007', sku: 'CLT-0777', name: 'Dashiki Print Top', category: 'Clothes', qty: 6, reorder: 4, location: 'Warehouse A — Yaoundé Hub', status: 'In Store', purchasePrice: 4500, targetPrice: 9000, icon: 'fa-tshirt', color: '#E85D26' },
  { itemId: 'ITM-009', sku: 'ACC-1102', name: 'Kitchen Blender', category: 'Accessories', qty: 3, reorder: 5, location: 'Warehouse B — Douala Port', status: 'On Ship', purchasePrice: 25000, targetPrice: 45000, icon: 'fa-blender', color: '#14B8A6' },
  { itemId: 'ITM-010', sku: 'CLT-0514', name: 'Floral Summer Dress', category: 'Clothes', qty: 8, reorder: 4, location: 'Warehouse A — Yaoundé Hub', status: 'In Store', purchasePrice: 6000, targetPrice: 14000, icon: 'fa-vest', color: '#E85D26' },
  { itemId: 'ITM-011', sku: 'ACC-2201', name: 'Phone Case iPhone 15', category: 'Accessories', qty: 15, reorder: 10, location: 'Warehouse A — Yaoundé Hub', status: 'Stored', purchasePrice: 1500, targetPrice: 4500, icon: 'fa-mobile-alt', color: '#14B8A6' },
  { itemId: 'ITM-012', sku: 'SHO-0444', name: 'Nike Air Max (Low Stock)', category: 'Shoes', qty: 1, reorder: 5, location: 'Warehouse B — Douala Port', status: 'In Store', purchasePrice: 32000, targetPrice: 55000, icon: 'fa-shoe-prints', color: '#1A3C5E' }
];

async function seed() {
  assertDestructiveOpsAllowed('Database seed');
  process.env.SKIP_PLAN_LIMITS = 'true';
  await connectDB();
  console.log('Seeding CargoTrader database...');

  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const row of tables) {
    if (row.tablename === '_prisma_migrations') continue;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${row.tablename}" CASCADE`);
  }

  const seedOwner = await User.create({
    name: 'Sample Owner',
    email: 'owner@cargotrader.local',
    password: 'seed-owner-change-me',
    role: 'Business Owner',
    countriesOperated: ['Cameroon'],
    preferredCurrency: 'XAF',
    preferredCurrencies: ['XAF'],
    businesses: []
  });

  const business = await Business.create({
    name: 'ThriftShip Cameroon',
    owner: seedOwner._id,
    country: 'Cameroon',
    currencies: ['XAF'],
    members: [{ user: seedOwner._id, role: 'Business Owner' }]
  });

  seedOwner.businesses.push({ business: business._id, role: 'Business Owner' });
  seedOwner.defaultBusinessId = business._id;
  await seedOwner.save();
  await ensureBusinessSubscription(business._id);

  const whA = await Warehouse.create({
    business: business._id,
    warehouseId: 'wh-a',
    name: 'Warehouse A — Yaoundé Hub',
    flag: '🇨🇲',
    address: 'Rue Nkolbisson, Yaoundé, Cameroon',
    location: 'Yaoundé',
    country: 'Cameroon',
    status: 'Operational',
    capacityM3: 480,
    manager: 'Kofi Asante',
    phone: '+237 694 200 100'
  });

  const whB = await Warehouse.create({
    business: business._id,
    warehouseId: 'wh-b',
    name: 'Warehouse B — Douala Port',
    flag: '🇨🇲',
    address: 'Zone Industrielle, Douala, Cameroon',
    location: 'Douala',
    country: 'Cameroon',
    status: 'Operational',
    capacityM3: 600,
    manager: 'Ibrahima Sow',
    phone: '+237 677 411 200'
  });

  const whC = await Warehouse.create({
    business: business._id,
    warehouseId: 'wh-c',
    name: 'Warehouse C — Bafoussam Store',
    flag: '🇨🇲',
    address: 'Marché Central, Bafoussam, Cameroon',
    location: 'Bafoussam',
    country: 'Cameroon',
    status: 'Operational',
    capacityM3: 240,
    manager: 'Aminata Diallo',
    phone: '+237 652 100 300'
  });

  const whD = await Warehouse.create({
    business: business._id,
    warehouseId: 'wh-d',
    name: 'Warehouse D — Lagos Transit',
    flag: '🇳🇬',
    address: 'Apapa Port Road, Lagos, Nigeria',
    location: 'Lagos',
    country: 'Nigeria',
    status: 'Transit Hub',
    capacityM3: 180,
    manager: 'Moussa Traoré',
    phone: '+234 803 555 0100'
  });

  await Item.insertMany(
    SAMPLE_ITEMS.map((item) => {
      const qty = item.qty;
      const purchaseValue = item.purchasePrice * qty;
      const value = item.targetPrice * qty;
      const isYaounde = item.location.includes('Yaoundé');
      const inStore = item.status === 'In Store';
      const onShip = item.status === 'On Ship';
      return {
        ...item,
        business: business._id,
        warehouse: inStore || onShip ? null : isYaounde ? whA._id : whB._id,
        storeId: inStore ? (isYaounde ? 'store-yde' : 'store-dla') : '',
        location: inStore
          ? (isYaounde ? 'ThriftShop Yaoundé — Yaoundé' : 'ThriftShop Douala — Douala')
          : item.location,
        purchaseValue,
        value,
        priceXaf: item.targetPrice,
        purchaseDate: '2025-06-01',
        createdBy: seedOwner._id
      };
    })
  );

  await Bale.insertMany([
    {
      business: business._id,
      baleId: 'BALE-001',
      name: 'Charges',
      sku: 'CLT-BALE-001',
      type: 'Grouped Item',
      category: 'Clothes',
      location: 'Warehouse A — Yaoundé Hub',
      warehouse: whA._id,
      buyValue: 12000,
      value: 24000,
      source: 'Guangzhou Import · Jun 2025',
      weight: '18 kg',
      icon: 'fa-tshirt',
      color: '#E85D26',
      itemCount: 0,
      items: []
    },
    {
      business: business._id,
      baleId: 'BALE-002',
      name: 'Flip Flop Bale',
      sku: 'SHO-BALE-007',
      type: 'Grouped Item',
      category: 'Shoes',
      location: 'Douala Warehouse',
      warehouse: whB._id,
      buyValue: 9000,
      value: 18000,
      source: 'Miami Thrift Market · May 2025',
      weight: '40 kg',
      icon: 'fa-shoe-prints',
      color: '#1A3C5E',
      itemCount: 3,
      items: [
        {
          id: '001',
          name: 'Flip Flops Mixed',
          qty: 3,
          category: 'Shoes',
          sku: 'SHO-FF-01',
          purchasePrice: 1500,
          targetPrice: 3000,
          priceXaf: 3000,
          grade: 'B'
        }
      ]
    },
    {
      business: business._id,
      baleId: 'BALE-003',
      name: 'Air Fresher Lot',
      sku: 'ACC-BALE-003',
      type: 'Grouped Item',
      category: 'Accessories',
      location: 'Douala Warehouse',
      warehouse: whB._id,
      buyValue: 240,
      value: 480,
      source: 'Marrakech Goods · Jun 2025',
      icon: 'fa-blender',
      color: '#14B8A6',
      itemCount: 16,
      items: [
        {
          id: '001',
          name: 'Air Fresher',
          qty: 16,
          category: 'Accessories',
          sku: 'SKU-1697',
          purchasePrice: 15,
          targetPrice: 30,
          priceXaf: 30,
          grade: 'A',
          condition: 'New in box'
        }
      ]
    }
  ]);

  await Supplier.insertMany([
    {
      business: business._id,
      supplierId: 'SUP-001',
      name: 'Chen Wei Wholesale',
      city: 'Guangzhou',
      country: 'CN',
      email: 'chen@wholesale.cn',
      rating: 4.8
    },
    {
      business: business._id,
      supplierId: 'SUP-002',
      name: 'TechZone Dubai',
      city: 'Dubai',
      country: 'AE',
      email: 'sales@techzone.ae',
      rating: 4.5
    },
    {
      business: business._id,
      supplierId: 'SUP-003',
      name: 'Istanbul Bazaar',
      city: 'Istanbul',
      country: 'TR',
      rating: 4.2
    },
    {
      business: business._id,
      supplierId: 'SUP-004',
      name: 'SecondWave USA',
      city: 'Miami',
      country: 'US',
      rating: 4.6
    },
    {
      business: business._id,
      supplierId: 'SUP-005',
      name: 'Marrakech Goods',
      city: 'Marrakech',
      country: 'MA',
      rating: 4.0
    }
  ]);

  const sup1 = await Supplier.findOne({ business: business._id, supplierId: 'SUP-001' });
  const sup2 = await Supplier.findOne({ business: business._id, supplierId: 'SUP-002' });
  const sup4 = await Supplier.findOne({ business: business._id, supplierId: 'SUP-004' });

  await Purchase.insertMany([
    {
      business: business._id,
      purchaseId: 'PUR-001',
      status: 'saved',
      itemName: 'Mixed Clothes Bale #12',
      sku: 'CLO-001',
      category: 'Clothes',
      quantity: 45,
      reorder: 5,
      location: 'Douala Warehouse',
      stockStatus: 'Stored',
      purchasePrice: 16000,
      purchaseValue: 720000,
      targetPrice: 37333,
      value: 1679985,
      supplier: sup1._id,
      purchaseDate: new Date('2025-06-12')
    },
    {
      business: business._id,
      purchaseId: 'PUR-002',
      status: 'saved',
      itemName: 'Nike/Adidas Sneakers Bale',
      sku: 'SHO-002',
      category: 'Shoes',
      quantity: 36,
      reorder: 6,
      location: 'Douala Warehouse',
      stockStatus: 'Stored',
      purchasePrice: 12000,
      purchaseValue: 432000,
      targetPrice: 35000,
      value: 1260000,
      supplier: sup4._id,
      purchaseDate: new Date('2025-06-08')
    },
    {
      business: business._id,
      purchaseId: 'PUR-003',
      status: 'draft',
      itemName: 'Samsung Phone Lot',
      sku: 'ELC-003',
      category: 'Electronics',
      quantity: 12,
      reorder: 3,
      location: 'On Transit',
      stockStatus: 'On Ship',
      purchasePrice: 180000,
      purchaseValue: 2160000,
      targetPrice: 300000,
      value: 3600000,
      supplier: sup2._id,
      purchaseDate: new Date('2025-06-20')
    },
    {
      business: business._id,
      purchaseId: 'PUR-004',
      status: 'saved',
      itemName: 'Black Shorts',
      sku: '',
      category: 'Clothes',
      quantity: 10,
      reorder: 5,
      location: 'Douala Warehouse',
      stockStatus: 'Stored',
      purchasePrice: 15000,
      purchaseValue: 150000,
      targetPrice: 0,
      value: 0,
      supplier: sup1._id,
      purchaseDate: new Date('2026-06-24')
    },
    {
      business: business._id,
      purchaseId: 'PUR-005',
      status: 'saved',
      itemName: 'Under Armor Shoe',
      sku: '',
      category: 'Shoes',
      quantity: 1,
      reorder: 5,
      location: 'USA WH',
      stockStatus: 'Stored',
      purchasePrice: 15000,
      purchaseValue: 15000,
      targetPrice: 0,
      value: 0,
      supplier: sup4._id,
      purchaseDate: new Date('2026-06-24')
    },
    {
      business: business._id,
      purchaseId: 'PUR-006',
      status: 'draft',
      itemName: 'Kitchen Blender Lot',
      sku: 'ACC-006',
      category: 'Accessories',
      quantity: 8,
      reorder: 4,
      location: 'Douala Port',
      stockStatus: 'On Ship',
      purchasePrice: 22000,
      purchaseValue: 176000,
      targetPrice: 45000,
      value: 360000,
      supplier: sup2._id,
      purchaseDate: new Date('2026-06-18'),
      notes: 'Awaiting port clearance'
    },
    {
      business: business._id,
      purchaseId: 'PUR-007',
      status: 'saved',
      itemName: 'Leather Bags Mix',
      sku: 'BAG-007',
      category: 'Bags',
      quantity: 15,
      reorder: 5,
      location: 'Warehouse A — Yaoundé Hub',
      stockStatus: 'Stored',
      purchasePrice: 18500,
      purchaseValue: 277500,
      targetPrice: 35000,
      value: 525000,
      supplier: sup1._id,
      purchaseDate: new Date('2026-06-10')
    }
  ]);

  await WarehouseStaff.insertMany([
    {
      business: business._id, warehouse: whA._id, staffId: 'stf-a1', firstName: 'Kofi', lastName: 'Asante',
      employeeId: 'EMP-1001', role: 'Manager', department: 'Operations', status: 'Active', shift: 'Day',
      phone: '+237 694 200 100', email: 'kofi.asante@thriftship.cm', avatarColor: 'orange'
    },
    {
      business: business._id, warehouse: whA._id, staffId: 'stf-a2', firstName: 'Fatou', lastName: 'Camara',
      employeeId: 'EMP-1002', role: 'Inventory Clerk', department: 'Inventory', status: 'Active', shift: 'Day',
      email: 'fatou.camara@thriftship.cm', avatarColor: 'green'
    },
    {
      business: business._id, warehouse: whA._id, staffId: 'stf-a3', firstName: 'Ibrahima', lastName: 'Sow',
      employeeId: 'EMP-1003', role: 'Forklift Operator', department: 'Logistics', status: 'Active', shift: 'Rotating',
      email: 'ibrahima.sow@thriftship.cm', avatarColor: ''
    },
    {
      business: business._id, warehouse: whA._id, staffId: 'stf-a4', firstName: 'Banadzem', lastName: 'Valery',
      employeeId: 'EMP-1004', role: 'Associate', department: 'Operations', status: 'Active', shift: 'Day',
      avatarColor: ''
    },
    { business: business._id, warehouse: whB._id, staffId: 'stf-b1', firstName: 'Ibrahima', lastName: 'Sow', role: 'Manager', department: 'Operations', status: 'Active', avatarColor: 'orange' },
    { business: business._id, warehouse: whB._id, staffId: 'stf-b2', firstName: 'Aminata', lastName: 'Diallo', role: 'Receiver', department: 'Logistics', status: 'Active', avatarColor: 'purple' },
    { business: business._id, warehouse: whC._id, staffId: 'stf-c1', firstName: 'Aminata', lastName: 'Diallo', role: 'Manager', department: 'Operations', status: 'Active', avatarColor: 'teal' },
    { business: business._id, warehouse: whD._id, staffId: 'stf-d1', firstName: 'Moussa', lastName: 'Traoré', role: 'Manager', department: 'Operations', status: 'Active', avatarColor: '' }
  ]);

  await WarehouseLog.insertMany([
    { business: business._id, warehouse: whA._id, type: 'inbound', desc: 'Received mixed clothes bale from Guangzhou', date: '2026-06-20', user: 'Kofi Asante', source: 'Purchase', qty: 45, ago: '4d ago' },
    { business: business._id, warehouse: whB._id, type: 'outbound', desc: 'Transferred 12 items to Warehouse A', date: '2026-06-22', user: 'Ibrahima Sow', source: 'Transfer', qty: 12, ago: '2d ago' },
    { business: business._id, warehouse: whA._id, type: 'inbound', desc: 'Stock adjustment — inventory count', date: '2026-06-23', user: 'Fatou Camara', source: 'Adjustment', qty: 3, ago: '1d ago' }
  ]);

  await Shipment.insertMany([
    { business: business._id, shipmentId: 'SHP-2025-041', trackingNumber: 'MSKU-784201', origin: 'Guangzhou', originFlag: '🇨🇳', dest: 'Douala', destFlag: '🇨🇲', carrier: 'COSCO Line', status: 'In Transit', statusBadge: 'badge-transit', eta: '2025-07-14', items: 48, weight: '142 kg', goodsCost: 2520000, shippingCost: 480000, dutiesCost: 120000, landedCostUsd: 4200, mode: 'active', container: 'MSKU-784201' },
    { business: business._id, shipmentId: 'SHP-2025-038', trackingNumber: 'MSCU-552901', origin: 'Istanbul', originFlag: '🇹🇷', dest: 'Douala', destFlag: '🇨🇲', carrier: 'MSC', status: 'Delayed', statusBadge: 'badge-delayed', eta: '2025-07-02', items: 32, weight: '98 kg', goodsCost: 2280000, shippingCost: 420000, dutiesCost: 90000, landedCostUsd: 3800, mode: 'active' },
    { business: business._id, shipmentId: 'SHP-2025-034', trackingNumber: 'MAEU-331204', origin: 'Dubai', originFlag: '🇦🇪', dest: 'Kribi', destFlag: '🇨🇲', carrier: 'Maersk', status: 'Arrived', statusBadge: 'badge-arrived', eta: '2025-06-22', items: 24, weight: '76 kg', goodsCost: 1770000, shippingCost: 320000, dutiesCost: 60000, landedCostUsd: 2950, mode: 'active' },
    { business: business._id, shipmentId: 'SHP-2025-031', trackingNumber: 'CMAU-902118', origin: 'Miami', originFlag: '🇺🇸', dest: 'Douala', destFlag: '🇨🇲', carrier: 'CMA-CGM', status: 'At Customs', statusBadge: 'badge-customs', eta: '2025-06-28', items: 15, weight: '52 kg', goodsCost: 3060000, shippingCost: 550000, dutiesCost: 140000, landedCostUsd: 5100, mode: 'active' },
    { business: business._id, shipmentId: 'SHP-2025-028', trackingNumber: 'EGLV-441002', origin: 'Yiwu', originFlag: '🇨🇳', dest: 'Lagos', destFlag: '🇳🇬', carrier: 'Evergreen', status: 'In Transit', statusBadge: 'badge-transit', eta: '2025-08-03', items: 60, weight: '185 kg', goodsCost: 4080000, shippingCost: 720000, dutiesCost: 180000, landedCostUsd: 6800, mode: 'active' },
    { business: business._id, shipmentId: 'SHP-2025-022', trackingNumber: 'Traveler carry', origin: 'Paris', originFlag: '🇫🇷', dest: 'Yaoundé', destFlag: '🇨🇲', carrier: 'Marie Dupont (Traveler)', shippingMethod: 'traveler', status: 'In Transit', statusBadge: 'badge-transit', eta: '2025-06-27', items: 18, weight: '24 kg', goodsCost: 534000, shippingCost: 120000, dutiesCost: 20000, landedCostUsd: 890, mode: 'active' },
    { business: business._id, shipmentId: 'SHP-2025-019', trackingNumber: 'MSKU-661204', origin: 'Guangzhou', originFlag: '🇨🇳', dest: 'Douala', destFlag: '🇨🇲', carrier: 'COSCO Line', status: 'Delivered', statusBadge: 'badge-delivered', eta: '2025-05-28', items: 42, weight: '128 kg', goodsCost: 2190000, shippingCost: 400000, dutiesCost: 100000, landedCostUsd: 3650, salesRevenue: 2850000, mode: 'completed', warehouseName: 'Warehouse B — Douala Port', warehouseId: 'wh-b' },
    { business: business._id, shipmentId: 'SHP-2025-015', trackingNumber: 'MSCU-441802', origin: 'Istanbul', originFlag: '🇹🇷', dest: 'Douala', destFlag: '🇨🇲', carrier: 'MSC', status: 'Delivered', statusBadge: 'badge-delivered', eta: '2025-05-12', items: 36, weight: '105 kg', goodsCost: 2460000, shippingCost: 450000, dutiesCost: 110000, landedCostUsd: 4100, salesRevenue: 3100000, mode: 'completed', warehouseName: 'Warehouse A — Yaoundé Hub', warehouseId: 'wh-a' }
  ]);

  await ShipmentDocument.insertMany([
    { business: business._id, docId: 'doc-001', shipmentId: 'SHP-2025-041', name: 'Commercial Invoice', type: 'invoice', fileName: 'INV-SHP-041.pdf', fileSize: '124 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-002', shipmentId: 'SHP-2025-041', name: 'Packing List', type: 'packing', fileName: 'PackList-041.pdf', fileSize: '88 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-003', shipmentId: 'SHP-2025-041', name: 'Bill of Lading', type: 'bl', fileName: 'BL-041.pdf', fileSize: '210 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-004', shipmentId: 'SHP-2025-041', name: 'Customs Declaration', type: 'customs', fileName: 'CD-041.pdf', fileSize: '156 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'pending' },
    { business: business._id, docId: 'doc-007', shipmentId: 'SHP-2025-038', name: 'Commercial Invoice', type: 'invoice', fileName: 'INV-SHP-038.pdf', fileSize: '118 KB', route: '🇹🇷 Istanbul → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-008', shipmentId: 'SHP-2025-038', name: 'Bill of Lading', type: 'bl', fileName: 'BL-038.pdf', fileSize: '198 KB', route: '🇹🇷 Istanbul → 🇨🇲 Douala', status: 'pending' },
    { business: business._id, docId: 'doc-009', shipmentId: 'SHP-2025-038', name: 'Customs Declaration', type: 'customs', fileName: 'CD-038.pdf', fileSize: '142 KB', route: '🇹🇷 Istanbul → 🇨🇲 Douala', status: 'expiring' },
    { business: business._id, docId: 'doc-010', shipmentId: 'SHP-2025-034', name: 'Packing List', type: 'packing', fileName: 'PackList-034.pdf', fileSize: '76 KB', route: '🇦🇪 Dubai → 🇨🇲 Kribi', status: 'verified' },
    { business: business._id, docId: 'doc-011', shipmentId: 'SHP-2025-034', name: 'Proof of Delivery', type: 'pod', fileName: 'POD-034.pdf', fileSize: '64 KB', route: '🇦🇪 Dubai → 🇨🇲 Kribi', status: 'verified' },
    { business: business._id, docId: 'doc-012', shipmentId: 'SHP-2025-031', name: 'Commercial Invoice', type: 'invoice', fileName: 'INV-SHP-031.pdf', fileSize: '132 KB', route: '🇺🇸 Miami → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-013', shipmentId: 'SHP-2025-031', name: 'Duty Payment Receipt', type: 'duty', fileName: 'DUTY-031.pdf', fileSize: '54 KB', route: '🇺🇸 Miami → 🇨🇲 Douala', status: 'pending' },
    { business: business._id, docId: 'doc-016', shipmentId: 'SHP-2025-019', name: 'Commercial Invoice', type: 'invoice', fileName: 'INV-SHP-019.pdf', fileSize: '121 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'verified' },
    { business: business._id, docId: 'doc-017', shipmentId: 'SHP-2025-019', name: 'Proof of Delivery', type: 'pod', fileName: 'POD-019.pdf', fileSize: '58 KB', route: '🇨🇳 Guangzhou → 🇨🇲 Douala', status: 'verified' }
  ]);

  const stores = await Store.insertMany([
    { business: business._id, storeId: 'store-yde', name: 'ThriftShop Yaoundé', icon: '🏪', address: 'Avenue Kennedy', city: 'Yaoundé', locationToken: 'Yaoundé', manager: 'Aminata Diallo', phone: '+237 6 77 00 11 22', shelfTarget: 120, active: true },
    { business: business._id, storeId: 'store-dla', name: 'ThriftShop Douala', icon: '🏪', address: 'Bonanjo', city: 'Douala', locationToken: 'Douala', manager: 'Jean-Paul Nkodo', phone: '+237 6 99 44 55 66', shelfTarget: 100, active: true },
    { business: business._id, storeId: 'store-kri', name: 'ThriftShop Kribi', icon: '🏪', address: 'Centre Ville', city: 'Kribi', locationToken: 'Kribi', manager: 'Marie Essomba', phone: '+237 6 55 33 22 11', shelfTarget: 80, active: true }
  ]);

  await StoreLog.insertMany([
    { business: business._id, store: stores[0]._id, storeId: 'store-yde', type: 'inbound', desc: 'Received 20× Vintage Denim Jacket from Warehouse A', date: '2026-06-20', user: 'Aminata Diallo', source: 'Warehouse Transfer', qty: 20, ago: '4d ago' },
    { business: business._id, store: stores[0]._id, storeId: 'store-yde', type: 'outbound', desc: 'Sold 2× Nike AF1 Sneakers · TXN-1001', date: '2026-06-22', user: 'Aminata Diallo', source: 'POS Sale', qty: 2, ago: '2d ago' },
    { business: business._id, store: stores[0]._id, storeId: 'store-yde', type: 'outbound', desc: 'Transferred 5× Leather Tote Bag to ThriftShop Douala', date: '2026-06-23', user: 'Aminata Diallo', source: 'Store Transfer', qty: 5, ago: '1d ago' },
    { business: business._id, store: stores[1]._id, storeId: 'store-dla', type: 'inbound', desc: 'Received 5× Leather Tote Bag from ThriftShop Yaoundé', date: '2026-06-23', user: 'Jean-Paul Nkodo', source: 'Store Transfer', qty: 5, ago: '1d ago' }
  ]);

  await PosCustomer.insertMany([
    { business: business._id, name: 'Walk-in Customer', phone: '', isWalkIn: true },
    { business: business._id, name: 'Marie Nguema', phone: '+237 677 123 456' },
    { business: business._id, name: 'Jean-Paul Fotso', phone: '+237 694 987 654' },
    { business: business._id, name: 'Aisha Bello', phone: '+237 655 321 789' }
  ]);

  await PromoCode.insertMany([
    { business: business._id, code: 'THRIFT10', discountPct: 10, active: true },
    { business: business._id, code: 'WELCOME5', discountPct: 5, active: true }
  ]);

  await RegisterSession.create({
    business: business._id,
    storeId: 'store-yde',
    cashierId: seedOwner._id,
    open: true,
    openedAt: new Date('2026-06-16'),
    openingFloat: 50000,
    dayTotal: 284500,
    transactionCount: 18
  });

  const sampleTxn = await PosTransaction.create({
    business: business._id,
    storeId: 'store-yde',
    storeName: 'ThriftShop Yaoundé',
    transactionId: 'TXN-0002',
    date: new Date('2026-08-18T14:30:00'),
    customerName: 'Walk-in Customer',
    lines: [{
      productId: 'ITM-003',
      sku: 'ELC-0588',
      name: 'Samsung Phone A52',
      price: 85500,
      qty: 1,
      category: 'Electronics',
      catLabel: 'ELECTRONICS'
    }],
    subtotal: 85500,
    discount: 0,
    total: 85500,
    payment: 'Cash',
    tendered: 100000,
    change: 14500,
    itemCount: 1,
    cashierId: seedOwner._id,
    cashierName: 'Sample Owner',
    status: 'completed'
  });

  await FinanceEntry.create({
    business: business._id,
    type: 'revenue',
    source: 'POS',
    amount: sampleTxn.total,
    linkedId: `pos-${sampleTxn.transactionId}`,
    description: `POS sale ${sampleTxn.transactionId} — ThriftShop Yaoundé`,
    date: sampleTxn.date
  });

  const shp041 = await Shipment.findOne({ business: business._id, shipmentId: 'SHP-2025-041' });
  if (shp041) {
    await Item.updateMany(
      {
        business: business._id,
        status: { $in: ['On Ship', 'In Transit'] },
        $or: [{ shipment: { $exists: false } }, { shipment: null }]
      },
      {
        $set: { shipment: shp041._id, location: 'On Transit' },
        $unset: { warehouse: '', storeId: '' }
      }
    );
  }

  const savedPurchases = await Purchase.find({ business: business._id, status: 'saved' });
  for (const purchase of savedPurchases) {
    const supplier = purchase.supplier ? await Supplier.findById(purchase.supplier) : null;
    await syncPurchaseToInventory(purchase, supplier);
  }

  await reconcileInventoryLocations(business._id);

  console.log('Seed complete!');
  console.log(`Sample business ID: ${business._id}`);
  console.log('Sample seed owner (local only): owner@cargotrader.local / seed-owner-change-me');
  console.log('Prefer registering a new account for normal use.');
  await disconnectDB();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
