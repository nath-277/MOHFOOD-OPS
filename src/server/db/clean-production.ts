import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🧹 MOH FOODS NG — Production Database Wipe & Clean Slate");

  if (!db) {
    console.error("❌ No DATABASE_URL configured or database connection failed.");
    process.exit(1);
  }

  const tablesToWipe = [
    "stock_transactions",
    "item_lots",
    "shift_records",
    "whatsapp_invoices",
    "requisition_approvals",
    "consignment_deliveries",
    "consignment_returns",
    "consignment_payments",
    "production_work_orders",
    "production_shift_logs",
    "delivery_runs",
    "delivery_stops",
    "finished_goods_batches",
    "finished_goods_transfers",
    "fleet_vehicles",
    "retail_stockists",
    "production_equipment",
    "production_settings",
  ];

  const tablesToPreserve = [
    "departments",
    "users",
    "user_pins",
    "items",
    "product_recipes",
    "recipe_ingredients",
  ];

  console.log("\n1. Truncating operational and mock data tables with CASCADE...");
  const truncateSql = `TRUNCATE TABLE ${tablesToWipe.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`;
  await db.execute(sql.raw(truncateSql));
  console.log("✅ Truncate completed successfully.");

  console.log("\n2. Resetting item balances and open floor containers to zero...");
  await db.execute(
    sql.raw(`
      UPDATE "items"
      SET
        "current_stock" = '0.000',
        "in_use_quantity" = '0.000',
        "in_use_remaining_portions" = '0.000',
        "updated_at" = NOW();
    `)
  );
  console.log("✅ Items stock counts reset to 0.000.");

  console.log("\n=== POST-WIPE AUDIT VERIFICATION ===");
  console.log("\n--- Preserved Tables ---");
  for (const t of tablesToPreserve) {
    const res: any = await db.execute(sql.raw(`SELECT count(*) as count FROM "${t}";`));
    const count = res.rows ? res.rows[0].count : res[0].count;
    console.log(`  ✓ ${t.padEnd(25)}: ${count} rows`);
  }

  console.log("\n--- Cleared Tables (Must be 0) ---");
  let anyUncleared = false;
  for (const t of tablesToWipe) {
    const res: any = await db.execute(sql.raw(`SELECT count(*) as count FROM "${t}";`));
    const count = Number(res.rows ? res.rows[0].count : res[0].count);
    if (count !== 0) {
      console.error(`  ❌ ${t.padEnd(25)}: ${count} rows (EXPECTED 0!)`);
      anyUncleared = true;
    } else {
      console.log(`  ✓ ${t.padEnd(25)}: ${count} rows`);
    }
  }

  const stockSumRes: any = await db.execute(
    sql.raw(`SELECT COALESCE(SUM(current_stock), 0) as total_stock FROM "items";`)
  );
  const totalStock = stockSumRes.rows ? stockSumRes.rows[0].total_stock : stockSumRes[0].total_stock;
  console.log(`\nTotal items current_stock sum: ${totalStock}`);

  if (anyUncleared || Number(totalStock) !== 0) {
    console.error("\n❌ Database wipe verification encountered discrepancies!");
    process.exit(1);
  }

  console.log("\n🎉 Database successfully wiped and verified clean. System is ready for live production!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error during database wipe:", err);
  process.exit(1);
});
