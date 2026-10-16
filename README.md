# Keystone: Rental Management (React + Vite web app, Node API, Supabase (PostgreSQL) database)

"Keystone" is a placeholder name.

## How the pieces fit
    Browser (React + Vite, web/)  --/api-->  Node API (server/, Express + pg)  --SQL-->  Supabase

The browser never talks to the database. Database credentials live only in server/.env.

## Folders
| Folder | What it is |
|---|---|
| database/ | schema_supabase.sql (50 tables) and drop_all_supabase.sql, to run in the Supabase SQL Editor |
| server/ | API: dashboard, chart of accounts, properties, units, tenants, credit notes, vendors, property bills and bill schedules. Seed script and connection check |
| web/ | React + Vite app: Dashboard, Properties, Tenants, Chart of accounts |
| docs/schema.prisma | The data model in readable form (database/schema_supabase.sql is the SQL actually run) |
| prototype/, design/ | The earlier single-file prototype and the design pages (reference only) |

## Setup (first time)
1. Supabase: open the SQL Editor, paste database/schema_supabase.sql and run it.
2. API:
       cd server
       copy .env.example to .env and set DATABASE_URL to your Supabase connection string (Project Settings > Database)
       npm install
       npm run check        (should say "Connected to postgres as ...")
       npm run seed         (loads demo data; "npm run seed:reset" wipes and reloads it)
       npm run dev          (API on http://localhost:3001)
3. Web (second terminal):
       cd web
       npm install
       npm run dev          (open http://localhost:5173)
Needs Node 18 or newer. The API connects straight to Supabase Postgres with the pg driver; the browser never gets the database credentials.

## Status: what was and was not tested
Tested: the dashboard calculations on the demo data (income $21,250, expenses $4,462, NOI $16,788, cash flow $13,288,
outstanding rent $4,250, occupancy 78%, every ledger entry balanced) and the syntax of every server and React file.
The server was exercised against a local PostgreSQL 16 (schema, seed, and every API route including writes). Not yet run against a real Supabase project.

## Not built yet
Login and roles (the API serves the single demo business with no authentication), rent charges and payments,
invoices, applying credit notes to rent charges, bills, banking, documents, e-signatures, notifications. The database tables for them exist.
Do not store real tenant data until login is added and you have checked Supabase's terms and security settings (the schema enables Row Level Security with no policies, so Supabase's public API exposes nothing).
