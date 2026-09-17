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
});
