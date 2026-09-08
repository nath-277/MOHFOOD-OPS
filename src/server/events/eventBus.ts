// Moh Foods NG (MOH-OPS) - Central Domain Event Bus & Audit Logger

export type DomainEventType =
  | "INVENTORY_INTAKE_RECORDED"
  | "INVENTORY_BATCH_DISPENSED"
  | "INVENTORY_INDIVIDUAL_DISPENSED"
  | "INVENTORY_FAULT_SCRAPPED"
  | "INVENTORY_EXCESS_RESTOCKED"
  | "SHIFT_HANDOVER_RECONCILED"
  | "PRODUCTION_WORK_ORDER_CREATED"
  | "PRODUCTION_BATCH_STARTED"
  | "PRODUCTION_YIELD_COMPLETED"
  | "LOGISTICS_RUN_DISPATCHED"
  | "LOGISTICS_DELIVERY_CONFIRMED"
  | "MANAGEMENT_CONSIGNMENT_DISPATCHED"
  | "MANAGEMENT_SOR_RETURN_RECORDED"
  | "MANAGEMENT_PAYMENT_SETTLED"
  | "PRODUCT_STORAGE_INTAKE_RECORDED"
  | "PRODUCT_STORAGE_DISPATCH_HANDOVER"
  | "SECURITY_PIN_SWITCH"
  | "STAFF_ACCOUNT_CREATED";

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  payload: T;
  performerName: string;
  departmentCode: string;
  timestamp: string;
}

type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

class DomainEventBus {
  private handlers: Map<DomainEventType, EventHandler[]> = new Map();
  private auditLog: DomainEvent[] = [
    {
      id: "evt-seed-01",
      type: "INVENTORY_INTAKE_RECORDED",
      payload: {
        itemCode: "RAW-MLK-01",
        itemName: "Full Cream Pasteurized Milk",
        quantity: 250,
        uom: "L",
        supplier: "FrieslandCampina WAMCO Nigeria",
        grnNumber: "GRN-2026-0905-01",
      },
      performerName: "Fatima Aliyu",
      departmentCode: "INVENTORY_STORE",
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: "evt-seed-02",
      type: "INVENTORY_BATCH_DISPENSED",
      payload: {
        recipeCode: "REC-PARFAIT-400ML",
        recipeName: "Signature Greek Yoghurt Parfait (400ml)",
        batchQuantity: 300,
        recipient: "David Adeleke (Production Supervisor)",
        referenceId: "BATCH-20260905-PRF-01",
        materialsCount: 5,
      },
      performerName: "Fatima Aliyu",
      departmentCode: "INVENTORY_STORE",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: "evt-seed-03",
      type: "INVENTORY_FAULT_SCRAPPED",
      payload: {
        itemCode: "PKG-CUP-400",
        itemName: "400ml Clear Dessert Cup",
        quantity: 15,
        faultReason: "Factory defective packaging (cracked cup seam)",
        replacementIssued: true,
        recipient: "Production Shift (Floor)",
      },
      performerName: "Musa Ibrahim",
      departmentCode: "INVENTORY_STORE",
      timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    },
    {
      id: "evt-seed-04",
      type: "MANAGEMENT_CONSIGNMENT_DISPATCHED",
      payload: {
        stockistName: "Spar Supermarket (Victoria Island)",
        stockistId: "STK-SPAR-VI",
        quantity: 80,
        grossValue: 176000,
        deliveryCode: "DEL-2026-0905-01",
      },
      performerName: "David Adeleke",
      departmentCode: "EXECUTIVE_MANAGEMENT",
      timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    },
    {
      id: "evt-seed-05",
      type: "MANAGEMENT_SOR_RETURN_RECORDED",
      payload: {
        stockistName: "Hubmart Stores (Ikeja GRA)",
        productCode: "PARFAIT-400ML",
        quantityReturned: 5,
        reason: "EXPIRED_ON_SHELF",
        creditAmount: 11000,
      },
      performerName: "David Adeleke",
      departmentCode: "EXECUTIVE_MANAGEMENT",
      timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    },
    {
      id: "evt-seed-06",
      type: "SECURITY_PIN_SWITCH",
      payload: {
        staffId: "MOH-ST-004",
        staffName: "Fatima Aliyu",
        targetDepartment: "INVENTORY_STORE",
        terminal: "Main Floor iPad Terminal",
      },
      performerName: "Fatima Aliyu",
      departmentCode: "SECURITY_IT",
      timestamp: new Date(Date.now() - 3600000 * 0.9).toISOString(),
    },
    {
      id: "evt-seed-07",
      type: "MANAGEMENT_PAYMENT_SETTLED",
      payload: {
        stockistName: "Ebeano Supermarket (Lekki Phase 1)",
        amount: 220000,
        paymentMethod: "BANK_TRANSFER",
        referenceNumber: "TXN-EBN-9921",
      },
      performerName: "Khadijah Mohammed",
      departmentCode: "EXECUTIVE_MANAGEMENT",
      timestamp: new Date(Date.now() - 3600000 * 0.4).toISOString(),
    },
  ];

  public subscribe<T = any>(type: DomainEventType, handler: EventHandler<T>): () => void {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);

    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(
        type,
        current.filter((h) => h !== handler)
      );
    };
  }

  public async publish<T = any>(
    type: DomainEventType,
    payload: T,
    performerName: string,
    departmentCode: string
  ): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload,
      performerName,
      departmentCode,
      timestamp: new Date().toISOString(),
    };

    // Store in audit history (capped at 500 recent events)
    this.auditLog.unshift(event);
    if (this.auditLog.length > 500) {
      this.auditLog.pop();
    }

    // Notify registered handlers asynchronously
    const registered = this.handlers.get(type) || [];
    for (const handler of registered) {
      try {
        await Promise.resolve(handler(event));
      } catch (err) {
        console.error(`[EventBus] Error in handler for ${type}:`, err);
      }
    }

    return event;
  }

  public getRecentEvents(limit = 50, department?: string): DomainEvent[] {
    if (department) {
      return this.auditLog.filter((e) => e.departmentCode === department).slice(0, limit);
    }
    return this.auditLog.slice(0, limit);
  }
}

export const eventBus = new DomainEventBus();
