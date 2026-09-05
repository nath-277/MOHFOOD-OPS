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
  "PERISHABLE_MEASURED",      // Milk, Sugar, Oats (kg, cups)
  "PERISHABLE_NUMBERED",      // Apples, Grapes, Coconut (count)
  "PACKAGING_NON_PERISHABLE", // Cups, Covers, Foil, Bottles, Labels
]);

export const shiftTypeEnum = pgEnum("shift_type", [
  "MORNING_SHIFT",
  "NIGHT_SHIFT",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "INBOUND_PURCHASE",
  "DISPENSE_PRODUCTION",
  "RETURN_FAULT_REPLACE",
  "RETURN_EXCESS_RESTOCK",
  "DISPOSAL_EXPIRED_SPOILT",
  "RECONCILIATION_ADJUST",
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
// AUDIT LOGS (Immutable Event Stream)
// ==========================================
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g. "AUTH_LOGIN", "DISPENSE_BATCH", "PIN_SWITCH"
  entity: text("entity").notNull(), // e.g. "SESSION", "STOCK", "RETAIL_PARTNER"
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

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
