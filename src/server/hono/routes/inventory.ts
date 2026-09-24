import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import { eventBus } from "@/server/events/eventBus";
import {
  getInventoryItems,
  getProductRecipes,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createProductRecipe,
  updateProductRecipe,
  deleteProductRecipe,
  calculateRecipeRequirements,
  calculateMultiRecipeRequirements,
  receiveAdHocIntake,
  getRecentIntakes,
  updateIntake,
  cancelIntake,
  recordStockDamage,
  getRecentDamages,
  cancelStockDamage,
  dispenseBatchToProduction,
  dispenseIndividualItem,
  markItemContainerDepleted,
  updateVariableFloorLevels,
  cancelDispatch,
  updatePendingDispatch,
  processFaultReturnAndReplace,
  processExcessRestock,
  reconcileShiftStock,
  getStockTransactions,
  getReturnsAudit,
  getShifts,
  getActiveShiftInfo,
  openShiftRecord,
  getShiftById,
  getDailyShiftStockReport,
  generatePeriodStatementCSV,
} from "../../inventory/store";
import { getRequisitionApprovalByRef } from "../../production/store";
import {
  getDefaultSupervisorName,
  getDefaultStoreManagerName,
  getActiveStaffRecipients,
  getProductionSupervisors,
} from "../../auth/store";

export const inventoryRouter = new Hono();

// Helper to extract authenticated user
async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// Enforce route & mutation protection: Production supervisors cannot mutate store inventory
inventoryRouter.use("*", async (c, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    const user = await getAuthUser(c);
    if (user?.role === "PRODUCTION_SUPERVISOR") {
      return c.json(
        {
          error:
            "Access denied: Production supervisors cannot modify store inventory. Please use the Production module to request and vet materials.",
        },
        403
      );
    }
  }
  await next();
});

// 1. ITEMS CRUD
inventoryRouter.get("/items", async (c) => {
  try {
    const category = c.req.query("category");
    const search = c.req.query("search");

    const items = await getInventoryItems({ category, search });
    return c.json({ success: true, items });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load inventory items." }, 500);
  }
});

// CREATE INVENTORY ITEM
inventoryRouter.post("/items", async (c) => {
  try {
    const body = await c.req.json();
    const {
      code,
      name,
      category,
      uom,
      currentStock,
      minStockThreshold,
      costPerUnit,
      storageLocation,
      imageUrl,
      packagingType,
      packUnit,
      unitsPerPack,
      cartonUnit,
      packsPerCarton,
      isVariablePack,
      inUseQuantity,
      inUseUnit,
      recipeUom,
      portionsPerContainer,
      inUseRemainingPortions,
    } = body;

    if (!code || !name || !category || !uom) {
      return c.json({ error: "Code, name, category, and UoM are required." }, 400);
    }

    const item = await createInventoryItem({
      code,
      name,
      category,
      uom,
      currentStock: Number(currentStock) || 0,
      minStockThreshold: Number(minStockThreshold) || 10,
      costPerUnit: Number(costPerUnit) || 0,
      storageLocation,
      imageUrl,
      packagingType,
      packUnit,
      unitsPerPack: unitsPerPack ? Number(unitsPerPack) : undefined,
      cartonUnit,
      packsPerCarton: packsPerCarton ? Number(packsPerCarton) : undefined,
      isVariablePack: Boolean(isVariablePack),
      inUseQuantity: inUseQuantity !== undefined ? Number(inUseQuantity) : undefined,
      inUseUnit: inUseUnit || undefined,
      recipeUom: recipeUom ? String(recipeUom).trim() : undefined,
      portionsPerContainer: portionsPerContainer ? Number(portionsPerContainer) : undefined,
      inUseRemainingPortions: inUseRemainingPortions !== undefined ? Number(inUseRemainingPortions) : undefined,
    });

    return c.json({ success: true, item, message: `Material ${item.name} created successfully.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create item." }, 400);
  }
});

// UPDATE INVENTORY ITEM (Cost, packaging, thresholds)
inventoryRouter.put("/items/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized. Please log in." }, 401);
    }
    const allowedRoles = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "ACCOUNTANT"];
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: "Access denied. Only Executives, Super Admins, Store Managers, and Accountants can edit inventory items." }, 403);
    }

    const id = c.req.param("id");
    const body = await c.req.json();
    const updated = await updateInventoryItem(id, body);

    if (body.costPerUnit !== undefined) {
      eventBus.publish(
        "INVENTORY_ITEM_COST_UPDATED",
        {
          itemId: id,
          itemName: updated.name,
          itemCode: updated.code,
          costPerUnit: updated.costPerUnit,
        },
        user.fullName,
        "MANAGEMENT"
      );
    }

    return c.json({ success: true, item: updated, message: "Item updated successfully." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update item." }, 400);
  }
});

// DELETE INVENTORY ITEM
inventoryRouter.delete("/items/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const deleted = await deleteInventoryItem(id);
    return c.json({ success: true, item: deleted, message: "Item removed." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete item." }, 400);
  }
});

// 2. AD-HOC INBOUND RAW MATERIAL INTAKE
inventoryRouter.post("/intake", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      itemCode,
      quantity,
      lotNumber,
      supplierName,
      expiryDate,
      unitCost,
      grnNumber,
      waybillUrl,
      shiftType = "MORNING_SHIFT",
      notes,
    } = body;

    const trimmedSupplier = supplierName?.trim() || "Store Intake";
    const effectiveLot = lotNumber?.trim() || `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (!itemCode) {
      return c.json({ error: "Item code is required." }, 400);
    }
    if (!quantity || Number(quantity) <= 0) {
      return c.json({ error: "A valid positive quantity is required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await receiveAdHocIntake({
      itemCode,
      quantity: Number(quantity),
      lotNumber: effectiveLot,
      supplierName: trimmedSupplier,
      expiryDate,
      unitCost: unitCost ? Number(unitCost) : undefined,
      grnNumber,
      waybillUrl,
      performedByName: performer,
      shiftType,
      notes,
    });

    return c.json({ success: true, message: "Raw material inbound intake logged successfully.", result });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to log material intake." }, 400);
  }
});

// 2b. RECENT INTAKES (LIST, EDIT, CANCEL)
inventoryRouter.get("/intakes", async (c) => {
  try {
    const limit = Number(c.req.query("limit") || 50);
    const shiftType = c.req.query("shiftType");
    const includeCancelled = c.req.query("includeCancelled") === "true";
    const intakes = await getRecentIntakes({ limit, shiftType, includeCancelled });
    return c.json({ success: true, intakes });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load recent intakes." }, 500);
  }
});

inventoryRouter.post("/intakes/:id/edit", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await updateIntake({
      txId: id,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      unitCost: body.unitCost !== undefined ? Number(body.unitCost) : undefined,
      notes: body.notes,
      expiryDate: body.expiryDate,
      performedByName: performer,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update intake." }, 400);
  }
});

inventoryRouter.patch("/intakes/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await updateIntake({
      txId: id,
      quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
      unitCost: body.unitCost !== undefined ? Number(body.unitCost) : undefined,
      notes: body.notes,
      expiryDate: body.expiryDate,
      performedByName: performer,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update intake." }, 400);
  }
});

inventoryRouter.post("/intakes/:id/cancel", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await cancelIntake({
      txId: id,
      performedByName: performer,
      reason: body.reason,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to cancel intake." }, 400);
  }
});

inventoryRouter.delete("/intakes/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await cancelIntake({
      txId: id,
      performedByName: performer,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to cancel intake." }, 400);
  }
});

// 2c. STOCK DAMAGES & SPOILAGE WRITEOFFS
inventoryRouter.get("/damages", async (c) => {
  try {
    const limit = Number(c.req.query("limit") || 50);
    const date = c.req.query("date");
    const shiftType = c.req.query("shiftType");
    const includeCancelled = c.req.query("includeCancelled") === "true";
    const damages = await getRecentDamages({ limit, date, shiftType, includeCancelled });
    return c.json({ success: true, damages });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load recent damages." }, 500);
  }
});

inventoryRouter.post("/damages", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const { itemCode, quantity, damageDate, shiftType, reason, notes, attachmentUrl } = body;

    if (!itemCode) {
      return c.json({ error: "Item code is required." }, 400);
    }
    if (!quantity || Number(quantity) <= 0) {
      return c.json({ error: "A valid positive quantity is required." }, 400);
    }
    if (!reason?.trim()) {
      return c.json({ error: "Damage reason is required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await recordStockDamage({
      itemCode,
      quantity: Number(quantity),
      damageDate,
      shiftType,
      reason: reason.trim(),
      notes,
      performedByName: performer,
      attachmentUrl,
    });

    return c.json({
      success: true,
      message: result.message,
      txId: result.txId,
      referenceId: result.referenceId,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record material damage." }, 400);
  }
});

inventoryRouter.post("/damages/:id/cancel", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await cancelStockDamage({
      txId: id,
      performedByName: performer,
      reason: body.reason,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to cancel damage entry." }, 400);
  }
});

inventoryRouter.delete("/damages/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await cancelStockDamage({
      txId: id,
      performedByName: performer,
    });

    return c.json({ success: true, message: result.message, txId: result.txId });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to cancel damage entry." }, 400);
  }
});

// 3. RECIPES & BOM CALCULATOR
inventoryRouter.get("/recipes", async (c) => {
  try {
    const recipes = await getProductRecipes();
    return c.json({ success: true, recipes });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load product recipes." }, 500);
  }
});

// CREATE PRODUCT RECIPE & INGREDIENT FORMULA
inventoryRouter.post("/recipes", async (c) => {
  try {
    const body = await c.req.json();
    const { code, name, description, imageUrl, yieldQuantity, yieldUnit, ingredients } = body;

    if (!code || !name || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return c.json({ error: "Code, product name, and at least 1 ingredient formula are required." }, 400);
    }

    const recipe = await createProductRecipe({
      code,
      name,
      description,
      imageUrl,
      yieldQuantity: Number(yieldQuantity) || 1,
      yieldUnit: yieldUnit || "unit",
      ingredients,
    });

    return c.json({ success: true, recipe, message: `Recipe ${recipe.name} created successfully.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create recipe." }, 400);
  }
});

// UPDATE PRODUCT RECIPE & INGREDIENT FORMULA
inventoryRouter.put("/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const updated = await updateProductRecipe(id, body);
    return c.json({ success: true, recipe: updated, message: "Recipe updated successfully." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update recipe." }, 400);
  }
});

// DELETE PRODUCT RECIPE
inventoryRouter.delete("/recipes/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const deleted = await deleteProductRecipe(id);
    return c.json({ success: true, recipe: deleted, message: "Recipe removed." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete recipe." }, 400);
  }
});

inventoryRouter.post("/calculate-bom", async (c) => {
  try {
    const body = await c.req.json();
    const { recipeCode, batchQuantity, recipes } = body;

    if (recipes && Array.isArray(recipes) && recipes.length > 0) {
      const calculation = await calculateMultiRecipeRequirements(recipes);
      return c.json({ success: true, calculation });
    }

    if (!recipeCode || !batchQuantity || Number(batchQuantity) <= 0) {
      return c.json({ error: "Please provide a valid recipe code and batch quantity, or a recipes list." }, 400);
    }

    const calculation = await calculateRecipeRequirements(recipeCode, Number(batchQuantity));
    return c.json({ success: true, calculation });
  } catch (err: any) {
    return c.json({ error: err.message || "BOM calculation failed." }, 400);
  }
});

// 3b. ACTIVE STAFF RECIPIENTS (From DB)
inventoryRouter.get("/recipients", async (c) => {
  try {
    const shiftType = c.req.query("shiftType") as ("MORNING_SHIFT" | "NIGHT_SHIFT") | undefined;
    const recipients = await getActiveStaffRecipients();
    const supervisors = await getProductionSupervisors();
    const defaultSupervisor = await getDefaultSupervisorName(shiftType);
    const defaultStoreManager = await getDefaultStoreManagerName();
    return c.json({
      success: true,
      supervisors,
      recipients,
      defaultSupervisor,
      defaultStoreManager,
      defaultRecipient: `${defaultSupervisor} (Production Supervisor)`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load staff recipients." }, 500);
  }
});

// 4. SHIFT BATCH DISPENSING TO PRODUCTION (Supports Single or Multiple Recipes)
inventoryRouter.post("/dispense", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const defaultSup = await getDefaultSupervisorName();
    const defaultStoreMgr = await getDefaultStoreManagerName();

    const {
      recipeCode,
      batchQuantity,
      recipes,
      recipient = `${defaultSup} (Production Supervisor)`,
      shiftType = "MORNING_SHIFT",
      notes,
      customIngredients,
    } = body;

    const hasMulti = recipes && Array.isArray(recipes) && recipes.length > 0;
    const hasSingle = recipeCode && batchQuantity && Number(batchQuantity) > 0;

    if (!hasMulti && !hasSingle) {
      return c.json({ error: "Recipe code and batch quantity (or a list of recipes) are required." }, 400);
    }

    const performer = user?.fullName || defaultStoreMgr;

    const result = await dispenseBatchToProduction({
      recipeCode,
      batchQuantity: batchQuantity ? Number(batchQuantity) : undefined,
      recipes: hasMulti ? recipes : undefined,
      performedByName: performer,
      recipient,
      shiftType,
      notes,
      customIngredients,
    });

    return c.json({ success: true, message: "Production batch ingredients dispensed successfully.", result });
  } catch (err: any) {
    return c.json({ error: err.message || "Dispensing failed." }, 400);
  }
});

// 4b. DIRECT INDIVIDUAL MATERIAL DISPENSING
inventoryRouter.post("/dispense-item", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const defaultSup = await getDefaultSupervisorName();
    const defaultStoreMgr = await getDefaultStoreManagerName();

    const {
      itemCode,
      quantity,
      dispensedUom,
      isVariableDispatch,
      recipient = `${defaultSup} (Production Floor)`,
      shiftType = "MORNING_SHIFT",
      purpose = "Floor Direct Requisition",
      notes,
    } = body;

    if (!itemCode || !quantity || Number(quantity) <= 0) {
      return c.json({ error: "Item code and a valid positive quantity are required." }, 400);
    }

    const performer = user?.fullName || defaultStoreMgr;

    const result = await dispenseIndividualItem({
      itemCode,
      quantity: Number(quantity),
      dispensedUom,
      isVariableDispatch: Boolean(isVariableDispatch),
      performedByName: performer,
      recipient,
      shiftType,
      purpose,
      notes,
    });

    return c.json({
      success: true,
      message: `${result.quantity} ${result.dispensedUom || result.item.uom} of ${result.item.name} dispensed successfully.`,
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Direct material dispensing failed." }, 400);
  }
});

// 4d. EVENT-DRIVEN DEPLETION (MARK CONTAINER EMPTY / OPEN NEXT)
inventoryRouter.post("/items/:id/deplete-container", async (c) => {
  try {
    const user = await getAuthUser(c);
    const itemCodeOrId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const { openNextContainer = false, reason = "Marked empty on production floor", shiftType = "MORNING_SHIFT" } = body;

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await markItemContainerDepleted({
      itemCodeOrId,
      openNextContainer: Boolean(openNextContainer),
      reason,
      performedByName: performer,
      shiftType,
    });

    return c.json({
      success: true,
      message: result.message,
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to mark container depleted." }, 400);
  }
});

// 4e. UPDATE FLOOR LEVELS FOR VARIABLE ITEMS (POST-DISPATCH PHYSICAL COUNT)
inventoryRouter.post("/items/update-floor-levels", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const { updates, shiftType = "MORNING_SHIFT", recipient } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return c.json({ error: "Updates array is required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";
    const result = await updateVariableFloorLevels({
      updates,
      performedByName: performer,
      recipient,
      shiftType,
    });

    return c.json({
      success: true,
      message: "Variable material floor levels updated successfully.",
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update floor levels." }, 400);
  }
});

// 4c. CANCEL PROVISIONAL DISPATCH (BEFORE SHIFT HANDOVER)
inventoryRouter.post("/dispatches/:referenceId/cancel", async (c) => {
  try {
    const user = await getAuthUser(c);
    const referenceId = c.req.param("referenceId");
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await cancelDispatch(referenceId, performer);
    return c.json({ success: true, result, message: result.message });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to cancel dispatch." }, 400);
  }
});

// 4d. EDIT PROVISIONAL DISPATCH ITEMS (BEFORE SHIFT HANDOVER)
inventoryRouter.post("/dispatches/:referenceId/edit", async (c) => {
  try {
    const user = await getAuthUser(c);
    const referenceId = c.req.param("referenceId");
    const body = await c.req.json();
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const { items = [], recipient, notes } = body;

    const result = await updatePendingDispatch({
      referenceId,
      items,
      recipient,
      notes,
      performedByName: performer,
    });

    return c.json({ success: true, result, message: result.message });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update dispatch." }, 400);
  }
});

// 5. FAULT RETURNS & IMMEDIATE REPLACEMENTS
inventoryRouter.post("/returns/fault", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      itemCode,
      quantity,
      unit,
      faultReason,
      recipient = "Production Shift (Floor)",
      shiftType = "MORNING_SHIFT",
      referenceBatch,
      issueReplacement = true,
    } = body;

    if (!itemCode || !quantity || !faultReason) {
      return c.json({ error: "Item code, quantity, and fault reason are required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await processFaultReturnAndReplace({
      itemCode,
      quantity: Number(quantity),
      unit,
      faultReason,
      performedByName: performer,
      recipient,
      shiftType,
      referenceBatch,
      issueReplacement: Boolean(issueReplacement),
    });

    return c.json({
      success: true,
      message: result.replacementIssued
        ? `Defective items recorded and ${result.replacementQuantity} replacement units issued from store stock.`
        : `Defective items recorded as scrap. No replacement issued (store stock balance untouched).`,
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Fault replacement failed." }, 400);
  }
});

// 6. EXCESS INGREDIENTS RESTOCK
inventoryRouter.post("/returns/excess", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      itemCode,
      quantity,
      unit,
      conditionNotes = "Clean, unmixed, sanitary condition verified",
      recipient = "Production Shift (Floor)",
      shiftType = "MORNING_SHIFT",
      referenceBatch,
    } = body;

    if (!itemCode || !quantity) {
      return c.json({ error: "Item code and quantity are required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await processExcessRestock({
      itemCode,
      quantity: Number(quantity),
      unit,
      conditionNotes,
      performedByName: performer,
      recipient,
      shiftType,
      referenceBatch,
    });

    return c.json({
      success: true,
      message: `${result.restockedQuantity} units restocked back to active inventory.`,
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Excess restock failed." }, 400);
  }
});

// 7. SHIFT MANAGEMENT & RECONCILIATION
inventoryRouter.get("/shifts", async (c) => {
  try {
    const shiftType = c.req.query("shiftType");
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;

    const [shifts, activeInfo] = await Promise.all([
      getShifts({ shiftType, limit }),
      getActiveShiftInfo(shiftType as any),
    ]);

    return c.json({
      success: true,
      shifts,
      activeShiftRecord: activeInfo.activeShiftRecord,
      activeShiftStats: activeInfo.activeShiftStats,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load shifts." }, 500);
  }
});

inventoryRouter.post("/shifts/open", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const { shiftType = "MORNING_SHIFT", officerName, notes } = body;

    const performer = officerName || user?.fullName || "Store Officer";
    const shift = await openShiftRecord({
      shiftType,
      officerName: performer,
      notes,
    });

    return c.json({
      success: true,
      message: `${shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} shift successfully opened.`,
      shift,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to open shift." }, 400);
  }
});

inventoryRouter.get("/shifts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const shift = await getShiftById(id);
    if (!shift) {
      return c.json({ error: "Shift record not found." }, 404);
    }
    return c.json({ success: true, shift });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load shift." }, 500);
  }
});

inventoryRouter.post("/shifts/reconcile", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      shiftType = "MORNING_SHIFT",
      counts = [],
      handoverOfficerName = "Incoming Store Officer",
      notes,
    } = body;

    const safeCounts = Array.isArray(counts) ? counts : [];
    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await reconcileShiftStock({
      shiftType,
      counts: safeCounts,
      performedByName: performer,
      handoverOfficerName,
      notes,
    });

    return c.json({
      success: true,
      message: "Shift stock count reconciled and handover report locked.",
      result,
      shiftRecord: result.shiftRecord,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Shift reconciliation failed." }, 400);
  }
});

// 8. STOCK TRANSACTIONS AUDIT LEDGER
inventoryRouter.get("/transactions", async (c) => {
  try {
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
    const page = c.req.query("page") ? Math.max(1, Number(c.req.query("page"))) : 1;
    const offset = c.req.query("offset") ? Number(c.req.query("offset")) : (page - 1) * limit;
    const type = c.req.query("type");
    const category = c.req.query("category");
    const search = c.req.query("search");
    const itemId = c.req.query("itemId");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const transactions = await getStockTransactions({
      limit,
      offset,
      type,
      category,
      search,
      itemId,
      startDate,
      endDate,
    });
    return c.json({ success: true, transactions, page, limit });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load transactions." }, 500);
  }
});

// 9. RETURNS & ROOT CAUSE AUDIT
inventoryRouter.get("/returns-audit", async (c) => {
  try {
    const audit = await getReturnsAudit();
    return c.json({ success: true, ...audit });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load returns audit." }, 500);
  }
});

// 10. DAILY SHIFT STOCK SHEET REPORT
inventoryRouter.get("/daily-shift-report", async (c) => {
  try {
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];
    const shiftType = (c.req.query("shiftType") as any) || "ALL";

    const report = await getDailyShiftStockReport({ date, shiftType });
    return c.json({ success: true, report });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to generate daily shift stock report." }, 500);
  }
});

// 11. REQUISITION APPROVAL STATUS
inventoryRouter.get("/requisitions/:refId/status", async (c) => {
  try {
    const refId = decodeURIComponent(c.req.param("refId"));
    const approval = await getRequisitionApprovalByRef(refId);
    return c.json({ success: true, approval });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load approval status." }, 500);
  }
});

// 12. PERIOD STATEMENT CSV EXPORT
inventoryRouter.get("/statement-export", async (c) => {
  try {
    const startDate =
      c.req.query("startDate") ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const endDate = c.req.query("endDate") || new Date().toISOString().split("T")[0];
    const shiftType = (c.req.query("shiftType") as any) || "ALL";

    const csvContent = await generatePeriodStatementCSV({ startDate, endDate, shiftType });
    const filename = `Moh_Movement_Audit_Log_${startDate}_to_${endDate}_${shiftType}.csv`;

    if (c.req.query("format") === "json") {
      return c.json({ success: true, csv: csvContent, filename });
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to generate statement export." }, 500);
  }
});



