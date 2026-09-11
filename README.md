# Moh Foods NG - Enterprise Operations Platform (MOH-OPS)

[![Moh Foods NG](https://img.shields.io/badge/Enterprise-Moh%20Foods%20NG-D81B60?style=for-the-badge)](https://mohfood.com)
[![NAFDAC Reg No](https://img.shields.io/badge/NAFDAC%20REG-A8--106771-008153?style=for-the-badge)](https://mohfood.com)
[![Runtime](https://img.shields.io/badge/Runtime-Bun%201.2+-black?style=for-the-badge&logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016.3-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Hono](https://img.shields.io/badge/API-Hono%20RPC-E36002?style=for-the-badge&logo=hono)](https://hono.dev)
[![Database](https://img.shields.io/badge/Database-NeonDB%20Postgres-00E599?style=for-the-badge&logo=postgresql)](https://neon.tech)
[![Storage](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020?style=for-the-badge&logo=cloudflare)](https://cloudflare.com)

Welcome to **MOH-OPS**, the mission-critical internal operations platform developed for **Moh Industries Ltd / Moh Foods NG** ([mohfood.com](https://mohfood.com)), leading manufacturers and distributors of healthy dairy and fruit treats in Lagos & Ogun State, Nigeria.

This platform systematically eliminates manual paper logs, messy spreadsheets, and unorganized WhatsApp threads by providing an enterprise-grade, PWA-enabled management and warehouse operations system.

---

## 📑 Core Documentation Index

- **[Documentation.md](./Documentation.md)**: The authoritative Product Requirements Document (PRD), Technical Architecture, UI Design System, Database Schemas, and Operational Runbooks.
- **[Phases.md](./Phases.md)**: The Phased Engineering Roadmap, Sprints (Phase 0 through Phase 5), Acceptance Criteria, and Go-Live Milestones.

---

## 🎯 MVP Scope & Core Departments

While architected to power all 9 Moh Foods departments, the MVP delivers immediate operational mastery over the core bottlenecks:

### 1. 🏬 Inventory & Store Operations
- **Store Manager vs. Store Officer Distinction**:
  - **Store Manager**: Governance, inventory ledger reconciliation, recipe/BOM creation, bulk intake authorizations, discrepancy investigation, and scrap write-offs.
  - **Store Officer**: Plant floor physical custody, receiving supplier lots with inspection checks, weighing and dispensing daily recipe batches, physical shift counts, and handover locking.
- **Occasional Raw Material Inbound**: Ad-hoc supplier intake with lot number, expiry date, purchase price, and Cloudflare R2 waybill attachment.
- **Strict Material Classification**:
  - *Perishable Measured Products*: Milk (`kg`), Sugar (`kg`), Oats (`kg`), Raisins (`cups`/`kg`), Granola (`kg`), Vanilla extract (`L`) in high-precision decimal storage (`numeric(12, 3)`).
  - *Perishable Numbered Products*: Apples, Grapes, Whole Coconuts, Cashew nuts in discrete integer counts.
  - *Packaging / Non-Perishables*: Parfait cups & lids, Greek yogurt containers, Vanilla drink bottles, Aluminium foil rolls, Tamper-proof shrink bands, and barcode labels.
- **Daily Shift Batch Dispensing**: Morning Shift (06:00 - 14:30) and Night Shift (18:00 - 02:30) batch dispensing with Bill of Materials (BOM) guidance and dual sign-off.
- **Bi-Directional Returns**: Immediate replacement for factory faulty items (with scrap logging) vs excess ingredient restocks.
- **Shift Closing Stock Reconciliation**: Physical counts vs expected balances with variance flagging and digital handover locks.

### 2. 🧊 Product Storage Department (`PRODUCT_STORAGE`)
- **Finished Goods Cold Room (2°C – 4°C)**: Dedicated cold chamber for finished goods transferred from Kitchen Production before distribution.
- **Production Intake**: Receive finished yogurt parfait and Greek yogurt batches with batch codes, unit counts, and shelf-life tracking.
- **Logistics Dispatch Handover**: Dispense finished batches to dispatch riders and delivery drivers with digital waybill verification and photo proof saved to Cloudflare R2.

### 3. 🔍 Returns & Why Root Cause Ledger (`/returns`)
- **Unified Discrepancy Tracking**: Top-level audit section combining factory floor raw material scrap write-offs and supermarket retail Sale-or-Return (SoR) credit returns.
- **Root Cause Categorization**: Financial impact and failure analysis for *Expired on Shelf*, *Broken Seal / Packaging Flaw*, *Transit Crushed*, and *Excess Unmixed Restocks*.

### 4. 👔 Executive & Management Operations
- **Supermarket Sale or Return (SoR) Ledger**: Tracking retail stockist accounts across Lagos and Ogun State. Reconciling delivered yogurt parfaits against expired returns, calculating net sales, and tracking outstanding debt, featuring mobile-first touch cards (`sm:hidden`) and a widescreen data table (`hidden sm:block`).
- **Packaging Unit Preference Switcher**: Toggleable display between Packaged Warehouse Units (Cartons, Packs, Sleeves) and Raw Base Units (kg, pieces, sets) with `localStorage` persistence across Grid, Mobile List, and Desktop Table views.
- **Variable Produce Tagging (`🍇 Variable`)**: Clear visual badges for produce lots with indeterminate unit counts per master pack (e.g. grapes).
- **Live Operational Shift HUD Banner**: Dynamic header status bar displaying the synchronized plant shift (☀️ Morning / 🌙 Night), pulse liveness indicator, active duty officer name, and direct audit access to the shift handover ledger.
- **Executive Inventory Command Center**: 2x2 responsive KPI cards with toggleable **Table/List** vs **Grid** views and `localStorage` layout persistence.
- **WhatsApp Invoice Reconciliation Center**: Centralized drop-zone to ingest, store on Cloudflare R2, and reconcile WhatsApp delivery photos, waybills, and payment proofs.
- **Procurement & Par Levels**: Real-time buffer runway indicators with dual packaging/raw units display and direct supplier outreach shortcuts.
- **Universal Mobile Responsiveness**: Zero horizontal overflow on mobile viewports (360px–430px: Tecno CM6 & iPhone 16 PM), 2x2 metric KPI cards, touch-optimized button grids, and scrollable horizontal tabs across all 9 roles.
- **Web Push Alerts & Synthesized Audio Chimes**: Cross-platform Web Notification API integration with Service Worker routing, multi-channel permission dashboard, 30-minute anti-fatigue cooldowns for safety stock warnings, and offline 2-tone melodic chimes.

---

## 🎨 Moh Foods Design System & Brand Palette

Extracted from the Moh Foods corporate branding banner and official web properties:

| Color Token | Hex Code | Role in UI |
|---|---|---|
| `--brand-berry-primary` | `#D81B60` | Primary brand magenta/berry; action buttons, badges |
| `--brand-berry-dark` | `#AD1457` | Deep berry hover and active states |
| `--brand-lime-swoosh` | `#84BD00` | Banner top wave lime accent |
| `--brand-green-forest` | `#008153` | Website forest green; success, verified items |
| `--brand-peach` | `#FF9065` | Warm parfait fruit highlight |
| `--brand-dark-plum` | `#2B1B24` | Chocolate plum logo accent & high-contrast titles |
| `--brand-cream` | `#FFFDF9` | Wholesome yogurt off-white card backgrounds |

---

## 🏗️ Technical Architecture

- **Runtime & Package Manager**: [Bun](https://bun.sh) (Strictly required per project standards).
- **Frontend**: Next.js 16.3 with React Server Components (RSC) and Tailwind CSS v4.
- **Backend API**: [Hono](https://hono.dev) mounted at `/api` with type-safe RPC client (`hc`) and Zod validation.
- **Database**: [NeonDB](https://neon.tech) Serverless PostgreSQL paired with [Drizzle ORM](https://orm.drizzle.team).
- **Object Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) via `@aws-sdk/client-s3`.
- **PWA & Offline Worker**: `@serwist/next` with IndexedDB local-first shift queue.
- **Web Push Notifications & Audio Chimes**: Native Web Notification API with Service Worker integration (`/sw.js`) and synthesized zero-dependency Web Audio API 2-tone chime (587Hz -> 880Hz) for safety stock shortages, inbound material arrivals, and operational dispatches.
- **Authentication**: Custom Iron Session / signed HTTP-only cookies with Argon2id hashing and 4-digit tablet PIN switching.

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh) v1.2+ installed
- PostgreSQL connection string (NeonDB)
- Cloudflare R2 credentials (Account ID, Access Key, Secret Key, Bucket Name)

### Quick Setup
```bash
# 1. Clone repository
git clone <repo-url>
cd "Moh Food"

# 2. Install dependencies using Bun
bun install

# 3. Configure environment variables
cp .env.example .env.local

# 4. Push database schema to NeonDB
bun run db:push

# 5. Start development server
bun run dev
```

---

## 🏛️ Future Department Extensions (Roadmap)
The domain module structure (`src/modules/*`) provides ready-to-plug extension stubs for:
- 🏭 **Production**: Machine yield, recipe formulations, work orders.
- 🚚 **Logistics**: Waybill dispatches, delivery truck routes, driver drop-off logs.
- 💰 **Accounting**: General ledger, bank statement matching, tax reports.
- 🛒 **Merchandisers**: Mobile shelf inspection and supermarket expiry monitoring.
- 🧼 **Cleaners**: Daily facility sanitization and HACCP hygiene checklists.
- 📢 **Media**: Marketing campaign scheduling and brand asset storage.
- 📦 **Procurement**: Formal RFQs and purchase order pipelines.

---

*Engineered by the Moh Foods IT & Systems Department.*
