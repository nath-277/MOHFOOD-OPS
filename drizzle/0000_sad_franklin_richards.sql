CREATE TYPE "public"."consignment_return_reason" AS ENUM('EXPIRED_ON_SHELF', 'BROKEN_SEAL', 'COLD_CHAIN_FAILURE', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."consignment_status" AS ENUM('DELIVERED', 'RECONCILED', 'SETTLED');--> statement-breakpoint
CREATE TYPE "public"."cooling_status" AS ENUM('NORMAL_CHILLED', 'WARNING_TEMP', 'DEFROST');--> statement-breakpoint
CREATE TYPE "public"."department_type" AS ENUM('EXECUTIVE_MANAGEMENT', 'INVENTORY_STORE', 'PRODUCTION', 'LOGISTICS', 'ACCOUNTING', 'MEDIA', 'CLEANERS', 'MERCHANDISERS', 'PROCUREMENT');--> statement-breakpoint
CREATE TYPE "public"."equipment_status" AS ENUM('RUNNING', 'STANDBY', 'MAINTENANCE', 'CIP_CLEANING');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('PENDING_VERIFICATION', 'MATCHED_TO_DELIVERY', 'PAYMENT_RECONCILED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."item_category" AS ENUM('PERISHABLE_MEASURED', 'PERISHABLE_NUMBERED', 'PACKAGING_NON_PERISHABLE');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('BANK_TRANSFER', 'CHEQUE', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('SCHEDULED', 'IN_TRANSIT', 'DELIVERED_COLLECTING', 'RETURNED_RECONCILED');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('OPEN', 'CLOSED', 'RECONCILED');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('MORNING_SHIFT', 'NIGHT_SHIFT');--> statement-breakpoint
CREATE TYPE "public"."stockist_status" AS ENUM('ACTIVE', 'PENDING_SETTLEMENT', 'VERIFIED_PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."stop_status" AS ENUM('PENDING', 'DELIVERED', 'RETURN_COLLECTED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('INBOUND_PURCHASE', 'DISPENSE_PRODUCTION', 'RETURN_FAULT_REPLACE', 'RETURN_EXCESS_RESTOCK', 'DISPOSAL_EXPIRED_SPOILT', 'RECONCILIATION_ADJUST');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'EXECUTIVE', 'STORE_MANAGER', 'STORE_OFFICER', 'PRODUCTION_SUPERVISOR', 'LOGISTICS_OFFICER', 'ACCOUNTANT', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('AVAILABLE', 'ON_DELIVERY_RUN', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('SCHEDULED', 'MIXING', 'PACKAGING', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignment_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stockist_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_delivered" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"driver_name" text,
	"waybill_number" text,
	"dispatch_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "consignment_status" DEFAULT 'DELIVERED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignment_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stockist_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference" text,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignment_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stockist_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"quantity_returned" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"credit_amount" numeric(12, 2) NOT NULL,
	"reason" "consignment_return_reason" NOT NULL,
	"return_date" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_number" text NOT NULL,
	"vehicle_id" uuid,
	"vehicle_name" text NOT NULL,
	"driver_name" text NOT NULL,
	"total_units_dispatched" integer NOT NULL,
	"departure_time" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_return" timestamp with time zone,
	"status" "run_status" DEFAULT 'SCHEDULED' NOT NULL,
	"temperature_logs" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_runs_dispatch_number_unique" UNIQUE("dispatch_number")
);
--> statement-breakpoint
CREATE TABLE "delivery_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stockist_id" text NOT NULL,
	"stockist_name" text NOT NULL,
	"location" text NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"units" integer NOT NULL,
	"status" "stop_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "department_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fleet_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plate_number" text NOT NULL,
	"vehicle_name" text NOT NULL,
	"driver_name" text NOT NULL,
	"driver_phone" text NOT NULL,
	"cooling_status" "cooling_status" DEFAULT 'NORMAL_CHILLED' NOT NULL,
	"current_temp" numeric(4, 1) DEFAULT '2.8' NOT NULL,
	"target_temp_range" text DEFAULT '2.0°C – 4.0°C' NOT NULL,
	"capacity_units" integer NOT NULL,
	"status" "vehicle_status" DEFAULT 'AVAILABLE' NOT NULL,
	"last_inspection" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fleet_vehicles_plate_number_unique" UNIQUE("plate_number")
);
--> statement-breakpoint
CREATE TABLE "item_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_number" text NOT NULL,
	"supplier_name" text NOT NULL,
	"arrival_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone,
	"initial_quantity" numeric(12, 3) NOT NULL,
	"remaining_quantity" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0.00',
	"grn_number" text,
	"waybill_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_lots_lot_number_unique" UNIQUE("lot_number")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "item_category" NOT NULL,
	"uom" text NOT NULL,
	"current_stock" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"min_stock_threshold" numeric(12, 3) DEFAULT '10.000' NOT NULL,
	"cost_per_unit" numeric(12, 2) DEFAULT '0.00',
	"storage_location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"yield_quantity" integer DEFAULT 1 NOT NULL,
	"yield_unit" text DEFAULT 'cup' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_recipes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "production_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"current_temp" numeric(5, 2),
	"status" "equipment_status" DEFAULT 'STANDBY' NOT NULL,
	"last_cleaned" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_operator" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_equipment_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "production_work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"recipe_code" text NOT NULL,
	"recipe_name" text NOT NULL,
	"target_quantity" integer NOT NULL,
	"actual_yield" integer,
	"scrap_quantity" integer DEFAULT 0,
	"yield_efficiency" numeric(5, 2),
	"shift_type" "shift_type" NOT NULL,
	"scheduled_date" text NOT NULL,
	"supervisor_name" text NOT NULL,
	"mixing_tank_name" text NOT NULL,
	"status" "work_order_status" DEFAULT 'SCHEDULED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "production_work_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_required" numeric(12, 3) NOT NULL,
	"uom" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retail_stockists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"standard_unit_price" numeric(10, 2) DEFAULT '2000.00',
	"payment_terms" text DEFAULT 'Sale or Return (SoR)',
	"status" "stockist_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retail_stockists_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"active_shift" "shift_type",
	"device_name" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shift_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"shift_date" text NOT NULL,
	"opened_by" uuid,
	"closed_by" uuid,
	"status" "shift_status" DEFAULT 'OPEN' NOT NULL,
	"total_variances" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"transaction_type" "transaction_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"performed_by" uuid,
	"performed_by_name" text,
	"recipient" text,
	"reference_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_pins_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"department_id" uuid,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_staff_id_unique" UNIQUE("staff_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"sender_phone" text,
	"upload_date" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(12, 2),
	"status" "invoice_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"matched_order_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_deliveries" ADD CONSTRAINT "consignment_deliveries_stockist_id_retail_stockists_id_fk" FOREIGN KEY ("stockist_id") REFERENCES "public"."retail_stockists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_payments" ADD CONSTRAINT "consignment_payments_stockist_id_retail_stockists_id_fk" FOREIGN KEY ("stockist_id") REFERENCES "public"."retail_stockists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignment_returns" ADD CONSTRAINT "consignment_returns_stockist_id_retail_stockists_id_fk" FOREIGN KEY ("stockist_id") REFERENCES "public"."retail_stockists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD CONSTRAINT "delivery_runs_vehicle_id_fleet_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."fleet_vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_stops" ADD CONSTRAINT "delivery_stops_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_lots" ADD CONSTRAINT "item_lots_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_product_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."product_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_records" ADD CONSTRAINT "shift_records_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_records" ADD CONSTRAINT "shift_records_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_lot_id_item_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."item_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_pins" ADD CONSTRAINT "user_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;