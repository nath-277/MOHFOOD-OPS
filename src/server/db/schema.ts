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
