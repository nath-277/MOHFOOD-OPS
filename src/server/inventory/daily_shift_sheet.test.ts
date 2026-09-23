import { describe, it, expect } from "bun:test";
import {
  createInventoryItem,
  receiveAdHocIntake,
  getRecentIntakes,
  updateIntake,
  cancelIntake,
  dispenseIndividualItem,
  processFaultReturnAndReplace,
  reconcileShiftStock,
  getDailyShiftStockReport,
  getItemByCode,
} from "./store";

describe("Daily Shift Stock Sheet Report", () => {
  it("should calculate exact mathematical formula: Opening + New Stock = Total, Total - Usage - Damages = Closing", async () => {
    const testCode = `TEST-OAT-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    // Create item with initial stock of 177.7 kg (matching Morning shift image)
    await createInventoryItem({
      code: testCode,
      name: "Test Rolled Oats",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 177.7,
      minStockThreshold: 20,
      costPerUnit: 2200,
      storageLocation: "Dry Store Shelf 3",
      packagingType: "DIRECT",
    });

    // Dispense 20 kg in Morning shift
    await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 20,
      performedByName: "Store Keeper",
      recipient: "Kitchen Supervisor",
      shiftType: "MORNING_SHIFT",
      notes: "Dispensed for batch granola",
    });

    // Fetch Morning shift report
    const report = await getDailyShiftStockReport({
      date: today,
      shiftType: "MORNING_SHIFT",
    });

    const row = report.rows.find((r) => r.itemCode === testCode);
    expect(row).toBeDefined();

    // Opening was 177.7 kg
    expect(row!.openingStock).toBe(177.7);
    // New stock is 0
    expect(row!.newStock).toBe(0);
    // Total stock is 177.7 + 0 = 177.7
    expect(row!.totalStock).toBe(177.7);
    // Usage is 20 kg
    expect(row!.usage).toBe(20);
    // Damages is 0
    expect(row!.damages).toBe(0);
    // Closing stock is 177.7 - 20 = 157.7 kg
    expect(row!.closingStock).toBe(157.7);

    // Fundamental identities must hold
    expect(row!.totalStock).toBe(Number((row!.openingStock + row!.newStock).toFixed(3)));
    expect(row!.closingStock).toBe(
      Number((row!.totalStock - row!.usage - row!.damages + row!.reconcileAdjust).toFixed(3))
    );
  });

  it("should record inbound intake additions under New Stock (+)", async () => {
    const testCode = `TEST-SGR-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    // Create item with 50 kg
    await createInventoryItem({
      code: testCode,
      name: "Test Granulated Sugar",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 50,
      minStockThreshold: 25,
      costPerUnit: 1800,
      storageLocation: "Dry Store Shelf 2",
      packagingType: "DIRECT",
    });

    // Receive 100 kg delivery from supplier
    await receiveAdHocIntake({
      itemCode: testCode,
      quantity: 100,
      supplierName: "Dangote Sugar Plc",
      lotNumber: `LOT-${Date.now()}`,
      performedByName: "Store Intake Officer",
      shiftType: "MORNING_SHIFT",
    });

    const report = await getDailyShiftStockReport({
      date: today,
      shiftType: "MORNING_SHIFT",
    });

    const row = report.rows.find((r) => r.itemCode === testCode);
    expect(row).toBeDefined();

    // Opening stock was 50 kg
    expect(row!.openingStock).toBe(50);
    // New stock received is 100 kg
    expect(row!.newStock).toBe(100);
    // Total stock is 150 kg
    expect(row!.totalStock).toBe(150);
    // Closing stock is 150 kg
    expect(row!.closingStock).toBe(150);
  });

  it("should record damages and scrapped defects under Damages (-)", async () => {
    const testCode = `TEST-CUP-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    // Create packaging cups with 500 pcs
    await createInventoryItem({
      code: testCode,
      name: "Test Parfait Cups 400ml",
      category: "PACKAGING_NON_PERISHABLE",
      uom: "pcs",
      currentStock: 500,
      minStockThreshold: 100,
      costPerUnit: 120,
      storageLocation: "Packaging Bay",
      packagingType: "DIRECT",
    });

    // Log 15 cracked cups scrapped
    await processFaultReturnAndReplace({
      itemCode: testCode,
      quantity: 15,
      faultReason: "Cracked / Damaged during transit",
      recipient: "Packaging Station",
      performedByName: "Store Keeper",
      shiftType: "MORNING_SHIFT",
      issueReplacement: true,
    });

    const report = await getDailyShiftStockReport({
      date: today,
      shiftType: "MORNING_SHIFT",
    });

    const row = report.rows.find((r) => r.itemCode === testCode);
    expect(row).toBeDefined();

    expect(row!.openingStock).toBe(500);
    expect(row!.damages).toBe(15);
    expect(row!.closingStock).toBe(485);
  });

  it("should reflect physical count and variance when shift is reconciled", async () => {
    const testCode = `TEST-MLK-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    await createInventoryItem({
      code: testCode,
      name: "Test Fresh Cow Milk",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 100,
      minStockThreshold: 20,
      costPerUnit: 1400,
      storageLocation: "Cold Room A",
      packagingType: "DIRECT",
    });

    // Reconcile shift with physical count of 98 kg (2 kg variance)
    await reconcileShiftStock({
      shiftType: "MORNING_SHIFT",
      counts: [
        {
          itemCode: testCode,
          physicalCount: 98,
          discrepancyNote: "2 kg spill on filling line",
        },
      ],
      performedByName: "Morning Officer",
      handoverOfficerName: "Night Officer",
      notes: "End of morning shift audit",
    });

    const report = await getDailyShiftStockReport({
      date: today,
      shiftType: "MORNING_SHIFT",
    });

    const row = report.rows.find((r) => r.itemCode === testCode);
    expect(row).toBeDefined();
    expect(row!.physicalCount).toBe(98);
    expect(row!.variance).toBe(-2);
    expect(row!.discrepancyNote).toBe("2 kg spill on filling line");
    expect(report.status).toBe("RECONCILED");
    expect(report.officerOnDuty).toBe("Morning Officer");
    expect(report.handoverOfficer).toBe("Night Officer");
  });

  it("should ensure seamless sequential continuity: Morning Closing Stock === Night Opening Stock", async () => {
    const testCode = `TEST-CONT-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    // Initial stock: 200 kg
    await createInventoryItem({
      code: testCode,
      name: "Test Continuity Item",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 200,
      minStockThreshold: 10,
      costPerUnit: 1000,
      storageLocation: "Cold Room",
      packagingType: "DIRECT",
    });

    // Morning shift dispenses 30 kg
    await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 30,
      performedByName: "Morning Officer",
      recipient: "Kitchen Lead",
      shiftType: "MORNING_SHIFT",
      notes: "Morning production run",
    });

    // Night shift dispenses 20 kg
    await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 20,
      performedByName: "Night Officer",
      recipient: "Kitchen Lead",
      shiftType: "NIGHT_SHIFT",
      notes: "Night production run",
    });

    // Fetch Morning Report
    const morningReport = await getDailyShiftStockReport({
      date: today,
      shiftType: "MORNING_SHIFT",
    });
    const morningRow = morningReport.rows.find((r) => r.itemCode === testCode);
    expect(morningRow).toBeDefined();
    expect(morningRow!.openingStock).toBe(200);
    expect(morningRow!.usage).toBe(30);
    expect(morningRow!.closingStock).toBe(170);

    // Fetch Night Report
    const nightReport = await getDailyShiftStockReport({
      date: today,
      shiftType: "NIGHT_SHIFT",
    });
    const nightRow = nightReport.rows.find((r) => r.itemCode === testCode);
    expect(nightRow).toBeDefined();
    // Night Opening MUST equal Morning Closing
    expect(nightRow!.openingStock).toBe(morningRow!.closingStock);
    expect(nightRow!.openingStock).toBe(170);
    expect(nightRow!.usage).toBe(20);
    expect(nightRow!.closingStock).toBe(150);

    // Fetch Full Day Report
    const fullDayReport = await getDailyShiftStockReport({
      date: today,
      shiftType: "ALL",
    });
    const fullDayRow = fullDayReport.rows.find((r) => r.itemCode === testCode);
    expect(fullDayRow).toBeDefined();
    expect(fullDayRow!.openingStock).toBe(200);
    expect(fullDayRow!.usage).toBe(50);
    expect(fullDayRow!.closingStock).toBe(150);
  });
});

describe("Recent Intakes Management (Edit & Delete Reversal)", () => {
  it("should record an intake, retrieve it, update its quantity and unit cost, and adjust stock balance", async () => {
    const testCode = `INTAKE-ITEM-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Cocoa Powder",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 50,
      minStockThreshold: 10,
      costPerUnit: 4000,
      storageLocation: "Dry Store Bin 4",
      packagingType: "DIRECT",
    });

    const grn = `GRN-${Date.now().toString().slice(-6)}`;
    const intakeResult = await receiveAdHocIntake({
      itemCode: testCode,
      quantity: 30,
      lotNumber: `LOT-TEST-${Date.now()}`,
      grnNumber: grn,
      unitCost: 4200,
      shiftType: "MORNING_SHIFT",
      performedByName: "Store Officer Tunde",
      notes: "Received 30 kg Cocoa Powder",
    });

    // Verify initial stock increased
    let item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(80);

    // List recent intakes
    const recent = await getRecentIntakes({ limit: 20 });
    const found = recent.find((r) => r.grnNumber === grn || r.id === intakeResult.transaction?.id);
    expect(found).toBeDefined();
    expect(found?.quantity).toBe(30);

    // Edit intake: increase quantity from 30 to 45 (+15 kg)
    const updateRes = await updateIntake({
      txId: found!.id,
      quantity: 45,
      unitCost: 4300,
      notes: "Corrected intake weight after weighbridge recount",
      performedByName: "Store Manager Ajayi",
    });
    expect(updateRes.success).toBe(true);

    item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(95);

    // Edit intake again: decrease quantity from 45 to 20 (-25 kg)
    await updateIntake({
      txId: found!.id,
      quantity: 20,
      performedByName: "Store Manager Ajayi",
    });
    item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(70);
  });

  it("should cancel an intake, reverse added stock from inventory, and mark status as CANCELLED", async () => {
    const testCode = `CANCEL-ITEM-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Flavor Concentrate",
      category: "PERISHABLE_MEASURED",
      uom: "l",
      currentStock: 40,
      minStockThreshold: 5,
      costPerUnit: 12000,
      storageLocation: "Cool Room Rack A",
      packagingType: "DIRECT",
    });

    const intakeResult = await receiveAdHocIntake({
      itemCode: testCode,
      quantity: 15,
      lotNumber: `LOT-CANCEL-${Date.now()}`,
      unitCost: 12000,
      shiftType: "MORNING_SHIFT",
      performedByName: "Store Intake Operator",
    });

    let item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(55);

    // Cancel / delete the intake
    const cancelRes = await cancelIntake({
      txId: intakeResult.transaction.id,
      performedByName: "Store Manager Ajayi",
      reason: "Damaged seal rejected by quality team",
    });
    expect(cancelRes.success).toBe(true);

    // Stock should be restored back to 40
    item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(40);

    // Recent intakes query without includeCancelled should not return it
    const activeRecent = await getRecentIntakes({ limit: 50, includeCancelled: false });
    const foundActive = activeRecent.find((r) => r.id === intakeResult.transaction.id);
    expect(foundActive).toBeUndefined();
  });

  it("should reject reducing or cancelling an intake if stock was already consumed below the intake amount", async () => {
    const testCode = `CONSUMED-ITEM-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Condensed Milk",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 10,
      minStockThreshold: 5,
      costPerUnit: 3500,
      storageLocation: "Dry Store Bin 8",
      packagingType: "DIRECT",
    });

    // Receive 50 kg -> stock becomes 60 kg
    const intakeResult = await receiveAdHocIntake({
      itemCode: testCode,
      quantity: 50,
      lotNumber: `LOT-CONSUMED-${Date.now()}`,
      shiftType: "MORNING_SHIFT",
      performedByName: "Store Staff",
    });

    // Dispense 55 kg to production -> stock becomes 5 kg
    await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 55,
      performedByName: "Store Keeper",
      recipient: "Production Floor",
      shiftType: "MORNING_SHIFT",
      notes: "Dispensed for batch run",
    });

    let item = await getItemByCode(testCode);
    expect(item?.currentStock).toBe(5);

    // Attempting to cancel 50 kg intake when only 5 kg remains should throw
    expect(
      cancelIntake({
        txId: intakeResult.transaction.id,
        performedByName: "Store Manager Ajayi",
      })
    ).rejects.toThrow("Cannot cancel intake");

    // Attempting to reduce quantity by 30 kg (from 50 to 20) when only 5 kg remains should throw
    expect(
      updateIntake({
        txId: intakeResult.transaction.id,
        quantity: 20,
        performedByName: "Store Manager Ajayi",
      })
    ).rejects.toThrow("Cannot reduce intake");
  });
});

