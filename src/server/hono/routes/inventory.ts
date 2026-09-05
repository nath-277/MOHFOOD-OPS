import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getInventoryItems,
  getProductRecipes,
  calculateRecipeRequirements,
  receiveAdHocIntake,
  dispenseBatchToProduction,
  processFaultReturnAndReplace,
  processExcessRestock,
  reconcileShiftStock,
  getStockTransactions,
} from "../../inventory/store";

export const inventoryRouter = new Hono();

// Helper to extract authenticated user
async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. GET ITEMS CATALOG
inventoryRouter.get("/items", async (c) => {
  try {
    const category = c.req.query("category");
    const search = c.req.query("search");

    const items = await getInventoryItems({ category, search });
    return c.json({ success: true, items });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch inventory items." }, 500);
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

    if (!itemCode || !quantity || !lotNumber || !supplierName) {
      return c.json(
        { error: "Item code, quantity, lot number, and supplier name are required." },
        400
      );
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await receiveAdHocIntake({
      itemCode,
      quantity: Number(quantity),
      lotNumber,
      supplierName,
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

// 3. RECIPES & BOM CALCULATOR
inventoryRouter.get("/recipes", async (c) => {
  try {
    const recipes = await getProductRecipes();
    return c.json({ success: true, recipes });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load product recipes." }, 500);
  }
});

inventoryRouter.post("/calculate-bom", async (c) => {
  try {
    const body = await c.req.json();
    const { recipeCode, batchQuantity } = body;

    if (!recipeCode || !batchQuantity || Number(batchQuantity) <= 0) {
      return c.json({ error: "Please provide a valid recipe code and batch quantity." }, 400);
    }

    const calculation = await calculateRecipeRequirements(recipeCode, Number(batchQuantity));
    return c.json({ success: true, calculation });
  } catch (err: any) {
    return c.json({ error: err.message || "BOM calculation failed." }, 400);
  }
});

// 4. SHIFT BATCH DISPENSING TO PRODUCTION
inventoryRouter.post("/dispense", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      recipeCode,
      batchQuantity,
      recipient = "Production Supervisor (David Adeleke)",
      shiftType = "MORNING_SHIFT",
      notes,
    } = body;

    if (!recipeCode || !batchQuantity || Number(batchQuantity) <= 0) {
      return c.json({ error: "Recipe code and batch quantity are required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await dispenseBatchToProduction({
      recipeCode,
      batchQuantity: Number(batchQuantity),
      performedByName: performer,
      recipient,
      shiftType,
      notes,
    });

    return c.json({ success: true, message: "Production batch ingredients dispensed successfully.", result });
  } catch (err: any) {
    return c.json({ error: err.message || "Dispensing failed." }, 400);
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
      faultReason,
      recipient = "Production Shift (Floor)",
      shiftType = "MORNING_SHIFT",
      referenceBatch,
    } = body;

    if (!itemCode || !quantity || !faultReason) {
      return c.json({ error: "Item code, quantity, and fault reason are required." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await processFaultReturnAndReplace({
      itemCode,
      quantity: Number(quantity),
      faultReason,
      performedByName: performer,
      recipient,
      shiftType,
      referenceBatch,
    });

    return c.json({
      success: true,
      message: `Defective items recorded and ${result.replacementQuantity} replacement units issued.`,
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

// 7. SHIFT RECONCILIATION & CLOSING STOCK COUNT
inventoryRouter.post("/shifts/reconcile", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    const {
      shiftType = "MORNING_SHIFT",
      counts,
      handoverOfficerName = "Night Shift Officer",
      notes,
    } = body;

    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      return c.json({ error: "Physical count array is required for shift reconciliation." }, 400);
    }

    const performer = user?.fullName || "Store Staff (Floor Terminal)";

    const result = await reconcileShiftStock({
      shiftType,
      counts,
      performedByName: performer,
      handoverOfficerName,
      notes,
    });

    return c.json({
      success: true,
      message: "Shift stock count reconciled and handover report locked.",
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Shift reconciliation failed." }, 400);
  }
});

// 8. STOCK TRANSACTIONS AUDIT LEDGER
inventoryRouter.get("/transactions", async (c) => {
  try {
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 30;
    const transactions = await getStockTransactions(limit);
    return c.json({ success: true, transactions });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load transactions." }, 500);
  }
});
