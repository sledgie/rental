# Graph Report - rental  (2026-10-14)

## Corpus Check
- Corpus is ~34,482 words - fits in a single context window. You may not need a graph.

## Summary
- 355 nodes · 1026 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Accounts UI & Ledger
- Root Package Config
- Property & Unit Fields
- Billing Forms
- Properties UI & Icons
- Server Dependencies
- Web Build Tooling
- Bill Schedule UI
- Ledger Reports Logic
- Tenants & Leases
- README Overview
- Page Design Specs
- App Shell & API Client
- Express Accounts Routes
- Bills & Schedules API
- Reports API
- DB Connection Layer
- Recurrence Engine
- Credit Notes API
- Accounting Pages
- Seed Data
- Add Tenant Page

## God Nodes (most connected - your core abstractions)
1. `rows()` - 30 edges
2. `text()` - 23 edges
3. `businessId()` - 21 edges
4. `Field()` - 21 edges
5. `Modal()` - 20 edges
6. `money()` - 19 edges
7. `useLoad()` - 18 edges
8. `HttpError` - 16 edges
9. `fail()` - 16 edges
10. `Status()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `CRA public index.html (Rental Manager)` --semantically_similar_to--> `Vite web index.html (Keystone)`  [INFERRED] [semantically similar]
  public/index.html → web/index.html
- `Dashboard page` --conceptually_related_to--> `web/ React + Vite app`  [INFERRED]
  design/Main.dc.html → README.md
- `Keystone rental prototype` --implements--> `Properties page design`  [INFERRED]
  prototype/rental-prototype.html → design/Properties.dc.html
- `Keystone rental prototype` --implements--> `Rent page design`  [INFERRED]
  prototype/rental-prototype.html → design/Rent.dc.html
- `Keystone rental prototype` --implements--> `Tenants page design`  [INFERRED]
  prototype/rental-prototype.html → design/Tenants.dc.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design pages sharing Keystone sidebar layout** — design_main_dc_dashboard, design_addtenant_dc_add_tenant, design_chartofaccounts_dc_chart_of_accounts, design_creditnotes_dc_credit_notes, design_creditnoteform_dc_credit_note_form, design_invoice_dc_send_rent_invoice [INFERRED 0.85]
- **Keystone design screens sharing sidebar and tenant/rent data** — design_properties_dc, design_rent_dc, design_tenants_dc, design_tenantaccount_dc, design_statement_dc [INFERRED 0.85]
- **Three-tier stack** — readme_web, readme_server, readme_oracle_freesql [EXTRACTED 1.00]
- **Schema generation pipeline** — readme_schema_prisma, tools_prisma_to_oracle, readme_database [EXTRACTED 1.00]

## Communities (23 total, 3 thin omitted)

### Community 0 - "Accounts UI & Ledger"
Cohesion: 0.23
Nodes (21): qs(), Accounts(), byCode(), descendants(), Ledger(), RANGE, suggest(), TYPES (+13 more)

### Community 1 - "Root Package Config"
Cohesion: 0.09
Nodes (22): browserslist, development, production, dependencies, react, react-dom, react-scripts, eslintConfig (+14 more)

### Community 2 - "Property & Unit Fields"
Cohesion: 0.16
Nodes (20): fields(), ADDRESS_REQUIRED, propFields(), PT, RI, TI, unitFields(), validateProperty() (+12 more)

### Community 3 - "Billing Forms"
Cohesion: 0.28
Nodes (20): FREQUENCIES, ScheduleForm(), todayStr(), UNITS, VendorPicker(), ContactDialog(), dialNumber(), AccountForm() (+12 more)

### Community 4 - "Properties UI & Icons"
Cohesion: 0.18
Nodes (18): BILL_TYPES, Icon(), PATHS, propertyHues(), Carousel(), ImageField(), Metric(), Properties() (+10 more)

### Community 5 - "Server Dependencies"
Cohesion: 0.10
Nodes (19): cors, oracledb, dependencies, cors, dotenv, express, oracledb, engines (+11 more)

### Community 6 - "Web Build Tooling"
Cohesion: 0.11
Nodes (18): vite, @vitejs/plugin-react, dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react (+10 more)

### Community 7 - "Bill Schedule UI"
Cohesion: 0.23
Nodes (16): DueBadge(), repeatText(), ScheduleRow(), useScheduleActions(), money(), money0(), BillSchedule(), needsAction() (+8 more)

### Community 8 - "Ledger Reports Logic"
Cohesion: 0.24
Nodes (17): balanceBy(), buildDashboard(), buildDrill(), col(), dollars(), inPeriod(), isCash(), lastColTotal() (+9 more)

### Community 9 - "Tenants & Leases"
Cohesion: 0.24
Nodes (17): coTenants(), join(), leaseOnUnit(), leave(), memberOf(), refreshLease(), RI, ROLE (+9 more)

### Community 10 - "README Overview"
Cohesion: 0.14
Nodes (13): Dashboard page, Keystone Rental Management README, Architecture: Browser -> Node API -> Oracle FreeSQL, database/ Oracle schema scripts, Keystone (placeholder name), Not built yet (login, payments, invoices, etc.), Oracle FreeSQL database, prototype/ and design/ (reference only) (+5 more)

### Community 11 - "Page Design Specs"
Cohesion: 0.14
Nodes (16): Properties page design, Property card (income, expenses, NOI, occupancy), Rent page design, Record payment form, Rent roll table, Tenant statement design, Tenant account page design, Tenant ledger (invoices, payments, credit notes, charges) (+8 more)

### Community 12 - "App Shell & API Client"
Cohesion: 0.18
Nodes (9): api, App(), PAGES, readHash(), store, ROLES, TABS, TSTATUS (+1 more)

### Community 13 - "Express Accounts Routes"
Cohesion: 0.18
Nodes (13): express, descendants(), router, validate(), router, app, properties, units (+5 more)

### Community 14 - "Bills & Schedules API"
Cohesion: 0.24
Nodes (14): BILL_TYPES, ensureBillAccount(), postBill(), insert(), newId(), tx(), ATTENTION, fields() (+6 more)

### Community 15 - "Reports API"
Cohesion: 0.41
Nodes (14): listAccounts(), businessId(), byProperty(), rows(), arByTenant(), dashboard(), drill(), householdBalances() (+6 more)

### Community 16 - "DB Connection Layer"
Cohesion: 0.22
Nodes (9): dotenv, closePool(), DATECOL, initPool(), ph(), query(), update(), withConn() (+1 more)

### Community 17 - "Recurrence Engine"
Cohesion: 0.33
Nodes (11): daysBetween(), iso(), LEAD_DAYS, nextAfter(), nthDate(), occurrences(), parse(), status() (+3 more)

### Community 18 - "Credit Notes API"
Cohesion: 0.29
Nodes (6): accountId(), router, STATUS, validate(), CURRENT_LEASE, HttpError

### Community 19 - "Accounting Pages"
Cohesion: 0.33
Nodes (6): Chart of Accounts page, Credit Note form page, Credit Notes list page, Send Rent Invoice page, New Account dialog, New Sub-account dialog

## Knowledge Gaps
- **21 isolated node(s):** `react`, `react-dom`, `react-scripts`, `react-app`, `react-app/jest` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Express Accounts Routes` to `Property & Unit Fields`, `Server Dependencies`, `Tenants & Leases`, `Bills & Schedules API`, `Credit Notes API`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `react`, `react-dom`, `react-scripts` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Root Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Why does `rows()` connect `Reports API` to `Property & Unit Fields`, `Tenants & Leases`, `Express Accounts Routes`, `Bills & Schedules API`, `DB Connection Layer`, `Recurrence Engine`, `Credit Notes API`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `Server Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Web Build Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `README Overview` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._