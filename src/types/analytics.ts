export type ShiftFilter = "ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT";

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
  shiftType: ShiftFilter;
}

export interface VelocityPoint {
  date: string;
  inbound: number;
  outbound: number;
  scrap: number;
}

export interface MaterialFlowItem {
  sku: string;
  name: string;
  inbound: number;
  outbound: number;
  uom: string;
}

export interface ScrapCauseItem {
  reason: string;
  count: number;
  quantity: number;
  uom: string;
}

export interface StockoutHazardItem {
  sku: string;
  name: string;
  currentDrain: "CRITICAL DRAIN" | "NET DEFICIT" | "BALANCED BUFFER" | "HEALTHY SURPLUS";
  note: string;
}

export interface StoreAnalyticsData {
  period: AnalyticsPeriod;
  kpis: {
    totalMovements: number;
    inboundCount: number;
    outboundCount: number;
    spoilageCount: number;
    activeSkusCount: number;
  };
  velocityCurve: VelocityPoint[];
  topMovingMaterials: MaterialFlowItem[];
  scrapCauses: ScrapCauseItem[];
  stockoutHazards: StockoutHazardItem[];
}

export interface RecipeYieldItem {
  recipeName: string;
  batches: number;
  totalUnits: number;
  packSize: string;
  avgUnitsPerBatch: number;
}

export interface ShiftThroughputPoint {
  date: string;
  morningUnits: number;
  nightUnits: number;
}

export interface SupervisorYieldLead {
  name: string;
  batches: number;
  totalUnits: number;
  avgUnitsPerBatch: number;
}

export interface RecipeVarianceItem {
  referenceId: string;
  date: string;
  shift: string;
  performedBy: string;
  notes: string;
}

export interface ProductionAnalyticsData {
  period: AnalyticsPeriod;
  kpis: {
    totalConsumerUnits: number;
    dailyTargetCapacity: number;
    targetAttainmentPct: number;
    morningShiftUnits: number;
    nightShiftUnits: number;
    bomOverrideRatePct: number;
  };
  productYields: RecipeYieldItem[];
  shiftThroughput: ShiftThroughputPoint[];
  supervisorLeads: SupervisorYieldLead[];
  recipeVariances: RecipeVarianceItem[];
}

export interface DailyValuationPoint {
  date: string;
  valuationImpact: number;
}

export interface CategorySpendItem {
  category: string;
  valuation: number;
  percentage: number;
}

export interface SoRSummaryItem {
  stockistName: string;
  invoicedAmount: number;
  paidAmount: number;
  outstandingBalance: number;
}

export interface ValuationBlindspotItem {
  sku: string;
  name: string;
  movementCount: number;
  category: string;
}

export interface FinancialAnalyticsData {
  period: AnalyticsPeriod;
  kpis: {
    totalDispenseValuationNgn: number;
    totalRestockSpendNgn: number;
    totalScrapLossNgn: number;
    totalSoRInvoicedNgn: number;
    totalSoRCollectedNgn: number;
  };
  valuationDrawCurve: DailyValuationPoint[];
  categorySpendBreakdown: CategorySpendItem[];
  sorProgression: SoRSummaryItem[];
  valuationBlindspots: ValuationBlindspotItem[];
}

export interface ExecutiveAnalyticsData {
  period: AnalyticsPeriod;
  kpis: {
    plantEfficiencyScore: number;
    totalUnitsPackaged: number;
    targetAttainmentPct: number;
    netInventoryVolume: number;
    totalOperationalCostNgn: number;
    bomOverrideRatePct: number;
  };
  storeSummary: StoreAnalyticsData["kpis"];
  productionSummary: ProductionAnalyticsData["kpis"];
  financialSummary: FinancialAnalyticsData["kpis"];
}
