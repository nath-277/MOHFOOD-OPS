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

    // Seed Items
    console.log("Seeding inventory catalog items...");
    const seedItems = [
      { code: "RAW-MLK-01", name: "Fresh Whole Cow Milk", category: "PERISHABLE_MEASURED" as const, uom: "kg", currentStock: "450.500", minStockThreshold: "50.000", costPerUnit: "1400.00", storageLocation: "Cold Room A (4°C)" },
      { code: "RAW-MLK-02", name: "Full Cream Powdered Milk", category: "PERISHABLE_MEASURED" as const, uom: "kg", currentStock: "180.000", minStockThreshold: "30.000", costPerUnit: "3500.00", storageLocation: "Dry Store Shelf 1" },
      { code: "RAW-SGR-01", name: "Granulated White Sugar", category: "PERISHABLE_MEASURED" as const, uom: "kg", currentStock: "120.000", minStockThreshold: "25.000", costPerUnit: "1800.00", storageLocation: "Dry Store Shelf 2" },
      { code: "RAW-OAT-01", name: "Rolled Oats Flakes", category: "PERISHABLE_MEASURED" as const, uom: "kg", currentStock: "88.250", minStockThreshold: "20.000", costPerUnit: "2200.00", storageLocation: "Dry Store Shelf 3" },
      { code: "RAW-GRN-01", name: "Honey Crunchy Granola", category: "PERISHABLE_MEASURED" as const, uom: "kg", currentStock: "95.000", minStockThreshold: "25.000", costPerUnit: "3800.00", storageLocation: "Dry Store Shelf 3" },
      { code: "RAW-RSN-01", name: "Seedless Golden Raisins", category: "PERISHABLE_MEASURED" as const, uom: "cups", currentStock: "35.000", minStockThreshold: "10.000", costPerUnit: "900.00", storageLocation: "Dry Store Bin 4" },
      { code: "RAW-VAN-01", name: "Pure Vanilla Extract", category: "PERISHABLE_MEASURED" as const, uom: "L", currentStock: "15.000", minStockThreshold: "5.000", costPerUnit: "8500.00", storageLocation: "Dry Store Locked Cabinet" },
      { code: "RAW-APL-01", name: "Fresh Crisp Green Apples", category: "PERISHABLE_NUMBERED" as const, uom: "pcs", currentStock: "1420.000", minStockThreshold: "300.000", costPerUnit: "250.00", storageLocation: "Cold Room B (Fruit Bay)" },
      { code: "RAW-GRP-01", name: "Seedless Purple Grapes", category: "PERISHABLE_NUMBERED" as const, uom: "pcs", currentStock: "3200.000", minStockThreshold: "500.000", costPerUnit: "60.00", storageLocation: "Cold Room B (Fruit Bay)" },
      { code: "RAW-CCN-01", name: "Fresh Whole Coconuts", category: "PERISHABLE_NUMBERED" as const, uom: "nuts", currentStock: "385.000", minStockThreshold: "100.000", costPerUnit: "450.00", storageLocation: "Fruit Prep Bay" },
      { code: "RAW-CSH-01", name: "Roasted Cashew Nuts", category: "PERISHABLE_NUMBERED" as const, uom: "packs", currentStock: "650.000", minStockThreshold: "150.000", costPerUnit: "600.00", storageLocation: "Dry Store Shelf 4" },
      { code: "PKG-CUP-400", name: "Parfait Cups & Dome Lids (400ml)", category: "PACKAGING_NON_PERISHABLE" as const, uom: "sets", currentStock: "4800.000", minStockThreshold: "1000.000", costPerUnit: "120.00", storageLocation: "Packaging Bay A" },
      { code: "PKG-GYC-500", name: "Greek Yogurt Cups & Lids (500ml)", category: "PACKAGING_NON_PERISHABLE" as const, uom: "sets", currentStock: "2100.000", minStockThreshold: "500.000", costPerUnit: "160.00", storageLocation: "Packaging Bay A" },
      { code: "PKG-BOT-350", name: "Vanilla Yogurt Bottles & Caps (350ml)", category: "PACKAGING_NON_PERISHABLE" as const, uom: "sets", currentStock: "1650.000", minStockThreshold: "400.000", costPerUnit: "140.00", storageLocation: "Packaging Bay B" },
      { code: "PKG-FOL-01", name: "Aluminium Foil Rolls (Wide)", category: "PACKAGING_NON_PERISHABLE" as const, uom: "rolls", currentStock: "24.000", minStockThreshold: "5.000", costPerUnit: "4500.00", storageLocation: "Packaging Bay B" },
      { code: "PKG-SEAL-01", name: "Tamper-Proof Shrink Seals", category: "PACKAGING_NON_PERISHABLE" as const, uom: "units", currentStock: "9500.000", minStockThreshold: "2000.000", costPerUnit: "25.00", storageLocation: "Packaging Bay C" },
      { code: "PKG-LBL-PRF", name: "Moh Parfait NAFDAC Labels", category: "PACKAGING_NON_PERISHABLE" as const, uom: "units", currentStock: "8200.000", minStockThreshold: "1500.000", costPerUnit: "35.00", storageLocation: "Packaging Bay C" },
    ];

    for (const item of seedItems) {
      await db.insert(schema.items).values(item).onConflictDoNothing();
    }
    console.log("✅ Inventory items seeded.");

    console.log("🎉 Seeding complete.");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  }
}

main();
