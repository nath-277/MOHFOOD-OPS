import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export function getDb() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Please configure your NeonDB connection string in .env.local"
    );
  }
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export const db = connectionString ? drizzle(neon(connectionString), { schema }) : null;
export { schema };
