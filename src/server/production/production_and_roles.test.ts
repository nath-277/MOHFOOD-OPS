import { describe, it, expect } from "bun:test";
import {
  createProductionShiftLog,
  getProductionShiftLogs,
  getShiftRequisitions,
  approveShiftRequisition,
} from "./store";
import { findUserByIdentifier, findUserByPin } from "../auth/store";
import { createInventoryItem, dispenseIndividualItem } from "../inventory/store";

describe("Production Supervisor Operations & Shift Logs", () => {
  it("should create and retrieve production shift logs for factory auditing", async () => {
    const today = new Date().toISOString().split("T")[0];
    const testNote = `Pasteurizer line 2 ran at 72°C. Batch 104 completed smoothly. Incident free. Ref: ${Date.now()}`;

    const newLog = await createProductionShiftLog({
      shiftDate: today,
      shiftType: "MORNING_SHIFT",
      supervisorId: "usr_sup_003",
      supervisorName: "David Adeleke",
      status: "OPTIMAL",
      powerStatus: "PHCN Grid Stable (0 hours generator)",
      equipmentNotes: testNote,
      outputSummary: "Produced 1,450 units of Moh Parfaits & Greek Yogurt",
      incidents: "No safety or contamination incidents reported",
      handoverNotes: "Transferred custody of chilled tanks to Night Supervisor Emmanuel Udoh",
    });

    expect(newLog).toBeDefined();
    expect(newLog.id).toBeDefined();
    expect(newLog.shiftDate).toBe(today);
    expect(newLog.shiftType).toBe("MORNING_SHIFT");
    expect(newLog.supervisorName).toBe("David Adeleke");
    expect(newLog.equipmentNotes).toBe(testNote);

    // Retrieve logs for today
    const logs = await getProductionShiftLogs({ date: today });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const found = logs.find((l) => l.id === newLog.id);
    expect(found).toBeDefined();
    expect(found?.outputSummary).toContain("1,450 units");
  });

  it("should capture and digitally approve material requisitions by production supervisor", async () => {
    const today = new Date().toISOString().split("T")[0];
    const testItemCode = `TEST-STRAW-${Date.now()}`;
    const batchRef = `BATCH-REQ-${Date.now()}`;

    // Create item to dispense
    await createInventoryItem({
      code: testItemCode,
      name: "Test Strawberries Bulk",
      category: "PERISHABLE_MEASURED",
      uom: "kg",
      currentStock: 100,
      minStockThreshold: 10,
      costPerUnit: 3500,
      storageLocation: "Chilled Room 1",
      packagingType: "DIRECT",
    });

    // Dispense item to production floor with referenceId
    await dispenseIndividualItem({
      itemCode: testItemCode,
      quantity: 15,
      performedByName: "Ajayi Boluwatife",
      recipient: "David Adeleke (Production)",
      shiftType: "MORNING_SHIFT",
      notes: "Dispensed for Parfait Fruit Layering",
      referenceId: batchRef,
    });

    // Retrieve shift requisitions
    const requisitions = await getShiftRequisitions({
      date: today,
      shift: "MORNING_SHIFT",
    });

    expect(requisitions.length).toBeGreaterThanOrEqual(1);
    const foundReq = requisitions.find((r) => r.referenceId === batchRef);
    expect(foundReq).toBeDefined();
    expect(foundReq?.items.length).toBeGreaterThanOrEqual(1);
    expect(foundReq?.items[0].itemName).toBe("Test Strawberries Bulk");
    expect(foundReq?.items[0].quantity).toBe(15);
    expect(foundReq?.status).toBe("PENDING_APPROVAL");

    // Supervisor digitally approves the requisition
    const result = await approveShiftRequisition(batchRef, {
      shiftDate: today,
      shiftType: "MORNING_SHIFT",
      approvedBy: "David Adeleke (Supervisor)",
      notes: "Quantities verified on factory scale and accepted by kitchen team",
    });

    expect(result.success).toBe(true);
    expect(result.approval.status).toBe("APPROVED");
    expect(result.approval.approvedBy).toContain("David Adeleke");

    // Verify subsequent query reflects APPROVED
    const updatedRequisitions = await getShiftRequisitions({
      date: today,
      shift: "MORNING_SHIFT",
    });
    const approvedReq = updatedRequisitions.find((r) => r.referenceId === batchRef);
    expect(approvedReq).toBeDefined();
    expect(approvedReq?.status).toBe("APPROVED");
    expect(approvedReq?.approvedBy).toContain("David Adeleke");
  });
});

describe("Accountant Role & Audit Access", () => {
  it("should have accountant user account seeded with staffId, email, role, and tablet PIN 6666", async () => {
    const accountantUser = await findUserByIdentifier("accountant@mohfood.com");
    expect(accountantUser).toBeDefined();
    expect(accountantUser?.role).toBe("ACCOUNTANT");
    expect(accountantUser?.staffId).toBe("MOH-ACC-01");
    expect(accountantUser?.departmentCode).toBe("ACCOUNTING");

    // Authenticate with 4-digit PIN
    const pinUser = await findUserByPin("6666");
    expect(pinUser).not.toBeNull();
    expect(pinUser?.role).toBe("ACCOUNTANT");
    expect(pinUser?.email).toBe("accountant@mohfood.com");
  });
});

describe("Production Target Capacity Settings & Customization", () => {
  it("should default dailyTargetCapacity to 400 and allow updates", async () => {
    const { getProductionSettings, updateProductionSettings } = await import("./store");
    const settings = await getProductionSettings();
    expect(settings).toBeDefined();
    expect(typeof settings.dailyTargetCapacity).toBe("number");

    // Update target
    const updated = await updateProductionSettings({
      dailyTargetCapacity: 450,
      updatedBy: "Executive CEO",
    });
    expect(updated.dailyTargetCapacity).toBe(450);

    const check = await getProductionSettings();
    expect(check.dailyTargetCapacity).toBe(450);

    // Reset back to standard 400
    await updateProductionSettings({ dailyTargetCapacity: 400, updatedBy: "System Reset" });
    const standard = await getProductionSettings();
    expect(standard.dailyTargetCapacity).toBe(400);
  });
});

describe("Single-Field Shift Operations Log", () => {
  it("should record and fetch a unified single-field description shift log", async () => {
    const today = new Date().toISOString().split("T")[0];
    const logDescription = `Complete shift description: Mixed 400 cups Strawberry Parfait. Line CIP finished. Grid power continuous. Ready for night run.`;

    const log = await createProductionShiftLog({
      shiftDate: today,
      shiftType: "NIGHT_SHIFT",
      supervisorName: "David Adeleke",
      status: "OPTIMAL",
      notes: logDescription,
    });

    expect(log).toBeDefined();
    expect(log.notes).toBe(logDescription);

    const logs = await getProductionShiftLogs({ date: today, shift: "NIGHT_SHIFT" });
    const found = logs.find((l) => l.id === log.id);
    expect(found).toBeDefined();
    expect(found?.notes).toBe(logDescription);
  });
});

describe("Requisition Slip & Staff Name Resolution", () => {
  it("should strip parenthetical role labels and format clean person names", async () => {
    const { cleanStaffName, generateRequisitionSlipHtml } = await import("@/lib/printUtils");

    expect(cleanStaffName("David Adeleke (Production Supervisor)")).toBe("David Adeleke");
    expect(cleanStaffName("Ibrahim Musa (Store Officer on Duty)")).toBe("Ibrahim Musa");
    expect(cleanStaffName("Production Supervisor")).toBe("David Adeleke");
    expect(cleanStaffName("Store Officer")).toBe("Ibrahim Musa");

    // Test slip generation
    const unapprovedHtml = generateRequisitionSlipHtml({
      shiftType: "MORNING_SHIFT",
      date: "2026-09-20",
      productName: "Moh Strawberry Parfait",
      preparedBy: "David Adeleke (Production Supervisor)",
      issuedBy: "Ibrahim Musa (Store Officer)",
      items: [
        { itemName: "Seedless Purple Grapes", quantity: 400, unit: "pcs", notes: "dished 400 pcs" },
      ],
      isApproved: false,
    });

    expect(unapprovedHtml).toContain("David Adeleke");
    expect(unapprovedHtml).toContain("Ibrahim Musa");
    expect(unapprovedHtml).not.toContain("(Production Supervisor)");
    expect(unapprovedHtml).toContain("ACCEPTED BY:");
    expect(unapprovedHtml).toContain("ISSUED BY:");
    expect(unapprovedHtml).toContain("Pending Production Acceptance");
    expect(unapprovedHtml).toContain("400");
    expect(unapprovedHtml).toContain("pcs");

    // Test approved slip
    const approvedHtml = generateRequisitionSlipHtml({
      shiftType: "MORNING_SHIFT",
      date: "2026-09-20",
      productName: "Moh Strawberry Parfait",
      acceptedBy: "David Adeleke",
      issuedBy: "Ibrahim Musa",
      items: [
        { itemName: "Cashew Nuts", quantity: 400, unit: "pcs" },
      ],
      isApproved: true,
    });

    expect(approvedHtml).toContain("✓ Accepted & Verified (David Adeleke)");
  });
});

describe("In-House Logistics Fleet", () => {
  it("should contain in-house delivery vans and dispatch riders in INITIAL_FLEET", async () => {
    const { INITIAL_FLEET } = await import("../logistics/store");
    expect(INITIAL_FLEET.length).toBeGreaterThanOrEqual(4);
    const vehicleNames = INITIAL_FLEET.map((v) => v.vehicleName);
    expect(vehicleNames.some((n) => n.includes("In-House Van 1"))).toBe(true);
    expect(vehicleNames.some((n) => n.includes("In-House Van 2"))).toBe(true);
    expect(vehicleNames.some((n) => n.includes("In-House Rider 1"))).toBe(true);
    expect(vehicleNames.some((n) => n.includes("In-House Rider 2"))).toBe(true);
  });
});

describe("Work Order Scheduling, Edit & Delete", () => {
  it("should create a work order with scheduledDate, allow updating and deleting", async () => {
    const {
      createWorkOrder,
      updateWorkOrder,
      deleteWorkOrder,
      getWorkOrders,
    } = await import("./store");

    const order = await createWorkOrder({
      recipeCode: "REC-PARFAIT-500",
      recipeName: "Strawberry Parfait (500ml)",
      targetQuantity: 400,
      shiftType: "MORNING_SHIFT",
      mixingTankId: "eq-01",
      mixingTankName: "Mixing Tank #1",
      supervisorName: "David Adeleke",
      scheduledDate: "2026-10-01",
      notes: "Test scheduled order",
    });

    expect(order).toBeDefined();
    expect(order.scheduledDate).toBe("2026-10-01");
    expect(order.targetQuantity).toBe(400);

    // Update work order
    const updated = await updateWorkOrder(
      order.id,
      {
        targetQuantity: 500,
        notes: "Updated order notes",
        scheduledDate: "2026-10-05",
      },
      "David Adeleke"
    );

    expect(updated).not.toBeNull();
    expect(updated?.targetQuantity).toBe(500);
    expect(updated?.scheduledDate).toBe("2026-10-05");
    expect(updated?.notes).toBe("Updated order notes");

    // Delete work order
    const deleted = await deleteWorkOrder(order.id, "David Adeleke");
    expect(deleted.success).toBe(true);

    const orders = await getWorkOrders();
    expect(orders.find((o) => o.id === order.id)).toBeUndefined();
  });
});

describe("Store Shift Handover Without Physical Counts", () => {
  it("should successfully reconcile and lock shift handover with empty counts array", async () => {
    const { reconcileShiftStock, getShifts } = await import("../inventory/store");

    const result = await reconcileShiftStock({
      shiftType: "MORNING_SHIFT",
      counts: [],
      performedByName: "Store Keeper",
      handoverOfficerName: "Production Lead",
      notes: "Store dispensing handover for morning factory run",
    });

    expect(result.shiftRecord).toBeDefined();
    expect(result.shiftRecord.status).toBe("RECONCILED");
    expect(result.shiftRecord.totalVariances).toBe(0);
    expect(result.shiftRecord.totalItemsChecked).toBe(0);
    expect(result.shiftRecord.handoverOfficerName).toBe("Production Lead");

    const records = await getShifts();
    const found = records.find((r) => r.id === result.shiftRecord.id);
    expect(found).toBeDefined();
  });
});

describe("Requisition Approval Synchronization & Lookup", () => {
  it("should look up approval status by reference ID", async () => {
    const { approveShiftRequisition, getRequisitionApprovalByRef } = await import("./store");

    const ref = "REQ-TEST-SYNC-" + Date.now();
    await approveShiftRequisition({
      referenceId: ref,
      shiftDate: "2026-09-21",
      shiftType: "MORNING_SHIFT",
      approvedBy: "David Adeleke",
      notes: "Vetted all ingredients on floor",
    });

    const approval = await getRequisitionApprovalByRef(ref);
    expect(approval).not.toBeNull();
    expect(approval?.status).toBe("APPROVED");
    expect(approval?.approvedBy).toBe("David Adeleke");
    expect(approval?.referenceId).toBe(ref);
  });
});

describe("Date-Range Statement CSV Export", () => {
  it("should generate a multi-day statement with consolidated summary and transaction log", async () => {
    const { generatePeriodStatementCSV } = await import("../inventory/store");

    const csv = await generatePeriodStatementCSV({
      startDate: "2026-09-01",
      endDate: "2026-09-21",
      shiftType: "ALL",
    });

    expect(csv).toContain("MOH FOOD AND CONFECTIONERIES — OFFICIAL STOCK PERIOD STATEMENT");
    expect(csv).toContain("SECTION 1: CONSOLIDATED STOCK BALANCE SUMMARY");
    expect(csv).toContain("SECTION 2: COMPLETE TRANSACTION MOVEMENTS AUDIT LOG");
    expect(csv).toContain("2026-09-01 to 2026-09-21");
    expect(csv).toContain("Opening Stock");
    expect(csv).toContain("Period Closing Stock");
  });
});

describe("Store Officer Role Elimination", () => {
  it("should not allow STORE_OFFICER in ALLOWED_ROLES and assign store staff STORE_MANAGER", async () => {
    const { ALLOWED_ROLES, getAllUsers } = await import("../auth/store");

    expect(ALLOWED_ROLES).not.toContain("STORE_OFFICER" as any);
    expect(ALLOWED_ROLES).toContain("STORE_MANAGER");

    const users = await getAllUsers();
    const blessing = users.find((u) => u.email === "store.officer@mohfood.com");
    expect(blessing).toBeDefined();
    expect(blessing?.role).toBe("STORE_MANAGER");
  });
});

describe("Route Protection for Production Supervisor", () => {
  it("should prevent production supervisor from mutating inventory routes with 403 Forbidden", async () => {
    const { inventoryRouter } = await import("../hono/routes/inventory");
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");

    const token = await signSession({
      sessionId: "sess_test_supervisor",
      userId: "usr_prod_005",
      staffId: "MOH-PRD-01",
      email: "production@mohfood.com",
      role: "PRODUCTION_SUPERVISOR",
      departmentCode: "PRODUCTION",
      fullName: "David Adeleke",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const req = new Request("http://localhost/dispense", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        recipeCode: "REC-PARFAIT-400ML",
        batchQuantity: 400,
        recipient: "David Adeleke",
      }),
    });

    const res = await inventoryRouter.fetch(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Access denied: Production supervisors cannot modify store inventory");
  });
});


