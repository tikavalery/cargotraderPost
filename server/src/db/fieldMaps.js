/**
 * Map mongoose-style field names ↔ Prisma column names per model.
 * `toPrisma`: API/mongoose filter field → Prisma field
 * `fromPrisma`: Prisma field → API field (when different)
 */
export const MODEL_FIELD_MAPS = {
  User: {
    toPrisma: { _id: 'id', defaultBusinessId: 'defaultBusinessId' },
    fromPrisma: {}
  },
  Business: {
    toPrisma: { _id: 'id', owner: 'ownerId' },
    fromPrisma: { ownerId: 'owner' }
  },
  Item: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      warehouse: 'warehouseId',
      bale: 'baleId',
      shipment: 'shipmentId',
      purchase: 'purchaseRefId',
      createdBy: 'createdById'
    },
    fromPrisma: {
      businessId: 'business',
      warehouseId: 'warehouse',
      baleId: 'bale',
      shipmentId: 'shipment',
      purchaseRefId: 'purchase',
      createdById: 'createdBy'
    }
  },
  Warehouse: {
    toPrisma: { _id: 'id', business: 'businessId', managerUser: 'managerUserId' },
    fromPrisma: { businessId: 'business', managerUserId: 'managerUser' }
  },
  StockMovement: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      fromWarehouse: 'fromWarehouseId',
      toWarehouse: 'toWarehouseId',
      fromBale: 'fromBaleId',
      toBale: 'toBaleId',
      item: 'itemId',
      performedBy: 'performedById'
    },
    fromPrisma: {
      businessId: 'business',
      fromWarehouseId: 'fromWarehouse',
      toWarehouseId: 'toWarehouse',
      fromBaleId: 'fromBale',
      toBaleId: 'toBale',
      itemId: 'item',
      performedById: 'performedBy'
    }
  },
  WarehouseStaff: {
    toPrisma: { _id: 'id', business: 'businessId', warehouse: 'warehouseId' },
    fromPrisma: { businessId: 'business', warehouseId: 'warehouse' }
  },
  WarehouseLog: {
    toPrisma: { _id: 'id', business: 'businessId', warehouse: 'warehouseId' },
    fromPrisma: { businessId: 'business', warehouseId: 'warehouse' }
  },
  WarehouseDamage: {
    toPrisma: { _id: 'id', business: 'businessId', warehouse: 'warehouseId' },
    fromPrisma: { businessId: 'business', warehouseId: 'warehouse' }
  },
  Bale: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      warehouse: 'warehouseId',
      shipment: 'shipmentId'
    },
    fromPrisma: {
      businessId: 'business',
      warehouseId: 'warehouse',
      shipmentId: 'shipment'
    }
  },
  Purchase: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      supplier: 'supplierId',
      restockOf: 'restockOfId'
    },
    fromPrisma: {
      businessId: 'business',
      supplierId: 'supplier',
      restockOfId: 'restockOf'
    }
  },
  Supplier: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  Shipment: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      warehouse: 'warehouseRefId'
    },
    fromPrisma: {
      businessId: 'business',
      warehouseRefId: 'warehouse'
    }
  },
  ShipmentDocument: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  TrackingEvent: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  Store: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  StoreLog: {
    toPrisma: { _id: 'id', business: 'businessId', store: 'storeIdRef' },
    fromPrisma: { businessId: 'business', storeIdRef: 'store' }
  },
  PosTransaction: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      deletedBy: 'deletedById'
    },
    fromPrisma: {
      businessId: 'business',
      deletedById: 'deletedBy'
    }
  },
  HeldSale: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  RegisterSession: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  PosCustomer: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  PromoCode: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  SalesReturn: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      posTransaction: 'posTransactionId',
      returnedBy: 'returnedById'
    },
    fromPrisma: {
      businessId: 'business',
      posTransactionId: 'posTransaction',
      returnedById: 'returnedBy'
    }
  },
  Sale: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      warehouse: 'warehouseId',
      cashier: 'cashierId'
    },
    fromPrisma: {
      businessId: 'business',
      warehouseId: 'warehouse',
      cashierId: 'cashier'
    }
  },
  FinanceEntry: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  Subscription: {
    toPrisma: { _id: 'id', business: 'businessId' },
    fromPrisma: { businessId: 'business' }
  },
  StripeWebhookEvent: {
    toPrisma: { _id: 'id' },
    fromPrisma: {}
  },
  StaffInvitation: {
    toPrisma: {
      _id: 'id',
      business: 'businessId',
      invitedBy: 'invitedById',
      acceptedUser: 'acceptedUserId'
    },
    fromPrisma: {
      businessId: 'business',
      invitedById: 'invitedBy',
      acceptedUserId: 'acceptedUser'
    }
  },
  Notification: {
    toPrisma: { _id: 'id', user: 'userId', business: 'businessId' },
    fromPrisma: { userId: 'user', businessId: 'business' }
  }
};

/** Relations to omit from serialized API docs by default */
export const RELATION_KEYS = new Set([
  'owner',
  'business',
  'warehouse',
  'bale',
  'shipment',
  'purchase',
  'supplier',
  'posTransaction',
  'linkedItems',
  'items',
  'bales',
  'staff',
  'logs',
  'damages',
  'stockFrom',
  'stockTo',
  'purchases',
  'salesReturns',
  'ownedBusinesses',
  'subscription',
  'notifications',
  'fromWarehouse',
  'toWarehouse'
]);
