CREATE TYPE "public"."finished_goods_status" AS ENUM('IN_CHILLER', 'PARTIALLY_DISPATCHED', 'DEPLETED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."finished_goods_transfer_type" AS ENUM('INTAKE_FROM_PRODUCTION', 'DISPATCH_TO_RIDER', 'RETURN_COLLECTED_SPOILT');--> statement-breakpoint
ALTER TYPE "public"."department_type" ADD VALUE 'PRODUCT_STORAGE' BEFORE 'LOGISTICS';--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE 'QUALITY_PASSED' BEFORE 'COMPLETED';--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE 'CANCELLED';--> statement-breakpoint
CREATE TABLE "finished_goods_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" text NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity_received" integer NOT NULL,
	"quantity_remaining" integer NOT NULL,
	"yield_unit" text DEFAULT 'cup' NOT NULL,
	"production_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone,
	"cold_storage_bay" text DEFAULT 'Cold Room C (Finished Goods)' NOT NULL,
	"current_temp" numeric(4, 1) DEFAULT '3.2' NOT NULL,
	"supervisor_name" text NOT NULL,
	"status" "finished_goods_status" DEFAULT 'IN_CHILLER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finished_goods_batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "finished_goods_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"batch_number" text NOT NULL,
	"transfer_type" "finished_goods_transfer_type" NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"driver_name" text,
	"vehicle_plate" text,
	"waybill_number" text,
	"waybill_photo_url" text,
	"temperature_at_transfer" numeric(4, 1),
	"performed_by_name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "packaging_type" text DEFAULT 'DIRECT' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "pack_unit" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "units_per_pack" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "carton_unit" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "packs_per_carton" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_variable_pack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "in_use_quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "in_use_unit" text;--> statement-breakpoint
ALTER TABLE "product_recipes" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD COLUMN "status" text DEFAULT 'PERMANENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "finished_goods_transfers" ADD CONSTRAINT "finished_goods_transfers_batch_id_finished_goods_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."finished_goods_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_tx_created_at" ON "stock_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_item_created" ON "stock_transactions" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_ref_id" ON "stock_transactions" USING btree ("reference_id");