# Technical Design: Role-Gated Departmental Analytics Dashboard (`/analytics`)

**Date**: 2026-10-13  
**Status**: Proposed  
**Author**: Antigravity & Engineering Team  

---

## 1. Executive Summary & Purpose

The existing daily shift system relied on static continuous or structured CSV spreadsheet downloads for reviewing operational movements. This approach caused friction for floor supervisors and management:
- Static files cannot be interactively drilled into on mobile and floor tablets.
- Lacks visual graphs for trends, yield ratios, and velocity over time.
- Exposes raw data uniformly without departmental role boundaries (floor supervisors seeing financial valuations or store officers seeing unneeded accounting numbers).

This design introduces a centralized, interactive **Role-Gated Analytics Dashboard** accessible at `/analytics` that provides live, visual intelligence tailored by department (`Store Analytics`, `Production Analytics`, `Financial Analytics`, and `Executive Overview`).

---

## 2. Architecture & Role-Based Access Control (RBAC)

### 2.1 Route & URL Scheme
- **Primary Route**: `/analytics`
- **Sub-View Navigation**: Managed via tab state and URL hash (`#executive`, `#store`, `#production`, `#finance`).
- **Sidebar Integration**: Integrated into `Sidebar.tsx` under a new section with icon `BarChart3` / `Activity`.

### 2.2 Access Control Matrix

| Role | Accessible Tabs | Default Landing Tab | Scope & Constraints |
| :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | All (`Executive`, `Store`, `Production`, `Finance`) | `Executive Overview` | Unrestricted factory-wide intelligence. |
| **`EXECUTIVE`** | All (`Executive`, `Store`, `Production`, `Finance`) | `Executive Overview` | Full strategic, operational, and financial visibility. |
| **`ACCOUNTANT`** | `Finance`, `Store`, `Production` | `Financial Analytics` | Inventory valuations, material COGS, vendor spend, SoR cashflow. |
| **`STORE_MANAGER`** | `Store Analytics` | `Store Analytics` | Stock movements, intake velocity, scrap, buffer runways (no financial costs). |
| **`PRODUCTION_SUPERVISOR`** | `Production Analytics` | `Production Analytics` | Batch yields, shift throughput, BOM overrides (no financial costs). |
| **`STAFF` / `LOGISTICS_OFFICER`** | None | Redirected | Redirected to their primary assigned dashboard (`/inventory`). |

### 2.3 Proxy & Server Guard Enforcement
1. **Proxy (`src/proxy.ts`)**:
   - `/analytics` requires an authenticated session with role in `["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT", "STORE_MANAGER", "PRODUCTION_SUPERVISOR"]`.
   - Unauthorized roles fallback cleanly to `/inventory`.
2. **API Endpoint (`/api/analytics/[department]`)**:
   - Validates session role against requested department on every request.
   - Throws `403 Forbidden` if a `STORE_MANAGER` or `PRODUCTION_SUPERVISOR` attempts to query `/api/analytics/finance`.

---

## 3. Technology Stack & Charting Strategy

### 3.1 Charting Engine
- **Primary Library**: **Recharts (v3.x / v2.15+)**
  - **Compatibility**: Native React 19 peer dependencies (`^19.0.0`), Next.js 16 App Router compatible.
  - **Rendering**: SVG-based; crisp rendering on high-DPI tablets and mobile devices with zero resolution blurring.
  - **Styling**: Wrapped with custom Tailwind CSS tooltips and facility colors (`#CF0458`, `#059669`, `#4F46E5`, `#D97706`).
- **Micro-Visuals**:
  - Native SVG and Tailwind CSS dials/rings for circular progress meters and KPI cards (zero runtime JS overhead).

---

## 4. Departmental Modules & Metrics

### 4.1 Store Analytics (`/analytics#store`)
Target Audience: Store Managers, Accountants, Executives.

1. **KPI Scorecard**:
   - **Total Movement Volume**: Logged IN restocks vs OUT floor dispatches.
   - **Stock Health Runway**: Count of items in `CRITICAL DRAIN`, `NET DEFICIT`, `BALANCED BUFFER`, and `HEALTHY SURPLUS`.
   - **Spoilage & Scrap Rate**: Percentage of items discarded due to defects, returns, or expiry.
   - **Active SKUs Managed**: Count of distinct materials with activity in the selected window.
2. **Visualizations**:
   - **Daily Inbound vs Outbound Velocity Curve** (*Area Chart*): Daily rhythm showing warehouse draw vs intake replenishment.
   - **Top 10 Fast-Moving Materials** (*Horizontal Bar Chart*): Compares received units against dispensed units.
   - **Scrap Cause Classification** (*Donut Chart*): Disposals grouped by cause (expired fruits, torn packaging, vendor returns).
3. **Data Tables & Action Register**:
   - **Stockout Hazard Watchlist**: Items where consumption exceeds intake and buffer is depleted.
   - **Recent Transaction Adjustments**: History of transaction modifications and ad-hoc edits.

### 4.2 Production Analytics (`/analytics#production`)
Target Audience: Production Supervisors, Executives, Store Managers.

1. **KPI Scorecard**:
   - **Finished Goods Output**: Total packaged consumer units (Parfait cups, Greek yoghurt bottles/tubs).
   - **Target Capacity Attainment**: Actual units packaged vs daily plant target (e.g. 400 units/day).
   - **Shift Split Ratio**: Morning shift volume vs Night shift volume.
   - **BOM Override Rate**: Percentage of recipe dispatches modified on the floor.
2. **Visualizations**:
   - **Finished Goods Yield by Product Line** (*Grouped Bar Chart*): Moh Parfait 500g, Sweetened Greek 500ml, Greek Vanilla 350ml, Unsweetened Greek 500ml, Pasteurized Milk prep.
   - **Shift Throughput Rhythm** (*Dual Bar Chart*): Day vs Night shift yield comparison across the selected timeframe.
   - **BOM Recipe Adherence Trend** (*Line Chart*): Standard recipe batches vs modified recipe batches over time.
3. **Data Tables & Registers**:
   - **Supervisor Yield Leaderboard**: Total batches, units produced, and average yield per run by supervisor (Ada vs Aishah).
   - **Recipe Variance Audit Register**: Itemized dispatches where ingredient quantities differed from master BOM.

### 4.3 Financial Analytics (`/analytics#finance`)
Target Audience: Accountants, Executives, Super Admins.

1. **KPI Scorecard**:
   - **Production COGS Valuation (NGN)**: Financial value of materials and packaging consumed on the floor.
   - **Inbound Restock Spend (NGN)**: Total capital expenditure captured via GRN intake.
   - **Scrap & Spoilage Damage (NGN)**: Direct financial loss from damaged apples, torn labels, and discarded items.
   - **Supermarket SoR Consignment Balance**: Total invoiced revenue vs payments collected from retail stockists.
2. **Visualizations**:
   - **Material Valuation Draw** (*Area Chart*): Daily financial value (NGN) of stock consumed by the kitchen.
   - **Expenditure by Material Category** (*Donut Chart*): Packaging vs Perishables vs Dairy Ingredients.
   - **SoR Revenue & Collection Progression** (*Bar Chart*): Supermarket consignment invoiced vs received payments.
3. **Audit Alerts**:
   - **Valuation Blindspots Register**: Materials with ₦0.00 unit cost logged in catalogue to flag missing pricing data for accounting.

### 4.4 Executive Overview (`/analytics#executive`)
Target Audience: Executives, Super Admins.

1. **Plant Health Scorecard**:
   - Composite Operational Score (evaluating target attainment + scrap minimization + recipe adherence).
   - Consolidated 360° summary of factory operations.
2. **Interactive Controls**:
   - Period selector: `Today`, `Last 7 Days`, `This Month`, `Last 30 Days`, or custom date range.
   - Shift filter: `All Shifts`, `Morning Shift`, `Night Shift`.

---

## 5. Backend Data Flow & API Architecture

### 5.1 Route Handlers
New route handler `src/server/hono/routes/analytics.ts` mounted under `/api/analytics`:
- `GET /api/analytics/store`
- `GET /api/analytics/production`
- `GET /api/analytics/finance`
- `GET /api/analytics/executive`

Each endpoint accepts query parameters:
- `startDate` (YYYY-MM-DD, default: 7 days ago)
- `endDate` (YYYY-MM-DD, default: today)
- `shiftType` (`ALL` | `MORNING_SHIFT` | `NIGHT_SHIFT`)

### 5.2 Analytics Aggregation Engine (`src/server/analytics/store.ts`)
Calculates metrics in memory / SQL queries:
- Scans `stockTransactions` for in/out volume, movement types, notes regex, and timestamps.
- Cross-references `inventoryItems` for unit cost, categories, and standard pack sizes.
- Pulls from `retailStockists` and `whatsAppInvoices` for supermarket consignment financial stats.
- Computes aggregations on-demand with SWR caching on the frontend.

---

## 6. Frontend Components Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── analytics/
│           └── page.tsx                    # Top-level page container with tab switching & role checks
├── components/
│   └── analytics/
│       ├── AnalyticsDateFilter.tsx         # Date range & shift selector bar
│       ├── StoreAnalyticsView.tsx          # Store KPIs, velocity charts, scrap breakdown
│       ├── ProductionAnalyticsView.tsx     # Output yield, shift throughput, BOM override trend
│       ├── FinancialAnalyticsView.tsx      # Valuation, spend breakdown, SoR collections
│       ├── ExecutiveAnalyticsView.tsx      # Consolidated scorecard & radar
│       └── charts/
│           ├── VelocityAreaChart.tsx       # Recharts area curve
│           ├── YieldBarChart.tsx           # Recharts grouped bar chart
│           ├── CategoryDonutChart.tsx      # Recharts donut chart
│           └── KpiDial.tsx                 # Native SVG circular progress gauge
```

---

## 7. Verification & Testing Strategy

1. **Role Enforcement Tests**:
   - `STORE_MANAGER` cannot access `/api/analytics/finance` (403 Forbidden).
   - `PRODUCTION_SUPERVISOR` cannot access `/api/analytics/finance` (403 Forbidden).
   - `ACCOUNTANT` can access `finance`, `store`, and `production`.
   - `EXECUTIVE` and `SUPER_ADMIN` can access all departments.
2. **Aggregation Correctness**:
   - Validates that finished goods count matches regex dispatches.
   - Verifies daily velocity totals sum correctly.
   - Tests financial valuations using item costPerUnit.
3. **Build & Typecheck**:
   - `bun tsc --noEmit` must pass with 0 errors.
   - `bun test` must pass 100%.
   - `bun run build` must compile cleanly without SSR hydration errors.
