# Keystone: Rental Management (React + Vite web app, Node API, Oracle FreeSQL database)

"Keystone" is a placeholder name.

## How the pieces fit
    Browser (React + Vite, web/)  --/api-->  Node API (server/, Express + oracledb)  --SQL-->  Oracle FreeSQL

The browser never talks to the database. Database credentials live only in server/.env.

## Folders
| Folder | What it is |
|---|---|
| database/ | schema_oracle.sql (47 tables) and drop_all_oracle.sql, to run in FreeSQL |
| server/ | API: dashboard, chart of accounts, properties, units, tenants. Seed script and connection check |
| web/ | React + Vite app: Dashboard, Properties, Tenants, Chart of accounts |
| docs/schema.prisma | The data model in readable form. tools/prisma_to_oracle.py turns it into database/schema_oracle.sql |
| prototype/, design/ | The earlier single-file prototype and the design pages (reference only) |

## Setup (first time)
1. FreeSQL: open your worksheet, paste database/schema_oracle.sql and use Run Script.
2. API:
       cd server
       copy .env.example to .env and fill in ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
       npm install
       npm run check        (should say "Connected as ...")
       npm run seed         (loads demo data; "npm run seed:reset" wipes and reloads it)
       npm run dev          (API on http://localhost:3001)
3. Web (second terminal):
       cd web
       npm install
       npm run dev          (open http://localhost:5173)
Needs Node 18 or newer. oracledb runs in "thin" mode, so no Oracle client install is needed.

## Status: what was and was not tested
Tested: the dashboard calculations on the demo data (income $21,250, expenses $4,462, NOI $16,788, cash flow $13,288,
outstanding rent $4,250, occupancy 78%, every ledger entry balanced) and the syntax of every server and React file.
NOT tested: the SQL against a real Oracle database, npm install, or running the app. Expect to fix a few first-run errors.

## Not built yet
Login and roles (the API serves the single demo business with no authentication), rent charges and payments,
invoices, credit notes, bills, banking, documents, e-signatures, notifications. The database tables for them exist.
Do not store real tenant data until login is added and you have checked FreeSQL's terms.
