import { describe, test, expect } from "bun:test";
import {
  getShiftHandoverCutoff,
  isDispatchEditable,
  getEffectiveDispatchStatus,
  formatCutoffTime,
  getHandoverGraceDescription,
} from "@/lib/shiftTiming";

describe("Shift Handover Timing & Open Edit/Cancel Access", () => {
  test("Morning Shift: Dispatches remain editable always across time", () => {
    const dispatchTime = new Date(2026, 8, 22, 10, 30, 0);
    const duringShift = new Date(2026, 8, 22, 15, 0, 0);
    expect(isDispatchEditable(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", duringShift)).toBe(true);

    const afterShift = new Date(2026, 8, 22, 23, 0, 0);
    expect(isDispatchEditable(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", afterShift)).toBe(true);
    expect(getEffectiveDispatchStatus(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", afterShift)).toBe("PENDING_HANDOVER");
  });

  test("Night Shift: Dispatches remain editable always across time", () => {
    const dispatchEvening = new Date(2026, 8, 22, 21, 0, 0);
    const nextDayNoon = new Date(2026, 8, 23, 14, 0, 0);
    expect(isDispatchEditable(dispatchEvening, "NIGHT_SHIFT", "PENDING_HANDOVER", nextDayNoon)).toBe(true);
  });

  test("Explicit status handling: CANCELLED is never editable", () => {
    const recent = new Date();
    expect(isDispatchEditable(recent, "MORNING_SHIFT", "CANCELLED")).toBe(false);
    expect(getEffectiveDispatchStatus(recent, "MORNING_SHIFT", "CANCELLED")).toBe("CANCELLED");
  });

  test("Badge and description helper returns informative user labels", () => {
    const dispatchTime = new Date(2026, 8, 22, 11, 0, 0);
    const descActive = getHandoverGraceDescription(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER");

    expect(descActive.isEditable).toBe(true);
    expect(descActive.badgeLabel).toBe("Active / Editable");

    const descCancelled = getHandoverGraceDescription(dispatchTime, "MORNING_SHIFT", "CANCELLED");
    expect(descCancelled.isEditable).toBe(false);
    expect(descCancelled.badgeLabel).toBe("Cancelled");
  });
});

describe("Multi-Recipe BOM Aggregation", () => {
  test("Aggregates shared ingredients across multiple recipes", async () => {
    const { calculateMultiRecipeRequirements, createInventoryItem, createProductRecipe } = await import("@/server/inventory/store");

    const itemCode1 = `TEST-ING1-${Date.now()}`;
    const itemCode2 = `TEST-ING2-${Date.now()}`;
    await createInventoryItem({
      code: itemCode1,
      name: "Test Granulated Sugar",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 100,
      minStockThreshold: 10,
    });
    await createInventoryItem({
      code: itemCode2,
      name: "Test Parfait Cups",
      category: "PACKAGING_NON_PERISHABLE",
      uom: "pcs",
      currentStock: 500,
      minStockThreshold: 50,
    });

    const recCode1 = `REC-TEST-A-${Date.now()}`;
    const recCode2 = `REC-TEST-B-${Date.now()}`;

    await createProductRecipe({
      code: recCode1,
      name: "Test Recipe Alpha",
      yieldQuantity: 100,
      yieldUnit: "cups",
      ingredients: [
        { itemCode: itemCode1, itemName: "Test Granulated Sugar", quantityRequired: 10, uom: "kg" },
        { itemCode: itemCode2, itemName: "Test Parfait Cups", quantityRequired: 100, uom: "pcs" },
      ],
    });

    await createProductRecipe({
      code: recCode2,
      name: "Test Recipe Beta",
      yieldQuantity: 100,
      yieldUnit: "cups",
      ingredients: [
        { itemCode: itemCode1, itemName: "Test Granulated Sugar", quantityRequired: 5, uom: "kg" },
      ],
    });

    const res = await calculateMultiRecipeRequirements([
      { recipeCode: recCode1, batchQuantity: 100 },
      { recipeCode: recCode2, batchQuantity: 100 },
    ]);

    expect(res.recipes.length).toBe(2);
    const sugar = res.requiredIngredients.find((i) => i.itemCode === itemCode1);
    expect(sugar).toBeDefined();
    expect(sugar?.unitRequired).toBe(15); // 10 + 5
    expect(sugar?.sourceBreakdown).toContain("Test Recipe Alpha");
    expect(sugar?.sourceBreakdown).toContain("Test Recipe Beta");
  });

  test("Dispenses multiple recipes as distinct recipe batches with individual references and clean notes", async () => {
    const { createInventoryItem, createProductRecipe, dispenseBatchToProduction } = await import(
      "@/server/inventory/store"
    );

    const ts = Date.now();
    const itemCode = `RAW-TEST-ING-${ts}`;
    await createInventoryItem({
      code: itemCode,
      name: "Test Batch Flavoring",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 200,
      minStockThreshold: 10,
      costPerUnit: 50,
      storageLocation: "Dry Store",
      packagingType: "DIRECT",
    });

    const recCode1 = `REC-TEST-D1-${ts}`;
    const recCode2 = `REC-TEST-D2-${ts}`;

    await createProductRecipe({
      code: recCode1,
      name: "Test Dessert Alpha",
      yieldQuantity: 100,
      yieldUnit: "cups",
      ingredients: [
        { itemCode, itemName: "Test Batch Flavoring", quantityRequired: 4, uom: "kg" },
      ],
    });

    await createProductRecipe({
      code: recCode2,
      name: "Test Dessert Beta",
      yieldQuantity: 100,
      yieldUnit: "cups",
      ingredients: [
        { itemCode, itemName: "Test Batch Flavoring", quantityRequired: 6, uom: "kg" },
      ],
    });

    const result = await dispenseBatchToProduction({
      recipes: [
        { recipeCode: recCode1, batchQuantity: 100 },
        { recipeCode: recCode2, batchQuantity: 100 },
      ],
      performedByName: "Store Manager",
      recipient: "Aishah Anuoluwapo",
      shiftType: "MORNING_SHIFT",
    });

    expect(result.success).toBe(true);
    expect(result.recipes.length).toBe(2);
    // Both recipes should have distinct batch references
    expect(result.recipes[0].batchReference).not.toBe(result.recipes[1].batchReference);

    // Verify transactions for each recipe have individual clean notes (no compound " + " note)
    const txns1 = result.transactions.filter((t) => t.referenceId === result.recipes[0].batchReference);
    const txns2 = result.transactions.filter((t) => t.referenceId === result.recipes[1].batchReference);

    expect(txns1.length).toBeGreaterThan(0);
    expect(txns2.length).toBeGreaterThan(0);

    expect(txns1[0].notes).toBe("Dispensed for 100x Test Dessert Alpha.");
    expect(txns2[0].notes).toBe("Dispensed for 100x Test Dessert Beta.");
    expect(txns1[0].notes).not.toContain(" + ");
  });

  test("Throws error if no valid recipes provided", async () => {
    const { calculateMultiRecipeRequirements } = await import("@/server/inventory/store");
    await expect(calculateMultiRecipeRequirements([])).rejects.toThrow();
  });
});
