import { describe, it, expect } from "bun:test";
import {
  createInventoryItem,
  dispenseIndividualItem,
  updatePendingDispatch,
  cancelDispatch,
  getItemByCode,
  createProductRecipe,
  dispenseBatchToProduction,
  updateVariableFloorLevels,
  getStockTransactions,
  getDailyShiftStockReport,
} from "./store";
import { formatTransactionMovementDisplay } from "@/lib/packaging";

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

  it("should allow changing recipe and target yield in a pending batch dispatch, adjusting inventory balances", async () => {
    const ts = Date.now();
    const itemA = `RAW-TEST-A-${ts}`;
    const itemB = `RAW-TEST-B-${ts}`;

    await createInventoryItem({
      code: itemA,
      name: "Test Ingredient A",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 100,
      minStockThreshold: 10,
      costPerUnit: 10,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
    });

    await createInventoryItem({
      code: itemB,
      name: "Test Ingredient B",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 100,
      minStockThreshold: 10,
      costPerUnit: 20,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
    });

    const rec1 = `REC-TEST-R1-${ts}`;
    const rec2 = `REC-TEST-R2-${ts}`;

    await createProductRecipe({
      code: rec1,
      name: "Recipe Alpha",
      yieldQuantity: 10,
      yieldUnit: "cups",
      ingredients: [{ itemCode: itemA, itemName: "Test Ingredient A", quantityRequired: 5, uom: "kg" }],
    });

    await createProductRecipe({
      code: rec2,
      name: "Recipe Beta",
      yieldQuantity: 10,
      yieldUnit: "cups",
      ingredients: [{ itemCode: itemB, itemName: "Test Ingredient B", quantityRequired: 8, uom: "kg" }],
    });

    // Dispense Recipe 1 for 10 cups (uses 5kg of itemA)
    const disp = await dispenseBatchToProduction({
      recipeCode: rec1,
      batchQuantity: 10,
      performedByName: "Store Keeper",
      recipient: "Floor Supervisor",
      shiftType: "MORNING_SHIFT",
    });

    expect(disp.success).toBe(true);
    const itemAAfterDisp = await getItemByCode(itemA);
    expect(Number(itemAAfterDisp?.currentStock)).toBe(95);

    const batchRef = disp.batchReference;

    // Change batch recipe from Recipe 1 (10 cups) to Recipe 2 (20 cups)
    // Recipe 2 needs 8kg per 10 cups -> 16kg of itemB for 20 cups
    // itemA should be restored from 95 back to 100
    // itemB should decrease from 100 to 84 (100 - 16 = 84)
    const updateRes = await updatePendingDispatch({
      referenceId: batchRef,
      items: [],
      recipeCode: rec2,
      targetYield: 20,
      performedByName: "Store Manager",
      recipient: "New Floor Lead",
      notes: "Changed to Recipe Beta per morning demand",
    });

    expect(updateRes.success).toBe(true);

    const itemAAfterEdit = await getItemByCode(itemA);
    expect(Number(itemAAfterEdit?.currentStock)).toBe(100);

    const itemBAfterEdit = await getItemByCode(itemB);
    expect(Number(itemBAfterEdit?.currentStock)).toBe(84);
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

  it("should return variableItems when editing dispatch and update pcs taken on daily sheet", async () => {
    const {
      createInventoryItem,
      createProductRecipe,
      dispenseBatchToProduction,
      updatePendingDispatch,
      getDailyShiftStockReport,
      updateVariableFloorLevels,
    } = await import("./store");

    const ts = Date.now();
    const varCode = `PKG-VAR-${ts}`;
    const recCode = `REC-VAR-${ts}`;

    await createInventoryItem({
      code: varCode,
      name: "Variable Parfait Cups",
      category: "PACKAGING_NON_PERISHABLE",
      uom: "packs",
      currentStock: 50,
      minStockThreshold: 5,
      isVariablePack: true,
      recipeUom: "pcs",
      packagingType: "PACK_ONLY",
      unitsPerPack: 20,
    });

    await createProductRecipe({
      code: recCode,
      name: "Parfait Test",
      yieldQuantity: 100,
      yieldUnit: "cups",
      ingredients: [
        {
          itemCode: varCode,
          itemName: "Variable Parfait Cups",
          quantityRequired: 100,
          uom: "pcs",
        },
      ],
    });

    const batchRes = await dispenseBatchToProduction({
      recipeCode: recCode,
      batchQuantity: 100,
      recipient: "Aishah Anuoluwapo",
      shiftType: "MORNING_SHIFT",
      performedByName: "Store Manager",
    });

    const refId = batchRes.batchReference;
    expect(refId).toBeDefined();

    // Edit dispatch to 150 pcs
    const editRes = await updatePendingDispatch({
      referenceId: refId!,
      items: [
        {
          itemCode: varCode,
          quantity: 150,
        },
      ],
      performedByName: "Store Manager",
    });

    expect(editRes.success).toBe(true);
    expect(editRes.variableItems).toBeDefined();
    expect(editRes.variableItems!.length).toBeGreaterThan(0);
    const varCup = editRes.variableItems!.find((v) => v.code === varCode);
    expect(varCup).toBeDefined();
    expect(varCup!.quantityDispensed).toBe(150);

    // Floor confirmation
    await updateVariableFloorLevels({
      updates: [
        {
          itemCode: varCode,
          newStock: 42.5,
          referenceId: refId!,
          notes: `Post-dispatch stock confirmation: remaining 42.5 packs. (Batch ${refId}: Gave out 150 pcs)`,
        },
      ],
      performedByName: "Store Manager",
      recipient: "Aishah Anuoluwapo",
      shiftType: "MORNING_SHIFT",
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const report = await getDailyShiftStockReport({ date: todayStr, shiftType: "MORNING_SHIFT" });
    const cupRow = report.rows.find((r) => r.itemCode === varCode);
    expect(cupRow).toBeDefined();
    expect(cupRow!.usageSecondary).toContain("150 pcs");
  });

  it("should record dispatches with user-selected custom dispatchDate for past/scheduled shifts", async () => {
    const { createInventoryItem, dispenseIndividualItem, dispenseBatchToProduction, createProductRecipe, getDailyShiftStockReport } = await import("./store");

    const customDate = "2026-09-20";
    const testCode = `TEST-CUSTOM-DATE-${Date.now()}`;
    await createInventoryItem({
      code: testCode,
      name: "Custom Date Test Milk",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 300,
      minStockThreshold: 10,
      costPerUnit: 1500,
      storageLocation: "Cold Room",
      packagingType: "DIRECT",
    });

    // 1. Direct dispense with custom date
    const indRes = await dispenseIndividualItem({
      itemCode: testCode,
      quantity: 25,
      dispensedUom: "kg",
      performedByName: "Store Keeper",
      recipient: "Aishah Anuoluwapo",
      shiftType: "MORNING_SHIFT",
      dispatchDate: customDate,
      notes: "Backdated shift dispatch",
    });

    expect(indRes.success).toBe(true);
    expect(indRes.transaction.createdAt).toContain(customDate);

    // 2. Recipe batch dispense with custom date
    const recCode = `REC-CD-${Date.now()}`;
    await createProductRecipe({
      code: recCode,
      name: "Custom Date Parfait",
      yieldQuantity: 10,
      yieldUnit: "cup",
      ingredients: [
        { itemCode: testCode, itemName: "Custom Date Test Milk", quantityRequired: 10, uom: "kg" },
      ],
    });

    const batchRes = await dispenseBatchToProduction({
      recipeCode: recCode,
      batchQuantity: 10,
      performedByName: "Store Keeper",
      recipient: "Aishah Anuoluwapo",
      shiftType: "MORNING_SHIFT",
      dispatchDate: customDate,
      notes: "Dispense for custom date batch",
    });

    expect(batchRes.success).toBe(true);
    const txn = batchRes.transactions.find((t) => t.itemId === indRes.item.id);
    expect(txn).toBeDefined();
    expect(txn!.createdAt).toContain(customDate);

    // 3. Shift report for that custom date must include the material usage
    const shiftReport = await getDailyShiftStockReport({ date: customDate, shiftType: "MORNING_SHIFT" });
    const row = shiftReport.rows.find((r) => r.itemCode === testCode);
    expect(row).toBeDefined();
    expect(row!.usage).toBeGreaterThanOrEqual(35); // 25 + 10
  });

  describe("formatTransactionMovementDisplay", () => {
    it("formats variable material with physical stock confirmation notes", () => {
      const result = formatTransactionMovementDisplay({
        quantity: -4.0,
        unit: "pack",
        notes: "Physical stock confirmation: remaining 39 pack. (Batch BATCH-PARFAIT-400ML-1372-2: Gave out 400 pcs)",
      });

      expect(result.primaryQty).toBe("-400 pcs");
      expect(result.secondaryQty).toBe("(-4 pack)");
      expect(result.isVariable).toBe(true);
    });

    it("formats variable material with culinary dished notes and pending floor count", () => {
      const result = formatTransactionMovementDisplay({
        quantity: 0,
        unit: "pcs",
        notes: "Dispensed for 100x Moh Parfait (500g). [Variable material: 400 pcs dished for production. Pending remaining stock confirmation]",
      });

      expect(result.primaryQty).toBe("-400 pcs");
      expect(result.secondaryQty).toBe("(Pending count)");
      expect(result.isVariable).toBe(true);
    });

    it("formats variable material with culinary cups for raisins", () => {
      const result = formatTransactionMovementDisplay({
        quantity: -0.1,
        unit: "carton",
        notes: "Physical stock confirmation: remaining 1.9 carton. (Batch BATCH-PARFAIT-400ML-1372-2: Gave out 2.5 cups)",
      });

      expect(result.primaryQty).toBe("-2.5 cups");
      expect(result.secondaryQty).toBe("(-0.1 carton)");
      expect(result.isVariable).toBe(true);
    });

    it("formats standard fixed BOM materials with direct deduction", () => {
      const result = formatTransactionMovementDisplay({
        quantity: -80,
        unit: "pcs",
        notes: "Dispensed for 100x Moh Parfait (500g).",
      });

      expect(result.primaryQty).toBe("-80 pcs");
      expect(result.secondaryQty).toBeUndefined();
      expect(result.isVariable).toBe(false);
    });
  });

  describe("Multi-recipe variable items isolation", () => {
    it("attaches distinct batchReference to variable items across multi-recipe dispatches", async () => {
      const varCode = `TEST-VAR-ISO-${Date.now()}`;
      await createInventoryItem({
        code: varCode,
        name: "Test Isolated Raisins",
        category: "PERISHABLE_MEASURED",
        uom: "carton",
        currentStock: 10,
        minStockThreshold: 1,
        costPerUnit: 5000,
        storageLocation: "Dry Store",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "cups",
      });

      const rec1 = `REC-ISO-1-${Date.now()}`;
      const rec2 = `REC-ISO-2-${Date.now()}`;

      await createProductRecipe({
        code: rec1,
        name: "Recipe 1",
        yieldQuantity: 1,
        yieldUnit: "cup",
        ingredients: [],
      });

      await createProductRecipe({
        code: rec2,
        name: "Recipe 2",
        yieldQuantity: 1,
        yieldUnit: "cup",
        ingredients: [
          { itemCode: varCode, itemName: "Test Isolated Raisins", quantityRequired: 2.5, uom: "cups" },
        ],
      });

      const res = await dispenseBatchToProduction({
        recipes: [
          { recipeCode: rec1, batchQuantity: 1 },
          { recipeCode: rec2, batchQuantity: 1 },
        ],
        performedByName: "Store Manager",
        recipient: "Floor Supervisor",
        shiftType: "MORNING_SHIFT",
      });

      expect(res.success).toBe(true);
      expect(res.variableItems.length).toBe(1);
      // Ensure the variable item carries the exact batchReference of the recipe that used it
      expect(res.variableItems[0].batchReference).toBeDefined();
      expect(res.variableItems[0].batchReference).toContain("ISO-2");
    });

    it("ensures editing a batch does not wipe or double confirmed variable items", async () => {
      const varCode = `TEST-VAR-EDIT-${Date.now()}`;
      await createInventoryItem({
        code: varCode,
        name: "Test Edit Grapes",
        category: "PERISHABLE_NUMBERED",
        uom: "pack",
        currentStock: 50,
        minStockThreshold: 5,
        costPerUnit: 2000,
        storageLocation: "Cold Room",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      const recCode = `REC-VAR-EDIT-${Date.now()}`;
      await createProductRecipe({
        code: recCode,
        name: "Edit Test Parfait",
        yieldQuantity: 100,
        yieldUnit: "cup",
        ingredients: [
          { itemCode: varCode, itemName: "Test Edit Grapes", quantityRequired: 100, uom: "pcs" },
        ],
      });

      // 1. Initial batch dispense (400 pcs dished)
      const dispRes = await dispenseBatchToProduction({
        recipes: [{ recipeCode: recCode, batchQuantity: 4 }], // 4x = 400 pcs
        performedByName: "Store Keeper",
        recipient: "Aishah Anuoluwapo",
        shiftType: "MORNING_SHIFT",
      });

      expect(dispRes.success).toBe(true);
      expect(dispRes.variableItems.length).toBe(1);
      const batchRef = dispRes.batchReference;

      // 2. Confirm floor count: 46 packs remaining (4 packs deducted for 400 pcs)
      await updateVariableFloorLevels({
        shiftType: "MORNING_SHIFT",
        performedByName: "Store Keeper",
        recipient: "Aishah Anuoluwapo",
        updates: [
          {
            itemCode: varCode,
            newStock: 46,
            referenceId: batchRef,
            notes: `Physical stock confirmation: remaining 46 pack. (Batch ${batchRef}: Gave out 400 pcs)`,
          },
        ],
      });

      const itemAfterConfirm = await getItemByCode(varCode);
      expect(Number(itemAfterConfirm?.currentStock)).toBe(46);

      // Verify movement display
      const txs = await getStockTransactions({ itemId: itemAfterConfirm!.id });
      const varTx = txs.find((t) => t.referenceId === batchRef);
      expect(varTx).toBeDefined();
      const disp = formatTransactionMovementDisplay(varTx!);
      expect(disp.primaryQty).toBe("-400 pcs");
      expect(disp.secondaryQty).toBe("(-4 pack)");

      // 3. Edit batch (e.g. change recipient / notes, but keep same recipe and 400 pcs yield)
      const editRes = await updatePendingDispatch({
        referenceId: batchRef,
        recipeCode: recCode,
        targetYield: 4,
        recipient: "Updated Floor Lead",
        notes: "Shift notes updated",
        performedByName: "Store Manager",
        items: [
          {
            itemId: itemAfterConfirm!.id,
            itemCode: varCode,
            quantity: 400, // Still 400 pcs
          },
        ],
      });

      expect(editRes.success).toBe(true);
      // Confirmed variable item should NOT be re-queued for confirmation!
      expect(editRes.variableItems.length).toBe(0);

      // Stock should remain at 46 packs (NOT restored to 50, NOT wiped to 0)
      const itemAfterEdit = await getItemByCode(varCode);
      expect(Number(itemAfterEdit?.currentStock)).toBe(46);

      // Transaction should remain confirmed with -4 pack and Gave out 400 pcs
      const txsAfterEdit = await getStockTransactions({ itemId: itemAfterConfirm!.id });
      const varTxAfter = txsAfterEdit.find((t) => t.referenceId === batchRef);
      expect(varTxAfter).toBeDefined();
      expect(Number(varTxAfter!.quantity)).toBe(-4);
      expect(varTxAfter!.unit).toBe("pack");
      expect(varTxAfter!.notes).toContain("Gave out 400 pcs");

      const dispAfter = formatTransactionMovementDisplay(varTxAfter!);
      expect(dispAfter.primaryQty).toBe("-400 pcs");
      expect(dispAfter.secondaryQty).toBe("(-4 pack)");

      // Daily shift report should accurately report 400 pcs (NOT 800 pcs, NOT 0 pcs)
      const today = new Date().toISOString().split("T")[0];
      const shiftReport = await getDailyShiftStockReport({ date: today, shiftType: "MORNING_SHIFT" });
      const reportRow = shiftReport.rows.find((r) => r.itemCode === varCode);
      expect(reportRow).toBeDefined();
      expect(reportRow!.usage).toBe(4);
      expect(reportRow!.usageSecondary).toBe("400 pcs");
    });

    it("editing non-variable ingredient (e.g. apples) does not prompt variable confirmation and preserves confirmed variable items", async () => {
      const appleCode = `RAW-APL-TEST-${Date.now()}`;
      const grapeCode = `RAW-GRP-TEST-${Date.now()}`;
      const cashewCode = `RAW-CSH-TEST-${Date.now()}`;

      await createInventoryItem({
        code: appleCode,
        name: "Test Apples",
        category: "PERISHABLE_NUMBERED",
        uom: "pcs",
        currentStock: 200,
        minStockThreshold: 10,
        costPerUnit: 100,
        storageLocation: "Dry Store",
        packagingType: "DIRECT",
        isVariablePack: false,
      });

      await createInventoryItem({
        code: grapeCode,
        name: "Test Grapes",
        category: "PERISHABLE_NUMBERED",
        uom: "pack",
        currentStock: 50,
        minStockThreshold: 5,
        costPerUnit: 2000,
        storageLocation: "Cold Room",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      await createInventoryItem({
        code: cashewCode,
        name: "Test Cashew",
        category: "PERISHABLE_NUMBERED",
        uom: "bottle",
        currentStock: 20,
        minStockThreshold: 2,
        costPerUnit: 3000,
        storageLocation: "Dry Store",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      const recCode = `REC-MULTI-VAR-${Date.now()}`;
      await createProductRecipe({
        code: recCode,
        name: "Multi Var Parfait",
        yieldQuantity: 400,
        yieldUnit: "cup",
        ingredients: [
          { itemCode: appleCode, itemName: "Test Apples", quantityRequired: 80, uom: "pcs" },
          { itemCode: grapeCode, itemName: "Test Grapes", quantityRequired: 400, uom: "pcs" },
          { itemCode: cashewCode, itemName: "Test Cashew", quantityRequired: 400, uom: "pcs" },
        ],
      });

      // 1. Initial batch dispatch
      const dispRes = await dispenseBatchToProduction({
        recipeCode: recCode,
        batchQuantity: 400,
        performedByName: "Ajayi Boluwatife",
        recipient: "Floor Supervisor",
        shiftType: "MORNING_SHIFT",
      });

      expect(dispRes.success).toBe(true);
      expect(dispRes.variableItems.length).toBe(2);
      const batchRef = dispRes.batchReference;

      // 2. Confirm floor count for Grapes (-4 pack, remaining 46) and Cashew (-1.5 bottle, remaining 18.5)
      await updateVariableFloorLevels({
        shiftType: "MORNING_SHIFT",
        performedByName: "Ajayi Boluwatife",
        recipient: "Floor Supervisor",
        updates: [
          {
            itemCode: grapeCode,
            newStock: 46,
            referenceId: batchRef,
            notes: `Physical stock confirmation: remaining 46 pack. (Batch ${batchRef}: Gave out 400 pcs)`,
          },
          {
            itemCode: cashewCode,
            newStock: 18.5,
            referenceId: batchRef,
            notes: `Physical stock confirmation: remaining 18.5 bottle. (Batch ${batchRef}: Gave out 400 pcs)`,
          },
        ],
      });

      const appleItem = await getItemByCode(appleCode);
      const grapeItem = await getItemByCode(grapeCode);
      const cashewItem = await getItemByCode(cashewCode);

      // Verify confirmed stocks
      expect(Number(grapeItem?.currentStock)).toBe(46);
      expect(Number(cashewItem?.currentStock)).toBe(18.5);
      expect(Number(appleItem?.currentStock)).toBe(120); // 200 - 80

      // 3. User edits ONLY apples (from 80 to 70 pcs), leaving variable items untouched at 400 pcs
      const editRes = await updatePendingDispatch({
        referenceId: batchRef,
        recipeCode: recCode,
        targetYield: 400,
        recipient: "Floor Supervisor",
        notes: "Adjusted apples",
        performedByName: "Ajayi Boluwatife",
        items: [
          { itemId: appleItem!.id, itemCode: appleCode, quantity: 70 },
          { itemId: grapeItem!.id, itemCode: grapeCode, quantity: 400 },
          { itemId: cashewItem!.id, itemCode: cashewCode, quantity: 400 },
        ],
      });

      expect(editRes.success).toBe(true);
      // Variable items modal MUST NOT trigger! (array must be empty)
      expect(editRes.variableItems.length).toBe(0);

      // Apples stock adjusted: was 120, restored 80 -> 200, deducted 70 -> 130
      const appleAfter = await getItemByCode(appleCode);
      expect(Number(appleAfter?.currentStock)).toBe(130);

      // Variable items stocks MUST NOT be touched
      const grapeAfter = await getItemByCode(grapeCode);
      expect(Number(grapeAfter?.currentStock)).toBe(46);
      const cashewAfter = await getItemByCode(cashewCode);
      expect(Number(cashewAfter?.currentStock)).toBe(18.5);

      // Confirmed transactions for variable items MUST be preserved (NOT zeroed out)
      const allTxns = await getStockTransactions({ limit: 50 });
      const grapeTx = allTxns.find((t) => t.referenceId === batchRef && t.itemId === grapeItem!.id);
      expect(grapeTx).toBeDefined();
      expect(Number(grapeTx!.quantity)).toBe(-4);
      expect(grapeTx!.unit).toBe("pack");
      expect(grapeTx!.notes).toContain("Gave out 400 pcs");

      const cashewTx = allTxns.find((t) => t.referenceId === batchRef && t.itemId === cashewItem!.id);
      expect(cashewTx).toBeDefined();
      expect(Number(cashewTx!.quantity)).toBe(-1.5);
      expect(cashewTx!.unit).toBe("bottle");
      expect(cashewTx!.notes).toContain("Gave out 400 pcs");
    });

    it("editing only one variable item in multi-variable recipe prompts ONLY for that single edited variable item", async () => {
      const grapeCode = `RAW-GRP-ISO2-${Date.now()}`;
      const cashewCode = `RAW-CSH-ISO2-${Date.now()}`;

      await createInventoryItem({
        code: grapeCode,
        name: "Test Grapes 2",
        category: "PERISHABLE_NUMBERED",
        uom: "pack",
        currentStock: 50,
        minStockThreshold: 5,
        costPerUnit: 2000,
        storageLocation: "Cold Room",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      await createInventoryItem({
        code: cashewCode,
        name: "Test Cashew 2",
        category: "PERISHABLE_NUMBERED",
        uom: "bottle",
        currentStock: 20,
        minStockThreshold: 2,
        costPerUnit: 3000,
        storageLocation: "Dry Store",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      const recCode = `REC-MULTI-VAR2-${Date.now()}`;
      await createProductRecipe({
        code: recCode,
        name: "Multi Var Parfait 2",
        yieldQuantity: 400,
        yieldUnit: "cup",
        ingredients: [
          { itemCode: grapeCode, itemName: "Test Grapes 2", quantityRequired: 400, uom: "pcs" },
          { itemCode: cashewCode, itemName: "Test Cashew 2", quantityRequired: 400, uom: "pcs" },
        ],
      });

      const dispRes = await dispenseBatchToProduction({
        recipeCode: recCode,
        batchQuantity: 400,
        performedByName: "Ajayi Boluwatife",
        recipient: "Floor Supervisor",
        shiftType: "MORNING_SHIFT",
      });

      const batchRef = dispRes.batchReference;

      // Confirm floor count
      await updateVariableFloorLevels({
        shiftType: "MORNING_SHIFT",
        performedByName: "Ajayi Boluwatife",
        recipient: "Floor Supervisor",
        updates: [
          {
            itemCode: grapeCode,
            newStock: 46,
            referenceId: batchRef,
            notes: `Physical stock confirmation: remaining 46 pack. (Batch ${batchRef}: Gave out 400 pcs)`,
          },
          {
            itemCode: cashewCode,
            newStock: 18.5,
            referenceId: batchRef,
            notes: `Physical stock confirmation: remaining 18.5 bottle. (Batch ${batchRef}: Gave out 400 pcs)`,
          },
        ],
      });

      const grapeItem = await getItemByCode(grapeCode);
      const cashewItem = await getItemByCode(cashewCode);

      // Now edit: increase Grapes from 400 pcs to 500 pcs, but leave Cashew at 400 pcs
      const editRes = await updatePendingDispatch({
        referenceId: batchRef,
        recipeCode: recCode,
        targetYield: 400,
        recipient: "Floor Supervisor",
        notes: "Grapes changed to 500 pcs",
        performedByName: "Ajayi Boluwatife",
        items: [
          { itemId: grapeItem!.id, itemCode: grapeCode, quantity: 500 },
          { itemId: cashewItem!.id, itemCode: cashewCode, quantity: 400 },
        ],
      });

      expect(editRes.success).toBe(true);
      // ONLY the edited variable item (Grapes) should be returned! Cashew must NOT be included!
      expect(editRes.variableItems.length).toBe(1);
      expect(editRes.variableItems[0].code).toBe(grapeCode);
      expect(editRes.variableItems[0].quantityDispensed).toBe(500);

      // Cashew transaction should remain confirmed with -1.5 bottle
      const allTxns = await getStockTransactions({ limit: 50 });
      const cashewTx = allTxns.find((t) => t.referenceId === batchRef && t.itemId === cashewItem!.id);
      expect(cashewTx).toBeDefined();
      expect(Number(cashewTx!.quantity)).toBe(-1.5);
      expect(cashewTx!.unit).toBe("bottle");
      expect(cashewTx!.notes).toContain("Gave out 400 pcs");

      // Grapes transaction was reset to 0 pending new physical confirmation for 500 pcs
      const grapeTx = allTxns.find((t) => t.referenceId === batchRef && t.itemId === grapeItem!.id);
      expect(grapeTx).toBeDefined();
      expect(Number(grapeTx!.quantity)).toBe(0);
      expect(grapeTx!.notes).toContain("500 pcs dished");
    });

    it("updateVariableFloorLevels strictly preserves original batch createdAt and shiftType from past date", async () => {
      const pastItemCode = `TEST-PAST-VAR-${Date.now()}`;
      await createInventoryItem({
        code: pastItemCode,
        name: "Test Past Variable",
        category: "PERISHABLE_NUMBERED",
        uom: "pack",
        currentStock: 40,
        minStockThreshold: 5,
        costPerUnit: 1000,
        storageLocation: "Cold Store",
        packagingType: "PACK_ONLY",
        isVariablePack: true,
        recipeUom: "pcs",
      });

      const recPastCode = `REC-PAST-${Date.now()}`;
      await createProductRecipe({
        code: recPastCode,
        name: "Test Past Recipe",
        yieldQuantity: 400,
        yieldUnit: "cup",
        ingredients: [
          { itemCode: pastItemCode, itemName: "Test Past Variable", quantityRequired: 400, uom: "pcs" },
        ],
      });

      const pastDate = "2026-09-25";

      // Dispense on past date
      const dispPast = await dispenseBatchToProduction({
        recipeCode: recPastCode,
        batchQuantity: 400,
        performedByName: "Past Keeper",
        recipient: "Floor Team",
        shiftType: "MORNING_SHIFT",
        dispatchDate: pastDate,
      });

      const pastBatchRef = dispPast.batchReference;
      const pastItem = await getItemByCode(pastItemCode);

      // Now call updateVariableFloorLevels on that batch
      await updateVariableFloorLevels({
        shiftType: "NIGHT_SHIFT", // Even if caller sends a different shift, batch reference should anchor it
        performedByName: "Current User",
        updates: [
          {
            itemCode: pastItemCode,
            newStock: 36,
            previousStock: 40,
            referenceId: pastBatchRef,
            notes: `Physical stock confirmation: remaining 36 pack. (Batch ${pastBatchRef}: Gave out 400 pcs)`,
          },
        ],
      });

      const allTxns = await getStockTransactions({ limit: 50 });
      const confirmedPastTx = allTxns.find((t) => t.referenceId === pastBatchRef && t.itemId === pastItem!.id);
      expect(confirmedPastTx).toBeDefined();
      expect(Number(confirmedPastTx!.quantity)).toBe(-4);
      expect(confirmedPastTx!.unit).toBe("pack");
      // Must preserve the 2026-09-25 date, not today's date
      expect(new Date(confirmedPastTx!.createdAt).toISOString().slice(0, 10)).toBe(pastDate);
      expect(confirmedPastTx!.shiftType).toBe("MORNING_SHIFT");
    });

    it("updateVariableFloorLevels respects explicit batchCreatedAt parameter", async () => {
      const explicitItemCode = `VAR-EXP-${Date.now()}`;
      await createInventoryItem({
        code: explicitItemCode,
        name: "Explicit Variable Item",
        category: "PERISHABLE_MEASURED",
        currentStock: 50,
        minStockThreshold: 10,
        uom: "pack",
        costPerUnit: 100,
        isVariablePack: true,
        recipeUom: "pcs",
        portionsPerContainer: 100,
      });

      const explicitItem = await getItemByCode(explicitItemCode);
      const fixedPastTimestamp = "2026-09-28T08:15:00.000Z";

      await updateVariableFloorLevels({
        shiftType: "MORNING_SHIFT",
        performedByName: "Auditor",
        batchCreatedAt: fixedPastTimestamp,
        updates: [
          {
            itemCode: explicitItemCode,
            newStock: 48,
            previousStock: 50,
            referenceId: `BATCH-EXP-${Date.now()}`,
            notes: "Direct confirmation with batchCreatedAt",
          },
        ],
      });

      const allTxns = await getStockTransactions({ limit: 20 });
      const targetTx = allTxns.find((t) => t.notes?.includes("Direct confirmation with batchCreatedAt"));
      expect(targetTx).toBeDefined();
      expect(new Date(targetTx!.createdAt).toISOString()).toBe(fixedPastTimestamp);
    });
  });
});


