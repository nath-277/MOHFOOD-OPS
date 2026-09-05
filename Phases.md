# Moh Foods NG - Enterprise Operations Platform (MOH-OPS)
# Phased Implementation Roadmap (Phases.md)

**Project Code:** MOH-OPS  
**Target Enterprise:** Moh Industries Ltd / Moh Foods NG ([mohfood.com](https://mohfood.com))  
**Tech Stack:** Next.js 16.3 (Bun Runtime) + Hono API + TSX + NeonDB (PostgreSQL) + Drizzle ORM + Cloudflare R2 + PWA (@serwist/next)  
**Methodology:** Incremental Agile Delivery (One verified module per phase)

---

## Phase Summary & Timeline

```mermaid
gantt
    title MOH-OPS Engineering & Rollout Roadmap
    dateFormat  YYYY-MM-DD
    section Completed
    Phase 0: Infrastructure & Design System   :done, p0, 2026-09-01, 2d
    Phase 1: Multi-Role Auth & PIN Lock       :done, p1, after p0, 2d
    Phase 2: Store Inventory & BOM Dispense  :done, p2, after p1, 3d
    Phase 3: Executive Hub & SoR Consignments :done, p3, after p2, 2d
    Phase 5: Production & Logistics Subsystems:done, p5, 2026-09-05, 3d
    section Upcoming
    Phase 4: PWA Offline Sync & Barcode HUD   :active, p4, 2026-09-08, 3d
```

---

## Phase 0: Workspace Scaffolding, Core Infrastructure & Design System

### Objectives
Initialize the repository under Bun runtime, configure Next.js 16.3 App Router, mount Hono API, connect NeonDB via Drizzle ORM, configure Cloudflare R2 client, and establish the Moh Foods corporate design system tokens.

### Action Items
- [x] Initialize Git repository with Conventional Commits setup.
- [x] Initialize Bun project with Next.js 16.3, React 19, TypeScript 5.x.
- [x] Configure Tailwind CSS v4 with Moh Foods brand tokens:
  - `--brand-berry-primary: #8E1538` (Refined to calm 2-3 palette)
  - `--brand-lime-swoosh: #84BD00`
  - `--brand-green-forest: #059669`
  - `--brand-peach: #FF9065`
  - `--brand-dark-plum: #2B1B24`
  - `--brand-cream: #F8FAFC`
- [x] Setup NeonDB pooled PostgreSQL connection and Drizzle ORM config (`drizzle.config.ts`, `schema.ts`).
- [x] Setup Hono API root handler at `src/app/api/[...route]/route.ts` with type-safe RPC client export (`hc`).
- [x] Setup Cloudflare R2 S3-compatible client (`@aws-sdk/client-s3`) with upload & signed URL helper.
- [x] Setup PWA manifest (`manifest.json`), icons, and Serwist service worker scaffolding.

### Verification & Deliverables
- `bun run dev` boots Next.js with Hono `/api/health` returning 200 OK.
- `bun run db:generate` & `bun run db:push` cleanly connect to NeonDB.
- Design tokens verify visual accuracy against Moh Foods branding banner.

---

## Phase 1: Custom Multi-Role Authentication & Department Routing Engine

### Objectives
Build the department-aware, multi-role authentication system with Argon2id password hashing, HTTP-only signed session cookies, role capability guards, and the 4-digit fast PIN switcher for shared warehouse tablets.

### Action Items
- [x] Implement Drizzle schemas: `departments`, `users`, `user_roles`, `sessions`, `quick_pins`.
- [x] Seed initial departments: `EXECUTIVE_MANAGEMENT`, `INVENTORY_STORE`, `PRODUCTION`, `LOGISTICS`, `ACCOUNTING`, `MEDIA`, `CLEANERS`, `MERCHANDISERS`, `PROCUREMENT`.
- [x] Seed initial roles: `SUPER_ADMIN`, `EXECUTIVE`, `STORE_MANAGER`, `STORE_OFFICER`, `PRODUCTION_SUPERVISOR`.
- [x] Implement Hono Auth endpoints:
  - `POST /api/auth/login` (Staff ID / Email + Password)
  - `POST /api/auth/pin-switch` (Fast 4-digit PIN for store counter tablet)
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [x] Build Next.js Middleware for route protection and automatic department redirection:
  - `/management/*` $\rightarrow$ Accessible by `SUPER_ADMIN`, `EXECUTIVE`.
  - `/inventory/*` $\rightarrow$ Accessible by `SUPER_ADMIN`, `EXECUTIVE`, `STORE_MANAGER`, `STORE_OFFICER`.
  - `/admin/*` $\rightarrow$ Accessible only by `SUPER_ADMIN`.
- [x] Build Branded UI Pages:
  - `/login`: Moh Foods branded login card with yogurt parfait aesthetic.
  - `/pin-lock`: Shared tablet PIN pad with instant operator profile switching.
  - Stationary left sidebar with shift scheduler and fast PIN lock.

### Verification & Deliverables
- Unit tests for password hashing and PIN validation.
- Store officer login redirects to `/inventory` with shift prompt.
- Executive login redirects to `/management`.
- Unauthorized route access returns 403 Forbidden or redirects to login.

---

## Phase 2: Inventory Department Operations (Store Module MVP)

### Objectives
Implement the complete operational lifecycle of the Moh Foods store: raw material ad-hoc intake, item catalog (perishables measured/numbered & packaging), morning/night shift batch dispensing, bi-directional returns (faults & excess), and shift closing stock reconciliation.

### Action Items
- [x] Implement Drizzle schemas:
  - `items` (categorized as `PERISHABLE_MEASURED`, `PERISHABLE_NUMBERED`, `PACKAGING_NON_PERISHABLE`).
  - `item_lots` (lot number, supplier, arrival date, expiry date, unit purchase cost).
  - `stock_transactions` (append-only ledger of every gram, piece, or carton movement).
  - `shifts` & `shift_reconciliations` (Morning and Night shift records, opening/closing balances).
- [x] Item Catalog & Seed Data:
  - Measured perishables: Milk (kg), Sugar (kg), Oats (kg), Raisins (cups/kg), Granola (kg), Vanilla extract (L).
  - Numbered perishables: Apples (pcs), Grapes (pcs), Coconuts (nuts), Cashews (packs).
  - Packaging items: Parfait cups & lids, Greek yogurt containers, Vanilla bottles & caps, Foil rolls, Tamper-proof seals, Labels.
- [x] Inbound Intake UI & Controller (`/inventory` modal):
  - Form for ad-hoc supplier delivery (GRN, Lot #, Expiry date, Weight/Count, Cost).
  - Cloudflare R2 file upload for physical waybill / paper invoice snapshot.
- [x] Daily Batch Dispensing UI & Controller (`/inventory` modal):
  - Shift selector (Morning Shift vs Night Shift).
  - Product formulation batch calculator with custom ingredient quantities and omission capability.
  - Live inventory deduction with low-stock warnings.
  - Dual acknowledgment sign-off (Store Officer + Production Supervisor).
- [x] Bi-Directional Returns Module (`/inventory` modal):
  - **Fault Return**: Log defective cups/spoiled fruit, automatically dispense replacements, and mark scrap.
  - **Excess Restock**: Log unused ingredients returned from shift, inspect condition, and restock back to inventory.
- [x] Shift Closing Count & Handover UI (`/inventory` modal):
  - Physical count checklist at shift conclusion (08:00–18:00 Morning / 18:00–08:00 Night).
  - Live calculation of variance against expected balance.
  - Mandatory reason documentation for discrepancies.
  - Digital lock and archive of shift report.

### Verification & Deliverables
- Complete flow test: Inbound Intake $\rightarrow$ Dispense Morning Shift $\rightarrow$ Return Fault & Replace $\rightarrow$ Return Excess $\rightarrow$ Close Shift & Verify Reconciled Balances.
- All transactions create immutable records in `stock_transactions`.

---

## Phase 3: Executive & Management Operations Module

### Objectives
Equip Executive Management with real-time operational visibility: supermarket Sale or Return (SoR) consignment accounts, WhatsApp invoice/waybill reconciliation center, procurement par-level alerts, and cross-departmental KPI analytics.

### Action Items
- [x] Implement Drizzle schemas:
  - `retail_partners` (Supermarkets, grocers, gym stockists across Lagos & Ogun).
  - `sor_consignments` (Delivered quantity, expiry returns, net sold, invoice amount, payments received, outstanding balance).
  - `whatsapp_invoices` (R2 file link, sender phone, delivery match status, amount).
  - `suppliers` (Raw material vendors, contact details, lead time, pricing history).
- [x] Supermarket SoR Consignment Ledger (`/management`):
  - Stockist directory with live balance cards (delivered vs returned vs paid).
  - Record new consignment delivery dispatch.
  - Record expired yogurt parfait returns (credit adjustment to invoice).
  - Cash / Bank transfer payment recording and balance settlement.
  - Export CSV ledger feature.
- [x] WhatsApp Invoice & Waybill Reconciliation Center (`/management`):
  - Drop-zone to upload photos/PDFs received from WhatsApp delivery threads.
  - Match uploaded invoice/waybill against open supplier order or supermarket delivery.
  - One-click reconciliation status toggle (`UNRECONCILED` $\rightarrow$ `VERIFIED`).
- [x] Procurement & Par-Level Management (`/management`):
  - Dynamic stock health monitor (Critical Red, Warning Yellow, Healthy Green).
  - Buffer runway days calculated dynamically against plant velocity of 850 units/day.
- [x] Executive KPI Command Center (`/management`):
  - Total Raw Material Stock Valuation (NGN $\mathcal{N}$).
  - Active Consignment Receivables (Outstanding Supermarket Payments).
  - Daily Production Output vs Plant Capacity Gauge.
  - Weekly Spoilage & Packaging Waste Percentage.
- [x] Segregated Executive Inventory UI & Root Cause Audit (`/inventory`):
  - Check Stock & live valuation.
  - Product Movement History audit trail.
  - See Returns and Why (Plant floor scrap & Supermarket shelf returns root cause breakdown).
- [x] Settings & Terminal Security (`/settings`):
  - Positioned directly above username in stationary sidebar.
  - 4-digit floor terminal PIN security management.

### Verification & Deliverables
- Supermarket consignment calculation: $\text{Delivered (200)} - \text{Expired Return (15)} = \text{Sold (185)} \times \mathcal{N}\text{Price}$.
- Invoice upload successfully stores file in Cloudflare R2 and renders preview.
- Executive dashboard aggregates live inventory and consignment data accurately.

---

## Phase 4: PWA Offline Capabilities, Barcode HUD & Warehouse Hardening

### Objectives
Optimize the application for factory floor reliability: full PWA offline support with IndexedDB action queue for shift counts, mobile/tablet camera barcode scanning, and ergonomic UX hardening for gloved warehouse use.

### Action Items
- [ ] PWA Configuration:
  - Setup `@serwist/next` with custom service worker.
  - Offline fallback page with Moh Foods branding.
  - Install banner prompt for Android/iOS tablets and smartphones.
- [ ] Local-First Shift Count Queue:
  - Integrate `idb-keyval` for offline stock count caching when store Wi-Fi drops.
  - Background synchronization worker triggered when connection is restored.
- [ ] Camera Barcode & QR Scanner Component:
  - HTML5 camera viewfinder supporting 1D EAN-13 barcodes and 2D QR codes.
  - Audio and haptic vibration feedback on scan detection.
  - Instant item lookup modal for rapid batch dispensing.
- [ ] Touch Ergonomics Audit:
  - Ensure all critical buttons have $\ge 48\text{px}$ touch targets.
  - Add quick plus/minus stepper controls for high-speed integer counting on tablets.

### Verification & Deliverables
- PWA installable on Chrome, Safari, and Android home screens.
- Disconnecting Wi-Fi during shift closing still allows count entry, syncing cleanly when reconnected.
- Camera barcode scanner correctly decodes sample EAN-13 / QR codes.

---

## Phase 5: Modular Subsystem Foundation for Future Departments

### Objectives
Establish clean domain abstractions and plug-in interfaces for the remaining Moh Foods departments (Production, Logistics, Accounting, Merchandisers, Cleaners, Procurement, Media).

### Action Items
- [x] Create domain engines and event bus:
  - `src/server/events/eventBus.ts`: Asynchronous in-memory event bus and structured audit log publisher.
  - `src/server/production/store.ts`: Work order scheduling, dual-shift runs, actual yield vs theoretical BOM, and line equipment temperature tracking.
  - `src/server/logistics/store.ts`: Chilled fleet management (2.0°C – 4.0°C), driver dispatch manifests, multi-stop supermarket deliveries, and in-transit probe calibrations.
- [x] Implement Hono API Routers:
  - `src/server/hono/routes/production.ts` (`/api/production/overview`, `/work-orders`, `/equipment`)
  - `src/server/hono/routes/logistics.ts` (`/api/logistics/overview`, `/runs`, `/fleet`)
- [x] Create Production UI Subsystem:
  - `/production`: Live status table, batch yield modal (`RecordYieldModal`), work order scheduler (`CreateWorkOrderModal`), line machinery cards, and dual-shift handovers.
- [x] Create Logistics UI Subsystem:
  - `/logistics`: Chilled fleet directory (2.0°C – 4.0°C), delivery runs & waybill manifests table, `DispatchRunModal`, temperature probe modal, and retail stockist network directory.
- [x] Update Next.js Proxy & Sidebar:
  - Route guards and role redirects for `PRODUCTION_SUPERVISOR` and `LOGISTICS_OFFICER`.
  - Promoted Production Mixing and Logistics & Dispatch to active Operations in stationary sidebar.

### Verification & Deliverables
- Zero circular dependencies between domain modules; event bus decouples cross-department notifications.
- Typecheck (`bun run typecheck`) and Turbopack production build (`bun run build`) succeed with 12 clean routes.

---

## Acceptance Criteria & Go-Live Checklist

| Milestone | Acceptance Criteria | Target Status |
|---|---|:---:|
| **Infrastructure (Phase 0)** | Bun runtime + Next.js 16.3 + Hono + NeonDB + Cloudflare R2 active | Complete |
| **Auth & RBAC (Phase 1)** | Multi-role session auth + 4-digit tablet PIN working with route guards | Complete |
| **Store Intake (Phase 2)** | Ad-hoc inbound flow with Lot #, Expiry, and R2 waybill attachment | Complete |
| **Batch Dispensing (Phase 2)** | Morning/Night shift dispensing with decimal/count precision and BOM calculations | Complete |
| **Returns Engine (Phase 2)** | Fault replacements (scrap log) and Excess returns (restock) verified | Complete |
| **Shift Reconciliation (Phase 2)** | Opening balance - Dispensed + Restocked = Expected vs Physical count | Complete |
| **SoR Supermarket Ledger (Phase 3)**| Consignment deliveries, expired returns, net sales, and debt tracking operational | Complete |
| **WhatsApp Ingestion (Phase 3)** | Waybill/invoice photo drop-zone with Cloudflare R2 link and status tagging | Complete |
| **Executive Inventory & Audit (Phase 3+)** | Check Stock, Product History, and Root Cause Returns & Scrap audit | Complete |
| **Settings & Terminal Security (Phase 3+)** | Profile management, 4-digit PIN setup, shift hours preference | Complete |
| **Production Mixing Subsystem (Phase 5)** | Work order scheduling, batch mixing logs, yield efficiency, CIP sanitation | Complete |
| **Logistics & Fleet Subsystem (Phase 5)** | Cold-chain vehicle fleet (2-4°C), waybills, stockist dispatch runs | Complete |
| **PWA & Offline Scanner (Phase 4)** | Camera barcode scanning + offline shift count local-first queue | Scheduled |
| **Documentation** | Technical PRD (`Documentation.md`) and Roadmap (`Phases.md`) finalized | Complete |
