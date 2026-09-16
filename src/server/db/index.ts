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
