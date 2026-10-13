import { getStockTransactions, getInventoryItems, InventoryItem, StockTransaction } from "../inventory/store";
import { getProductionSettings } from "../production/store";
import { getManagementOverview, getRetailStockists } from "../management/store";
import {
  AnalyticsPeriod,
  StoreAnalyticsData,
  ProductionAnalyticsData,
  FinancialAnalyticsData,
  ExecutiveAnalyticsData,
  VelocityPoint,
  MaterialFlowItem,
  ScrapCauseItem,
  StockoutHazardItem,
  RecipeYieldItem,
  ShiftThroughputPoint,
  SupervisorYieldLead,
  RecipeVarianceItem,
  DailyValuationPoint,
  CategorySpendItem,
  SoRSummaryItem,
  ValuationBlindspotItem,
} from "@/types/analytics";

interface ProcessedMovement {
  txn: StockTransaction;
  matchedItem: InventoryItem | null;
  dateStr: string;
  qty: number;
  direction: "IN (+)" | "OUT (-)" | "ADJUST (+/-)";
  isScrap: boolean;
  unitCost: number;
  valuationImpact: number;
}

async function getProcessedMovements(period: AnalyticsPeriod): Promise<{
  processed: ProcessedMovement[];
  items: InventoryItem[];
}> {
  const allTxns = await getStockTransactions({ limit: 10000 });
  const allItems = await getInventoryItems();

  const itemMapById = new Map<string, InventoryItem>();
  const itemMapByCode = new Map<string, InventoryItem>();
  const itemMapByName = new Map<string, InventoryItem>();

  for (const item of allItems) {
    if (item.id) itemMapById.set(item.id, item);
    if (item.code) itemMapByCode.set(item.code.toUpperCase(), item);
    if (item.name) itemMapByName.set(item.name.toLowerCase().trim(), item);
  }

  const startDate = period.startDate || "1970-01-01";
  const endDate = period.endDate || "2099-12-31";
  const shiftType = period.shiftType || "ALL";

  const filtered = allTxns.filter((t) => {
    const txnDate = (t.createdAt || "").slice(0, 10);
    if (!txnDate) return false;
    if (txnDate < startDate || txnDate > endDate) return false;
    if (shiftType === "ALL") return true;
    return t.shiftType === shiftType;
  });

  const processed: ProcessedMovement[] = filtered.map((t) => {
    const matched =
      (t.itemId && itemMapById.get(t.itemId)) ||
      (t.itemCode && itemMapByCode.get(t.itemCode.toUpperCase())) ||
      (t.itemId && itemMapByCode.get(t.itemId.toUpperCase())) ||
      (t.itemName && itemMapByName.get(t.itemName.toLowerCase().trim())) ||
      null;

    const dateStr = (t.createdAt || "").slice(0, 10);
    const rawQty = Math.abs(Number(t.quantity) || 0);
    const unitCost = Number(matched?.costPerUnit || 0);

    let direction: "IN (+)" | "OUT (-)" | "ADJUST (+/-)" = "OUT (-)";
    if (t.transactionType === "INBOUND_PURCHASE" || t.transactionType === "RETURN_EXCESS_RESTOCK") {
      direction = "IN (+)";
    } else if (t.transactionType === "RECONCILIATION_ADJUST") {
      direction = "ADJUST (+/-)";
    }

    const isScrap =
      t.transactionType === "DISPOSAL_EXPIRED_SPOILT" || t.transactionType === "RETURN_FAULT_SCRAP";

    const sign = direction === "IN (+)" ? 1 : -1;
    const valuationImpact = Number((sign * rawQty * unitCost).toFixed(2));

    return {
      txn: t,
      matchedItem: matched,
      dateStr,
      qty: rawQty,
      direction,
      isScrap,
      unitCost,
      valuationImpact,
    };
  });

  return { processed, items: allItems };
}

export async function getStoreAnalyticsData(period: AnalyticsPeriod): Promise<StoreAnalyticsData> {
  const { processed } = await getProcessedMovements(period);

  const inboundMovements = processed.filter((p) => p.direction === "IN (+)");
  const outboundMovements = processed.filter((p) => p.direction === "OUT (-)" && !p.isScrap);
  const scrapMovements = processed.filter((p) => p.isScrap);

  const skusSet = new Set<string>();
  processed.forEach((p) => {
    const sku = p.matchedItem?.code || p.txn.itemCode || p.txn.itemId;
    if (sku) skusSet.add(sku);
  });

  // Daily Velocity Curve
  const velocityMap = new Map<string, { inbound: number; outbound: number; scrap: number }>();
  for (const p of processed) {
    if (!p.dateStr) continue;
    const cur = velocityMap.get(p.dateStr) || { inbound: 0, outbound: 0, scrap: 0 };
    if (p.isScrap) {
      cur.scrap += 1;
    } else if (p.direction === "IN (+)") {
      cur.inbound += 1;
    } else {
      cur.outbound += 1;
    }
    velocityMap.set(p.dateStr, cur);
  }

  const velocityCurve: VelocityPoint[] = Array.from(velocityMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      inbound: counts.inbound,
      outbound: counts.outbound,
      scrap: counts.scrap,
    }));

  // Material Flow / Top Moving Materials
  const flowMap = new Map<string, { sku: string; name: string; inbound: number; outbound: number; uom: string }>();
  for (const p of processed) {
    const sku = p.matchedItem?.code || p.txn.itemCode || p.txn.itemId || "UNKNOWN";
    const name = p.matchedItem?.name || p.txn.itemName || "Unknown Item";
    const uom = p.txn.unit || p.matchedItem?.uom || "units";
    const cur = flowMap.get(sku) || { sku, name, inbound: 0, outbound: 0, uom };
    if (p.direction === "IN (+)") {
      cur.inbound += p.qty;
    } else if (p.direction === "OUT (-)") {
      cur.outbound += p.qty;
    }
    flowMap.set(sku, cur);
  }

  const topMovingMaterials: MaterialFlowItem[] = Array.from(flowMap.values())
    .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound))
    .slice(0, 10);

  // Scrap Causes
  const scrapMap = new Map<string, { count: number; quantity: number; uom: string }>();
  for (const s of scrapMovements) {
    const reason = s.txn.notes ? s.txn.notes.replace(/^\[Reason:\s*([^\]]+)\].*$/i, "$1").trim() : "Scrap / Disposal";
    const uom = s.txn.unit || s.matchedItem?.uom || "units";
    const cur = scrapMap.get(reason) || { count: 0, quantity: 0, uom };
    cur.count += 1;
    cur.quantity += s.qty;
    scrapMap.set(reason, cur);
  }

  const scrapCauses: ScrapCauseItem[] = Array.from(scrapMap.entries()).map(([reason, val]) => ({
    reason,
    count: val.count,
    quantity: val.quantity,
    uom: val.uom,
  }));

  // Stockout Hazards
  const stockoutHazards: StockoutHazardItem[] = [];
  for (const item of flowMap.values()) {
    const net = item.inbound - item.outbound;
    let hazard: "CRITICAL DRAIN" | "NET DEFICIT" | "BALANCED BUFFER" | "HEALTHY SURPLUS" | null = null;
    let note = "";

    if (item.inbound === 0 && item.outbound >= 100) {
      hazard = "CRITICAL DRAIN";
      note = `Heavy dispenses (${item.outbound} ${item.uom}) with 0 logged restocks`;
    } else if (net < 0) {
      hazard = "NET DEFICIT";
      note = `Store buffer drained by ${Math.abs(net).toFixed(1)} ${item.uom}`;
    }

    if (hazard) {
      stockoutHazards.push({
        sku: item.sku,
        name: item.name,
        currentDrain: hazard,
        note,
      });
    }
  }

  // Also check for physical confirmation negative notes
  for (const p of processed) {
    if (p.txn.notes && (/remaining\s*-\d+/i.test(p.txn.notes) || /negative/i.test(p.txn.notes))) {
      const sku = p.matchedItem?.code || p.txn.itemCode || p.txn.itemId || "UNKNOWN";
      const name = p.matchedItem?.name || p.txn.itemName || "Unknown Item";
      if (!stockoutHazards.some((h) => h.sku === sku)) {
        stockoutHazards.unshift({
          sku,
          name,
          currentDrain: "NET DEFICIT",
          note: p.txn.notes,
        });
      }
    }
  }

  return {
    period,
    kpis: {
      totalMovements: processed.length,
      inboundCount: inboundMovements.length,
      outboundCount: outboundMovements.length,
      spoilageCount: scrapMovements.length,
      activeSkusCount: skusSet.size,
    },
    velocityCurve,
    topMovingMaterials,
    scrapCauses,
    stockoutHazards: stockoutHazards.slice(0, 15),
  };
}

export async function getProductionAnalyticsData(period: AnalyticsPeriod): Promise<ProductionAnalyticsData> {
  const { processed } = await getProcessedMovements(period);
  const settings = await getProductionSettings();
  const dailyTarget = settings.dailyTargetCapacity || 400;

  const recipeMap = new Map<
    string,
    { batches: number; totalUnits: number; packSize: string }
  >();
  const seenBatches = new Set<string>();

  const shiftThroughputMap = new Map<string, { morning: number; night: number }>();
  const supervisorMap = new Map<string, { batches: number; units: number }>();
  const variances: RecipeVarianceItem[] = [];

  let morningUnits = 0;
  let nightUnits = 0;
  let totalBatchesCount = 0;
  let modifiedBatchesCount = 0;

  for (const p of processed) {
    const ref = p.txn.referenceId || "";
    const notes = p.txn.notes || "";
    const isMorning = p.txn.shiftType === "MORNING_SHIFT";

    // BOM Override Tracking
    if (p.txn.transactionType === "DISPENSE_PRODUCTION") {
      totalBatchesCount += 1;
      if (notes.includes("Modified")) {
        modifiedBatchesCount += 1;
        if (!variances.some((v) => v.referenceId === ref)) {
          variances.push({
            referenceId: ref || "N/A",
            date: p.dateStr,
            shift: isMorning ? "Morning Shift" : "Night Shift",
            performedBy: p.txn.performedByName || "Floor Staff",
            notes,
          });
        }
      }
    }

    // Recipe Batch Count & Units Output
    if (ref.startsWith("BATCH-") && !seenBatches.has(ref)) {
      seenBatches.add(ref);
      const match = notes.match(/Dispensed for (\d+)x (.+?)(?:\.|$)/i);
      if (match) {
        const qty = parseInt(match[1], 10) || 0;
        const name = match[2].trim();

        let packSize = "Packaged Units";
        if (/parfait/i.test(name)) packSize = "500g Cup";
        else if (/greek/i.test(name) && /vanilla/i.test(name)) packSize = "350ml Bottle";
        else if (/greek/i.test(name)) packSize = "500ml Tub";
        else if (/milk/i.test(name)) packSize = "500g Cup";

        const rec = recipeMap.get(name) || { batches: 0, totalUnits: 0, packSize };
        rec.batches += 1;
        rec.totalUnits += qty;
        recipeMap.set(name, rec);

        // Throughput by Shift
        if (isMorning) {
          morningUnits += qty;
        } else {
          nightUnits += qty;
        }

        const dateKey = p.dateStr;
        const curShift = shiftThroughputMap.get(dateKey) || { morning: 0, night: 0 };
        if (isMorning) curShift.morning += qty;
        else curShift.night += qty;
        shiftThroughputMap.set(dateKey, curShift);

        // Supervisor attribution
        const recipient = p.txn.recipient || "";
        let lead = "Floor Lead";
        if (/ada/i.test(recipient)) lead = "Aunty Ada";
        else if (/aishah/i.test(recipient)) lead = "Aishah Anuoluwapo";
        else if (recipient && recipient !== "-") lead = recipient;

        const sup = supervisorMap.get(lead) || { batches: 0, units: 0 };
        sup.batches += 1;
        sup.units += qty;
        supervisorMap.set(lead, sup);
      }
    }
  }

  const totalConsumerUnits = Array.from(recipeMap.values()).reduce((acc, r) => acc + r.totalUnits, 0);

  // Compute Days for target capacity
  const uniqueDatesCount = Math.max(1, shiftThroughputMap.size);
  const expectedCapacity = uniqueDatesCount * dailyTarget;
  const targetAttainmentPct = expectedCapacity > 0 ? Math.round((totalConsumerUnits / expectedCapacity) * 100) : 0;
  const bomOverrideRatePct = totalBatchesCount > 0 ? Number(((modifiedBatchesCount / totalBatchesCount) * 100).toFixed(1)) : 0;

  const productYields: RecipeYieldItem[] = Array.from(recipeMap.entries())
    .map(([recipeName, val]) => ({
      recipeName,
      batches: val.batches,
      totalUnits: val.totalUnits,
      packSize: val.packSize,
      avgUnitsPerBatch: val.batches > 0 ? Number((val.totalUnits / val.batches).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);

  const shiftThroughput: ShiftThroughputPoint[] = Array.from(shiftThroughputMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      morningUnits: val.morning,
      nightUnits: val.night,
    }));

  const supervisorLeads: SupervisorYieldLead[] = Array.from(supervisorMap.entries())
    .map(([name, val]) => ({
      name,
      batches: val.batches,
      totalUnits: val.units,
      avgUnitsPerBatch: val.batches > 0 ? Number((val.units / val.batches).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);

  return {
    period,
    kpis: {
      totalConsumerUnits,
      dailyTargetCapacity: dailyTarget,
      targetAttainmentPct,
      morningShiftUnits: morningUnits,
      nightShiftUnits: nightUnits,
      bomOverrideRatePct,
    },
    productYields,
    shiftThroughput,
    supervisorLeads,
    recipeVariances: variances.slice(0, 20),
  };
}

export async function getFinancialAnalyticsData(period: AnalyticsPeriod): Promise<FinancialAnalyticsData> {
  const { processed, items } = await getProcessedMovements(period);
  const managementOverview = await getManagementOverview();

  let totalDispenseValuationNgn = 0;
  let totalRestockSpendNgn = 0;
  let totalScrapLossNgn = 0;

  const valuationMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const p of processed) {
    const val = Math.abs(p.valuationImpact);
    const cat = p.matchedItem?.category || "GENERAL";

    if (p.isScrap) {
      totalScrapLossNgn += val;
    } else if (p.direction === "OUT (-)") {
      totalDispenseValuationNgn += val;
      const curCat = categoryMap.get(cat) || 0;
      categoryMap.set(cat, curCat + val);

      if (p.dateStr) {
        const curDate = valuationMap.get(p.dateStr) || 0;
        valuationMap.set(p.dateStr, curDate + val);
      }
    } else if (p.direction === "IN (+)") {
      totalRestockSpendNgn += val;
    }
  }

  const valuationDrawCurve: DailyValuationPoint[] = Array.from(valuationMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      valuationImpact: Number(val.toFixed(2)),
    }));

  const totalCatValuation = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0) || 1;
  const categorySpendBreakdown: CategorySpendItem[] = Array.from(categoryMap.entries()).map(
    ([category, valuation]) => ({
      category:
        category === "PERISHABLE_MEASURED"
          ? "Perishable (Measured)"
          : category === "PERISHABLE_NUMBERED"
          ? "Perishable (Numbered)"
          : category === "PACKAGING_NON_PERISHABLE"
          ? "Packaging"
          : category,
      valuation: Number(valuation.toFixed(2)),
      percentage: Number(((valuation / totalCatValuation) * 100).toFixed(1)),
    })
  );

  // Supermarket SoR Progression
  const stockists = await getRetailStockists();
  const sorProgression: SoRSummaryItem[] = stockists.map((s) => ({
    stockistName: s.name,
    invoicedAmount: Number(s.totalInvoiced || 0),
    paidAmount: Number(s.totalPaid || 0),
    outstandingBalance: Number(s.outstandingDebt || 0),
  }));

  const totalSoRInvoicedNgn = sorProgression.reduce((sum, s) => sum + s.invoicedAmount, 0);
  const totalSoRCollectedNgn = sorProgression.reduce((sum, s) => sum + s.paidAmount, 0);

  // Valuation Blindspots: items used or stocked with 0.00 unit cost
  const unpricedSkuCounts = new Map<string, { name: string; count: number; category: string }>();
  for (const p of processed) {
    if (p.unitCost === 0) {
      const sku = p.matchedItem?.code || p.txn.itemCode || p.txn.itemId || "UNKNOWN";
      const name = p.matchedItem?.name || p.txn.itemName || "Unknown Item";
      const cat = p.matchedItem?.category || "General";
      const cur = unpricedSkuCounts.get(sku) || { name, count: 0, category: cat };
      cur.count += 1;
      unpricedSkuCounts.set(sku, cur);
    }
  }

  const valuationBlindspots: ValuationBlindspotItem[] = Array.from(unpricedSkuCounts.entries()).map(
    ([sku, val]) => ({
      sku,
      name: val.name,
      movementCount: val.count,
      category: val.category,
    })
  );

  return {
    period,
    kpis: {
      totalDispenseValuationNgn: Number(totalDispenseValuationNgn.toFixed(2)),
      totalRestockSpendNgn: Number(totalRestockSpendNgn.toFixed(2)),
      totalScrapLossNgn: Number(totalScrapLossNgn.toFixed(2)),
      totalSoRInvoicedNgn: Number(totalSoRInvoicedNgn.toFixed(2)),
      totalSoRCollectedNgn: Number(totalSoRCollectedNgn.toFixed(2)),
    },
    valuationDrawCurve,
    categorySpendBreakdown,
    sorProgression,
    valuationBlindspots: valuationBlindspots.slice(0, 15),
  };
}

export async function getExecutiveAnalyticsData(period: AnalyticsPeriod): Promise<ExecutiveAnalyticsData> {
  const [store, prod, fin] = await Promise.all([
    getStoreAnalyticsData(period),
    getProductionAnalyticsData(period),
    getFinancialAnalyticsData(period),
  ]);

  // Composite Plant Efficiency Score (0-100)
  // Weighted: 40% Target Capacity Attainment, 30% BOM Recipe Adherence, 30% Spoilage Minimization
  const attainmentScore = Math.min(100, prod.kpis.targetAttainmentPct);
  const adherenceScore = Math.max(0, 100 - prod.kpis.bomOverrideRatePct);
  const scrapPenalty = Math.min(30, (store.kpis.spoilageCount / (store.kpis.totalMovements || 1)) * 300);
  const efficiencyScore = Math.max(
    0,
    Math.min(100, Math.round(attainmentScore * 0.4 + adherenceScore * 0.3 + (30 - scrapPenalty)))
  );

  return {
    period,
    kpis: {
      plantEfficiencyScore: efficiencyScore,
      totalUnitsPackaged: prod.kpis.totalConsumerUnits,
      targetAttainmentPct: prod.kpis.targetAttainmentPct,
      netInventoryVolume: store.kpis.inboundCount - store.kpis.outboundCount,
      totalOperationalCostNgn: fin.kpis.totalDispenseValuationNgn + fin.kpis.totalScrapLossNgn,
      bomOverrideRatePct: prod.kpis.bomOverrideRatePct,
    },
    storeSummary: store.kpis,
    productionSummary: prod.kpis,
    financialSummary: fin.kpis,
  };
}
