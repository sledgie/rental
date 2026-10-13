# Graph Report - rental  (2026-10-13)

## Corpus Check
- Corpus is ~23,817 words - fits in a single context window. You may not need a graph.

## Summary
- 256 nodes · 594 edges · 12 communities (10 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Express Accounts API
- React Web Client
- Root Package Config
- DB Pool & Checks
- Server Dependencies
- Vite Web Config
- Ledger Calculations
- Rent & Tenant Designs
- System Architecture
- Accounting & Invoice Designs
- Add Tenant Design

## God Nodes (most connected - your core abstractions)
1. `rows()` - 18 edges
2. `businessId()` - 13 edges
3. `text()` - 13 edges
4. `Accounts()` - 13 edges
5. `Tenants()` - 12 edges
6. `useLoad()` - 12 edges
7. `Dashboard()` - 11 edges
8. `Properties()` - 11 edges
9. `Modal()` - 11 edges
10. `buildDashboard()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `CRA public index.html (Rental Manager)` --semantically_similar_to--> `Vite web index.html (Keystone)`  [INFERRED] [semantically similar]
  public/index.html → web/index.html
- `Keystone rental prototype` --implements--> `Properties page design`  [INFERRED]
  prototype/rental-prototype.html → design/Properties.dc.html
- `Dashboard page` --conceptually_related_to--> `web/ React + Vite app`  [INFERRED]
  design/Main.dc.html → README.md
- `Not built yet features (auth, invoices, credit notes, etc.)` --references--> `Credit Notes list page`  [INFERRED]
  README.md → design/CreditNotes.dc.html
- `Not built yet features (auth, invoices, credit notes, etc.)` --references--> `Send Rent Invoice page`  [INFERRED]
  README.md → design/Invoice.dc.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design pages sharing Keystone sidebar layout** — design_main_dc_dashboard, design_addtenant_dc_add_tenant, design_chartofaccounts_dc_chart_of_accounts, design_creditnotes_dc_credit_notes, design_creditnoteform_dc_credit_note_form, design_invoice_dc_send_rent_invoice [INFERRED 0.85]
- **Keystone design screens sharing sidebar and tenant/rent data** — design_properties_dc, design_rent_dc, design_tenants_dc, design_tenantaccount_dc, design_statement_dc [INFERRED 0.85]

## Communities (12 total, 2 thin omitted)

### Community 0 - "Express Accounts API"
Cohesion: 0.10
Nodes (51): express, descendants(), fields(), listAccounts(), router, validate(), businessId(), byProperty() (+43 more)

### Community 1 - "React Web Client"
Cohesion: 0.13
Nodes (43): api, qs(), App(), PAGES, readRoute(), store, money(), money0() (+35 more)

### Community 2 - "Root Package Config"
Cohesion: 0.09
Nodes (22): browserslist, development, production, dependencies, react, react-dom, react-scripts, eslintConfig (+14 more)

### Community 3 - "DB Pool & Checks"
Cohesion: 0.15
Nodes (13): dotenv, closePool(), CURRENT_LEASE, DATECOL, initPool(), insert(), ph(), query() (+5 more)

### Community 4 - "Server Dependencies"
Cohesion: 0.10
Nodes (19): cors, oracledb, dependencies, cors, dotenv, express, oracledb, engines (+11 more)

### Community 5 - "Vite Web Config"
Cohesion: 0.11
Nodes (18): vite, @vitejs/plugin-react, dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react (+10 more)

### Community 6 - "Ledger Calculations"
Cohesion: 0.24
Nodes (17): balanceBy(), buildDashboard(), buildDrill(), col(), dollars(), inPeriod(), isCash(), lastColTotal() (+9 more)

### Community 7 - "Rent & Tenant Designs"
Cohesion: 0.14
Nodes (16): Properties page design, Property card (income, expenses, NOI, occupancy), Rent page design, Record payment form, Rent roll table, Tenant statement design, Tenant account page design, Tenant ledger (invoices, payments, credit notes, charges) (+8 more)

### Community 8 - "System Architecture"
Cohesion: 0.20
Nodes (7): Dashboard page, Browser - Node API - Oracle FreeSQL architecture, Oracle FreeSQL database (47 tables), Keystone Rental Management App, docs/schema.prisma data model, server/ Express + oracledb API, web/ React + Vite app

### Community 9 - "Accounting & Invoice Designs"
Cohesion: 0.33
Nodes (7): Chart of Accounts page, Credit Note form page, Credit Notes list page, Send Rent Invoice page, New Account dialog, New Sub-account dialog, Not built yet features (auth, invoices, credit notes, etc.)

## Knowledge Gaps
- **17 isolated node(s):** `react`, `react-dom`, `react-scripts`, `react-app`, `react-app/jest` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 83 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Express Accounts API` to `Server Dependencies`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Accounts()` (e.g. with `App.jsx` and `byCode()`) actually correct?**
  _`Accounts()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `react`, `react-dom`, `react-scripts` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Express Accounts API` be split into smaller, more focused modules?**
  _Cohesion score 0.1005260081823495 - nodes in this community are weakly interconnected._
- **Should `React Web Client` be split into smaller, more focused modules?**
  _Cohesion score 0.1318181818181818 - nodes in this community are weakly interconnected._
- **Should `Root Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Server Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._