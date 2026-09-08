import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// CORE ENUMS
// ==========================================
export const departmentTypeEnum = pgEnum("department_type", [
  "EXECUTIVE_MANAGEMENT",
  "INVENTORY_STORE",
  "PRODUCTION",
  "PRODUCT_STORAGE",
  "LOGISTICS",
  "ACCOUNTING",
  "MEDIA",
  "CLEANERS",
  "MERCHANDISERS",
  "PROCUREMENT",
]);

export const userRoleEnum = pgEnum("user_role", [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "STORE_MANAGER",
  "STORE_OFFICER",
  "PRODUCTION_SUPERVISOR",
  "LOGISTICS_OFFICER",
  "ACCOUNTANT",
  "STAFF",
]);

export const itemCategoryEnum = pgEnum("item_category", [
  "PERISHABLE_MEASURED",      // Milk, Sugar, Oats, Granola (kg, cups)
  "PERISHABLE_NUMBERED",      // Apples, Grapes, Coconut (count)
  "PACKAGING_NON_PERISHABLE", // Cups, Covers, Foil, Bottles, Labels
]);

export const shiftTypeEnum = pgEnum("shift_type", [
  "MORNING_SHIFT",
  "NIGHT_SHIFT",
]);

export const shiftStatusEnum = pgEnum("shift_status", [
  "OPEN",
  "CLOSED",
  "RECONCILED",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "INBOUND_PURCHASE",       // Supplier delivery into store
  "DISPENSE_PRODUCTION",    // Dispensed for morning/night shift batch
  "RETURN_FAULT_REPLACE",   // Defective item returned & replaced
  "RETURN_EXCESS_RESTOCK",  // Unused ingredient returned from shift
  "DISPOSAL_EXPIRED_SPOILT",// Written off stock
  "RECONCILIATION_ADJUST",  // Physical count audit correction
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "PENDING_VERIFICATION",
  "MATCHED_TO_DELIVERY",
  "PAYMENT_RECONCILED",
  "DISPUTED",
]);

export const consignmentStatusEnum = pgEnum("consignment_status", [
  "DELIVERED",
  "RECONCILED",
  "SETTLED",
]);

export const consignmentReturnReasonEnum = pgEnum("consignment_return_reason", [
  "EXPIRED_ON_SHELF",
  "BROKEN_SEAL",
  "COLD_CHAIN_FAILURE",
  "DAMAGED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "BANK_TRANSFER",
  "CHEQUE",
  "CASH",
]);

export const stockistStatusEnum = pgEnum("stockist_status", [
  "ACTIVE",
  "PENDING_SETTLEMENT",
  "VERIFIED_PAID",
  "OVERDUE",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "SCHEDULED",
  "MIXING",
  "PACKAGING",
  "QUALITY_PASSED",
  "COMPLETED",
  "CANCELLED",
]);

export const equipmentStatusEnum = pgEnum("equipment_status", [
  "RUNNING",
  "STANDBY",
  "MAINTENANCE",
  "CIP_CLEANING",
]);

export const coolingStatusEnum = pgEnum("cooling_status", [
  "NORMAL_CHILLED",
  "WARNING_TEMP",
  "DEFROST",
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "AVAILABLE",
  "ON_DELIVERY_RUN",
  "MAINTENANCE",
]);

export const runStatusEnum = pgEnum("run_status", [
  "SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED_COLLECTING",
  "RETURNED_RECONCILED",
]);

export const stopStatusEnum = pgEnum("stop_status", [
  "PENDING",
  "DELIVERED",
  "RETURN_COLLECTED",
]);

export const finishedGoodsStatusEnum = pgEnum("finished_goods_status", [
  "IN_CHILLER",
  "PARTIALLY_DISPATCHED",
  "DEPLETED",
  "EXPIRED",
]);

export const finishedGoodsTransferTypeEnum = pgEnum("finished_goods_transfer_type", [
  "INTAKE_FROM_PRODUCTION",
  "DISPATCH_TO_RIDER",
  "RETURN_COLLECTED_SPOILT",
]);

// ==========================================
// DEPARTMENTS
// ==========================================
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: departmentTypeEnum("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// USERS & OPERATORS
// ==========================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: text("staff_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  role: userRoleEnum("role").default("STAFF").notNull(),
  phone: text("phone"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// QUICK PINS (For Floor Tablet Fast Switching)
// ==========================================
export const userPins = pgTable("user_pins", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// SESSIONS
// ==========================================
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  activeShift: shiftTypeEnum("active_shift"),
  deviceName: text("device_name"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// INVENTORY: ITEMS
// ==========================================
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. "RAW-MLK-01", "PKG-CUP-400"
  name: text("name").notNull(),
  category: itemCategoryEnum("category").notNull(),
  uom: text("uom").notNull(), // "kg", "g", "cup", "count", "pack", "roll", "unit"
  currentStock: numeric("current_stock", { precision: 12, scale: 3 }).notNull().default("0.000"),
  minStockThreshold: numeric("min_stock_threshold", { precision: 12, scale: 3 }).notNull().default("10.000"),
  costPerUnit: numeric("cost_per_unit", { precision: 12, scale: 2 }).default("0.00"),
  storageLocation: text("storage_location"), // "Cold Room A", "Dry Store Shelf 3", "Packaging Bay"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// INVENTORY: ITEM LOTS / BATCHES
// ==========================================
export const itemLots = pgTable("item_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }).notNull(),
  lotNumber: text("lot_number").notNull().unique(), // e.g. "LOT-2026-0901-MLK"
  supplierName: text("supplier_name").notNull(),
  arrivalDate: timestamp("arrival_date", { withTimezone: true }).defaultNow().notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  initialQuantity: numeric("initial_quantity", { precision: 12, scale: 3 }).notNull(),
  remainingQuantity: numeric("remaining_quantity", { precision: 12, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).default("0.00"),
  grnNumber: text("grn_number"), // Goods Received Note
  waybillUrl: text("waybill_url"), // Cloudflare R2 file URL
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// INVENTORY: STOCK TRANSACTIONS (Append-only Ledger)
// ==========================================
export const stockTransactions = pgTable("stock_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  lotId: uuid("lot_id").references(() => itemLots.id),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  performedBy: uuid("performed_by").references(() => users.id),
  performedByName: text("performed_by_name"),
  recipient: text("recipient"), // e.g. "Production Shift Supervisor (David Adeleke)"
  referenceId: text("reference_id"), // e.g. Batch Code, Requisition Number
  notes: text("notes"), // Fault reason, spillage explanation, or restock condition
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// FINISHED PRODUCT RECIPES / BOM (Bill of Materials)
// ==========================================
export const productRecipes = pgTable("product_recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. "REC-PARFAIT-400ML", "REC-GREEK-500ML"
  name: text("name").notNull(),
  description: text("description"),
  yieldQuantity: integer("yield_quantity").default(1).notNull(),
  yieldUnit: text("yield_unit").default("cup").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id").references(() => productRecipes.id, { onDelete: "cascade" }).notNull(),
  itemId: uuid("item_id").references(() => items.id).notNull(),
  quantityRequired: numeric("quantity_required", { precision: 12, scale: 3 }).notNull(),
  uom: text("uom").notNull(),
});

// ==========================================
// SHIFT RECORDS & RECONCILIATIONS
// ==========================================
export const shiftRecords = pgTable("shift_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  shiftDate: text("shift_date").notNull(), // "YYYY-MM-DD"
  openedBy: uuid("opened_by").references(() => users.id),
  closedBy: uuid("closed_by").references(() => users.id),
  status: shiftStatusEnum("status").default("OPEN").notNull(),
  totalVariances: integer("total_variances").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// ==========================================
// AUDIT LOGS (Immutable Event Stream)
// ==========================================
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// MANAGEMENT: RETAIL STOCKISTS (Supermarkets & Outlets)
// ==========================================
export const retailStockists = pgTable("retail_stockists", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. "STK-HUBMART-IKJ"
  name: text("name").notNull(),
  location: text("location").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  standardUnitPrice: numeric("standard_unit_price", { precision: 10, scale: 2 }).default("2000.00"),
  paymentTerms: text("payment_terms").default("Sale or Return (SoR)"),
  status: stockistStatusEnum("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// MANAGEMENT: CONSIGNMENT DELIVERIES (SoR Dispatches)
// ==========================================
export const consignmentDeliveries = pgTable("consignment_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockistId: uuid("stockist_id").references(() => retailStockists.id, { onDelete: "cascade" }).notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  quantityDelivered: integer("quantity_delivered").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  driverName: text("driver_name"),
  waybillNumber: text("waybill_number"),
  dispatchDate: timestamp("dispatch_date", { withTimezone: true }).defaultNow().notNull(),
  status: consignmentStatusEnum("status").default("DELIVERED").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// MANAGEMENT: CONSIGNMENT RETURNS (Expired/Damaged on Shelf)
// ==========================================
export const consignmentReturns = pgTable("consignment_returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockistId: uuid("stockist_id").references(() => retailStockists.id, { onDelete: "cascade" }).notNull(),
  productCode: text("product_code").notNull(),
  quantityReturned: integer("quantity_returned").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).notNull(),
  reason: consignmentReturnReasonEnum("reason").notNull(),
  returnDate: timestamp("return_date", { withTimezone: true }).defaultNow().notNull(),
  receivedBy: text("received_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// MANAGEMENT: CONSIGNMENT PAYMENTS
// ==========================================
export const consignmentPayments = pgTable("consignment_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  stockistId: uuid("stockist_id").references(() => retailStockists.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  reference: text("reference"),
  paymentDate: timestamp("payment_date", { withTimezone: true }).defaultNow().notNull(),
  receivedBy: text("received_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// MANAGEMENT: WHATSAPP INVOICES & WAYBILLS
// ==========================================
export const whatsappInvoices = pgTable("whatsapp_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  senderPhone: text("sender_phone"),
  uploadDate: timestamp("upload_date", { withTimezone: true }).defaultNow().notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  status: invoiceStatusEnum("status").default("PENDING_VERIFICATION").notNull(),
  matchedOrderId: text("matched_order_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// PRODUCTION: WORK ORDERS & BATCH RUNS
// ==========================================
export const productionWorkOrders = pgTable("production_work_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // e.g. "WO-2026-0905-01"
  recipeCode: text("recipe_code").notNull(),
  recipeName: text("recipe_name").notNull(),
  targetQuantity: integer("target_quantity").notNull(),
  actualYield: integer("actual_yield"),
  scrapQuantity: integer("scrap_quantity").default(0),
  yieldEfficiency: numeric("yield_efficiency", { precision: 5, scale: 2 }),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  supervisorName: text("supervisor_name").notNull(),
  mixingTankName: text("mixing_tank_name").notNull(),
  status: workOrderStatusEnum("status").default("SCHEDULED").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ==========================================
// PRODUCTION: EQUIPMENT & LINE STATUS
// ==========================================
export const productionEquipment = pgTable("production_equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(), // e.g. "EQ-TNK-01"
  name: text("name").notNull(),
  type: text("type").notNull(),
  currentTemp: numeric("current_temp", { precision: 5, scale: 2 }),
  status: equipmentStatusEnum("status").default("STANDBY").notNull(),
  lastCleaned: timestamp("last_cleaned", { withTimezone: true }).defaultNow().notNull(),
  assignedOperator: text("assigned_operator"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// LOGISTICS: REFRIGERATED FLEET
// ==========================================
export const fleetVehicles = pgTable("fleet_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  plateNumber: text("plate_number").notNull().unique(),
  vehicleName: text("vehicle_name").notNull(),
  driverName: text("driver_name").notNull(),
  driverPhone: text("driver_phone").notNull(),
  coolingStatus: coolingStatusEnum("cooling_status").default("NORMAL_CHILLED").notNull(),
  currentTemp: numeric("current_temp", { precision: 4, scale: 1 }).default("2.8").notNull(),
  targetTempRange: text("target_temp_range").default("2.0°C – 4.0°C").notNull(),
  capacityUnits: integer("capacity_units").notNull(),
  status: vehicleStatusEnum("status").default("AVAILABLE").notNull(),
  lastInspection: timestamp("last_inspection", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// LOGISTICS: DELIVERY RUNS & MANIFESTS
// ==========================================
export const deliveryRuns = pgTable("delivery_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dispatchNumber: text("dispatch_number").notNull().unique(), // e.g. "DSP-2026-0905-01"
  vehicleId: uuid("vehicle_id").references(() => fleetVehicles.id),
  vehicleName: text("vehicle_name").notNull(),
  driverName: text("driver_name").notNull(),
  totalUnitsDispatched: integer("total_units_dispatched").notNull(),
  departureTime: timestamp("departure_time", { withTimezone: true }).defaultNow().notNull(),
  estimatedReturn: timestamp("estimated_return", { withTimezone: true }),
  status: runStatusEnum("status").default("SCHEDULED").notNull(),
  temperatureLogs: jsonb("temperature_logs"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// LOGISTICS: DELIVERY STOPS
// ==========================================
export const deliveryStops = pgTable("delivery_stops", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id").references(() => deliveryRuns.id, { onDelete: "cascade" }).notNull(),
  stockistId: text("stockist_id").notNull(),
  stockistName: text("stockist_name").notNull(),
  location: text("location").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  units: integer("units").notNull(),
  status: stopStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// PRODUCT STORAGE: FINISHED GOODS COLD ROOM
// ==========================================
export const finishedGoodsBatches = pgTable("finished_goods_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchNumber: text("batch_number").notNull().unique(), // e.g. "BATCH-PRF-2026-0908-01"
  productCode: text("product_code").notNull(), // e.g. "REC-PARFAIT-400ML"
  productName: text("product_name").notNull(),
  quantityReceived: integer("quantity_received").notNull(),
  quantityRemaining: integer("quantity_remaining").notNull(),
  yieldUnit: text("yield_unit").default("cup").notNull(),
  productionDate: timestamp("production_date", { withTimezone: true }).defaultNow().notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  coldStorageBay: text("cold_storage_bay").default("Cold Room C (Finished Goods)").notNull(),
  currentTemp: numeric("current_temp", { precision: 4, scale: 1 }).default("3.2").notNull(),
  supervisorName: text("supervisor_name").notNull(),
  status: finishedGoodsStatusEnum("status").default("IN_CHILLER").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const finishedGoodsTransfers = pgTable("finished_goods_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").references(() => finishedGoodsBatches.id, { onDelete: "set null" }),
  batchNumber: text("batch_number").notNull(),
  transferType: finishedGoodsTransferTypeEnum("transfer_type").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  driverName: text("driver_name"),
  vehiclePlate: text("vehicle_plate"),
  waybillNumber: text("waybill_number"),
  waybillPhotoUrl: text("waybill_photo_url"), // Cloudflare R2 file URL
  temperatureAtTransfer: numeric("temperature_at_transfer", { precision: 4, scale: 1 }),
  performedByName: text("performed_by_name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// RELATIONS
// ==========================================
export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  pin: one(userPins, {
    fields: [users.id],
    references: [userPins.userId],
  }),
  sessions: many(sessions),
  auditLogs: many(auditLogs),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  lots: many(itemLots),
  transactions: many(stockTransactions),
  recipeIngredients: many(recipeIngredients),
}));

export const itemLotsRelations = relations(itemLots, ({ one, many }) => ({
  item: one(items, {
    fields: [itemLots.itemId],
    references: [items.id],
  }),
  transactions: many(stockTransactions),
}));

export const productRecipesRelations = relations(productRecipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(productRecipes, {
    fields: [recipeIngredients.recipeId],
    references: [productRecipes.id],
  }),
  item: one(items, {
    fields: [recipeIngredients.itemId],
    references: [items.id],
  }),
}));

export const retailStockistsRelations = relations(retailStockists, ({ many }) => ({
  deliveries: many(consignmentDeliveries),
  returns: many(consignmentReturns),
  payments: many(consignmentPayments),
}));

export const consignmentDeliveriesRelations = relations(consignmentDeliveries, ({ one }) => ({
  stockist: one(retailStockists, {
    fields: [consignmentDeliveries.stockistId],
    references: [retailStockists.id],
  }),
}));

export const consignmentReturnsRelations = relations(consignmentReturns, ({ one }) => ({
  stockist: one(retailStockists, {
    fields: [consignmentReturns.stockistId],
    references: [retailStockists.id],
  }),
}));

export const consignmentPaymentsRelations = relations(consignmentPayments, ({ one }) => ({
  stockist: one(retailStockists, {
    fields: [consignmentPayments.stockistId],
    references: [retailStockists.id],
  }),
}));

export const fleetVehiclesRelations = relations(fleetVehicles, ({ many }) => ({
  deliveryRuns: many(deliveryRuns),
}));

export const deliveryRunsRelations = relations(deliveryRuns, ({ one, many }) => ({
  vehicle: one(fleetVehicles, {
    fields: [deliveryRuns.vehicleId],
    references: [fleetVehicles.id],
  }),
  stops: many(deliveryStops),
}));

export const deliveryStopsRelations = relations(deliveryStops, ({ one }) => ({
  run: one(deliveryRuns, {
    fields: [deliveryStops.runId],
    references: [deliveryRuns.id],
  }),
}));

export const finishedGoodsBatchesRelations = relations(finishedGoodsBatches, ({ many }) => ({
  transfers: many(finishedGoodsTransfers),
}));

export const finishedGoodsTransfersRelations = relations(finishedGoodsTransfers, ({ one }) => ({
  batch: one(finishedGoodsBatches, {
    fields: [finishedGoodsTransfers.batchId],
    references: [finishedGoodsBatches.id],
  }),
}));

