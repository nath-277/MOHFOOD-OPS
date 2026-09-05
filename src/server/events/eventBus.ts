// Moh Foods NG (MOH-OPS) - Central Domain Event Bus & Audit Logger

export type DomainEventType =
  | "INVENTORY_INTAKE_RECORDED"
  | "INVENTORY_BATCH_DISPENSED"
  | "INVENTORY_FAULT_SCRAPPED"
  | "INVENTORY_EXCESS_RESTOCKED"
  | "PRODUCTION_WORK_ORDER_CREATED"
  | "PRODUCTION_BATCH_STARTED"
  | "PRODUCTION_YIELD_COMPLETED"
  | "LOGISTICS_RUN_DISPATCHED"
  | "LOGISTICS_DELIVERY_CONFIRMED"
  | "MANAGEMENT_CONSIGNMENT_DISPATCHED"
  | "MANAGEMENT_SOR_RETURN_RECORDED"
  | "MANAGEMENT_PAYMENT_SETTLED";

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
  private auditLog: DomainEvent[] = [];

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
