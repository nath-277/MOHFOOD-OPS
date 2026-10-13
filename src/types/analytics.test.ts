// src/types/analytics.test.ts
import { describe, it, expect } from "bun:test";
import type {
  StoreAnalyticsData,
  ProductionAnalyticsData,
  FinancialAnalyticsData,
  ExecutiveAnalyticsData,
} from "./analytics";

describe("Analytics Types Contract", () => {
  it("should validate StoreAnalyticsData structure", () => {
    const mockStore: StoreAnalyticsData = {
      period: { startDate: "2026-10-01", endDate: "2026-10-07", shiftType: "ALL" },
      kpis: {
        totalMovements: 307,
        inboundCount: 40,
        outboundCount: 265,
        spoilageCount: 2,
        activeSkusCount: 18,
      },
      velocityCurve: [{ date: "2026-10-01", inbound: 10, outbound: 45, scrap: 0 }],
      topMovingMaterials: [{ sku: "RAW-APPLE", name: "Apples", inbound: 1403, outbound: 1100, uom: "pcs" }],
      scrapCauses: [{ reason: "Bad Apples, Returned to Seller", count: 1, quantity: 180, uom: "pcs" }],
      stockoutHazards: [{ sku: "RAW-GRP-01", name: "Grapes", currentDrain: "NET DEFICIT", note: "remaining -2.5 pack" }],
    };
    expect(mockStore.kpis.totalMovements).toBe(307);
  });
});
