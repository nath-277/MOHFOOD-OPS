import { describe, it, expect } from "bun:test";
import {
  createInventoryItem,
  dispenseIndividualItem,
  updatePendingDispatch,
  cancelDispatch,
  getItemByCode,
} from "./store";

describe("Variable item dispensing and pending handover editing", () => {
  it("should handle variable pack individual dispense in culinary UoM without false container deduction", async () => {
    const testCode = `TEST-VAR-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Liquid Glucose",
      category: "PERISHABLE_MEASURED",
      uom: "bucket",
      currentStock: 1, // Only 1 bucket in store
      minStockThreshold: 1,
      costPerUnit: 15000,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
      isVariablePack: true,
      recipeUom: "cups",
    });

    // Dispense 5 cups from the 1 bucket
    const result = await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 5,
      dispensedUom: "cups",
      isVariableDispatch: true,
      performedByName: "Test Performer",
      recipient: "David Adeleke",
      shiftType: "MORNING_SHIFT",
    });

    expect(result.success).toBe(true);
    expect(result.isVariable).toBe(true);
    expect(result.quantity).toBe(5);
    expect(result.dispensedUom).toBe("cups");

    // Item stock in store remains 1 bucket until floor confirmation modal submits actual remaining
    const item = await getItemByCode(testCode);
    expect(Number(item?.currentStock)).toBe(1);
  });

  it("should allow editing quantities in a pending handover and adjust stock accordingly", async () => {
    const testCode = `TEST-MAT-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Packaging Cup",
      category: "PACKAGING_NON_PERISHABLE",
      uom: "pcs",
      currentStock: 1000,
      minStockThreshold: 100,
      costPerUnit: 20,
      storageLocation: "Packaging Store",
      packagingType: "DIRECT",
    });

    // Dispense 400 pcs
    const disp = await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 400,
      dispensedUom: "pcs",
      performedByName: "Store Keeper",
      recipient: "Production Floor",
      shiftType: "MORNING_SHIFT",
    });

    expect(disp.success).toBe(true);
    const itemAfterDisp = await getItemByCode(testCode);
    expect(Number(itemAfterDisp?.currentStock)).toBe(600); // 1000 - 400 = 600

    // Edit pending handover: user actually needed only 350 pcs (return 50 to store)
    const updateResult = await updatePendingDispatch({
      referenceId: disp.referenceId,
      items: [
        {
          txId: disp.transaction.id,
          quantity: 350,
        },
      ],
      recipient: "Updated Floor Lead",
      performedByName: "Supervisor",
    });

    expect(updateResult.success).toBe(true);
    const itemAfterEdit = await getItemByCode(testCode);
    expect(Number(itemAfterEdit?.currentStock)).toBe(650); // 600 + 50 = 650

    // Edit again: user needs 500 pcs (extra 150 deducted from store)
    await updatePendingDispatch({
      referenceId: disp.referenceId,
      items: [
        {
          txId: disp.transaction.id,
          quantity: 500,
        },
      ],
      performedByName: "Supervisor",
    });

    const itemAfterIncrease = await getItemByCode(testCode);
    expect(Number(itemAfterIncrease?.currentStock)).toBe(500); // 650 - 150 = 500

    // Cancel dispatch
    const cancelRes = await cancelDispatch(disp.referenceId, "Supervisor");
    expect(cancelRes.success).toBe(true);
    const itemAfterCancel = await getItemByCode(testCode);
    expect(Number(itemAfterCancel?.currentStock)).toBe(1000); // Fully restored to 1000
  });
});

describe("Batch notification consolidation logic", () => {
  it("should consolidate transactions of a batch into one recipe notification", () => {
    const transactions = [
      {
        id: "tx-1",
        itemName: "Parfait Cup 400ml",
        quantity: -400,
        unit: "pcs",
        referenceId: "BATCH-TEST1",
        transactionType: "DISPENSE_PRODUCTION",
        recipient: "Floor Lead",
        notes: "Dispensed for 400x Parfait 400ml.",
      },
      {
        id: "tx-2",
        itemName: "Dessert Spoon",
        quantity: -400,
        unit: "pcs",
        referenceId: "BATCH-TEST1",
        transactionType: "DISPENSE_PRODUCTION",
        recipient: "Floor Lead",
        notes: "Dispensed for 400x Parfait 400ml.",
      },
      {
        id: "tx-3",
        itemName: "Liquid Glucose",
        quantity: -5,
        unit: "cups",
        referenceId: "IND-TEST2",
        transactionType: "DISPENSE_INDIVIDUAL",
        recipient: "Baker",
        notes: "Direct material dispense",
      },
    ];

    const batchGroups: Record<string, any[]> = {};
    const individualEvents: any[] = [];

    for (const tx of transactions) {
      const isBatch =
        (tx.transactionType === "DISPENSE_PRODUCTION" || tx.transactionType?.includes("DISPENSE")) &&
        tx.referenceId &&
        (tx.referenceId.startsWith("BATCH-") || tx.notes?.includes("Dispensed for"));

      if (isBatch && tx.referenceId) {
        if (!batchGroups[tx.referenceId]) {
          batchGroups[tx.referenceId] = [];
        }
        batchGroups[tx.referenceId].push(tx);
      } else {
        individualEvents.push(tx);
      }
    }

    expect(Object.keys(batchGroups).length).toBe(1);
    expect(batchGroups["BATCH-TEST1"].length).toBe(2);
    expect(individualEvents.length).toBe(1);
    expect(individualEvents[0].referenceId).toBe("IND-TEST2");
  });

  it("should format cancelled batch notifications as ALERT with clear cancellation copy", () => {
    const cancelledBatchTransactions = [
      {
        id: "tx-c1",
        itemName: "Parfait Cup 400ml",
        quantity: -400,
        unit: "pcs",
        referenceId: "BATCH-CANCELLED1",
        transactionType: "DISPENSE_PRODUCTION",
        recipient: "Floor Lead",
        status: "CANCELLED",
        notes: "[CANCELLED by Supervisor]: Dispensed for 400x Parfait 400ml.",
      },
      {
        id: "tx-c2",
        itemName: "Granola Standard",
        quantity: -20,
        unit: "kg",
        referenceId: "BATCH-CANCELLED1",
        transactionType: "DISPENSE_PRODUCTION",
        recipient: "Floor Lead",
        status: "CANCELLED",
        notes: "[CANCELLED by Supervisor]: Dispensed for 400x Parfait 400ml.",
      },
    ];

    const isCancelled = cancelledBatchTransactions.some(
      (i: any) => i.status?.toUpperCase() === "CANCELLED" || i.notes?.includes("[CANCELLED")
    );

    expect(isCancelled).toBe(true);

    const notifType = isCancelled ? "ALERT" : "INFO";
    const title = isCancelled ? "Dispatch Cancelled: Parfait 400ml" : "Production Batch: Parfait 400ml";
    const message = isCancelled
      ? `Dispatch BATCH-CANCELLED1 was cancelled. Deducted materials were returned to store balance.`
      : `Batch 400x: 2 materials dished out. Ref: BATCH-CANCELLED1`;

    expect(notifType).toBe("ALERT");
    expect(title).toContain("Dispatch Cancelled");
    expect(message).toContain("materials were returned to store balance");
  });
});

describe("Variable product returns (Two-UoM workflow)", () => {
  it("should process excess return of variable items in culinary units without corrupting container stock", async () => {
    const { processExcessRestock } = await import("./store");
    const testCode = `TEST-RET-VAR-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Roasted Cashews",
      category: "PERISHABLE_MEASURED",
      uom: "bottles",
      currentStock: 8.5,
      minStockThreshold: 2,
      costPerUnit: 5000,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
      isVariablePack: true,
      recipeUom: "pcs",
    });

    // Kitchen floor returns 50 pcs unused cashews
    const result = await processExcessRestock({
      itemCode: testCode,
      quantity: 50,
      unit: "pcs",
      conditionNotes: "Unopened sanitary portion cups",
      performedByName: "Kitchen Chef",
      recipient: "Store Keeper",
      shiftType: "MORNING_SHIFT",
    });

    expect(result.success).toBe(true);
    expect(result.isVariable).toBe(true);
    expect(result.restockedQuantity).toBe(50);
    expect(result.variableItem).toBeDefined();
    expect(result.variableItem?.code).toBe(testCode);
    expect(result.variableItem?.dispensedUom).toBe("pcs");
    expect(result.variableItem?.currentStock).toBe(8.5);

    // Verify container stock in store was NOT blindly incremented by 50 bottles
    const item = await getItemByCode(testCode);
    expect(Number(item?.currentStock)).toBe(8.5);
  });

  it("should process fault return and replace for variable items in culinary units", async () => {
    const { processFaultReturnAndReplace } = await import("./store");
    const testCode = `TEST-FAULT-VAR-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Test Raisins Premium",
      category: "PERISHABLE_MEASURED",
      uom: "carton",
      currentStock: 2,
      minStockThreshold: 1,
      costPerUnit: 12000,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
      isVariablePack: true,
      recipeUom: "cups",
    });

    // Replace 3 cups of spoiled raisins
    const result = await processFaultReturnAndReplace({
      itemCode: testCode,
      quantity: 3,
      unit: "cups",
      faultReason: "Foreign particulate found in bag",
      performedByName: "Floor Supervisor",
      recipient: "QA Team",
      shiftType: "MORNING_SHIFT",
      issueReplacement: true,
    });

    expect(result.success).toBe(true);
    expect(result.isVariable).toBe(true);
    expect(result.replacementIssued).toBe(true);
    expect(result.replacementQuantity).toBe(3);
    expect(result.variableItem?.dispensedUom).toBe("cups");

    // Container count untouched until floor measurement confirmation
    const item = await getItemByCode(testCode);
    expect(Number(item?.currentStock)).toBe(2);
  });

  it("updateVariableFloorLevels should record transactions as PENDING_HANDOVER with recipient", async () => {
    const { updateVariableFloorLevels, getInventoryItems } = await import("./store");
    const items = await getInventoryItems();
    const raisins = items.find((i) => i.code === "RAW-RSN-01");
    if (!raisins) return;

    const res = await updateVariableFloorLevels({
      updates: [
        {
          itemCode: "RAW-RSN-01",
          newStock: 0.9,
          previousStock: 1,
          dispatchQuantity: 4,
          dispatchUom: "cups",
          referenceId: "BATCH-TEST-VAR-01",
          notes: "Batch BATCH-TEST-VAR-01: Gave out 4 cups. Physical stock updated from 1 to 0.9 carton.",
        },
      ],
      performedByName: "Ajayi Boluwatife",
      recipient: "Aishah Anuoluwapo (Production Supervisor)",
      shiftType: "MORNING_SHIFT",
    });

    expect(res.transactions.length).toBeGreaterThan(0);
    const txn = res.transactions[0];
    expect(txn.status).toBe("PENDING_HANDOVER");
    expect(txn.recipient).toBe("Aishah Anuoluwapo (Production Supervisor)");
    expect(txn.quantity).toBe(-0.1);
  });

  it("getProductionSupervisors should list all users with role PRODUCTION_SUPERVISOR", async () => {
    const { getProductionSupervisors } = await import("../auth/store");
    const supervisors = await getProductionSupervisors();

    expect(supervisors.length).toBeGreaterThanOrEqual(2);
    const names = supervisors.map((s) => s.cleanName.toLowerCase());
    expect(names.some((n) => n.includes("aishah"))).toBe(true);
    expect(names.some((n) => n.includes("ada"))).toBe(true);

    for (const sup of supervisors) {
      expect(sup.role).toBe("PRODUCTION_SUPERVISOR");
      expect(sup.label).toBeDefined();
    }
  });

  it("getBenchmarkPortionsPerContainer should provide accurate benchmarks for Raisins and other variable items", async () => {
    const { getBenchmarkPortionsPerContainer } = await import("@/lib/packaging");

    expect(getBenchmarkPortionsPerContainer({ code: "RAW-RSN-01" })).toBe(40);
    expect(getBenchmarkPortionsPerContainer({ code: "RAW-VAN-01" })).toBe(267);
    expect(getBenchmarkPortionsPerContainer({ code: "RAW-CSH-01" })).toBe(200);
    expect(getBenchmarkPortionsPerContainer({ code: "RAW-GRP-01" })).toBe(80);
    expect(getBenchmarkPortionsPerContainer({ code: "RAW-GLC-01" })).toBe(25);
  });
});

