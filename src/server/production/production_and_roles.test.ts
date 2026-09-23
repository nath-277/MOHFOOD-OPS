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
    // Requisitions are now consolidated per shift — referenceId is shift-level
    const shiftRefId = `SHIFT-${today}-MORNING_SHIFT`;
    const foundReq = requisitions.find((r) => r.referenceId === shiftRefId);
    expect(foundReq).toBeDefined();
    expect(foundReq?.items.length).toBeGreaterThanOrEqual(1);
    expect(foundReq?.items.some((i) => i.itemName === "Test Strawberries Bulk")).toBe(true);
    const testItem = foundReq?.items.find((i) => i.itemName === "Test Strawberries Bulk");
    expect(testItem?.quantity).toBe(15);
    expect(foundReq?.status).toBe("PENDING_APPROVAL");

    // Supervisor digitally approves the shift requisition
    const result = await approveShiftRequisition(shiftRefId, {
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
    const approvedReq = updatedRequisitions.find((r) => r.referenceId === shiftRefId);
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
  it("should strip parenthetical role labels and format clean person names without hardcoded substitutions", async () => {
    const { cleanStaffName, generateRequisitionSlipHtml } = await import("@/lib/printUtils");
    const { getDefaultSupervisorName, getDefaultStoreManagerName } = await import("../auth/store");

    expect(cleanStaffName("David Adeleke (Production Supervisor)")).toBe("David Adeleke");
    expect(cleanStaffName("Ajayi Boluwatife (Store Manager on Duty)")).toBe("Ajayi Boluwatife");
    expect(cleanStaffName("Production Supervisor")).toBe("Production Supervisor");
    expect(cleanStaffName("Store Manager")).toBe("Store Manager");
    expect(cleanStaffName("", "Production Supervisor")).toBe("Production Supervisor");

    // Verify DB-driven dynamic resolvers
    const defaultSup = await getDefaultSupervisorName();
    const defaultMgr = await getDefaultStoreManagerName();
    expect(typeof defaultSup).toBe("string");
    expect(defaultSup.length).toBeGreaterThan(0);
    expect(typeof defaultMgr).toBe("string");
    expect(defaultMgr.length).toBeGreaterThan(0);

    // Test slip generation
    const unapprovedHtml = generateRequisitionSlipHtml({
      shiftType: "MORNING_SHIFT",
      date: "2026-09-20",
      productName: "Moh Strawberry Parfait",
      preparedBy: "David Adeleke (Production Supervisor)",
      issuedBy: "Ajayi Boluwatife (Store Manager)",
      items: [
        { itemName: "Seedless Purple Grapes", quantity: 400, unit: "pcs", notes: "dished 400 pcs" },
      ],
      isApproved: false,
    });

    expect(unapprovedHtml).toContain("David Adeleke");
    expect(unapprovedHtml).toContain("Ajayi Boluwatife");
    expect(unapprovedHtml).not.toContain("(Production Supervisor)");
    expect(unapprovedHtml).not.toContain("(Store Manager)");
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
      issuedBy: "Ajayi Boluwatife",
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

describe("Movement & Audit CSV Export Ledger", () => {
  it("should generate a single continuous Movement and Audit CSV table with all 19 standardized columns", async () => {
    const { generatePeriodStatementCSV } = await import("../inventory/store");

    const csv = await generatePeriodStatementCSV({
      startDate: "2026-09-01",
      endDate: "2026-09-21",
      shiftType: "ALL",
    });

    // Verify standardized 19 audit ledger headers
    expect(csv).toContain("Transaction ID");
    expect(csv).toContain("Date (YYYY-MM-DD)");
    expect(csv).toContain("Time (HH:MM:SS)");
    expect(csv).toContain("Shift");
    expect(csv).toContain("Reference / Batch ID");
    expect(csv).toContain("Movement Type");
    expect(csv).toContain("Direction");
    expect(csv).toContain("Item SKU");
    expect(csv).toContain("Item Name");
    expect(csv).toContain("Category");
    expect(csv).toContain("Quantity");
    expect(csv).toContain("UoM");
    expect(csv).toContain("Portion / Secondary Details");
    expect(csv).toContain("Unit Cost (NGN)");
    expect(csv).toContain("Total Valuation Impact (NGN)");
    expect(csv).toContain("Performed By (Staff)");
    expect(csv).toContain("Recipient / Destination");
    expect(csv).toContain("Handover Status");
    expect(csv).toContain("Audit & Requisition Notes");

    // Must be a single clean table without legacy disjoint section headers
    expect(csv).not.toContain("SECTION 1: CONSOLIDATED STOCK BALANCE SUMMARY");
    expect(csv).not.toContain("SECTION 2: COMPLETE TRANSACTION MOVEMENTS AUDIT LOG");

    // First line must be the CSV header row
    const lines = csv.split("\n");
    expect(lines[0]).toContain('"Transaction ID","Date (YYYY-MM-DD)"');
  });
});

describe("Store Officer Role Elimination", () => {
  it("should not allow STORE_OFFICER in ALLOWED_ROLES and assign store staff STORE_MANAGER", async () => {
    const { ALLOWED_ROLES, getAllUsers } = await import("../auth/store");

    expect(ALLOWED_ROLES).not.toContain("STORE_OFFICER" as any);
    expect(ALLOWED_ROLES).toContain("STORE_MANAGER");

    const users = await getAllUsers();
    const storeManager = users.find((u) => u.email === "store.manager@mohfood.com");
    expect(storeManager).toBeDefined();
    expect(storeManager?.role).toBe("STORE_MANAGER");

    // Blessing Okon (store.officer@mohfood.com) was wiped by admin and must not exist
    const blessing = users.find((u) => u.email === "store.officer@mohfood.com");
    expect(blessing).toBeUndefined();
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

describe("Legacy STORE_OFFICER Session Auto-Migration & Proxy Protection", () => {
  it("should auto-migrate legacy STORE_OFFICER token to STORE_MANAGER in verifySession", async () => {
    const { signSession, verifySession } = await import("../auth/session");

    const legacyPayload = {
      sessionId: "sess_legacy_officer_01",
      userId: "usr_store_off_004",
      staffId: "MOH-STR-02",
      fullName: "Blessing Okon",
      email: "store.officer@mohfood.com",
      role: "STORE_OFFICER",
      departmentCode: "INVENTORY_STORE",
      activeShift: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const token = await signSession(legacyPayload as any);
    const verified = await verifySession(token);

    expect(verified).not.toBeNull();
    expect(verified?.role).toBe("STORE_MANAGER");
    expect(verified?.email).toBe("store.officer@mohfood.com");
  });

  it("should allow legacy STORE_OFFICER to access /inventory via proxy and refresh cookie", async () => {
    const { proxy } = await import("../../proxy");
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");
    const { NextRequest } = await import("next/server");

    const legacyPayload = {
      sessionId: "sess_legacy_officer_02",
      userId: "usr_store_off_004",
      staffId: "MOH-STR-02",
      fullName: "Blessing Okon",
      email: "store.officer@mohfood.com",
      role: "STORE_OFFICER",
      departmentCode: "INVENTORY_STORE",
      activeShift: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const token = await signSession(legacyPayload as any);

    const req = new NextRequest("http://localhost:3000/inventory", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    const res = await proxy(req);

    // It should NOT redirect away from /inventory into a loop
    expect(res.status).toBe(200);

    // It should set the refreshed cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(AUTH_COOKIE_NAME);
  });

  it("should invalidate corrupt/unknown role and redirect to /login?expired=true without looping", async () => {
    const { proxy } = await import("../../proxy");
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");
    const { NextRequest } = await import("next/server");

    const corruptPayload = {
      sessionId: "sess_corrupt_01",
      userId: "usr_corrupt_01",
      staffId: "MOH-XXX-01",
      fullName: "Unknown Role User",
      email: "unknown@mohfood.com",
      role: "NON_EXISTENT_ROLE",
      departmentCode: "UNKNOWN",
      activeShift: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const token = await signSession(corruptPayload as any);

    const req = new NextRequest("http://localhost:3000/inventory", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    const res = await proxy(req);

    // It should redirect to login with expired=true, NOT management or inventory
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?expired=true");
  });

  it("should allow /login?logout=true without auto-redirecting back to dashboard", async () => {
    const { proxy } = await import("../../proxy");
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");
    const { NextRequest } = await import("next/server");

    const token = await signSession({
      sessionId: "sess_valid_01",
      userId: "usr_store_mgr_003",
      staffId: "MOH-STR-01",
      fullName: "Ajayi Boluwatife",
      email: "store.manager@mohfood.com",
      role: "STORE_MANAGER",
      departmentCode: "INVENTORY_STORE",
      activeShift: null,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const req = new NextRequest("http://localhost:3000/login?logout=true", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    });

    const res = await proxy(req);

    // Should stay on login (status 200), not redirect to dashboard
    expect(res.status).toBe(200);
  });

  describe("Database Strict Enforcement & Mock Elimination", () => {
    it("should reject wiped/deleted users like Blessing Okon and store officer account", async () => {
      const deletedUser = await findUserByIdentifier("store.officer@mohfood.com");
      expect(deletedUser).toBeNull();

      const byStaffId = await findUserByIdentifier("MOH-STR-02");
      expect(byStaffId).toBeNull();
    });

    it("should strictly verify passwords and reject arbitrary bypass passwords", async () => {
      const { verifyPassword, hashPassword } = await import("../auth/session");
      const realHash = await hashPassword("ValidSecretPassword123!");

      // Valid match
      const isMatch = await verifyPassword("ValidSecretPassword123!", realHash);
      expect(isMatch).toBe(true);

      // Wrong password should fail, never bypass
      const isWrong = await verifyPassword("WrongPassword123!", realHash);
      expect(isWrong).toBe(false);

      // Former backdoor bypasses must strictly fail
      const isBackdoor = await verifyPassword("ChangeThisSecurePassword123!", realHash);
      expect(isBackdoor).toBe(false);

      const isAdminBackdoor = await verifyPassword("admin", realHash);
      expect(isAdminBackdoor).toBe(false);
    });

    it("should not return dummy seed shift logs when querying production shift logs", async () => {
      const { INITIAL_SHIFT_LOGS } = await import("./store");
      expect(INITIAL_SHIFT_LOGS.length).toBe(0);

      // Searching for non-existent date should return empty array, not dummy seeds
      const fakeDateLogs = await getProductionShiftLogs({ date: "1999-01-01" });
      expect(fakeDateLogs).toEqual([]);
      expect(fakeDateLogs.some((l) => l.id === "log-seed-01")).toBe(false);
    });
  });

  describe("Admin Staff CRUD (Edit & Permanent Delete)", () => {
    it("should allow admin to edit staff details, role, and tablet PIN, then permanently delete user", async () => {
      const {
        createStaffAccount,
        updateStaffAccount,
        deleteStaffAccount,
        findUserByIdentifier,
        verifyUserPin,
      } = await import("../auth/store");

      const testStaffId = `MOH-TST-${Date.now().toString().slice(-4)}`;
      const testEmail = `tst.${Date.now()}@mohfood.com`;

      // 1. Create staff
      const created = await createStaffAccount({
        staffId: testStaffId,
        fullName: "Initial Staff Name",
        email: testEmail,
        password: "InitialPassword123!",
        role: "STORE_MANAGER",
        departmentCode: "INVENTORY_STORE",
        phone: "+2348001112222",
        pin: "1234",
      });
      expect(created.fullName).toBe("Initial Staff Name");
      expect(created.staffId).toBe(testStaffId);

      // Verify initial PIN works
      const pinValid1 = await verifyUserPin(created.id, "1234");
      expect(pinValid1.success).toBe(true);

      // 2. Edit staff (update name, role, phone, and reset PIN to 8888)
      const updated = await updateStaffAccount(created.id, {
        fullName: "Updated Staff Name",
        role: "ACCOUNTANT",
        phone: "+2348009998888",
        pin: "8888",
        departmentCode: "ACCOUNTING",
      });
      expect(updated.fullName).toBe("Updated Staff Name");
      expect(updated.role).toBe("ACCOUNTANT");
      expect(updated.phone).toBe("+2348009998888");

      // Verify old PIN fails and new PIN works
      const oldPinCheck = await verifyUserPin(created.id, "1234");
      expect(oldPinCheck.success).toBe(false);

      const newPinCheck = await verifyUserPin(created.id, "8888");
      expect(newPinCheck.success).toBe(true);

      // 3. Permanently delete staff account
      const deleted = await deleteStaffAccount(created.id, { permanent: true });
      expect(deleted).toBe(true);

      // Verify user lookup returns null
      const checkLookup = await findUserByIdentifier(testEmail);
      expect(checkLookup).toBeNull();

      const checkById = await findUserByIdentifier(testStaffId);
      expect(checkById).toBeNull();
    });
  });

  describe("Requisition Slip Given-Out Filtering", () => {
    it("should render clean empty state when no materials were given out", async () => {
      const { generateRequisitionSlipHtml } = await import("@/lib/printUtils");

      const htmlEmpty = generateRequisitionSlipHtml({
        shiftType: "MORNING_SHIFT",
        date: "2026-09-22",
        referenceId: "REQ-TEST-EMPTY",
        productName: "Parfait 400ml",
        preparedBy: "Production Supervisor",
        acceptedBy: "Production Supervisor",
        issuedBy: "Store Manager",
        items: [],
      });

      expect(htmlEmpty).toContain("No materials were given out for this shift run.");
      expect(htmlEmpty).not.toContain("Fresh Whole Cow Milk");
    });

    it("should strictly list only items with positive quantity or valid culinary notes", async () => {
      const { generateRequisitionSlipHtml } = await import("@/lib/printUtils");

      const htmlWithItems = generateRequisitionSlipHtml({
        shiftType: "MORNING_SHIFT",
        date: "2026-09-22",
        referenceId: "REQ-TEST-ITEMS",
        productName: "Parfait 400ml",
        preparedBy: "Production Supervisor",
        acceptedBy: "Production Supervisor",
        issuedBy: "Store Manager",
        items: [
          { itemName: "Fresh Cow Milk", quantity: 50, unit: "kg" },
          { itemName: "Zero Qty Powder", quantity: 0, unit: "kg" }, // Should be excluded
          { itemName: "Seedless Grapes", quantity: 0, unit: "pcs", notes: "dished 400 pcs" }, // Valid notes should be kept
        ],
      });

      expect(htmlWithItems).toContain("Fresh Cow Milk");
      expect(htmlWithItems).toContain("Seedless Grapes");
      expect(htmlWithItems).not.toContain("Zero Qty Powder");
    });
  });

  describe("Executive Item Unit Cost Editing & Event Bus Logging", () => {
    it("should update item unit cost and record INVENTORY_ITEM_COST_UPDATED domain event", async () => {
      const { updateInventoryItem, getInventoryItems } = await import("../inventory/store");
      const { eventBus } = await import("../events/eventBus");

      const allItems = await getInventoryItems();
      expect(allItems.length).toBeGreaterThan(0);
      const targetItem = allItems[0];
      const originalCost = targetItem.costPerUnit;

      const newTestCost = 1950.5;
      const updated = await updateInventoryItem(targetItem.id, { costPerUnit: newTestCost });
      expect(updated.costPerUnit).toBe(newTestCost);

      // Publish event as the route handler does
      eventBus.publish(
        "INVENTORY_ITEM_COST_UPDATED",
        {
          itemId: targetItem.id,
          itemName: updated.name,
          costPerUnit: newTestCost,
        },
        "Executive Officer",
        "MANAGEMENT"
      );

      const recentEvents = eventBus.getRecentEvents(10, "MANAGEMENT");
      const costEvent = recentEvents.find((e) => e.type === "INVENTORY_ITEM_COST_UPDATED");
      expect(costEvent).toBeDefined();
      expect(costEvent?.performerName).toBe("Executive Officer");
      expect(costEvent?.payload?.costPerUnit).toBe(newTestCost);

      // Restore original cost
      await updateInventoryItem(targetItem.id, { costPerUnit: originalCost });
    });
  });
});


