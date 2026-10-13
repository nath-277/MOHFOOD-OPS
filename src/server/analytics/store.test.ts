// src/server/analytics/store.test.ts
import { describe, it, expect } from "bun:test";
import {
  getStoreAnalyticsData,
  getProductionAnalyticsData,
  getFinancialAnalyticsData,
  getExecutiveAnalyticsData,
} from "./store";

describe("Analytics Aggregation Engine", () => {
  it("should calculate store analytics with velocity and buffer health", async () => {
    const data = await getStoreAnalyticsData({
      startDate: "2026-10-01",
      endDate: "2026-10-07",
      shiftType: "ALL",
    });

    expect(data.period.startDate).toBe("2026-10-01");
    expect(data.kpis.totalMovements).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.velocityCurve)).toBe(true);
    expect(Array.isArray(data.topMovingMaterials)).toBe(true);
    expect(Array.isArray(data.stockoutHazards)).toBe(true);
  });

  it("should calculate production analytics with yield breakdown and BOM overrides", async () => {
    const data = await getProductionAnalyticsData({
      startDate: "2026-10-01",
      endDate: "2026-10-07",
      shiftType: "ALL",
    });

    expect(data.kpis.dailyTargetCapacity).toBeGreaterThan(0);
    expect(Array.isArray(data.productYields)).toBe(true);
    expect(Array.isArray(data.shiftThroughput)).toBe(true);
    expect(Array.isArray(data.supervisorLeads)).toBe(true);
  });

  it("should safely handle zero-valuation items without NaN", async () => {
    const data = await getFinancialAnalyticsData({
      startDate: "2026-10-01",
      endDate: "2026-10-07",
      shiftType: "ALL",
    });

    expect(isNaN(data.kpis.totalDispenseValuationNgn)).toBe(false);
    expect(isNaN(data.kpis.totalRestockSpendNgn)).toBe(false);
    expect(Array.isArray(data.valuationBlindspots)).toBe(true);
  });

  it("should generate consolidated executive scorecard", async () => {
    const data = await getExecutiveAnalyticsData({
      startDate: "2026-10-01",
      endDate: "2026-10-07",
      shiftType: "ALL",
    });

    expect(data.kpis.plantEfficiencyScore).toBeGreaterThanOrEqual(0);
    expect(data.kpis.plantEfficiencyScore).toBeLessThanOrEqual(100);
  });
});
