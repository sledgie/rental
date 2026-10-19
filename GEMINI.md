# Keystone: Rental Property Management & Accounting System

Project memory and operational guide for Google Antigravity.

---

## 1. System Overview & Architecture

"Keystone" is a property management and double-entry accounting web application for residential/commercial rentals.

```
Browser (React 18 + Vite, web/) --/api--> Node.js API (server/, Express + oracledb) --SQL--> Oracle FreeSQL (23ai)
```

- **Frontend (`web/`)**: React 18, Vite 5, pure modular CSS / design tokens (`styles.css`, `shell.css`), hash routing (`#/dashboard`, `#/properties`, `#/tenants`, `#/accounts`, `#/credit-notes`, `#/vendors`, `#/bill-schedule`), lightweight custom API client (`web/src/api.js`).
- **Backend (`server/`)**: Node.js >= 18 (ESM), Express 4, `oracledb` 6.6+ in Thin Mode (pure JS/TLS, no Oracle Instant Client required).
- **Database (`database/`, `docs/`)**: Oracle Database (FreeSQL/23ai). Canonical data model is in `docs/schema.prisma` (47 tables), converted to Oracle SQL via `tools/prisma_to_oracle.py` into `database/schema_oracle.sql`. Incremental migration patches live in `database/add_*.sql`.
- **Root Legacy Files**: `package.json` and `src/components/` at the workspace root are remnants of an initial CRA prototype. Active development occurs in `server/` and `web/`.

---

## 2. Database & Data Access Patterns

- **UUIDs (`RAW(16)`)**:
  - Generated as 32-character uppercase hex strings (`newId()` via `crypto.randomUUID().replace(/-/g, '').toUpperCase()`).
  - Column names ending in `id` or matching `RAWCOL = /(^id$|_id$)/` must be wrapped with `HEXTORAW(:param)` in SQL statements.
  - Queries return RAW as hex via `RAWTOHEX(col) "colAlias"`.
- **Date Handling**:
  - ISO 8601 strings (`YYYY-MM-DD`).
  - Columns in `DATECOL` (`entry_date`, `start_date`, `end_date`, `move_in_date`, `move_out_date`, `terminated_at`, `available_on`, `issue_date`, `due_date`) must be bound with `TO_DATE(:param, 'YYYY-MM-DD')` and selected with `TO_CHAR(col, 'YYYY-MM-DD')`.
- **Multi-Tenancy & Scoping**:
  - Single business per database instance currently: `businessId()` queries the first business record from the `business` table.
  - All resource queries and mutations must be scoped by `business_id = HEXTORAW(:b)`.
- **Transactions & Connection Pooling**:
  - `tx(async (conn) => { ... })` executes operations in a single connection, automatically committing on success and rolling back on exceptions.
  - `withConn(fn)` for single reads/writes. Helper `rows(sql, binds)` returns execute results.

---

## 3. Core Domains & Business Logic

### A. Accounting & Pure Ledger Engine (`server/src/ledger.js`, `server/src/reports.js`)
- **Double-Entry Model**: Every financial transaction creates a `journal_entry` and two or more `journal_entry_line` records. Total Debits must equal total Credits.
- **Natural Balances (`nat(line)`)**:
  - `ASSET` and `EXPENSE`: debit - credit (`dr - cr`).
  - `LIABILITY`, `EQUITY`, `INCOME`: credit - debit (`cr - dr`).
- **Standard System Accounts**:
  - `1000` Operating Account (Bank)
  - `1100` Accounts Receivable (`AR`)
  - `2000` Accounts Payable (`AP`)
  - `2100` Security Deposits Held
  - `2200` Tenant Credits (`TENANT_CREDITS`)
  - `3000` Owner's Equity / `3900` Retained Earnings (`RETAINED_EARNINGS`)
  - `4000` Rental Income (`RENT_INCOME`)
  - `4900` Rent Adjustments (`RENT_ADJUSTMENTS`)
  - `5000` Repairs & Maintenance / `5100` Utilities / `5200` Insurance / `5300` Property Tax / `5400` Mortgage Interest
- **Key Financial Calculations**:
  - Net Operating Income (NOI): `income - opex` (where `opex` excludes `Financing` expenses like mortgage interest).
  - Cash Flow: Net changes in Bank accounts (`type === 'ASSET'`, `subtype === 'Bank'`, excluding opening balance entries).
  - Outstanding Rent: Natural balance of lines where `systemKey === 'AR'`.
  - Bills Due: Natural balance of lines where `systemKey === 'AP'`.

### B. Properties & Units (`server/src/properties.js`, `web/src/pages/Properties.jsx`)
- Property types: `SINGLE_FAMILY`, `MULTI_FAMILY`, `APARTMENT_BUILDING`, `CONDO`, `COMMERCIAL`, `MIXED_USE`, `OTHER`.
- Unit statuses: `OCCUPIED`, `VACANT`, `RESERVED`, `MAINTENANCE`, `UNAVAILABLE`.
- **Automatic Unit Synchronization (`syncUnit`)**:
  - Linked to current lease status:
    - Active lease (`status = 'ACTIVE'`) -> Unit is `OCCUPIED`.
    - Draft lease (`status = 'DRAFT'`) -> Unit is `RESERVED`.
    - No active/draft lease -> Unit is `VACANT`.
    - Units marked `MAINTENANCE` or `UNAVAILABLE` remain untouched.

### C. Tenants, Leases & Households (`server/src/tenants.js`, `server/src/leases.js`, `web/src/tenants/`)
- A lease connects one or more units (`lease_unit`) to one or more tenants (`lease_tenant`).
- **Tenant Roles**:
  - `PRIMARY`: Head of household, liable for full rent, receives invoices/statements (`lease.tenant_id`).
  - `CO_TENANT`: Co-signer / room-mate, jointly and severally liable, can make payments.
  - `OCCUPANT`: Resides in the unit (e.g., minor or dependent), zero financial liability (`balance = 0`).
- **Household Balance Calculation (`householdBalances`)**:
  - Outstanding rent is calculated across the entire lease household. Primary and co-tenants share visibility into the collective household AR balance.
- **Lease Lifecycle**:
  - `join()`: Adds primary or co-tenant to a lease. Creates draft lease if no lease exists.
  - `leave()`: Removes a tenant. If primary leaves, automatically promotes the next co-tenant; if no liable tenant remains, terminates lease and marks occupants as `PAST`.

### D. Utility Recharge & Expense Allocation (`server/src/recharge.js`, `server/src/leases.js`)
- Supported utilities: `electricity`, `water`, `internet`.
- Lease-level rules stored in `lease_utility` and `lease_utility_share`:
  - `LANDLORD`: Landlord absorbs 100% of the cost.
  - `TENANT`: 100% passed through to tenants.
  - `SPLIT`: Percentage split between landlord and tenants (`tenant_pct`).
- Tenant shares within the tenant portion can be equal or custom percentages (`lease_utility_share`).
- **Rounding without loss (`divide`)**: Any leftover cents from integer division are distributed sequentially to ensure line totals match exactly.
- **Posting Bills with Recharge (`postBill`)**:
  - Books Landlord Expense & AP: `Dr 51xx Expense / Cr 2000 AP`.
  - Recharges Tenants: `Dr 1100 AR (per tenant) / Cr 51xx Expense` (offsetting landlord expense so net expense equals landlord's portion).

### E. Bill Schedules & Recurrence Engine (`server/src/schedules.js`, `server/src/recurrence.js`)
- Repeating bill generator: `DAILY`, `WEEKLY`, `MONTHLY`, or `CUSTOM` (`every` N `DAY|WEEK|MONTH`).
- Month clamping: `nthDate` preserves day-of-month (e.g., Jan 31 -> Feb 28 -> Mar 31).
- States:
  - `overdue`: One or more unhandled occurrences prior to today.
  - `soon`: Next occurrence is within `LEAD_DAYS` (7 days).
  - `ok`: Next occurrence is > 7 days away.
  - `paused`: Schedule deactivated.
  - `done`: Reached end date with no pending occurrences.
- Actions: `post` (converts occurrence to a posted journal bill), `skip` (records run without posting bill), `skipAll`.

### F. Credit Notes (`server/src/creditNotes.js`, `web/src/pages/CreditNotes.jsx`)
- Represents business obligation to tenant (overpayment, rent concession).
- Issuing creates: `Dr 4900 Rent Adjustments / Cr 2200 Tenant Credits`.
- Voiding: Only permitted if `applied_cents === 0`. Creates a reversing journal entry (`source = 'REVERSAL'`) swapping debits and credits, marking original entry as `REVERSED`.

---

## 4. Key File Map

| Path | Purpose |
|---|---|
| `server/src/index.js` | Express app, middleware, route mounting, port binding |
| `server/src/db.js` | Connection pool, `withConn`, `tx`, `insert`, `update`, `newId`, Oracle types |
| `server/src/ledger.js` | Pure aggregation logic (NOI, cash flow, AR, AP, drill-downs) |
| `server/src/reports.js` | DB queries feeding the ledger aggregator |
| `server/src/properties.js` | Endpoints for `/api/properties` and `/api/units` |
| `server/src/tenants.js` | Endpoints for `/api/tenants`, lease joining, leaving, status sync |
| `server/src/leases.js` | Endpoints for `/api/leases/:id/units` and `/utilities` |
| `server/src/bills.js` | Bill posting and utility recharge journal entry generation |
| `server/src/schedules.js` | Bill schedule CRUD, status aggregation |
| `server/src/recurrence.js` | Pure recurrence date math (clamped month intervals, occurrences) |
| `server/src/recharge.js` | Tenant share calculation and exact integer rounding logic |
| `server/src/creditNotes.js` | Credit note issue, voiding, and reversal logic |
| `server/src/vendors.js` | Vendor directory and bill linkage |
| `web/src/App.jsx` | Client shell, topbar, sidebar, hash-route router, global property filter |
| `web/src/tenants/` | Modern tenant management suite (DataGrid, drawer, column customization, filters) |
| `web/src/pages/` | `Dashboard.jsx`, `Properties.jsx`, `Accounts.jsx`, `CreditNotes.jsx`, `Vendors.jsx`, `BillSchedule.jsx` |
| `database/schema_oracle.sql` | 47-table Oracle DDL schema |
| `docs/schema.prisma` | Upstream data model definition |
| `tools/prisma_to_oracle.py` | Schema generator script |

---

## 5. Development & Environment Notes

- **API Configuration**:
  - `server/.env` requires: `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING`.
  - Optional `AS_OF_DATE` (e.g. `2026-10-15`) pins `today()` for predictable test/demo runs.
  - Connection check: `cd server && npm run check`.
  - Seed demo data: `cd server && npm run seed` (or `npm run seed:reset` to clear and re-seed).
- **Web App**:
  - Development proxy: Vite proxies `/api` calls from `http://localhost:5173` to `http://localhost:3001`.
- **Roadmap / Not Yet Implemented**:
  1. Authentication & RBAC (currently serves single demo business without user auth).
  2. Rent payment collection & receipts.
  3. Automatic recurring rent charges.
  4. Tenant invoice PDF generation & emailing.
  5. Applying credit notes against open rent invoices.
  6. Bank feed / statement reconciliation.
  7. Electronic signature integration for leases.
