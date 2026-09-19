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
