import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let isSchemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureSchemaColumns(): Promise<void> {
  if (isSchemaEnsured || !connectionString) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    try {
      const sql = neon(connectionString);
      await sql`
        DO $$
        BEGIN
          -- product_recipes image_url
          ALTER TABLE "product_recipes" ADD COLUMN IF NOT EXISTS "image_url" text;

          -- items packaging and dual-uom columns
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "image_url" text;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "packaging_type" text DEFAULT 'DIRECT' NOT NULL;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "pack_unit" text;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "units_per_pack" numeric(12, 3);
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "carton_unit" text;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "packs_per_carton" numeric(12, 3);
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "is_variable_pack" boolean DEFAULT false NOT NULL;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "in_use_quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "in_use_unit" text;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "recipe_uom" text;
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "portions_per_container" numeric(12, 3);
          ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "in_use_remaining_portions" numeric(12, 3) DEFAULT '0.000' NOT NULL;

          -- recipe_ingredients recipe_uom
          ALTER TABLE "recipe_ingredients" ADD COLUMN IF NOT EXISTS "recipe_uom" text;

          -- stock_transactions status
          ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'PERMANENT' NOT NULL;

          -- Clean legacy in-use and benchmark data on variable items
          UPDATE "items" SET "in_use_quantity" = '0.000', "in_use_remaining_portions" = '0.000', "portions_per_container" = NULL WHERE "is_variable_pack" = true;

          -- Migrate legacy STORE_OFFICER role in database to STORE_MANAGER
          UPDATE "users" SET "role" = 'STORE_MANAGER' WHERE "role"::text = 'STORE_OFFICER';

          -- production_shift_logs table
          CREATE TABLE IF NOT EXISTS "production_shift_logs" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "shift_date" text NOT NULL,
            "shift_type" text NOT NULL,
            "supervisor_id" uuid,
            "supervisor_name" text NOT NULL,
            "status" text DEFAULT 'OPTIMAL' NOT NULL,
            "power_status" text,
            "equipment_notes" text,
            "output_summary" text,
            "incidents" text,
            "handover_notes" text,
            "notes" text,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
          );

          -- requisition_approvals table
          CREATE TABLE IF NOT EXISTS "requisition_approvals" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "reference_id" text NOT NULL UNIQUE,
            "shift_date" text NOT NULL,
            "shift_type" text NOT NULL,
            "status" text DEFAULT 'PENDING_APPROVAL' NOT NULL,
            "approved_by" text,
            "approved_by_id" uuid,
            "approved_at" timestamp with time zone,
            "notes" text,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
          );

          -- production_settings table
          CREATE TABLE IF NOT EXISTS "production_settings" (
            "id" text PRIMARY KEY DEFAULT 'default',
            "daily_target_capacity" integer DEFAULT 400 NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "updated_by" text
          );

          -- supervisor_shift_rotations table
          CREATE TABLE IF NOT EXISTS "supervisor_shift_rotations" (
            "id" text PRIMARY KEY DEFAULT 'default',
            "mode" text DEFAULT 'AUTO_WEEKLY' NOT NULL,
            "base_week_start_date" text DEFAULT '2026-09-21' NOT NULL,
            "base_morning_supervisor_id" text NOT NULL,
            "base_morning_supervisor_name" text NOT NULL,
            "base_night_supervisor_id" text NOT NULL,
            "base_night_supervisor_name" text NOT NULL,
            "manual_morning_supervisor_id" text,
            "manual_morning_supervisor_name" text,
            "manual_night_supervisor_id" text,
            "manual_night_supervisor_name" text,
            "rotation_day_of_week" integer DEFAULT 1 NOT NULL,
            "rotation_hour" integer DEFAULT 0 NOT NULL,
            "last_swapped_at" timestamp with time zone,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "updated_by" text,
            "notes" text
          );

          -- Ensure initial rotation record exists (Aishah Day / Ada Night)
          INSERT INTO "supervisor_shift_rotations" (
            "id", "mode", "base_week_start_date",
            "base_morning_supervisor_id", "base_morning_supervisor_name",
            "base_night_supervisor_id", "base_night_supervisor_name",
            "rotation_day_of_week", "rotation_hour", "notes"
          )
          VALUES (
            'default', 'AUTO_WEEKLY', '2026-09-21',
            'c620225a-d1ad-47aa-9611-030b0fd656f1', 'Aishah Anuoluwapo',
            '759ccc19-caf0-4fb8-a309-b9b29d631e71', 'Aunty Ada',
            1, 0, 'Initial weekly rotation: Aishah Morning / Ada Night'
          )
          ON CONFLICT ("id") DO NOTHING;

          -- user_notification_state table
          CREATE TABLE IF NOT EXISTS "user_notification_state" (
            "user_id" text PRIMARY KEY,
            "read_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
            "dismissed_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL
          );
        END $$;
      `;
      isSchemaEnsured = true;
    } catch (err) {
      console.warn("Schema self-healing check warning:", err);
    }
  })();

  return schemaPromise;
}

export function getDb() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Please configure your NeonDB connection string in .env.local"
    );
  }
  ensureSchemaColumns().catch(() => {});
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export const db = connectionString ? drizzle(neon(connectionString), { schema }) : null;
if (db) {
  ensureSchemaColumns().catch(() => {});
}

export { schema };
