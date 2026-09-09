# Moh Foods NG - Enterprise Operations Platform (MOH-OPS)
# Product Requirements Document (PRD) & Technical Specification

**Version:** 1.0.0  
**Target Enterprise:** Moh Industries Ltd / Moh Foods NG ([mohfood.com](https://mohfood.com))  
**NAFDAC Reg. No:** A8-106771 (Yogurt Parfait)  
**Author:** IT & Systems Architecture Department  
**Scope:** MVP (Admin, Executive Management, Inventory Store) + Modular Domain Foundation for Enterprise Scaling  

---

## 1. Executive Summary & Strategic Context

Moh Foods NG is an established FMCG food manufacturing and distribution company based in Lagos and Ogun State, Nigeria. The company specializes in freshly crafted dairy and healthy treat lines:
- **Moh Yogurt Parfait** (NAFDAC Reg. No: A8-106771): Fresh yogurt layered with fresh fruits (apples, grapes, coconut), crunchy granola, raisins, and cashew nuts.
- **Moh Greek Yogurt**: Plain unsweetened, sweetened, and vanilla infused.
- **Moh Vanilla Yogurt Drink & Pure Coconut Oil**.

### The Problem
Moh Foods currently manages its manufacturing, warehouse inventory, supermarket distribution, and financial reconciliations using manual notebooks, disjointed spreadsheets, and WhatsApp communication threads. This causes:
1. **Inventory Discrepancy & Spoilage**: Material intake occurs on an irregular schedule, and ingredient dispensing to morning and night production shifts is tracked on paper, resulting in unrecorded stock shrinkages and unverified shift handovers.
2. **Untracked Production Returns**: Ingredients returned due to factory faults or excess dispensing are poorly documented, causing recipe calculation errors and stock drift.
3. **Consignment / Sale or Return (SoR) Debt Traps**: Products are supplied to retail supermarkets, grocery stores, and gym stockists on a **Sale or Return (SoR)** basis. Reconciling delivered goods against returned unsold stock and collecting cash is fraught with delay and human error.
4. **WhatsApp Invoice Confusion**: Delivery receipts, driver waybills, and payment confirmations are shared across WhatsApp groups without a centralized verification ledger.

### The Solution: MOH-OPS
A unified, modular, mobile-first Progressive Web App (PWA) built specifically for factory floor and executive operations:
- **Factory-Hardened Inventory Store Module**: Handles ad-hoc raw material inbounds, lot expiry tracking, decimal-precision measured dispensing (kg, cups), integer numbered counting (pieces, packs), packaging reconciliation, dual-shift morning/night handovers, and bi-directional returns (fault replacements vs excess restocks).
- **Executive Management Command Center**: Real-time SoR consignment ledger for retail stockists across Lagos & Ogun, WhatsApp invoice/waybill verification hub, procurement par-level alerts, and cross-departmental oversight.
- **Modular Domain Architecture**: Built on Next.js 16.3 (Bun runtime) + Hono API + NeonDB (PostgreSQL) + Cloudflare R2 with strict domain isolation so subsequent departments (Production, Logistics, Accounting, Merchandisers, Cleaners, Procurement, Media) plug in without rewriting core systems.

---

## 2. Brand Identity & UI Design System

The visual design system directly mirrors Moh Foods' branding extracted from the physical corporate roll-up banner and official web properties:

### 2.1 Color Palette & Design Tokens

```css
:root {
  /* Primary Brand: Berry Pink / Magenta (Energy, Taste, Vitality) */
  --brand-berry-primary: #D81B60;       /* Banner main magenta body */
  --brand-berry-dark: #AD1457;          /* Deep berry for hover & active states */
  --brand-berry-light: #FCE4EC;         /* Light berry tint for soft badges / highlights */
  --brand-berry-glow: rgba(216, 27, 96, 0.15);

  /* Secondary Brand: Fresh Avocado & Nature Green (Freshness, Health, NAFDAC Quality) */
  --brand-lime-swoosh: #84BD00;         /* Banner top wave lime */
  --brand-green-fresh: #7CB342;         /* Accent leaf green */
  --brand-green-forest: #008153;        /* Web button green & dark ribbon divider */
  --brand-green-light: #E8F5E9;         /* Green tint for verified / in-stock badges */

  /* Tertiary Accent: Warm Mango & Coral Peach (Parfait Fruit Accent) */
  --brand-peach: #FF9065;               /* Website warm highlight */
  --brand-mango: #FFA726;               /* Pending & warning highlights */

  /* Dark Neutrals: Cocoa Plum & Charcoal Slate (Readability & Professionalism) */
  --brand-dark-plum: #2B1B24;           /* Banner text "Moh Food" deep chocolate plum */
  --neutral-charcoal: #1E293B;          /* Primary body typography (Slate 800) */
  --neutral-slate: #475569;             /* Secondary labels & timestamps (Slate 600) */
  --neutral-border: #E2E8F0;            /* Crisp factory UI dividers (Slate 200) */

  /* Light Neutrals: Cream Yogurt & Clean Canvas (Sanitary & Wholesome) */
  --brand-cream: #FFFDF9;               /* Banner logo circle off-white cream */
  --surface-ground: #F8FAFC;            /* Clean app background (Slate 50) */
  --surface-card: #FFFFFF;              /* Pure white elevated cards */

  /* Semantic Feedback Tokens */
  --status-success: #059669;            /* Restocked, Paid, Reconciled, Verified */
  --status-warning: #D97706;            /* Low stock alert, Pending shift sign-off */
  --status-danger: #DC2626;             /* Faulty return, Expired item, Unpaid debt */
  --status-info: #2563EB;               /* Active shift, Inbound scheduled */
}
```

### 2.2 Typography & Readability Hierarchy
- **Display Headings**: `Poppins` / `Plus Jakarta Sans` (Semi-bold, rounded, modern food-industry aesthetic).
- **Body & Tabular Data**: `Inter` (Optimized for numerical clarity, high legibility on 10-inch store room tablets under bright fluorescent warehouse lighting).
- **Code & Barcode Labels**: `JetBrains Mono` / `Roboto Mono` for Batch IDs, Lot Numbers, and NAFDAC registration references.

### 2.3 Ergonomics for Factory Floor (PWA UX)
- **Minimum Touch Targets**: All buttons, quick-dispense selectors, and shift toggles have a minimum touch area of **48x48px** to allow comfortable interaction with gloved hands.
- **High-Contrast Dark Mode / Glare Mode**: High-contrast mode for warehouse workers operating under variable lighting conditions.
- **Audio & Haptic Feedback**: Optional sound and vibration chirp upon successful barcode scan or batch sign-off to minimize screen distraction.

### 2.4 Enterprise Layout Architecture: Left Immovable Sidebar & Content Pane
- **Left Immovable Sidebar (`Sidebar.tsx`)**:
  - Permanently fixed on the left viewport edge (`sticky top-0 h-screen w-64 lg:w-72 bg-white border-r border-slate-200 z-30 select-none`).
  - Does not scroll with the right-side content pane, maintaining instant access to navigation and emergency tablet lock.
  - Hosts the Moh Foods logo, NAFDAC Registration (`A8-106771`), plant status indicator, active shift switcher (Morning/Night), modular navigation categories, and pinned user profile with instant PIN lock.
  - Touch-friendly sliding drawer with backdrop overlay for mobile/tablet screen viewports.
- **Right Content Viewport (`TopHeader.tsx` + `{children}`)**:
  - Uncluttered top bar containing breadcrumb trails, shift badge, facility status, and terminal lock shortcut.
  - Dedicated full-width content canvas with responsive padding and unified footer.

---

## 3. Technology Stack & Infrastructure

| Layer | Selected Technology | Technical Rationale |
|---|---|---|
| **Runtime & Package Manager** | **Bun 1.2+** | Ultra-fast script execution, instant package resolution, native TypeScript support, and lowest memory footprint. |
| **Frontend Framework** | **Next.js 16.3 (App Router)** | Modern React Server Components (RSC) for zero client bundle bloat on initial load, streaming SSR, and Next.js Server Actions. |
| **API Framework** | **Hono API (`@hono/node-server`)** | High-performance, lightweight web framework mounted at `/api`. Delivers end-to-end typed RPC (`hc`), Zod payload validation, and sub-millisecond route handling. |
| **Database & Engine** | **NeonDB (Serverless PostgreSQL)** | Fully managed serverless Postgres with instant branching (for zero-risk staging migrations), auto-scaling, and pooled WebSocket connections. |
| **ORM & Migrations** | **Drizzle ORM + Drizzle Kit** | Zero-overhead, edge-compatible, type-safe SQL builder with explicit schema control and automated migrations. |
| **Object Storage** | **Cloudflare R2** | S3-compatible, zero-egress fee cloud storage for delivery waybills, WhatsApp invoice photos, product packaging artwork, and batch quality proofs. |
| **PWA & Offline Worker** | **@serwist/next** | Successor to `next-pwa`, provides native service worker registration, offline fallback, stale-while-revalidate asset caching, and web app installability. |
| **Authentication & RBAC** | **Custom Iron Session / Signed JWT Cookies** | Secure HTTP-only cookies with Argon2id password hashing, multi-tenant department scoping, role-based capability lists, and quick PIN-based shift unlock for floor tablets. |
| **Barcode & Camera Engine** | **@zxing/browser + html5-qrcode** | Client-side camera-based scanning of QR codes and 1D barcodes (EAN-13, Code 128) for inventory items and delivery waybills without external hardware. |
| **Styling & Components** | **Tailwind CSS v4 + Radix UI / Lucide Icons** | Utility-first styling customized with Moh Foods design tokens, headless accessible primitives, and consistent iconography. |

---

## 4. End-to-End System Flows

### 4.1 Authentication & Department Gateway Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as Staff / Executive
    participant Client as PWA Frontend
    participant AuthAPI as Hono Auth Endpoint
    participant DB as NeonDB (PostgreSQL)

    User->>Client: Enters Staff ID / Email + Password
    Client->>AuthAPI: POST /api/auth/login { identifier, password }
    AuthAPI->>DB: Query user, roles, permissions, assigned department
    DB-->>AuthAPI: User record + hashed credentials
    AuthAPI->>AuthAPI: Verify Argon2id hash & generate signed session cookie
    AuthAPI-->>Client: 200 OK (Set-Cookie: moh_session, payload: user profile)
    Client->>Client: Evaluate assigned role & active shift status
    alt Role == 'SUPER_ADMIN' or 'EXECUTIVE'
        Client-->>User: Redirect to /management/dashboard
    alt Role == 'STORE_MANAGER' or 'STORE_OFFICER'
        Client-->>User: Redirect to /inventory/dashboard (Prompt for Shift Selection: Morning/Night)
    else Other Department (Future: Production, Logistics, etc.)
        Client-->>User: Redirect to /department/[id]/dashboard
    end
```

### 4.2 Floor Tablet Fast PIN Switch Flow (Shared Device in Store Room)
```mermaid
sequenceDiagram
    autonumber
    actor Officer as Shift Store Officer
    participant PWA as Store Tablet
    participant AuthAPI as Hono Auth Endpoint

    Note over PWA: Tablet is locked on Store Counter
    Officer->>PWA: Taps profile avatar & inputs 4-digit PIN (e.g. 8492)
    PWA->>AuthAPI: POST /api/auth/pin-switch { pin, deviceToken }
    AuthAPI->>AuthAPI: Verify PIN against Store Department staff
    AuthAPI-->>PWA: Updates active operator context without full re-login
    PWA-->>Officer: Unlocks Dispensing HUD with operator's name stamped
```

---

## 5. Detailed Operational Specifications (MVP Roles)

### 5.1 Department: Inventory & Store Operations

#### 5.1.0 Role Governance: Store Manager vs. Store Officer
To maintain dual-control integrity and regulatory separation of duties, the platform enforces distinct scopes:
- **Store Manager (`STORE_MANAGER`)**:
  - **Ledger Governance**: Oversees overall inventory valuation, audit integrity, and supplier balance reconciliations.
  - **Formulation & Recipe BOMs**: Manages standard product recipes and Bill of Materials (BOM) ingredient ratios.
  - **Discrepancy Authorization**: Authorizes scrap loss write-offs, investigates shift shrinkage variances exceeding tolerance limits, and approves manual inventory adjustments.
  - **Catalog & Par Management**: Defines minimum safety stock thresholds, creates new SKU profiles, and liaises with Procurement on bulk purchase orders.
- **Store Officer (`STORE_OFFICER`)**:
  - **Physical Custody**: Manages physical warehouse entry, temperature verification, and bin storage in Cold Rooms A & B.
  - **Supplier Lot Intake**: Executes physical intake checks on incoming raw material shipments, verifies GRN documents, and logs lot batch numbers and expiration dates.
  - **Batch & Direct Dispensing**: Measures, counts, and dispenses exact ingredient requirements to kitchen mixing crews for morning and night shifts.
  - **Shift Handover Execution**: Performs end-of-shift physical counts and executes digital shift handover locks.

#### 5.1.1 Raw Material Intake (Inbound Flow)
- **Arrival Frequency**: Ad-hoc / Occasional (suppliers arrive unannounced or on short notice).
- **Required Metadata**:
  - Supplier Name & Contact
  - Goods Received Note (GRN) Reference
  - Delivery Waybill / Invoice Snapshot (Uploaded directly to Cloudflare R2)
  - Arrival Date & Time
  - Receiving Officer Name
- **Quality Inspection Checklist**: Packaging integrity, visual freshness, smell/temperature check, manufacturing & expiry dates.

#### 5.1.2 Material Classification & Measurement Logic

Moh Foods operates with three distinct material handling paradigms:

| Category | Sub-Classification | Items Handled | Unit of Measurement (UoM) | Storage Precision |
|---|---|---|---|---|
| **Perishable** | **Measured Products** | Fresh Milk, Powdered Milk, Sugar, Oats, Granola, Raisins, Vanilla extract | `kg` (Kilograms), `g` (Grams), `cups` (Standardized Cups), `liters` | `numeric(12, 3)` (Allows exact 0.250kg or 1.500L tracking) |
| **Perishable** | **Numbered Products** | Fresh Apples, Seedless Grapes, Whole Coconuts, Cashew nuts (pre-packed/counted) | `count` (Pieces/Nuts), `bunches`, `packs` | `integer` (Exact discrete counts) |
| **Non-Perishable** | **Packaging Goods** | Parfait cups, Parfait dome covers, Greek yogurt containers, Vanilla drink bottles, Bottle caps, Aluminium foil rolls, Tamper-proof heat shrink seals, Front/back labels | `units` (Pieces), `sleeves` (e.g., 50 cups/sleeve), `cartons` | `integer` (Units & full packaging packs) |

#### 5.1.2.1 Multi-Tier Packaging & Conversion Hierarchy

To reflect practical warehouse packaging (e.g., cups arriving in master cartons containing packs of cups, grapes arriving in packs dispensed in pieces, or apples counted directly), items support flexible packaging hierarchies:

1. **Direct Count / Weight (`DIRECT`)**:
   - Items managed strictly in base unit (e.g. `1,420 apples`, `45.5 kg sugar`).
   - No intermediary packaging units.
2. **Pack Only (`PACK_ONLY`)**:
   - Single packaging layer over discrete or measured units.
   - Example: Grapes arrive in packs of 80 pcs. If starting with 20 packs (1,600 pcs) and 400 pcs are dispensed to production, remaining balance automatically computes and displays as `15 packs (1,200 pcs)`.
3. **Carton & Pack (`CARTON_AND_PACK`)**:
   - Two-tier packaging hierarchy: Master Carton $\rightarrow$ Inner Pack/Sleeve $\rightarrow$ Base Units.
   - Example: Parfait Cups arrive in cartons of 50 packs $\times$ 20 cups (1,000 cups/carton).
   - Inbound intake can be logged in cartons (e.g. 10 cartons), packs (e.g. 50 packs), or pieces.
   - Dispensing can be logged in cartons, packs, or exact pieces.
   - Remaining stock dynamically calculates fractional cartons (e.g. `6.5 cartons (325 packs • 6,500 cups)`).

**Technical Principles**:
- **Base Unit as Source of Truth**: All database stock quantities (`currentStock`, `quantity`, recipes, lots) are stored in the base unit (`uom`) to prevent calculation drift in production recipes and BOM deductions.
- **Presentation & Translation Layer**: Packaging is an intake/dispense translation layer (`src/lib/packaging.ts`) with `toBaseUnits`, `fromBaseUnits`, and `formatPackagingDisplay` translating base units into warehouse packaging across all views.

#### 5.1.3 Daily Batch Dispensing (Outbound to Production Floor)
- **Shift Schedule**:
  - **Morning Shift**: 06:00 - 14:30
  - **Night Shift**: 18:00 - 02:30
- **Dispensing Protocol**:
  1. Production Supervisor submits a Requisition Batch: e.g., *"Produce 300 units of 400ml Moh Parfait + 150 units of 500ml Greek Yogurt"*.
  2. System auto-calculates Bill of Materials (BOM) guidance:
     - Milk: 45.000 kg
     - Granola: 12.500 kg
     - Apples: 75 pieces
     - Grapes: 300 pieces
     - Parfait Cups & Covers: 300 sets
     - Tamper-proof seals: 300 units
  3. Store Officer weighs/counts out materials, logs actual dispensed quantities, and assigns Lot IDs.
  4. Both Store Officer and Production Supervisor confirm transfer via digital acknowledgment.

#### 5.1.4 Bi-Directional Returns & Replacements (Transparent Stock Deduction)
- **Scenario A: Fault Return & Immediate Replacement**
  - *Trigger*: Production encounters defective packaging (cracked parfait cups, torn foil) or spoiled ingredients on the floor.
  - *Action*: Production brings defective items back to the store room.
  - *Deduction Impact Logic*:
    - **Issue Replacement Stock**: Fresh replacement units are issued from the warehouse store to the floor. The store balance is deducted by $-X$ to reflect the departure of fresh units, while the defective items are recorded in the scrap write-off ledger.
    - **Log Defect / Scrap Only (No Replacement)**: When the floor does not need replacement units (e.g. production run already ended or batch scaled down), zero store stock is deducted ($\pm 0$ store balance impact), and the event is logged strictly as a quality incident and scrap write-off.
- **Scenario B: Excess Return & Restock**
  - *Trigger*: Production finishes the run and has unused ingredients (e.g., 2.500 kg unused oats, 15 unused apples, 20 unused cups).
  - *Action*: Items are inspected by Store Officer for hygiene and temperature.
  - *System Workflow*: Store logs `RETURN_EXCESS_RESTOCK`. Stock balance is immediately incremented with restocked timestamp and operator audit stamp.

#### 5.1.5 Shift Closing Inventory Count & Reconciliation
- At the close of each shift (Morning and Night), the Store Officer performs a physical count of top high-velocity items and compares against the system balance.
- **Variance Metric**: $\text{Variance} = \text{Physical Count} - \text{Expected System Balance}$.
- Any variance exceeding acceptable tolerance triggers a mandatory note (e.g. "Spillage during dispensing", "Moisture evaporation").
- Shift handover report is digitally locked and archived.

#### 5.1.6 Single Material Direct Dispensing (Floor Requisitions)
- In addition to full recipe formulation BOM batch dispensing, the store supports **Direct Single-Material Requisitions** (e.g. dispensing 5kg oats, 250 cups, or 10L milk directly to kitchen floor).
- Live stock balance calculator ensures requested quantity does not exceed current warehouse stock.
- Requisition records operator, recipient, department purpose, and shift context in the audit ledger.

#### 5.1.7 Production Batch Runs Audit Trail & Accordion Breakdown
- The Movement & Audit Trail tab features a dual-view interface:
  - **Production Batch Runs View**: Groups stock movements by scheduled production runs. Displays scheduled finished product name (e.g., "Signature Granola 500g"), target batch volume, reference ID, shift, and floor recipient.
  - **Expandable Materials Accordion**: Inline drawer expanding to show the exact table of itemized raw ingredients dispatched from the store with quantities, units, and timestamps.
  - **Full Dispatch Slip Modal**: Detailed modal dialog providing full run specifications and operator sign-offs.
  - **All Movements Ledger**: Chronological transaction feed of all inventory entries (intakes, BOM batches, ad-hoc requisitions, scraps, returns, reconciliations).

---

### 5.2 Department: Executive & Management Operations

#### 5.2.1 Supermarket & Retail Consignment (Sale or Return - SoR) Ledger
Moh Foods supplies retail supermarkets and stockists across Lagos & Ogun State on a **Sale or Return** agreement:
- **Consignment Tracking Equation**:
  $$\text{Net Sold} = \text{Delivered Quantity} - \text{Returned Expired Quantity}$$
  $$\text{Invoice Due} = \text{Net Sold} \times \text{Agreed Unit Price}$$
  $$\text{Outstanding Balance} = \text{Invoice Due} - \text{Cash / Transfer Paid}$$
- **Features**:
  - Retail Partner Profiles: Supermarket name, branch address, store manager name, direct WhatsApp/phone link, credit limit, delivery schedule.
  - Consignment Waybill generator with QR tracking.
  - Returned Goods Verification: Log expired parfaits retrieved from stores to credit partner accounts.
  - Aged Debtors Aging Report: 0-7 days, 8-14 days, 15-30 days, 30+ days overdue.

#### 5.2.2 WhatsApp Invoice & Delivery Reconciliation Center
- **The Challenge**: Logistics drivers drop goods at supermarkets and post delivery notes in a WhatsApp group; accounting receives bank alerts; procurement posts raw material receipts.
- **The Feature**:
  - Executive Upload Drop-Zone: Upload WhatsApp screenshot or photo of waybill/invoice.
  - Metadata Tagging: Link invoice to Supplier or Retail Partner, input invoice number, total amount, and delivery date.
  - Cloudflare R2 Archival: Secure, permanent storage with fast CDN thumbnail previews.
  - Reconciliation Status: `UNRECONCILED` $\rightarrow$ `MATCHED_TO_DELIVERY` $\rightarrow$ `PAYMENT_VERIFIED` $\rightarrow$ `ARCHIVED`.

#### 5.2.3 Raw Material Procurement & Par-Level Alerts
- Real-time stock level monitoring with dynamic reorder thresholds:
  - *Critical Red*: Stock covers $< 24$ hours of planned production.
  - *Warning Yellow*: Stock below safety buffer.
  - *Optimal Green*: Adequate inventory.
- One-Click Supplier Outreach: Pre-formatted WhatsApp message or phone call shortcut to suppliers for Milk, Cups, Honey, Oats, etc.

#### 5.2.4 Cross-Departmental Performance Hub
- Real-time snapshot of:
  - Total Raw Materials on Hand (valuation in NGN $\mathcal{N}$).
  - Current Daily Production Output vs Plant Capacity.
  - Total Active Consignment Debt with Supermarkets.
  - Weekly Spoilage & Fault Rate percentage.

#### 5.2.5 Segregated Executive Inventory UI vs Store Manager UI
To eliminate operational clutter for C-suite and Operations Executives, the platform automatically renders a specialized **Executive Inventory & Audit View** (`ExecutiveInventoryView.tsx`) when accessed by users with the `EXECUTIVE` role:
- **Separation of Concerns**:
  - **Store Managers & Officers**: Retain the floor terminal interface with granular action modals (Inbound Intake, Batch Dispense with ingredient omission, Recipe BOM Builder, and Shift Reconciliation).
  - **Executive Management**: Access an uncluttered, analytical audit ledger focused on two core functions:
    1. **Check Stock & Product Movement History**:
       - Live stock valuation ($\mathcal{N}$) and category-filtered inventory balances.
       - Full chronological audit ledger of all product transactions (batch dispenses, supplier intakes, shift variances).
    2. **See Returns and Why (Root Cause Analysis)**:
       - Dedicated executive audit table cross-referencing **Plant Floor Material Scrap** (fault write-offs vs excess restocks) and **Supermarket SoR Shelf Returns** (retail returns with credit amounts).
       - Prominent root cause categorization (e.g. *Expired on Shelf*, *Broken Seal / Packaging Flaw*, *Transit Damage*, *Excess Unmixed Restock*).
       - Financial valuation impact of all losses.
  - **Super Admins**: Equipped with a 1-click header switcher to toggle between the Executive Audit View and the Store Floor Terminal view.

#### 5.2.6 Settings & Terminal Security
Accessible via a permanent **Settings** link positioned directly above the operator profile card in the stationary sidebar:
- **Operator Profile & Identity**: Displays Staff ID, Full Name, Department, Role, and official contact information.
- **Fast Terminal PIN Security**: Allows operators and executives to configure a 4-digit PIN for rapid unlocking of plant floor tablets.
- **Plant Operational Preferences**: Configurable default shift view (Morning: 08:00–18:00 vs Night: 18:00–08:00), low buffer alerts, and audio/haptic feedback.
- **Regulatory Metadata**: Displays NAFDAC Registration Number (`A8-106771`), Lagos Plant facility location, and system runtime information.

#### 5.2.7 Operational Notification Center & Floor Terminal Screen Lock
- **Notification Center**: Bell icon located in the persistent top header with live unread badge. Opens a slide-out drawer displaying low-stock alerts, defective return quality incidents, consignment dispatches, and shift handover confirmations.
- **Dedicated Terminal Screen Lock**: Locks the terminal screen into a protected PIN keypad view without logging the operator out of the server session. Session-persisted in `sessionStorage`, ensuring unauthorized personnel cannot interact with floor tablets while staff step away.

#### 5.2.8 Central Domain Event Bus & Systemwide Admin Audit Dashboard
- **Domain Event Bus (`DomainEventBus`)**: Central, decoupled event architecture publishing typed domain events across all subsystems (`INVENTORY_INTAKE_RECORDED`, `INVENTORY_BATCH_DISPENSED`, `INVENTORY_INDIVIDUAL_DISPENSED`, `INVENTORY_FAULT_SCRAPPED`, `SHIFT_HANDOVER_RECONCILED`, `MANAGEMENT_CONSIGNMENT_DISPATCHED`, `MANAGEMENT_SOR_RETURN_RECORDED`, `SECURITY_PIN_SWITCH`, etc.).
- **Admin Activity & Audit Trail Tab**: Real-time chronological audit feed on `/admin#audit`:
  - Quick summary metric cards (Total Logged Events, Active Operators, Store Operations, Commercial & Finance).
  - Search filter (by operator name, SKU, GRN, waybill, reference ID).
  - Department filter pills (All, Store & Warehouse, Executive & SoR, Production Floor, Security & Access, Logistics).
  - Rich audit entries with operator avatar initials, department badge, action badge, formatted human-readable narrative, payload metadata pills, exact timestamps, and immutable event IDs.

---

### 5.3 Department: Product Storage (Finished Goods Cold Room & Logistics Dispatch)

The **Product Storage Department** (`PRODUCT_STORAGE`) bridges the Kitchen Production mixing floor and the Logistics dispatch fleet. It governs **Finished Goods Cold Room C** maintained at strict temperatures (2.0°C – 4.0°C):

#### 5.3.1 Inbound Finished Goods Intake (From Kitchen Production)
- **Intake Flow**: Once packaging and sealing of a production run are finalized, the kitchen crew transfers the batch to Product Storage.
- **Batch Record Creation**: Generates a finished goods lot record (`finished_goods_batches`) containing:
  - Batch Number (e.g. `BATCH-2026-PARFAIT-01`)
  - Target SKU Name & Category (e.g., *Moh Yogurt Parfait 400ml*)
  - Unit Quantity Manufactured
  - Chiller Chamber Identification (Chamber A, B, C)
  - Temperature at Handover (typically 2.5°C – 3.8°C)
  - Manufacturing Date & Best-Before Expiration Date
  - Receiving Officer & Handing-Over Production Supervisor signatures

#### 5.3.2 Outbound Handover to Logistics Dispatch Riders
- **Handover Flow**: When delivery drivers or motorcycle dispatch riders prepare to depart for retail stockist runs, Product Storage dispenses finished units.
- **Dispatch Transfer Logging (`finished_goods_transfers`)**:
  - Automatically deducts remaining units from the active cold room batch.
  - Records Rider / Driver Name, Van Plate Number, Waybill Reference ID, and Departure Transit Temperature.
  - **Cloudflare R2 Digital Waybill**: Direct camera capture or document upload of the signed physical dispatch waybill, permanently preserved in Cloudflare R2 bucket `mohfood`.

---

### 5.4 Returns & Why Root Cause Ledger (`/returns`)

A dedicated top-level section accessible from the persistent sidebar, providing comprehensive root cause analysis and financial loss accounting across two primary discrepancy streams:

#### 5.4.1 Stream 1: Plant Floor Raw Material Scrap
- **Sources**: Physical plant damage during transit, ingredient spoilage, broken packaging seals, or operator handling spills.
- **Impact**: Zero or negative store deduction with financial scrap loss valuation.
- **Audit Fields**: Defective item, scrapped quantity, unit cost, operator name, shift, and detailed incident reason.

#### 5.4.2 Stream 2: Supermarket Retail Sale-or-Return (SoR) Returns
- **Sources**: Unsold, near-expiry, or heat-abused yogurt products returned by retail supermarket partners (e.g., Hubmart, Ebeano, Justrite) across Lagos and Ogun State.
- **Impact**: Credits customer accounts against outstanding consignment receivables.
- **Audit Fields**: Stockist account, SKU, returned quantity, unit credit rate, total credit amount, return waybill reference, and condition notes.

#### 5.4.3 Root Cause Distribution & Pareto Analysis
- Real-time Pareto breakdown grouping all returns into distinct operational categories:
  - `EXPIRED_ON_SHELF`: Supermarket stock rotation failures.
  - `BROKEN_SEAL`: Packaging or tamper-proof band integrity defects.
  - `DAMAGED_TRANSIT`: Temperature abuse or rough transport damage.
  - `EXCESS_RESTOCK`: Benign returns of unused production ingredients.

---

## 6. Information Architecture & Modular Directory Structure

The platform uses a modular domain architecture within Next.js, allowing seamless expansion into future departments:

```
moh-ops/
├── apps/
│   └── web/
│       ├── public/
│       │   ├── icons/                 # PWA icons (192x192, 512x512, maskable)
│       │   ├── manifest.json          # PWA web manifest
│       │   └── branding/              # Moh Food logo & brand assets
│       ├── src/
│       │   ├── app/                   # Next.js App Router
│       │   │   ├── (auth)/            # Login & PIN unlock routes
│       │   │   ├── (dashboard)/
│       │   │   │   ├── inventory/     # Inventory & Store Department pages
│       │   │   │   │   ├── intake/    # Raw material inbound
│       │   │   │   │   ├── dispense/  # Morning & Night shift batch dispensing
│       │   │   │   │   ├── returns/   # Fault replacement & excess restock
│       │   │   │   │   ├── items/     # Catalog (measured, numbered, packaging)
│       │   │   │   │   └── shifts/    # Shift handovers & reconciliation
│       │   │   │   ├── management/    # Executive Management pages
│       │   │   │   │   ├── sor/       # Retail stockist SoR consignment ledger
│       │   │   │   │   ├── whatsapp/  # Invoice & waybill reconciliation
│       │   │   │   │   ├── suppliers/ # Procurement & supplier directory
│       │   │   │   │   └── analytics/ # Plant output & financial overview
│       │   │   │   └── admin/         # User roles, departments & audit logs
│       │   │   └── api/
│       │   │       └── [...route]/    # Hono API root handler
│       │   ├── modules/               # Domain-Driven Modular Business Logic
│       │   │   ├── auth/              # Auth controllers, hashing, session guards
│       │   │   ├── inventory/         # Stock transactions, shift reconciliations
│       │   │   ├── management/        # SoR ledger, executive metrics
│       │   │   ├── shared/            # Common domain utilities & R2 storage client
│       │   │   └── future_departments/# Extension stubs (Production, Logistics, Accounting...)
│       │   ├── server/                # Database & Backend Infrastructure
│       │   │   ├── db/
│       │   │   │   ├── schema/        # Drizzle ORM schema definitions
│       │   │   │   └── index.ts       # NeonDB pooled connection client
│       │   │   └── hono/              # Hono app instance, middlewares & routes
│       │   ├── components/            # UI Components
│       │   │   ├── ui/                # Moh Foods branded primitives (buttons, inputs)
│       │   │   ├── scanner/           # PWA camera barcode/QR scanner component
│       │   │   └── layout/            # Responsive sidebar, shift header, mobile nav
│       │   └── lib/                   # Utility helpers, formatters, date utils
│       ├── tailwind.config.ts         # Moh Foods color palette & design tokens
│       ├── next.config.ts             # Serwist PWA & image optimization settings
│       └── package.json
```

---

## 7. Complete Database Schema (Drizzle ORM & PostgreSQL)

```typescript
// Core Enums
export const departmentTypeEnum = pgEnum('department_type', [
  'EXECUTIVE_MANAGEMENT',
  'INVENTORY_STORE',
  'PRODUCTION',
  'LOGISTICS',
  'ACCOUNTING',
  'MEDIA',
  'CLEANERS',
  'MERCHANDISERS',
  'PROCUREMENT'
]);

export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN',
  'EXECUTIVE',
  'STORE_MANAGER',
  'STORE_OFFICER',
  'PRODUCTION_SUPERVISOR',
  'LOGISTICS_OFFICER',
  'ACCOUNTANT',
  'STAFF'
]);

export const itemCategoryEnum = pgEnum('item_category', [
  'PERISHABLE_MEASURED',    // Milk, Sugar, Oats (kg, cups)
  'PERISHABLE_NUMBERED',    // Apples, Grapes, Coconut (count)
  'PACKAGING_NON_PERISHABLE'// Cups, Covers, Foil, Bottles, Labels
]);

export const shiftTypeEnum = pgEnum('shift_type', [
  'MORNING_SHIFT',
  'NIGHT_SHIFT'
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'INBOUND_PURCHASE',       // Supplier delivery into store
  'DISPENSE_PRODUCTION',    // Dispensed for morning/night shift batch
  'RETURN_FAULT_REPLACE',   // Defective item returned & replaced
  'RETURN_EXCESS_RESTOCK',  // Unused ingredient returned from shift
  'DISPOSAL_EXPIRED_SPOILT',// Written off stock
  'RECONCILIATION_ADJUST'   // Physical count audit correction
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'PENDING_VERIFICATION',
  'MATCHED_TO_DELIVERY',
  'PAYMENT_RECONCILED',
  'DISPUTED'
]);
```

### Table Relationships:
- `users` $\rightarrow$ Belongs to a `department`, assigned a `user_role`, possesses a 4-digit `quick_pin`.
- `items` $\rightarrow$ Defines category, unit of measure (`kg`, `g`, `cup`, `unit`), current stock balance, minimum reorder threshold.
- `item_lots` $\rightarrow$ Tracks supplier batch number, arrival date, expiry date, and unit cost.
- `stock_transactions` $\rightarrow$ Append-only ledger recording every addition, deduction, fault, and restock with shift ID and operator stamp.
- `shifts` & `shift_reconciliations` $\rightarrow$ Logs opening balance, items dispensed, items returned, physical closing count, and discrepancies.
- `retail_partners` & `sor_consignments` $\rightarrow$ Tracks supermarket deliveries, returns of expired yogurt parfaits, and outstanding cash settlements.
- `whatsapp_invoices` $\rightarrow$ Stores Cloudflare R2 file URLs, tags, total amounts, and reconciliation status.
- `audit_logs` $\rightarrow$ Immutable audit trail of every administrative and financial event.

---

## 8. PWA, Offline & Hardware Integration

1. **Service Worker Caching**:
   - Cache-First strategy for static branding assets, icons, fonts, and CSS.
   - Network-First with IndexedDB fallback for item catalogs and active shift sheets.
2. **Offline Shift Count Queue**:
   - If the warehouse loses internet connection during shift closing, the count is stored locally in IndexedDB (`idb-keyval`).
   - As soon as network connectivity is restored, the queued reconciliation payload is synced to `/api/inventory/shifts/sync` with optimistic confirmation.
3. **Camera Barcode & QR Scanner**:
   - Integrated camera viewfinder scanning standard retail EAN-13 barcodes on packaging cartons and custom 2D QR codes on raw material lots.
   - Instant vibration and audio feedback on scan match.

---

## 9. Security & Access Control (RBAC) Matrix

| Operational Capability | Super Admin | Executive | Store Manager | Store Officer | Production Supervisor |
|---|:---:|:---:|:---:|:---:|:---:|
| View Executive KPI Command Center | ✅ | ✅ | ❌ | ❌ | ❌ |
| View / Edit Supermarket SoR Ledger | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reconcile WhatsApp Invoices & Waybills | ✅ | ✅ | ❌ | ❌ | ❌ |
| Receive Raw Material Inbound (GRN) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Dispense Shift Ingredients (Batch BOM) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Acknowledge Received Shift Batch | ✅ | ❌ | ❌ | ❌ | ✅ |
| Log Fault Returns & Replacements | ✅ | ❌ | ✅ | ✅ | ✅ (Request) |
| Log Excess Returns (Restock) | ✅ | ❌ | ✅ | ✅ | ✅ (Request) |
| Submit Shift Closing Count | ✅ | ❌ | ✅ | ✅ | ❌ |
| Approve Stock Count Discrepancies | ✅ | ✅ | ✅ | ❌ | ❌ |
| User & Role Management | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 10. Operational Success Metrics (KPIs)

1. **Zero Unaccounted Inventory Variance**: Total unaccounted shift variance reduced to $< 0.5\%$ within 30 days of rollout.
2. **100% Shift Handover Compliance**: Digital Morning and Night shift sign-offs submitted with zero missing days.
3. **Accelerated SoR Collection**: Days Sales Outstanding (DSO) from retail supermarkets reduced by $40\%$ through automated expiry return credits and outstanding debt visibility.
4. **WhatsApp Invoice Zero Backlog**: Invoices reconciled within 24 hours of posting to WhatsApp.

---

## 11. Modular Subsystems Architecture (Phase 5)

Phase 5 introduces decoupled modular domain subsystems, establishing clean architectural boundaries and a central domain event bus (`eventBus.ts`):

### 11.1 Production Mixing Subsystem (`/production`)
- **Work Order Scheduling**: Schedule production runs for Day (08:00–18:00) and Night (18:00–08:00) shifts across Moh Yogurt Parfait, Greek Yogurt, and Vanilla Probiotic Drink.
- **Recipe Yield & Scrap Tracking**: Real-time tracking of theoretical BOM output vs actual unit packaging yield and scrap percentage (`yieldEfficiency`).
- **Machinery & Tank Status**: Core temperature monitoring of industrial mixing tanks and pasteurizers with CIP (Clean-in-Place) sanitation audit dates.
- **API Endpoints**: `/api/production/overview`, `/api/production/work-orders`, `/api/production/work-orders/:id/status`, `/api/production/work-orders/:id/yield`, `/api/production/equipment`.

### 11.2 Cold-Chain Logistics & Dispatch Subsystem (`/logistics`)
- **Fleet Directory**: Management of refrigerated delivery vans and trikes operating under strict NAFDAC cold-chain temperature compliance (2.0°C – 4.0°C). Automatic warning status when temperatures exceed 4.5°C.
- **Dispatch Manifests & Delivery Runs**: Multi-stop driver dispatching to retail stockists (Hubmart, Prince Ebeano, Justrite, Spar, Shoprite) with live in-transit temperature probe calibration.
- **Status Lifecycle**: `SCHEDULED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `DELIVERED_COLLECTING` $\rightarrow$ `RETURNED_RECONCILED`.
- **API Endpoints**: `/api/logistics/overview`, `/api/logistics/runs`, `/api/logistics/runs/:id/status`, `/api/logistics/fleet`, `/api/logistics/fleet/:id/temperature`.

### 11.3 Cross-Domain Event Bus (`eventBus.ts`)
Decoupled event emitter pattern supporting audit log subscriptions and inter-department messaging without circular dependencies:
- `PRODUCTION_WORK_ORDER_CREATED`
- `PRODUCTION_YIELD_RECONCILED`
- `LOGISTICS_RUN_DISPATCHED`
- `LOGISTICS_DELIVERY_CONFIRMED`
- `INVENTORY_DISPENSE_CONFIRMED`

### 11.4 Notification & Broadcast Subsystem (`/notifications`)
- **Centralized Event Inbox**: Real-time aggregation of inventory par-level breaches, Cold-Chain temperature alerts, and production handovers with severity filtering (`ALL`, `CRITICAL`, `WARNING`, `INFO`).
- **Interactive Triage**: Inline individual alert dismissal with `X` buttons and dismissal synchronization across the global notification center (`NotificationCenter.tsx`), top header alert banner (`TopNotificationBanner.tsx`), and dedicated triage dashboard.
- **Top Alert Banner**: High-priority ambient banner on dashboard layout with immediate action links and one-click dismissal.

---

## 12. Client Experience, PWA Hardware & Ergonomic Tooling

### 12.1 Enterprise Progressive Web App (PWA) Architecture & Mobile Install Engine (`pwa-provider.tsx`)
- **Native Next.js 16 Web Manifest (`src/app/manifest.ts`)**: Generates `/manifest.webmanifest` with MIME type `application/manifest+json`. Configures `id: "/?source=pwa"`, `start_url: "/login?source=pwa"`, `display: "standalone"`, `orientation: "portrait"`, and references both `any` and `maskable` icon sets.
- **Dedicated Android Adaptive Maskable Icons**: Features `public/icon-maskable-192.png` and `public/icon-maskable-512.png` generated with a 15% safe-zone margin to prevent circular or squircle Android WebAPK masking from cropping the corporate crest.
- **Service Worker v2 (`public/sw.js`) & Offline Fallback Shell (`public/offline.html`)**:
  - Pre-caches shell assets (`/manifest.json`, `/favicon.ico`, standard/maskable icons, `/Moh-Logo.png`, `/offline.html`) individually via `Promise.allSettled` to prevent redirect drops from failing worker installation.
  - Implements `skipWaiting()` and immediate client claim (`clients.claim()`).
  - Network-first navigation strategy with automatic fallback to `/offline.html` when network connectivity drops on the factory floor.
  - Stale-while-revalidate caching for static scripts, styles, and images.
- **Context-Aware Install Gate**:
  - **Standalone / Installed**: Directly serves the app cleanly with no prompts.
  - **Android / Chromium Secure Context**: 1-click **"Install MOH-OPS App"** button directly executing `deferredPrompt.prompt()`.
  - **Apple iOS Safari**: 2-step visual guidance (Share $\rightarrow$ Add to Home Screen) with dedicated `apple-touch-icon.png` (180x180).
  - **Insecure LAN HTTP Detection (`http://192.168.x.x`)**: Detects `window.isSecureContext === false` on mobile devices. Explains Chrome Android's security constraints (which prevent PWA WebAPK generation over raw HTTP) and provides a 1-tap **"Copy Origin URL"** button for `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, plus an HTTPS tunnel script (`bun run tunnel`).
  - **Staff Override**: Persistent "Continue in Browser" session bypass (`moh_force_install_bypassed`).

### 12.2 Client-Side Camera Photo Compression Engine (`imageOptimizer.ts`)
- **Automatic Downscaling & Compression**: Ingests multi-megapixel photos directly from mobile camera captures (frequently 8–15MB) and transparently downscales them (max dimension 1600px, JPEG quality 0.82) using an in-memory HTML5 Canvas pipeline.
- **Zero-Friction Ingestion**: Shrinks base64 storage payloads by ~90% (~250–400KB output) in under 50ms, eliminating "image size must be less than 2MB" errors across Material Intake, Recipe Builder, and Inventory Item modals.

### 12.3 Flexible Inventory Layout Toggle (Grid vs. Table)
- **Responsive Layout Control**: Store managers and floor staff can seamlessly toggle between a dense tabular list (`TABLE`) and a tactile visual card grid (`GRID`) via quick-action buttons on both desktop and mobile viewports.
- **State Persistence**: Selected layout mode is saved in client `localStorage` (`moh_stock_view_layout`) for immediate recall across sessions.

### 12.4 Official Branding Assets & Desktop PWA Installation
- **Unified Logo & Favicon**: Converted official corporate asset [`public/Moh-logo.png`](file:///home/th3mw/DEV/Moh%20Food/public/Moh-logo.png) to high-resolution 32-bit RGBA `.ico` (`favicon.ico`) and standard 192x192 / 512x512 PWA icons.
- **Desktop Sidebar 1-Click Installation**: Embedded a dedicated **Install MOH-OPS App** button in the stationary sidebar (`Sidebar.tsx`) that activates automatically on Chromium desktop/tablet browsers upon `beforeinstallprompt` detection.

