# Role-Gated Departmental Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized, interactive analytics hub at `/analytics` providing live charts, KPI scorecards, and department-specific operational views (Store, Production, Finance, Executive), strictly role-gated.

**Architecture:** A server-side aggregation engine computes KPIs and chart series from `stockTransactions`, `inventoryItems`, and management stores with role enforcement in Hono API routes and Next.js proxy. The frontend renders SVG-based Recharts and native Tailwind progress dials within tabbed views synced to URL hash (`#store`, `#production`, `#finance`, `#executive`).

**Tech Stack:** Next.js 16 (App Router), React 19, Recharts 3.x, Tailwind CSS v4, Hono, SWR, Bun.

**Spec:** [docs/superpowers/specs/2026-10-13-analytics-dashboard-design.md](file:///home/th3mw/DEV/Moh%20Food/docs/superpowers/specs/2026-10-13-analytics-dashboard-design.md)

---

## Global Constraints

- Never commit secrets, credentials, or `.env` files.
- Role matrix strictly enforced:
  - `STORE_MANAGER` cannot access Financial Analytics.
  - `PRODUCTION_SUPERVISOR` cannot access Financial Analytics.
  - `ACCOUNTANT` accesses Finance, Store, and Production.
  - `EXECUTIVE` and `SUPER_ADMIN` access all tabs.
- Recharts must use `'use client'` client-boundary wrappers to avoid SSR hydration mismatch in Next.js 16 App Router.
- Transactions remain editable whenever (no retired 2-hour grace period restrictions).
- TypeScript: `bun tsc --noEmit` must pass with 0 errors after every task.
- Tests: `bun test` must pass 100% after every task.

---

## Review Focus

1. **Unpriced items in financial aggregation**: Items with `0.00 NGN` or undefined `costPerUnit` must not throw `NaN` or divide-by-zero, but safely render `0.00` and get flagged in the Valuation Blindspot register.
2. **Empty date ranges / zero transactions**: Date intervals with zero logged movements must return clean empty data structures (0 counts, empty series arrays) without crashing chart containers.
3. **Role tab tampering**: Manually setting URL hash `#finance` as a `STORE_MANAGER` or `PRODUCTION_SUPERVISOR` must gracefully redirect to their authorized tab and reject the underlying API fetch with `403 Forbidden`.
4. **Negative confirmed counts**: Transactions with negative remaining confirmation notes (e.g., `-2.5 pack`) must be parsed and tagged in the stockout hazard register without throwing regex parsing errors.
5. **Mobile/tablet viewport scaling**: Chart components must use responsive containers (`w-full` with fixed aspect ratios or height classes) so they do not clip or cause horizontal overflow on mobile screens.

---

## Task Structure

### Task 1: Package Dependencies & Analytics Core Types

**Files:**
- Modify: `package.json`
- Create: `src/types/analytics.ts`
- Test: `src/types/analytics.test.ts`

**Interfaces:**
- Produces: `StoreAnalyticsData`, `ProductionAnalyticsData`, `FinancialAnalyticsData`, `ExecutiveAnalyticsData`, `AnalyticsQueryParams`

- [ ] **Step 1: Write the failing type contract test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/types/analytics.test.ts`  
Expected: FAIL (Cannot find module `./analytics`)

- [ ] **Step 3: Install `recharts` and create `src/types/analytics.ts`**

Run: `bun add recharts`

Create `src/types/analytics.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/types/analytics.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/types/analytics.ts src/types/analytics.test.ts
git commit -m "feat(analytics): add recharts dependency and core analytics type contracts"
```

---

### Task 2: Analytics Aggregation Engine

**Files:**
- Create: `src/server/analytics/store.ts`
- Create: `src/server/analytics/store.test.ts`

**Interfaces:**
- Consumes: `getStockTransactions`, `getInventoryItems`, `getManagementOverview`
- Produces: `getStoreAnalyticsData(params)`, `getProductionAnalyticsData(params)`, `getFinancialAnalyticsData(params)`, `getExecutiveAnalyticsData(params)`

- [ ] **Step 1: Write the failing engine tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/analytics/store.test.ts`  
Expected: FAIL (Cannot find module `./store`)

- [ ] **Step 3: Implement `src/server/analytics/store.ts`**

Implement aggregation routines:
- Filter `allTxns` using `startDate`, `endDate`, and `shiftType`.
- Map inventory items by code, id, and name.
- Parse finished goods units using `regex` `Dispensed for (\d+)x (.+?)(?:\.|$)`.
- Extract scrap causes from `DISPOSAL_EXPIRED_SPOILT` / `RETURN_FAULT_SCRAP`.
- Extract recipe override notes matching `/Modified/i`.
- Pull SoR invoices from `getManagementOverview()` for financial overview.
- Compute composite plant efficiency score:
  `Math.min(100, Math.max(0, Math.round(targetAttainment * 0.4 + (100 - bomOverrideRate) * 0.3 + (100 - scrapRate) * 0.3)))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/analytics/store.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/analytics/store.ts src/server/analytics/store.test.ts
git commit -m "feat(analytics): implement server analytics aggregation engine for store, production, finance and executive metrics"
```

---

### Task 3: Hono Analytics API Endpoints & Role-Based Security

**Files:**
- Create: `src/server/hono/routes/analytics.ts`
- Modify: `src/server/hono/app.ts`
- Create: `src/server/analytics/rbac.test.ts`

**Interfaces:**
- Consumes: `getStoreAnalyticsData`, `getProductionAnalyticsData`, `getFinancialAnalyticsData`, `getExecutiveAnalyticsData`, `getAuthUser`
- Produces: `GET /api/analytics/store`, `GET /api/analytics/production`, `GET /api/analytics/finance`, `GET /api/analytics/executive`

- [ ] **Step 1: Write the failing RBAC test**

```ts
// src/server/analytics/rbac.test.ts
import { describe, it, expect } from "bun:test";
import { app } from "../hono/app";

describe("Analytics API RBAC Protection", () => {
  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const res = await app.request("/api/analytics/store");
    expect(res.status).toBe(401);
  });

  it("should permit STORE_MANAGER to access store analytics but forbid financial analytics with 403", async () => {
    // Generate store manager token
    const { signSession } = await import("../auth/session");
    const storeToken = await signSession({
      userId: "usr_store_test",
      staffId: "MOH-STR-01",
      email: "store@mohfood.com",
      role: "STORE_MANAGER",
      departmentCode: "STORE",
      fullName: "Store Manager User",
    });

    const storeRes = await app.request("/api/analytics/store", {
      headers: { Cookie: `moh_session=${storeToken}` },
    });
    expect(storeRes.status).toBe(200);

    const financeRes = await app.request("/api/analytics/finance", {
      headers: { Cookie: `moh_session=${storeToken}` },
    });
    expect(financeRes.status).toBe(403);
  });

  it("should permit ACCOUNTANT to access financial, store and production analytics", async () => {
    const { signSession } = await import("../auth/session");
    const accountantToken = await signSession({
      userId: "usr_acc_test",
      staffId: "MOH-ACC-01",
      email: "accountant@mohfood.com",
      role: "ACCOUNTANT",
      departmentCode: "FINANCE",
      fullName: "Lead Accountant",
    });

    const financeRes = await app.request("/api/analytics/finance", {
      headers: { Cookie: `moh_session=${accountantToken}` },
    });
    expect(financeRes.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/server/analytics/rbac.test.ts`  
Expected: FAIL (404 Not Found for `/api/analytics/*`)

- [ ] **Step 3: Implement `src/server/hono/routes/analytics.ts` and mount in `app.ts`**

In `src/server/hono/routes/analytics.ts`:
- Define `analyticsRouter = new Hono()`.
- Add auth middleware verifying session:
  - If no session, return `401 Unauthorized`.
- Guard each department route:
  - `/store`: `["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT", "STORE_MANAGER"]`
  - `/production`: `["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT", "PRODUCTION_SUPERVISOR", "STORE_MANAGER"]`
  - `/finance`: `["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT"]`
  - `/executive`: `["SUPER_ADMIN", "EXECUTIVE"]`
- Non-matching roles return `403 Forbidden` with `{ error: "Insufficient permissions to view this departmental analytics module." }`.
- Mount in `src/server/hono/app.ts`: `app.route("/api/analytics", analyticsRouter)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/analytics/rbac.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/hono/routes/analytics.ts src/server/hono/app.ts src/server/analytics/rbac.test.ts
git commit -m "feat(analytics): add Hono analytics API routes with strict role-based access control"
```

---

### Task 4: Proxy & Navigation Integration

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Test: `src/server/production/production_and_roles.test.ts`

**Interfaces:**
- Consumes: Next.js middleware routing in `src/proxy.ts`, `useAuth` in `Sidebar.tsx`
- Produces: Route protection for `/analytics`, new Sidebar link with role visibility

- [ ] **Step 1: Write test verifying proxy route protection for `/analytics`**

Add test to `src/server/production/production_and_roles.test.ts`:
```ts
it("should allow authorized roles to access /analytics and redirect unauthorized roles", async () => {
  const { proxy } = await import("../../proxy");
  const { signSession } = await import("../auth/session");

  const supervisorToken = await signSession({
    userId: "usr_sup_01",
    staffId: "MOH-SUP-01",
    email: "supervisor@mohfood.com",
    role: "PRODUCTION_SUPERVISOR",
    departmentCode: "PRODUCTION",
    fullName: "Floor Supervisor",
  });

  const req = new Request("http://localhost:3000/analytics", {
    headers: { Cookie: `moh_session=${supervisorToken}` },
  });
  const res = await proxy(req as any);
  // Allowed roles should not be redirected away to login or /inventory
  expect(res.headers.get("location")).toBeNull();
});
```

- [ ] **Step 2: Update `src/proxy.ts`**

Add `/analytics` routing rule in `src/proxy.ts`:
```ts
if (pathname.startsWith("/analytics")) {
  const allowed = [
    "SUPER_ADMIN",
    "EXECUTIVE",
    "STORE_MANAGER",
    "PRODUCTION_SUPERVISOR",
    "ACCOUNTANT",
  ];
  if (!allowed.includes(session.role)) {
    const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
    const safeTarget = fallback.startsWith("/analytics") ? "/inventory" : fallback;
    return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
  }
}
```

- [ ] **Step 3: Update `src/components/layout/Sidebar.tsx`**

Add `/analytics` navigation item under Operations group for authorized roles:
```tsx
{(isExecutive || isSuperAdmin || isAccountant || isStoreStaff || role === "PRODUCTION_SUPERVISOR") && (
  <Link
    href="/analytics"
    onClick={onCloseMobile}
    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
      pathname === "/analytics"
        ? "bg-[#CF0458] text-white shadow-xs"
        : "text-slate-700 hover:bg-slate-100"
    }`}
  >
    <div className="flex items-center gap-2.5">
      <BarChart3 className="w-4 h-4" />
      <span>Analytics & Intelligence</span>
    </div>
    <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/analytics" ? "text-white/70" : "text-slate-300"}`} />
  </Link>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/server/production/production_and_roles.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/components/layout/Sidebar.tsx src/server/production/production_and_roles.test.ts
git commit -m "feat(analytics): add proxy protection and sidebar link for /analytics"
```

---

### Task 5: Recharts Visual Components & Native SVG Dials

**Files:**
- Create: `src/components/analytics/charts/VelocityAreaChart.tsx`
- Create: `src/components/analytics/charts/YieldBarChart.tsx`
- Create: `src/components/analytics/charts/CategoryDonutChart.tsx`
- Create: `src/components/analytics/charts/KpiDial.tsx`
- Create: `src/components/analytics/charts/KpiCard.tsx`

**Interfaces:**
- Produces: Recharts client-wrapped charts with custom tooltips and responsive styling.

- [ ] **Step 1: Create `KpiDial.tsx` (Native SVG circular progress meter)**

```tsx
"use client";
import React from "react";

interface KpiDialProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
  color?: string;
}

export function KpiDial({
  value,
  size = 110,
  strokeWidth = 8,
  label,
  subLabel,
  color = "#CF0458",
}: KpiDialProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-black text-slate-900">{clamped}%</span>
          {subLabel && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{subLabel}</span>}
        </div>
      </div>
      {label && <span className="mt-2 text-xs font-bold text-slate-700 text-center">{label}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `KpiCard.tsx` (Metric card with trend badges)**

```tsx
"use client";
import React from "react";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: { text: string; variant: "success" | "warning" | "danger" | "neutral" };
  icon?: LucideIcon;
  iconBg?: string;
}

export function KpiCard({ title, value, subtitle, badge, icon: Icon, iconBg }: KpiCardProps) {
  const badgeClasses = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  }[badge?.variant || "neutral"];

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg || "bg-slate-100 text-slate-600"}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        {badge && (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badgeClasses}`}>
            {badge.text}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-[11px] text-slate-400 font-medium">{subtitle}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create `VelocityAreaChart.tsx` (Recharts Area Chart)**

```tsx
"use client";
import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { VelocityPoint } from "@/types/analytics";

interface VelocityAreaChartProps {
  data: VelocityPoint[];
}

export function VelocityAreaChart({ data }: VelocityAreaChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-xs text-slate-400">No movement velocity data for this period.</div>;
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#CF0458" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#CF0458" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "0.75rem", border: "1px solid #E2E8F0", fontSize: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Area type="monotone" dataKey="inbound" name="Inbound Restocks (IN)" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorInbound)" />
          <Area type="monotone" dataKey="outbound" name="Production Dispatches (OUT)" stroke="#CF0458" strokeWidth={2} fillOpacity={1} fill="url(#colorOutbound)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create `YieldBarChart.tsx` and `CategoryDonutChart.tsx`**

Implement `YieldBarChart.tsx` using `<BarChart>` for recipe yields and `CategoryDonutChart.tsx` using `<PieChart>` and `<Pie innerRadius={60} outerRadius={80}>`.

- [ ] **Step 5: Verify build & commit**

Run: `bun tsc --noEmit`  
Expected: 0 errors  
Commit:
```bash
git add src/components/analytics/charts/
git commit -m "feat(analytics): create responsive Recharts and native SVG metric components"
```

---

### Task 6: Departmental Views (Store, Production, Finance, Executive)

**Files:**
- Create: `src/components/analytics/AnalyticsDateFilter.tsx`
- Create: `src/components/analytics/StoreAnalyticsView.tsx`
- Create: `src/components/analytics/ProductionAnalyticsView.tsx`
- Create: `src/components/analytics/FinancialAnalyticsView.tsx`
- Create: `src/components/analytics/ExecutiveAnalyticsView.tsx`

**Interfaces:**
- Consumes: Data contracts from `src/types/analytics.ts`, chart components from `Task 5`
- Produces: Self-contained departmental analytics views with KPI scorecards, interactive charts, and itemized registers.

- [ ] **Step 1: Create `AnalyticsDateFilter.tsx`**

Contains quick presets (`Today`, `7 Days`, `This Month`, `30 Days`), date inputs, and shift selector (`All`, `Morning`, `Night`).

- [ ] **Step 2: Create `StoreAnalyticsView.tsx`**

Renders Store KPIs, `VelocityAreaChart`, Top materials horizontal bar chart, Scrap cause donut chart, and Stockout hazards list.

- [ ] **Step 3: Create `ProductionAnalyticsView.tsx`**

Renders Production KPIs (Target capacity attainment dial, units packaged, BOM override rate), `YieldBarChart` by product line, Shift throughput split, Supervisor leaderboard, and recipe deviation register.

- [ ] **Step 4: Create `FinancialAnalyticsView.tsx`**

Renders COGS impact, GRN spend, scrap loss, SoR invoice collection progression, category expenditure donut, and Valuation Blindspot alert table.

- [ ] **Step 5: Create `ExecutiveAnalyticsView.tsx`**

Renders Plant Efficiency Dial, high-level radar, cross-department variance summary, and consolidated plant scorecard.

- [ ] **Step 6: Verify build & commit**

Run: `bun tsc --noEmit`  
Expected: 0 errors  
Commit:
```bash
git add src/components/analytics/
git commit -m "feat(analytics): create departmental views for store, production, finance and executive tabs"
```

---

### Task 7: Master Analytics Page (`/analytics`) & Full Verification

**Files:**
- Create: `src/app/(dashboard)/analytics/page.tsx`
- Modify: `src/lib/swr.ts` (add `useAnalytics` hook)
- Test: Full integration test suite

- [ ] **Step 1: Add SWR hooks for analytics**

In `src/lib/swr.ts`:
Add `useStoreAnalytics(params)`, `useProductionAnalytics(params)`, `useFinancialAnalytics(params)`, `useExecutiveAnalytics(params)` with automatic cache revalidation.

- [ ] **Step 2: Create `src/app/(dashboard)/analytics/page.tsx`**

- Fetch active user via `useAuth()`.
- Compute accessible tabs based on `user.role`.
- Track active tab in state, synced with `window.location.hash`.
- Render top tab switcher with icons (`Sparkles` for Executive, `Boxes` for Store, `Factory` for Production, `Coins` for Finance).
- Render `AnalyticsDateFilter` and the active departmental view.
- Handle unauthorized tab requests gracefully.

- [ ] **Step 3: Run comprehensive verification**

Run: `bun test`  
Expected: All 107+ tests pass.

Run: `bun tsc --noEmit`  
Expected: 0 errors.

Run: `bun run build`  
Expected: Next.js production build compiles cleanly without SSR hydration errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/analytics/page.tsx src/lib/swr.ts
git commit -m "feat(analytics): implement master analytics dashboard with role-gated tabs and URL hash sync"
```
