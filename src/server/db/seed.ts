import { db, schema } from "./index";
import { hashPassword, hashPin } from "../auth/session";

async function main() {
  console.log("🌱 Moh Foods NG (MOH-OPS) - Database Seeding");

  if (!db) {
    console.log("ℹ️  No DATABASE_URL configured. In-memory demo store is ready for local sandbox.");
    return;
  }

  try {
    console.log("Creating departments...");
    const depts = [
      { code: "EXECUTIVE_MANAGEMENT" as const, name: "Executive Management", description: "C-suite, strategy and company-wide coordination" },
      { code: "INVENTORY_STORE" as const, name: "Inventory Store Department", description: "Warehouse raw materials, packaging, and shift batch dispensing" },
      { code: "PRODUCTION" as const, name: "Production Department", description: "Yogurt parfaits, greek yogurt processing, and packaging lines" },
      { code: "LOGISTICS" as const, name: "Logistics Department", description: "Cold-chain delivery fleet, dispatch, and driver waybills" },
      { code: "ACCOUNTING" as const, name: "Accounting Department", description: "Invoices, payroll, retail payment reconciliation, and bank ledgers" },
      { code: "MEDIA" as const, name: "Media & Brand Communications", description: "Marketing, content, social media, and retailer promotions" },
      { code: "CLEANERS" as const, name: "Sanitation & Hygiene", description: "Facility cleanliness, HACCP hygiene, and equipment sterilization" },
      { code: "MERCHANDISERS" as const, name: "Retail Merchandising", description: "Supermarket shelf management and expiry monitoring across Lagos/Ogun" },
      { code: "PROCUREMENT" as const, name: "Procurement Department", description: "Supplier relationship, raw material sourcing, and price contracts" },
    ];

    for (const d of depts) {
      await db.insert(schema.departments).values(d).onConflictDoNothing();
    }
    console.log("✅ Departments seeded successfully.");

    // Retrieve department records
    const allDepts = await db.select().from(schema.departments);
    const getDeptId = (code: string) => allDepts.find((d) => d.code === code)?.id;

    console.log("Creating initial users & quick PINs...");
    const defaultPassword = "ChangeThisSecurePassword123!";
    const pwHash = await hashPassword(defaultPassword);

    const seedUsers = [
      {
        staffId: "MOH-ADM-01",
        fullName: "Chief IT Systems Admin",
        email: "admin@mohfood.com",
        passwordHash: pwHash,
        departmentId: getDeptId("EXECUTIVE_MANAGEMENT"),
        role: "SUPER_ADMIN" as const,
        phone: "+2347010731559",
        pin: "1234",
      },
      {
        staffId: "MOH-EXEC-01",
        fullName: "Chief Executive Officer",
        email: "ceo@mohfood.com",
        passwordHash: pwHash,
        departmentId: getDeptId("EXECUTIVE_MANAGEMENT"),
        role: "EXECUTIVE" as const,
        phone: "+2347010731559",
        pin: "5678",
      },
      {
        staffId: "MOH-STR-01",
        fullName: "Alhaji Musa (Store Manager)",
        email: "store.manager@mohfood.com",
        passwordHash: pwHash,
        departmentId: getDeptId("INVENTORY_STORE"),
        role: "STORE_MANAGER" as const,
        phone: "+2348023456789",
        pin: "1111",
      },
      {
        staffId: "MOH-STR-02",
        fullName: "Blessing Okon (Store Officer)",
        email: "store.officer@mohfood.com",
        passwordHash: pwHash,
        departmentId: getDeptId("INVENTORY_STORE"),
        role: "STORE_OFFICER" as const,
        phone: "+2348034567890",
        pin: "2222",
      },
      {
        staffId: "MOH-PRD-01",
        fullName: "David Adeleke (Production Supervisor)",
        email: "production@mohfood.com",
        passwordHash: pwHash,
        departmentId: getDeptId("PRODUCTION"),
        role: "PRODUCTION_SUPERVISOR" as const,
        phone: "+2348045678901",
        pin: "3333",
      },
    ];

    for (const u of seedUsers) {
      const { pin, ...userData } = u;
      const inserted = await db.insert(schema.users).values(userData).onConflictDoNothing().returning();
      if (inserted.length > 0) {
        const pinH = await hashPin(pin);
        await db.insert(schema.userPins).values({
          userId: inserted[0].id,
          pinHash: pinH,
        }).onConflictDoNothing();
      }
    }

    console.log("✅ Seed users and quick PINs created.");
    console.log("🎉 Seeding complete.");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  }
}

main();
