-- =====================================================================================================================
-- 004_accounting.sql
-- Chart of accounts, double-entry journal, receivables (invoices, payments, credit notes), expenses and utility bills,
-- bank accounts + reconciliation, security deposits.
--
-- Financial integrity rules enforced here (not only in the UI):
--   * Journal entries are created as drafts and POSTED once; a posted entry must balance, have >= 2 lines, use active posting
--     accounts and respect the organization's books-closed date. Posted entries/lines are immutable; mistakes are fixed by
--     reversal entries (public.reverse_journal_entry).
--   * Issued invoices are immutable (void + credit note instead). Payments can only be reversed, never edited or deleted.
--   * Payment allocations, credit applications, refunds, bill payments are validated against what is actually outstanding,
--     under row locks, so concurrent requests cannot over-apply money.
--   * Recurring rent invoices cannot be generated twice for the same lease and billing period.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------------------------------------------------
create table public.accounts (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  code                 text not null check (code ~ '^[0-9A-Za-z.\-]{1,20}$'),
  name                 text not null check (btrim(name) <> ''),
  parent_id            uuid,
  account_type         text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'operating_cost', 'administrative_expense', 'other_income', 'other_expense')),
  classification       text,
  normal_balance       text not null check (normal_balance in ('debit', 'credit')),
  role                 text not null default 'posting' check (role in ('group', 'posting')),
  allow_direct_posting boolean not null default true,        -- may be used on MANUAL journal entries
  status               text not null default 'active' check (status in ('active', 'inactive')),
  description          text,
  tax_code             text,
  opening_balance      numeric(14,2),
  sort_order           integer not null default 0,
  system_key           text check (system_key is null or system_key ~ '^[a-z_]+$'),   -- stable key used by posting functions
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (organization_id, system_key),
  foreign key (organization_id, parent_id) references public.accounts (organization_id, id) on delete restrict,
  check (parent_id is distinct from id)
);
create index accounts_parent_idx on public.accounts (organization_id, parent_id, sort_order);
create index accounts_type_idx on public.accounts (organization_id, account_type, status);

-- Tree rules: parents are group accounts, depth <= 8, no cycles.
create or replace function private.check_account_tree() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_depth int;
  v_cycle boolean;
  v_parent_role text;
begin
  if new.parent_id is null then return new; end if;
  select role into v_parent_role from public.accounts where organization_id = new.organization_id and id = new.parent_id;
  if v_parent_role is distinct from 'group' then
    raise exception 'The parent of an account must be a group account' using errcode = '23514';
  end if;
  with recursive up(id, parent_id, depth) as (
    select a.id, a.parent_id, 1 from public.accounts a where a.organization_id = new.organization_id and a.id = new.parent_id
    union all
    select a.id, a.parent_id, up.depth + 1 from public.accounts a join up on a.id = up.parent_id and a.organization_id = new.organization_id
     where up.depth < 20)
  select coalesce(max(depth), 0), coalesce(bool_or(id = new.id), false) into v_depth, v_cycle from up;
  if v_cycle then raise exception 'An account cannot be moved under its own descendant' using errcode = '23514'; end if;
  if v_depth + 1 > 8 then raise exception 'The chart of accounts is limited to 8 levels' using errcode = '23514'; end if;
  return new;
end $$;
create trigger accounts_tree before insert or update of parent_id on public.accounts for each row execute function private.check_account_tree();

-- Once an account has journal lines its classification can no longer change (history would silently re-state).
create or replace function private.accounts_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.account_type is distinct from old.account_type or new.normal_balance is distinct from old.normal_balance or new.role is distinct from old.role)
     and exists (select 1 from public.journal_entry_lines l where l.organization_id = old.organization_id and l.account_id = old.id) then
    raise exception 'Account % already has postings: its type, normal balance and role cannot change', old.code using errcode = '23514';
  end if;
  return new;
end $$;
create trigger accounts_guard before update on public.accounts for each row execute function private.accounts_guard();

create table public.expense_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name            text not null check (btrim(name) <> ''),
  account_id      uuid not null,                          -- default GL expense account
  is_active       boolean not null default true,
  unique (organization_id, id),
  unique (organization_id, name),
  foreign key (organization_id, account_id) references public.accounts (organization_id, id) on delete restrict
);
alter table public.properties
  add constraint properties_default_expense_category_fk foreign key (organization_id, default_expense_category_id)
  references public.expense_categories (organization_id, id) on delete set null (default_expense_category_id);

create table public.catalog_items (                       -- billable / creditable items ("Rent overpayment", "Late fee waiver")
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name            text not null,
  description     text,
  rate            numeric(14,2) not null default 0 check (rate >= 0),
  account_id      uuid not null,
  is_active       boolean not null default true,
  unique (organization_id, id),
  unique (organization_id, name),
  foreign key (organization_id, account_id) references public.accounts (organization_id, id) on delete restrict
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Bank accounts (each maps to an asset/liability GL account)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.bank_accounts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  name                  text not null check (btrim(name) <> ''),
  institution           text,
  last4                 char(4) check (last4 is null or last4 ~ '^[0-9A-Za-z]{4}$'),   -- never store full account numbers
  account_type          text not null default 'operating' check (account_type in ('operating', 'trust', 'reserve', 'restricted', 'other')),
  currency              char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  gl_account_id         uuid not null,
  opening_balance       numeric(14,2) not null default 0,
  opening_balance_date  date,
  is_active             boolean not null default true,
  purpose               text,
  property_id           uuid,
  classification        text,
  notes                 text,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, gl_account_id),
  foreign key (organization_id, gl_account_id) references public.accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete set null (property_id)
);
create or replace function private.check_bank_gl_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.accounts a where a.organization_id = new.organization_id and a.id = new.gl_account_id
                    and a.account_type in ('asset', 'liability') and a.role = 'posting') then
    raise exception 'A bank account must map to an asset or liability posting account' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger bank_accounts_gl_check before insert or update of gl_account_id on public.bank_accounts for each row execute function private.check_bank_gl_account();

-- ---------------------------------------------------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------------------------------------------------
create table public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_number    bigint,
  entry_date      date not null,
  memo            text,
  source          text not null default 'manual'
                    check (source in ('manual', 'invoice', 'payment', 'payment_reversal', 'refund', 'credit_note', 'credit_application', 'expense', 'bill',
                                      'bill_payment', 'bank_transaction', 'transfer', 'deposit', 'recurring', 'reversal', 'opening', 'adjustment')),
  source_table    text,
  source_id       uuid,
  status          text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  reversal_of_id  uuid,
  posted_at       timestamptz,
  posted_by       uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, entry_number),
  unique (organization_id, reversal_of_id),
  foreign key (organization_id, reversal_of_id) references public.journal_entries (organization_id, id) on delete restrict
);
create index journal_entries_date_idx on public.journal_entries (organization_id, entry_date, id);
create index journal_entries_source_idx on public.journal_entries (organization_id, source_table, source_id) where source_id is not null;
create index journal_entries_status_idx on public.journal_entries (organization_id, status);

create table public.journal_entry_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  entry_id        uuid not null,
  line_number     integer not null default 0,
  account_id      uuid not null,
  debit           numeric(14,2) not null default 0 check (debit >= 0),
  credit          numeric(14,2) not null default 0 check (credit >= 0),
  memo            text,
  entry_date      date not null,                           -- denormalised from the entry for fast reporting (set by trigger)
  property_id     uuid,
  unit_id         uuid,
  tenant_id       uuid,
  lease_id        uuid,
  vendor_id       uuid,
  bank_account_id uuid,
  project_id      uuid,                                    -- FK added in 005 (projects)
  unique (organization_id, id),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  foreign key (organization_id, entry_id) references public.journal_entries (organization_id, id) on delete cascade,
  foreign key (organization_id, account_id) references public.accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete restrict,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict
);
create index jel_entry_idx    on public.journal_entry_lines (organization_id, entry_id);
create index jel_account_idx  on public.journal_entry_lines (organization_id, account_id, entry_date);
create index jel_property_idx on public.journal_entry_lines (organization_id, property_id, entry_date) where property_id is not null;
create index jel_unit_idx     on public.journal_entry_lines (organization_id, unit_id, entry_date) where unit_id is not null;
create index jel_tenant_idx   on public.journal_entry_lines (organization_id, tenant_id, entry_date) where tenant_id is not null;
create index jel_bank_idx     on public.journal_entry_lines (organization_id, bank_account_id, entry_date) where bank_account_id is not null;

create or replace function private.journal_entry_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_closed date;
  v_lines int;
  v_debit numeric;
  v_credit numeric;
begin
  if tg_op = 'INSERT' then
    if new.entry_number is null then new.entry_number := private.next_number(new.organization_id, 'journal'); end if;
    new.status := 'draft';                                  -- entries are always created as drafts and posted explicitly
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    return new;
  elsif tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from public.organizations o where o.id = old.organization_id) then
      raise exception 'Posted journal entries cannot be deleted; reverse them instead' using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status = 'draft' then
    if new.status = 'posted' then
      select o.books_closed_through into v_closed from public.organizations o where o.id = new.organization_id;
      if v_closed is not null and new.entry_date <= v_closed then
        raise exception 'The books are closed through % (entry dated %)', v_closed, new.entry_date using errcode = '23514';
      end if;
      select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0) into v_lines, v_debit, v_credit
        from public.journal_entry_lines where organization_id = new.organization_id and entry_id = new.id;
      if v_lines < 2 then raise exception 'A journal entry needs at least two lines' using errcode = '23514'; end if;
      if v_debit <> v_credit then raise exception 'Journal entry does not balance (debits %, credits %)', v_debit, v_credit using errcode = '23514'; end if;
      new.posted_at := now();
      new.posted_by := (select auth.uid());
    elsif new.status <> 'draft' then
      raise exception 'A draft entry can only be posted' using errcode = '23514';
    end if;
    return new;
  elsif old.status = 'posted' and new.status = 'reversed'
        and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;                                             -- the only allowed change to a posted entry
  end if;
  raise exception 'Posted journal entries are immutable' using errcode = '42501';
end $$;
create trigger journal_entries_guard before insert or update or delete on public.journal_entries for each row execute function private.journal_entry_guard();

create or replace function private.journal_line_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_entry public.journal_entries%rowtype;
  v_account public.accounts%rowtype;
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
begin
  select * into v_entry from public.journal_entries where organization_id = v_org and id = v_entry_id;
  if not found then return coalesce(new, old); end if;      -- entry is being cascaded away
  if v_entry.status <> 'draft' then
    raise exception 'Lines of a posted journal entry cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  select * into v_account from public.accounts where organization_id = new.organization_id and id = new.account_id;
  if v_account.role <> 'posting' or v_account.status <> 'active' then
    raise exception 'Account % is not an active posting account', v_account.code using errcode = '23514';
  end if;
  if v_entry.source = 'manual' and not v_account.allow_direct_posting then
    raise exception 'Account % does not allow manual postings', v_account.code using errcode = '23514';
  end if;
  new.entry_date := v_entry.entry_date;
  return new;
end $$;
create trigger journal_lines_guard before insert or update or delete on public.journal_entry_lines for each row execute function private.journal_line_guard();

-- Keep denormalised line dates in step if a DRAFT entry is re-dated.
create or replace function private.journal_entry_redate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.entry_date is distinct from old.entry_date and new.status = 'draft' then
    update public.journal_entry_lines set entry_date = new.entry_date where organization_id = new.organization_id and entry_id = new.id;
  end if;
  return null;
end $$;
create trigger journal_entries_redate after update of entry_date on public.journal_entries for each row execute function private.journal_entry_redate();

-- Create (and optionally post) a balanced entry in one transaction. p_lines: [{account_id|account_code, debit, credit, memo, property_id, ...}]
create or replace function public.create_journal_entry(
  p_org uuid, p_date date, p_memo text, p_lines jsonb, p_post boolean default true, p_source text default 'manual'
) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_line jsonb;
  v_account uuid;
  v_n int := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'p_lines must be a JSON array with at least two lines' using errcode = '22023';
  end if;
  insert into public.journal_entries (id, organization_id, entry_date, memo, source) values (v_id, p_org, p_date, p_memo, p_source);
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    v_account := coalesce((v_line ->> 'account_id')::uuid,
                          (select a.id from public.accounts a where a.organization_id = p_org and a.code = v_line ->> 'account_code'));
    insert into public.journal_entry_lines (organization_id, entry_id, line_number, account_id, debit, credit, memo, entry_date,
                                            property_id, unit_id, tenant_id, lease_id, vendor_id, bank_account_id)
    values (p_org, v_id, v_n, v_account, coalesce((v_line ->> 'debit')::numeric, 0), coalesce((v_line ->> 'credit')::numeric, 0), v_line ->> 'memo', p_date,
            (v_line ->> 'property_id')::uuid, (v_line ->> 'unit_id')::uuid, (v_line ->> 'tenant_id')::uuid, (v_line ->> 'lease_id')::uuid,
            (v_line ->> 'vendor_id')::uuid, (v_line ->> 'bank_account_id')::uuid);
  end loop;
  if p_post then update public.journal_entries set status = 'posted' where organization_id = p_org and id = v_id; end if;
  return v_id;
end $$;

create or replace function public.reverse_journal_entry(p_entry uuid, p_date date default current_date, p_memo text default null) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_old public.journal_entries%rowtype;
  v_new uuid := gen_random_uuid();
begin
  select * into v_old from public.journal_entries where id = p_entry for update;
  if not found then raise exception 'journal entry not found' using errcode = 'P0002'; end if;
  if v_old.status <> 'posted' then raise exception 'only a posted entry can be reversed' using errcode = '22023'; end if;
  insert into public.journal_entries (id, organization_id, entry_date, memo, source, reversal_of_id)
  values (v_new, v_old.organization_id, p_date, coalesce(p_memo, 'Reversal of entry #' || v_old.entry_number), 'reversal', v_old.id);
  insert into public.journal_entry_lines (organization_id, entry_id, line_number, account_id, debit, credit, memo, entry_date,
                                          property_id, unit_id, tenant_id, lease_id, vendor_id, bank_account_id, project_id)
  select organization_id, v_new, line_number, account_id, credit, debit, memo, p_date, property_id, unit_id, tenant_id, lease_id, vendor_id, bank_account_id, project_id
    from public.journal_entry_lines where organization_id = v_old.organization_id and entry_id = v_old.id;
  update public.journal_entries set status = 'posted' where id = v_new;
  update public.journal_entries set status = 'reversed' where id = v_old.id;
  return v_new;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Receivables: invoices, payments, allocations, credit notes
-- ---------------------------------------------------------------------------------------------------------------------
create table public.invoices (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  invoice_number         text,
  tenant_id              uuid not null,
  lease_id               uuid,
  property_id            uuid,
  unit_id                uuid,
  invoice_type           text not null default 'rent' check (invoice_type in ('rent', 'utilities', 'maintenance', 'late_fee', 'deposit', 'other')),
  -- paid / partially_paid / overdue are DERIVED (v_invoice_balances); only the workflow state is stored
  status                 text not null default 'draft' check (status in ('draft', 'pending_approval', 'open', 'void')),
  issue_date             date not null default current_date,
  due_date               date not null,
  billing_period_start   date,
  billing_period_end     date,
  currency               char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  discount               numeric(14,2) not null default 0 check (discount >= 0),
  memo                   text,
  sent_at                timestamptz,
  viewed_at              timestamptz,
  voided_at              timestamptz,
  void_reason            text,
  journal_entry_id       uuid,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, invoice_number),
  check (billing_period_end is null or billing_period_start is null or billing_period_end >= billing_period_start),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create trigger invoices_number before insert on public.invoices for each row execute function private.assign_number('invoice_number', 'invoice', 'INV-', '5');
create index invoices_tenant_idx on public.invoices (organization_id, tenant_id, due_date);
create index invoices_due_idx    on public.invoices (organization_id, due_date) where status = 'open';
create index invoices_lease_idx  on public.invoices (organization_id, lease_id) where lease_id is not null;
create index invoices_property_idx on public.invoices (organization_id, property_id, issue_date) where property_id is not null;
-- Recurring billing cannot create two rent invoices for the same lease and billing period.
create unique index invoices_one_rent_per_period on public.invoices (organization_id, lease_id, billing_period_start)
  where invoice_type = 'rent' and status <> 'void' and lease_id is not null and billing_period_start is not null;

create table public.invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id      uuid not null,
  position        integer not null default 0,
  description     text not null,
  category        text not null default 'other' check (category in ('rent', 'utilities', 'maintenance', 'parking', 'storage', 'fees', 'other')),
  quantity        numeric(12,3) not null default 1 check (quantity > 0),
  unit_price      numeric(14,2) not null check (unit_price >= 0),
  tax_rate        numeric(6,3) not null default 0 check (tax_rate between 0 and 100),   -- percent, e.g. 13 for HST
  account_id      uuid,
  subtotal        numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount      numeric(14,2) generated always as (round(quantity * unit_price * tax_rate / 100, 2)) stored,
  unique (organization_id, id),
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete cascade,
  foreign key (organization_id, account_id) references public.accounts (organization_id, id) on delete restrict
);
create index invoice_lines_invoice_idx on public.invoice_lines (organization_id, invoice_id, position);

create table public.invoice_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id      uuid not null,
  author_id       uuid references public.profiles (id) on delete set null,
  body            text not null,
  pinned          boolean not null default false,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete cascade
);
create index invoice_notes_invoice_idx on public.invoice_notes (organization_id, invoice_id, created_at);

create or replace function private.invoice_total(p_invoice uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.subtotal + l.tax_amount), 0) - coalesce((select i.discount from public.invoices i where i.id = p_invoice), 0)
    from public.invoice_lines l where l.invoice_id = p_invoice;
$$;
revoke all on function private.invoice_total(uuid) from public, anon;
grant execute on function private.invoice_total(uuid) to authenticated, service_role;

create or replace function private.invoice_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from public.organizations o where o.id = old.organization_id) then
      raise exception 'Only draft invoices can be deleted; void the invoice instead' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status in ('open', 'void') then
    if old.status = 'void' then raise exception 'A void invoice cannot be changed' using errcode = '42501'; end if;
    -- issued invoices: only workflow fields may change (sending, viewing, voiding, memo)
    if new.status not in ('open', 'void')
       or (to_jsonb(new) - array['status','sent_at','viewed_at','voided_at','void_reason','memo','updated_at']) is distinct from
          (to_jsonb(old) - array['status','sent_at','viewed_at','voided_at','void_reason','memo','updated_at']) then
      raise exception 'An issued invoice cannot be edited; void it and issue a new one' using errcode = '42501';
    end if;
    if new.status = 'void' then
      if exists (select 1 from public.payment_allocations a join public.payments p on p.id = a.payment_id where a.invoice_id = old.id and p.status = 'posted')
         or exists (select 1 from public.credit_note_applications c where c.invoice_id = old.id) then
        raise exception 'Reverse the payments and credit applications on this invoice before voiding it' using errcode = '23514';
      end if;
      new.voided_at := coalesce(new.voided_at, now());
    end if;
  elsif old.status in ('draft', 'pending_approval') and new.status = 'void' then
    new.voided_at := coalesce(new.voided_at, now());
  end if;
  return new;
end $$;
create trigger invoices_guard before update or delete on public.invoices for each row execute function private.invoice_guard();

create or replace function private.invoice_line_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_inv uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select status into v_status from public.invoices where organization_id = v_org and id = v_inv;
  if v_status is null then return coalesce(new, old); end if;     -- parent being cascaded away
  if v_status not in ('draft', 'pending_approval') then
    raise exception 'Lines of an issued invoice cannot be changed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines for each row execute function private.invoice_line_guard();

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  payment_number     text,
  receipt_number     text,
  tenant_id          uuid not null,
  lease_id           uuid,
  payment_date       date not null default current_date,
  method             text not null check (method in ('etransfer', 'cash', 'card', 'cheque', 'bank_transfer', 'pre_authorized_debit', 'other')),
  amount             numeric(14,2) not null check (amount > 0),
  currency           char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  reference          text,
  notes              text,
  status             text not null default 'posted' check (status in ('posted', 'reversed')),
  bank_account_id    uuid,
  idempotency_key    text,
  recorded_by        uuid references public.profiles (id) on delete set null,
  receipt_issued_at  timestamptz,
  reversed_at        timestamptz,
  reversed_by        uuid references public.profiles (id) on delete set null,
  reversal_reason    text,
  journal_entry_id   uuid,
  created_at         timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, payment_number),
  unique (organization_id, receipt_number),
  unique (organization_id, idempotency_key),
  check ((status = 'reversed') = (reversed_at is not null)),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete restrict,
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create trigger payments_number before insert on public.payments for each row execute function private.assign_number('payment_number', 'payment', 'PAY-', '5');
create index payments_tenant_idx on public.payments (organization_id, tenant_id, payment_date desc);
create index payments_date_idx   on public.payments (organization_id, payment_date desc);
create index payments_lease_idx  on public.payments (organization_id, lease_id) where lease_id is not null;

-- Payments are never edited or deleted. The only allowed change is a reversal (status posted -> reversed with reason) or issuing the receipt.
create or replace function private.payment_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.organizations o where o.id = old.organization_id) then
      raise exception 'Payments cannot be deleted; reverse the payment instead' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'reversed' then raise exception 'A reversed payment cannot be changed' using errcode = '42501'; end if;
  if old.journal_entry_id is not null and new.journal_entry_id is distinct from old.journal_entry_id then
    raise exception 'The ledger posting of a payment cannot be replaced' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status','reversed_at','reversed_by','reversal_reason','receipt_number','receipt_issued_at','notes','journal_entry_id'])
     is distinct from (to_jsonb(old) - array['status','reversed_at','reversed_by','reversal_reason','receipt_number','receipt_issued_at','notes','journal_entry_id']) then
    raise exception 'Payment amounts, dates and parties cannot be edited' using errcode = '42501';
  end if;
  if new.status = 'reversed' then
    if coalesce(btrim(new.reversal_reason), '') = '' then raise exception 'A reversal reason is required' using errcode = '23514'; end if;
    new.reversed_at := coalesce(new.reversed_at, now());
    new.reversed_by := coalesce(new.reversed_by, (select auth.uid()));
  end if;
  return new;
end $$;
create trigger payments_guard before update or delete on public.payments for each row execute function private.payment_guard();

create table public.credit_notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  credit_number     text,
  tenant_id         uuid not null,
  lease_id          uuid,
  invoice_id        uuid,                                  -- invoice the credit relates to (optional)
  source_payment_id uuid,                                  -- set when the credit came from an overpayment
  reference_number  text,
  subject           text,
  status            text not null default 'draft' check (status in ('draft', 'open', 'void')),   -- applied / partially applied are derived
  issue_date        date not null default current_date,
  amount            numeric(14,2) not null check (amount > 0),
  reason            text,
  customer_notes    text,
  terms             text,
  auto_apply        boolean not null default false,
  voided_at         timestamptz,
  journal_entry_id  uuid,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, credit_number),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete restrict,
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete set null (invoice_id),
  foreign key (organization_id, source_payment_id) references public.payments (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create trigger credit_notes_number before insert on public.credit_notes for each row execute function private.assign_number('credit_number', 'credit_note', 'CN-', '5');
create index credit_notes_tenant_idx on public.credit_notes (organization_id, tenant_id, issue_date);

create table public.credit_note_lines (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  credit_note_id  uuid not null,
  item_id         uuid,
  account_id      uuid not null,
  description     text,
  quantity        numeric(12,2) not null default 1 check (quantity > 0),
  rate            numeric(14,2) not null default 0 check (rate >= 0),
  discount        numeric(14,2) not null default 0 check (discount >= 0),
  amount          numeric(14,2) generated always as (round(quantity * rate, 2) - discount) stored,
  position        integer not null default 0,
  foreign key (organization_id, credit_note_id) references public.credit_notes (organization_id, id) on delete cascade,
  foreign key (organization_id, item_id) references public.catalog_items (organization_id, id) on delete set null (item_id),
  foreign key (organization_id, account_id) references public.accounts (organization_id, id) on delete restrict
);
create index credit_note_lines_idx on public.credit_note_lines (organization_id, credit_note_id, position);

create table public.payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  payment_id      uuid not null,
  invoice_id      uuid not null,
  amount          numeric(14,2) not null check (amount > 0),
  created_at      timestamptz not null default now(),
  unique (payment_id, invoice_id),
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete restrict,
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete restrict
);
create index payment_allocations_invoice_idx on public.payment_allocations (organization_id, invoice_id);

create table public.payment_refunds (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  payment_id       uuid not null,
  amount           numeric(14,2) not null check (amount > 0),
  reason           text not null check (btrim(reason) <> ''),
  refund_method    text,
  reference        text,
  refunded_on      date not null default current_date,
  refunded_by      uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create index payment_refunds_payment_idx on public.payment_refunds (organization_id, payment_id);

create table public.credit_note_applications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  credit_note_id   uuid not null,
  invoice_id       uuid not null,
  amount           numeric(14,2) not null check (amount > 0),
  applied_on       date not null default current_date,
  applied_by       uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, credit_note_id) references public.credit_notes (organization_id, id) on delete restrict,
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create index credit_note_applications_invoice_idx on public.credit_note_applications (organization_id, invoice_id);
create index credit_note_applications_credit_idx on public.credit_note_applications (organization_id, credit_note_id);

-- Allocation / application / refund validation (row-locks parents so concurrent writers serialise) ----------------------------
create or replace function private.validate_payment_allocation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments%rowtype;
  v_inv public.invoices%rowtype;
  v_allocated numeric;
  v_refunded numeric;
  v_inv_paid numeric;
  v_inv_credits numeric;
begin
  select * into v_pay from public.payments where organization_id = new.organization_id and id = new.payment_id for update;
  select * into v_inv from public.invoices where organization_id = new.organization_id and id = new.invoice_id for update;
  if v_pay.status <> 'posted' then raise exception 'Cannot allocate a reversed payment' using errcode = '23514'; end if;
  if v_inv.status <> 'open' then raise exception 'Payments can only be applied to open invoices' using errcode = '23514'; end if;
  if v_pay.tenant_id <> v_inv.tenant_id then raise exception 'Payment and invoice belong to different tenants' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into v_allocated from public.payment_allocations where payment_id = new.payment_id and id is distinct from new.id;
  select coalesce(sum(amount), 0) into v_refunded from public.payment_refunds where payment_id = new.payment_id;
  if v_allocated + v_refunded + new.amount > v_pay.amount then
    raise exception 'Allocations exceed the payment amount (% available)', v_pay.amount - v_allocated - v_refunded using errcode = '23514';
  end if;
  select coalesce(sum(a.amount), 0) into v_inv_paid
    from public.payment_allocations a join public.payments p on p.id = a.payment_id
   where a.invoice_id = new.invoice_id and p.status = 'posted' and a.id is distinct from new.id;
  select coalesce(sum(c.amount), 0) into v_inv_credits from public.credit_note_applications c where c.invoice_id = new.invoice_id;
  if v_inv_paid + v_inv_credits + new.amount > private.invoice_total(new.invoice_id) then
    raise exception 'Allocation exceeds the invoice balance' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payment_allocations_validate before insert or update on public.payment_allocations for each row execute function private.validate_payment_allocation();

create or replace function private.allocations_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.organizations o where o.id = old.organization_id) then
    raise exception '% rows are append-only; reverse the payment or credit instead', tg_table_name using errcode = '42501';
  end if;
  return old;
end $$;
create trigger payment_allocations_no_delete before delete on public.payment_allocations for each row execute function private.allocations_immutable();
create trigger payment_refunds_no_change before update or delete on public.payment_refunds for each row execute function private.allocations_immutable();
create trigger credit_note_applications_no_change before update or delete on public.credit_note_applications for each row execute function private.allocations_immutable();

create or replace function private.validate_payment_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments%rowtype;
  v_allocated numeric;
  v_refunded numeric;
begin
  select * into v_pay from public.payments where organization_id = new.organization_id and id = new.payment_id for update;
  if v_pay.status <> 'posted' then raise exception 'Cannot refund a reversed payment' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into v_allocated from public.payment_allocations where payment_id = new.payment_id;
  select coalesce(sum(amount), 0) into v_refunded from public.payment_refunds where payment_id = new.payment_id;
  if v_allocated + v_refunded + new.amount > v_pay.amount then
    raise exception 'Refund exceeds the unapplied part of the payment (% available)', v_pay.amount - v_allocated - v_refunded using errcode = '23514';
  end if;
  new.refunded_by := coalesce(new.refunded_by, (select auth.uid()));
  return new;
end $$;
create trigger payment_refunds_validate before insert on public.payment_refunds for each row execute function private.validate_payment_refund();

create or replace function private.validate_credit_application() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_credit public.credit_notes%rowtype;
  v_inv public.invoices%rowtype;
  v_applied numeric;
  v_inv_paid numeric;
  v_inv_credits numeric;
  v_source_status text;
begin
  select * into v_credit from public.credit_notes where organization_id = new.organization_id and id = new.credit_note_id for update;
  select * into v_inv from public.invoices where organization_id = new.organization_id and id = new.invoice_id for update;
  if v_credit.status <> 'open' then raise exception 'Only an open credit note can be applied' using errcode = '23514'; end if;
  if v_inv.status <> 'open' then raise exception 'Credits can only be applied to open invoices' using errcode = '23514'; end if;
  if v_credit.tenant_id <> v_inv.tenant_id then raise exception 'Credit note and invoice belong to different tenants' using errcode = '23514'; end if;
  if v_credit.source_payment_id is not null then
    select status into v_source_status from public.payments where id = v_credit.source_payment_id;
    if v_source_status = 'reversed' then raise exception 'The payment that created this credit was reversed' using errcode = '23514'; end if;
  end if;
  select coalesce(sum(amount), 0) into v_applied from public.credit_note_applications where credit_note_id = new.credit_note_id;
  if v_applied + new.amount > v_credit.amount then
    raise exception 'Application exceeds the remaining credit (% left)', v_credit.amount - v_applied using errcode = '23514';
  end if;
  select coalesce(sum(a.amount), 0) into v_inv_paid
    from public.payment_allocations a join public.payments p on p.id = a.payment_id where a.invoice_id = new.invoice_id and p.status = 'posted';
  select coalesce(sum(amount), 0) into v_inv_credits from public.credit_note_applications where invoice_id = new.invoice_id;
  if v_inv_paid + v_inv_credits + new.amount > private.invoice_total(new.invoice_id) then
    raise exception 'Application exceeds the invoice balance' using errcode = '23514';
  end if;
  new.applied_by := coalesce(new.applied_by, (select auth.uid()));
  return new;
end $$;
create trigger credit_note_applications_validate before insert on public.credit_note_applications for each row execute function private.validate_credit_application();

-- ---------------------------------------------------------------------------------------------------------------------
-- Payables: expenses, utility/vendor bills, recurring bill schedules
-- ---------------------------------------------------------------------------------------------------------------------
create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  expense_number     text,
  property_id        uuid,
  unit_id            uuid,
  category_id        uuid not null,
  vendor_id          uuid,
  work_order_id      uuid,                                   -- FK added in 005
  expense_date       date not null,
  amount             numeric(14,2) not null check (amount > 0),      -- total including tax
  tax_amount         numeric(14,2) not null default 0 check (tax_amount >= 0 and tax_amount <= amount),
  currency           char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  payment_account_id uuid,
  description        text not null,
  notes              text,
  is_allocated       boolean not null default false,
  status             text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  journal_entry_id   uuid,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, expense_number),
  check (unit_id is null or property_id is not null),
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, category_id) references public.expense_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, payment_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create trigger expenses_number before insert on public.expenses for each row execute function private.assign_number('expense_number', 'expense', 'EXP-', '5');
create index expenses_date_idx     on public.expenses (organization_id, expense_date desc);
create index expenses_property_idx on public.expenses (organization_id, property_id, expense_date) where property_id is not null;
create index expenses_vendor_idx   on public.expenses (organization_id, vendor_id) where vendor_id is not null;

create table public.expense_allocations (                    -- splits one expense across properties/units
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  expense_id      uuid not null,
  property_id     uuid not null,
  unit_id         uuid,
  amount          numeric(14,2) not null check (amount > 0),
  foreign key (organization_id, expense_id) references public.expenses (organization_id, id) on delete cascade,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);
create index expense_allocations_expense_idx on public.expense_allocations (organization_id, expense_id);
create or replace function private.check_expense_allocation_total() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_expense uuid := coalesce(new.expense_id, old.expense_id);
  v_total numeric;
  v_amount numeric;
  v_flag boolean;
begin
  select amount, is_allocated into v_amount, v_flag from public.expenses where id = v_expense;
  if v_amount is null then return null; end if;
  select coalesce(sum(amount), 0) into v_total from public.expense_allocations where expense_id = v_expense;
  if v_total > 0 and v_total <> v_amount then
    raise exception 'Expense allocations (%) must add up to the expense total (%)', v_total, v_amount using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger expense_allocations_total after insert or update or delete on public.expense_allocations
  deferrable initially deferred for each row execute function private.check_expense_allocation_total();

create table public.bill_schedules (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  name                   text not null,
  bill_type              text not null default 'other' check (bill_type in ('hydro', 'gas', 'water', 'internet', 'insurance', 'property_tax', 'maintenance', 'other')),
  vendor_id              uuid,
  property_id            uuid not null,
  unit_id                uuid,
  account_number         text,
  frequency              text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'semi_annually', 'annually', 'custom')),
  repeat_every           integer not null default 1 check (repeat_every >= 1),
  repeat_unit            text not null default 'month' check (repeat_unit in ('day', 'week', 'month')),
  custom_frequency_note  text,
  expected_amount        numeric(14,2) check (expected_amount is null or expected_amount >= 0),
  start_date             date not null,
  end_date               date,
  next_expected_date     date,
  due_date_rule          text,
  responsible_party      text not null default 'landlord' check (responsible_party in ('landlord', 'tenant', 'shared')),
  allocation_method      text not null default 'none' check (allocation_method in ('none', 'percentage', 'fixed', 'manual', 'equal_split')),
  allocation_percentage  numeric(5,2) check (allocation_percentage is null or allocation_percentage between 0 and 100),
  allocation_fixed_amount numeric(14,2) check (allocation_fixed_amount is null or allocation_fixed_amount >= 0),
  reminder_days          integer[] not null default '{}',
  notes                  text,
  status                 text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, id),
  check (end_date is null or end_date >= start_date),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);
create index bill_schedules_due_idx on public.bill_schedules (organization_id, next_expected_date) where status = 'active';
create table public.bill_schedule_tenants (
  organization_id uuid not null,
  schedule_id     uuid not null,
  tenant_id       uuid not null,
  primary key (schedule_id, tenant_id),
  foreign key (organization_id, schedule_id) references public.bill_schedules (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete cascade
);

create table public.bills (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  bill_number           text,
  name                  text not null,
  category              text not null default 'other' check (category in ('hydro', 'gas', 'water', 'internet', 'insurance', 'property_tax', 'maintenance', 'other')),
  vendor_id             uuid not null,
  property_id           uuid not null,
  invoice_number        text,                                   -- the provider's own invoice number
  account_number        text,
  billing_period_start  date not null,
  billing_period_end    date not null,
  invoice_date          date not null,
  due_date              date not null,
  amount                numeric(14,2) not null check (amount > 0),
  tax_amount            numeric(14,2) not null default 0 check (tax_amount >= 0),
  currency              char(3) not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  responsible_party     text not null default 'landlord' check (responsible_party in ('landlord', 'tenant', 'shared')),
  expense_category_id   uuid,
  schedule_id           uuid,
  reminder_days         integer[] not null default '{}',
  notes                 text,
  status                text not null default 'open' check (status in ('draft', 'open', 'cancelled')),   -- paid state is derived (v_bill_balances)
  journal_entry_id      uuid,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, bill_number),
  check (billing_period_end >= billing_period_start),
  foreign key (organization_id, vendor_id) references public.vendors (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, expense_category_id) references public.expense_categories (organization_id, id) on delete set null (expense_category_id),
  foreign key (organization_id, schedule_id) references public.bill_schedules (organization_id, id) on delete set null (schedule_id),
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create trigger bills_number before insert on public.bills for each row execute function private.assign_number('bill_number', 'bill', 'BILL-', '5');
create index bills_due_idx      on public.bills (organization_id, due_date) where status = 'open';
create index bills_property_idx on public.bills (organization_id, property_id, due_date);
create index bills_vendor_idx   on public.bills (organization_id, vendor_id);
-- the same provider invoice cannot be entered twice for a vendor
create unique index bills_vendor_invoice_key on public.bills (organization_id, vendor_id, invoice_number) where invoice_number is not null and status <> 'cancelled';

create table public.bill_units (
  organization_id uuid not null,
  bill_id         uuid not null,
  unit_id         uuid not null,
  primary key (bill_id, unit_id),
  foreign key (organization_id, bill_id) references public.bills (organization_id, id) on delete cascade,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);
create table public.bill_tenant_allocations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  bill_id           uuid not null,
  tenant_id         uuid not null,
  unit_id           uuid,
  method            text not null default 'equal_split' check (method in ('none', 'percentage', 'fixed', 'manual', 'equal_split')),
  percentage        numeric(5,2) check (percentage is null or percentage between 0 and 100),
  fixed_amount      numeric(14,2) check (fixed_amount is null or fixed_amount >= 0),
  manual_amount     numeric(14,2) check (manual_amount is null or manual_amount >= 0),
  calculation_basis text not null default 'actual' check (calculation_basis in ('actual', 'expected')),
  notes             text,
  unique (bill_id, tenant_id),
  foreign key (organization_id, bill_id) references public.bills (organization_id, id) on delete cascade,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict
);
create table public.bill_payments (                          -- payments TO the provider
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  bill_id          uuid not null,
  amount           numeric(14,2) not null check (amount > 0),
  paid_on          date not null,
  method           text not null default 'bank_transfer' check (method in ('bank_transfer', 'credit_card', 'debit_card', 'cheque', 'cash', 'other')),
  reference_number text,
  bank_account_id  uuid,
  notes            text,
  journal_entry_id uuid,
  recorded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, bill_id) references public.bills (organization_id, id) on delete restrict,
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict
);
create index bill_payments_bill_idx on public.bill_payments (organization_id, bill_id);
create table public.bill_tenant_recoveries (                 -- money recovered FROM tenants for a bill
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  bill_id          uuid not null,
  tenant_id        uuid not null,
  amount           numeric(14,2) not null check (amount > 0),
  received_on      date not null,
  method           text not null default 'bank_transfer' check (method in ('bank_transfer', 'credit_card', 'debit_card', 'cheque', 'cash', 'other')),
  reference_number text,
  notes            text,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, bill_id) references public.bills (organization_id, id) on delete restrict,
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict
);
create index bill_recoveries_bill_idx on public.bill_tenant_recoveries (organization_id, bill_id);

create or replace function private.validate_bill_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bill public.bills%rowtype;
  v_paid numeric;
begin
  select * into v_bill from public.bills where organization_id = new.organization_id and id = new.bill_id for update;
  if v_bill.status <> 'open' then raise exception 'Payments can only be recorded against open bills' using errcode = '23514'; end if;
  if tg_table_name = 'bill_payments' then
    select coalesce(sum(amount), 0) into v_paid from public.bill_payments where bill_id = new.bill_id and id is distinct from new.id;
  else
    select coalesce(sum(amount), 0) into v_paid from public.bill_tenant_recoveries where bill_id = new.bill_id and id is distinct from new.id;
  end if;
  if v_paid + new.amount > v_bill.amount then
    raise exception 'Total exceeds the bill amount (% remaining)', v_bill.amount - v_paid using errcode = '23514';
  end if;
  return new;
end $$;
create trigger bill_payments_validate before insert or update on public.bill_payments for each row execute function private.validate_bill_payment();
create trigger bill_recoveries_validate before insert or update on public.bill_tenant_recoveries for each row execute function private.validate_bill_payment();

-- One row per handled due date: 'posted' (a bill was created) or 'skipped'. The unique key prevents posting the same occurrence twice.
create table public.bill_schedule_runs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  schedule_id     uuid not null,
  due_date        date not null,
  action          text not null check (action in ('posted', 'skipped')),
  bill_id         uuid,
  handled_by      uuid references public.profiles (id) on delete set null,
  handled_at      timestamptz not null default now(),
  unique (schedule_id, due_date),
  check ((action = 'posted') = (bill_id is not null)),
  foreign key (organization_id, schedule_id) references public.bill_schedules (organization_id, id) on delete cascade,
  foreign key (organization_id, bill_id) references public.bills (organization_id, id) on delete set null (bill_id)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- Bank reconciliation
-- ---------------------------------------------------------------------------------------------------------------------
create table public.bank_import_mappings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  format          text not null default 'csv',
  columns         jsonb not null default '{}'::jsonb,            -- column indexes for date/description/debit/credit/...
  signed_amount_meaning text not null default 'positive_is_deposit' check (signed_amount_meaning in ('positive_is_deposit', 'positive_is_withdrawal')),
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);
create table public.reconciliations (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  reference                 text,
  bank_account_id           uuid not null,
  period_start              date not null,
  period_end                date not null,
  statement_opening_balance numeric(14,2) not null default 0,
  statement_ending_balance  numeric(14,2) not null default 0,
  statement_ref             text,
  file_name                 text,
  notes                     text,
  status                    text not null default 'not_started'
                              check (status in ('not_started', 'in_progress', 'needs_review', 'ready_to_finalize', 'reconciled', 'reopened', 'cancelled')),
  created_by                uuid references public.profiles (id) on delete set null,
  finalized_by              uuid references public.profiles (id) on delete set null,
  finalized_at              timestamptz,
  reopen_reason             text,
  final_summary             jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  check (period_end >= period_start),
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  -- an account cannot be reconciled twice for overlapping periods
  constraint reconciliations_no_overlap exclude using gist (
    bank_account_id with =, daterange(period_start, period_end, '[]') with &&
  ) where (status = 'reconciled')
);
create trigger reconciliations_number before insert on public.reconciliations for each row execute function private.assign_number('reference', 'reconciliation', 'REC-', '5');
create index reconciliations_account_idx on public.reconciliations (organization_id, bank_account_id, period_end desc);

create table public.bank_import_batches (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  bank_account_id  uuid not null,
  reconciliation_id uuid,
  period_start     date,
  period_end       date,
  file_name        text,
  mapping_name     text,
  total_rows       integer not null default 0,
  accepted_rows    integer not null default 0,
  rejected_rows    integer not null default 0,
  duplicate_rows   integer not null default 0,
  warnings         text[] not null default '{}',
  imported_by      uuid references public.profiles (id) on delete set null,
  imported_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, reconciliation_id) references public.reconciliations (organization_id, id) on delete set null (reconciliation_id)
);
create table public.bank_transactions (                      -- lines of the bank statement
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  batch_id         uuid,
  bank_account_id  uuid not null,
  tx_date          date not null,
  posted_date      date,
  description      text not null default '',
  reference        text,
  debit            numeric(14,2) not null default 0 check (debit >= 0),     -- money out
  credit           numeric(14,2) not null default 0 check (credit >= 0),    -- money in
  signed_amount    numeric(14,2) generated always as (credit - debit) stored,
  running_balance  numeric(14,2),
  fingerprint      text not null,
  duplicate_of     uuid,
  manual_entry     boolean not null default false,
  notes            text,
  imported_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, batch_id) references public.bank_import_batches (organization_id, id) on delete set null (batch_id),
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, duplicate_of) references public.bank_transactions (organization_id, id) on delete set null (duplicate_of)
);
-- a statement line (same account + fingerprint) can only be imported once; re-imports are flagged via duplicate_of instead
create unique index bank_transactions_fingerprint_key on public.bank_transactions (bank_account_id, fingerprint) where duplicate_of is null;
create index bank_transactions_account_date_idx on public.bank_transactions (organization_id, bank_account_id, tx_date);

create table public.book_transactions (                      -- the ledger side of the reconciliation
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  bank_account_id  uuid not null,
  tx_date          date not null,
  tx_type          text not null check (tx_type in ('rent_payment', 'tenant_deposit', 'deposit_refund', 'maintenance_expense', 'vendor_payment', 'management_fee',
                                                   'bank_fee', 'interest_income', 'transfer_out', 'transfer_in', 'returned_payment', 'other')),
  description      text not null default '',
  counterparty     text,
  property_id      uuid,
  unit_id          uuid,
  reference        text,
  money_in         numeric(14,2) not null default 0 check (money_in >= 0),
  money_out        numeric(14,2) not null default 0 check (money_out >= 0),
  signed_amount    numeric(14,2) generated always as (money_in - money_out) stored,
  coa_account_id   uuid,
  posting_status   text not null default 'posted' check (posting_status in ('posted', 'pending')),
  source           text,
  notes            text,
  assignee_id      uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid,
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  check ((money_in > 0) <> (money_out > 0)),
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete set null (property_id),
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete set null (unit_id),
  foreign key (organization_id, coa_account_id) references public.accounts (organization_id, id) on delete set null (coa_account_id),
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete set null (journal_entry_id)
);
create index book_transactions_account_date_idx on public.book_transactions (organization_id, bank_account_id, tx_date);
create table public.book_transaction_invoices (
  organization_id     uuid not null,
  book_transaction_id uuid not null,
  invoice_id          uuid,
  invoice_number      text not null,
  amount              numeric(14,2) not null check (amount >= 0),
  foreign key (organization_id, book_transaction_id) references public.book_transactions (organization_id, id) on delete cascade,
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete set null (invoice_id)
);
create index book_transaction_invoices_idx on public.book_transaction_invoices (organization_id, book_transaction_id);

create table public.reconciliation_matches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  reconciliation_id uuid not null,
  match_type        text not null check (match_type in ('one_to_one', 'one_to_many', 'many_to_one')),
  confidence        numeric(5,2) not null default 0 check (confidence between 0 and 100),
  confidence_level  text not null default 'none' check (confidence_level in ('high', 'medium', 'low', 'none')),
  explanation       text,
  is_automatic      boolean not null default false,
  confirmed_by      uuid references public.profiles (id) on delete set null,
  confirmed_at      timestamptz,
  history           jsonb not null default '[]'::jsonb,
  unique (organization_id, id),
  foreign key (organization_id, reconciliation_id) references public.reconciliations (organization_id, id) on delete cascade
);
-- A statement line / ledger line can belong to ONE match at a time (unmatching deletes its junction rows; history stays in the match).
create table public.reconciliation_match_bank_lines (
  organization_id     uuid not null,
  match_id            uuid not null,
  bank_transaction_id uuid not null unique,
  primary key (match_id, bank_transaction_id),
  foreign key (organization_id, match_id) references public.reconciliation_matches (organization_id, id) on delete cascade,
  foreign key (organization_id, bank_transaction_id) references public.bank_transactions (organization_id, id) on delete cascade
);
create table public.reconciliation_match_book_lines (
  organization_id     uuid not null,
  match_id            uuid not null,
  book_transaction_id uuid not null unique,
  primary key (match_id, book_transaction_id),
  foreign key (organization_id, match_id) references public.reconciliation_matches (organization_id, id) on delete cascade,
  foreign key (organization_id, book_transaction_id) references public.book_transactions (organization_id, id) on delete cascade
);
create table public.reconciliation_adjustments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  reconciliation_id uuid not null,
  side              text not null check (side in ('bank', 'book')),
  kind              text not null,
  amount            numeric(14,2) not null,
  description       text,
  coa_account_id    uuid,
  approved          boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  foreign key (organization_id, reconciliation_id) references public.reconciliations (organization_id, id) on delete cascade,
  foreign key (organization_id, coa_account_id) references public.accounts (organization_id, id) on delete set null (coa_account_id)
);

-- A finalized reconciliation is frozen: its matches/adjustments cannot change until it is reopened.
create or replace function private.reconciliation_frozen_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_rec uuid := coalesce(to_jsonb(new) ->> 'reconciliation_id', to_jsonb(old) ->> 'reconciliation_id')::uuid;
  v_status text;
begin
  if v_rec is null and tg_table_name in ('reconciliation_match_bank_lines', 'reconciliation_match_book_lines') then
    select m.reconciliation_id into v_rec from public.reconciliation_matches m where m.id = coalesce(to_jsonb(new) ->> 'match_id', to_jsonb(old) ->> 'match_id')::uuid;
  end if;
  select status into v_status from public.reconciliations where id = v_rec;
  if v_status = 'reconciled' then
    raise exception 'This reconciliation is finalized; reopen it before changing matches or adjustments' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger reconciliation_matches_frozen before insert or update or delete on public.reconciliation_matches for each row execute function private.reconciliation_frozen_guard();
create trigger reconciliation_adjustments_frozen before insert or update or delete on public.reconciliation_adjustments for each row execute function private.reconciliation_frozen_guard();
create trigger reconciliation_match_bank_frozen before insert or update or delete on public.reconciliation_match_bank_lines for each row execute function private.reconciliation_frozen_guard();
create trigger reconciliation_match_book_frozen before insert or update or delete on public.reconciliation_match_book_lines for each row execute function private.reconciliation_frozen_guard();

-- ---------------------------------------------------------------------------------------------------------------------
-- Security deposits (jurisdiction rules, interest, key devices, refunds, reconciliation exceptions)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.deposit_rules (                           -- organization_id NULL = system default rule, visible to every organization
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid references public.organizations (id) on delete cascade,
  jurisdiction              text not null,
  lease_type                text not null default 'residential',
  deposit_type              text not null check (deposit_type in ('last_month_rent', 'key_fob', 'security_deposit', 'pet_deposit', 'utility_deposit', 'other_permitted')),
  collection_permitted      boolean not null default true,
  max_amount                numeric(14,2),
  max_multiple_of_rent_bps  integer check (max_multiple_of_rent_bps is null or max_multiple_of_rent_bps >= 0),
  calculation_method        text,
  refund_conditions         text,
  interest_applicable       boolean not null default false,
  interest_method           text,
  interest_frequency        text,
  application_purposes      text[] not null default '{}',
  required_documents        text[] not null default '{}',
  approval_required         boolean not null default false,
  refund_approval_required  boolean not null default false,
  rounding_mode             text not null default 'half_up_cent',
  effective_from            date not null default date '2000-01-01',
  effective_to              date,
  validation_message        text,
  legal_reference           text,
  notes                     text,
  configured_by             uuid references public.profiles (id) on delete set null,
  configured_at             timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  -- rules for the same scope cannot be valid on overlapping dates
  constraint deposit_rules_no_overlap exclude using gist (
    (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =, jurisdiction with =, lease_type with =, deposit_type with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);
create table public.deposit_interest_rates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  jurisdiction    text not null,
  lease_type      text not null default 'residential',
  deposit_type    text not null,
  annual_rate_bps integer not null check (annual_rate_bps >= 0),
  effective_from  date not null,
  effective_to    date,
  source          text,
  notes           text,
  check (effective_to is null or effective_to >= effective_from),
  constraint deposit_rates_no_overlap exclude using gist (
    (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =, jurisdiction with =, lease_type with =, deposit_type with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  )
);

create table public.deposits (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null references public.organizations (id) on delete cascade,
  reference                     text,
  tenant_id                     uuid not null,
  lease_id                      uuid not null,
  property_id                   uuid,
  unit_id                       uuid,
  deposit_type                  text not null check (deposit_type in ('last_month_rent', 'key_fob', 'security_deposit', 'pet_deposit', 'utility_deposit', 'other_permitted')),
  jurisdiction                  text,
  lease_type                    text,
  status                        text not null default 'draft'
                                  check (status in ('draft', 'expected', 'partially_received', 'held', 'partially_applied', 'applied', 'refund_requested', 'refund_pending',
                                                    'partially_refunded', 'refunded', 'transferred', 'closed', 'cancelled')),
  required_amount               numeric(14,2) not null default 0 check (required_amount >= 0),
  expected_date                 date,
  first_received_date           date,
  interest_applicable           boolean not null default false,
  liability_account_id          uuid,
  cash_account_id               uuid,
  receivable_account_id         uuid,
  interest_payable_account_id   uuid,
  responsible_user_id           uuid references public.profiles (id) on delete set null,
  notes                         text,
  rule_snapshot                 jsonb not null default '{}'::jsonb,
  reconciliation_status         text not null default 'not_reviewed' check (reconciliation_status in ('not_reviewed', 'under_review', 'reconciled', 'exception')),
  last_reconciled_at            timestamptz,
  closed_at                     timestamptz,
  cancelled_at                  timestamptz,
  cancellation_reason           text,
  transfer_ref                  text,
  created_by                    uuid references public.profiles (id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  foreign key (organization_id, tenant_id) references public.tenants (organization_id, id) on delete restrict,
  foreign key (organization_id, lease_id) references public.leases (organization_id, id) on delete restrict,
  foreign key (organization_id, property_id) references public.properties (organization_id, id) on delete restrict,
  foreign key (organization_id, unit_id) references public.units (organization_id, id) on delete restrict,
  foreign key (organization_id, liability_account_id) references public.accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, cash_account_id) references public.accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, receivable_account_id) references public.accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, interest_payable_account_id) references public.accounts (organization_id, id) on delete restrict
);
create trigger deposits_number before insert on public.deposits for each row execute function private.assign_number('reference', 'deposit', 'DEP-', '5');
create index deposits_lease_idx  on public.deposits (organization_id, lease_id);
create index deposits_tenant_idx on public.deposits (organization_id, tenant_id);
create index deposits_status_idx on public.deposits (organization_id, status);

create table public.deposit_refunds (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null,
  reference                 text,
  deposit_id                uuid not null,
  requested_at              timestamptz not null default now(),
  requested_principal       numeric(14,2) not null default 0 check (requested_principal >= 0),
  requested_interest        numeric(14,2) not null default 0 check (requested_interest >= 0),
  approved_principal        numeric(14,2) check (approved_principal is null or approved_principal >= 0),
  approved_interest         numeric(14,2) check (approved_interest is null or approved_interest >= 0),
  method                    text check (method in ('cash', 'cheque', 'eft', 'etransfer', 'other')),
  status                    text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'paid', 'cancelled')),
  due_date                  date,
  approval_status           text not null default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  requested_by              uuid references public.profiles (id) on delete set null,
  approved_by               uuid references public.profiles (id) on delete set null,
  approved_at               timestamptz,
  rejection_reason          text,
  payment_id                uuid,
  completed_at              timestamptz,
  notes                     text,
  created_at                timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  foreign key (organization_id, deposit_id) references public.deposits (organization_id, id) on delete restrict,
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete set null (payment_id)
);
create trigger deposit_refunds_number before insert on public.deposit_refunds for each row execute function private.assign_number('reference', 'deposit_refund', 'REF-', '5');

create table public.deposit_transactions (                    -- ledger of everything that happened to a deposit (signed: + received, - paid out)
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  reference           text,
  deposit_id          uuid not null,
  txn_type            text not null check (txn_type in ('collection', 'partial_collection', 'application', 'refund_request', 'refund_payment', 'interest_accrual', 'interest_payment', 'reversal')),
  classification      text not null default 'principal' check (classification in ('principal', 'interest', 'none')),
  signed_amount       numeric(14,2) not null,
  occurred_at         timestamptz not null default now(),
  payment_id          uuid,
  invoice_id          uuid,
  refund_id           uuid,
  journal_entry_id    uuid,
  user_id             uuid references public.profiles (id) on delete set null,
  notes               text,
  document_ref        text,
  purpose             text,
  approval_ref        text,
  related_txn_id      uuid,
  reversal_of_txn_id  uuid,
  period_start        date,
  period_end          date,
  rate_bps            integer,
  status              text not null default 'posted' check (status in ('posted', 'pending', 'reversed')),
  created_at          timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, reference),
  foreign key (organization_id, deposit_id) references public.deposits (organization_id, id) on delete restrict,
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete set null (payment_id),
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete set null (invoice_id),
  foreign key (organization_id, refund_id) references public.deposit_refunds (organization_id, id) on delete set null (refund_id),
  foreign key (organization_id, journal_entry_id) references public.journal_entries (organization_id, id) on delete restrict,
  foreign key (organization_id, related_txn_id) references public.deposit_transactions (organization_id, id) on delete set null (related_txn_id),
  foreign key (organization_id, reversal_of_txn_id) references public.deposit_transactions (organization_id, id) on delete restrict
);
create trigger deposit_transactions_number before insert on public.deposit_transactions for each row execute function private.assign_number('reference', 'deposit_txn', 'DTX-', '6');
create index deposit_transactions_deposit_idx on public.deposit_transactions (organization_id, deposit_id, occurred_at);
create or replace function private.deposit_transactions_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then return old; end if;
  if tg_op = 'UPDATE' and old.status = 'posted' and new.status = 'reversed'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'Deposit transactions are append-only; post a reversal instead' using errcode = '42501';
end $$;
create trigger deposit_transactions_no_change before update or delete on public.deposit_transactions for each row execute function private.deposit_transactions_immutable();

create table public.deposit_key_devices (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null,
  deposit_id            uuid not null,
  device_type           text not null,
  identifier            text,
  quantity_issued       integer not null default 1 check (quantity_issued >= 0),
  quantity_returned     integer not null default 0 check (quantity_returned >= 0),
  replacement_cost      numeric(10,2) check (replacement_cost is null or replacement_cost >= 0),
  return_date           date,
  return_condition      text,
  notes                 text,
  check (quantity_returned <= quantity_issued),
  foreign key (organization_id, deposit_id) references public.deposits (organization_id, id) on delete cascade
);
create table public.deposit_reconciliation_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  reference         text,
  deposit_id        uuid not null,
  txn_reference     text,
  accounting_ref    text,
  txn_date          date,
  amount            numeric(14,2),
  difference        numeric(14,2),
  source            text,
  reason            text,
  reviewer_id       uuid references public.profiles (id) on delete set null,
  status            text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_notes  text,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  foreign key (organization_id, deposit_id) references public.deposits (organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['accounts', 'bank_accounts', 'invoices', 'credit_notes', 'expenses', 'bill_schedules', 'bills', 'reconciliations', 'deposits'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Row-Level Security. Reads need view_finance; writes manage_finance. Posted/immutable data is protected by triggers above,
-- and append-only tables get no UPDATE/DELETE policy.
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['accounts', 'expense_categories', 'catalog_items', 'bank_accounts', 'journal_entries', 'journal_entry_lines', 'invoices', 'invoice_lines',
                            'invoice_notes', 'payments', 'credit_notes', 'credit_note_lines', 'expenses', 'expense_allocations', 'bill_schedules',
                            'bill_schedule_tenants', 'bills', 'bill_units', 'bill_tenant_allocations', 'bill_payments', 'bill_tenant_recoveries',
                            'bill_schedule_runs', 'bank_import_mappings', 'reconciliations', 'bank_import_batches', 'bank_transactions', 'book_transactions',
                            'book_transaction_invoices', 'reconciliation_matches', 'reconciliation_match_bank_lines', 'reconciliation_match_book_lines',
                            'reconciliation_adjustments', 'deposits', 'deposit_key_devices', 'deposit_reconciliation_items'] loop
    execute format('call private.apply_org_policies(%L, %L, %L)', 'public.' || t, 'view_finance', 'manage_finance');
  end loop;
end $$;
-- append-only ledgers: no UPDATE policy (and the triggers above refuse changes anyway)
call private.apply_org_policies('public.payment_allocations',      'view_finance', 'manage_finance', 'none');
call private.apply_org_policies('public.payment_refunds',          'view_finance', 'manage_finance', 'none');
call private.apply_org_policies('public.credit_note_applications', 'view_finance', 'manage_finance', 'none');
call private.apply_org_policies('public.deposit_transactions',     'view_finance', 'manage_finance', 'none');
call private.apply_org_policies('public.deposit_refunds',          'view_finance', 'manage_finance');
drop policy if exists org_update on public.payment_allocations;  drop policy if exists org_update on public.payment_refunds;
drop policy if exists org_update on public.credit_note_applications;
-- (deposit_transactions needs UPDATE only to flag a row 'reversed'; the trigger limits it to that single transition)

-- Payments: no DELETE policy (reverse instead).
call private.apply_org_policies('public.payments', 'view_finance', 'manage_finance', 'none');

-- Deposit rules and rates: system rows (organization_id IS NULL) are readable by everyone, organization rows by members.
alter table public.deposit_rules enable row level security;
alter table public.deposit_interest_rates enable row level security;
create policy deposit_rules_select on public.deposit_rules for select to authenticated
  using (organization_id is null or private.has_permission(organization_id, 'view_finance'));
create policy deposit_rules_write on public.deposit_rules for all to authenticated
  using (organization_id is not null and private.has_permission(organization_id, 'manage_finance'))
  with check (organization_id is not null and private.has_permission(organization_id, 'manage_finance'));
create policy deposit_rates_select on public.deposit_interest_rates for select to authenticated
  using (organization_id is null or private.has_permission(organization_id, 'view_finance'));
create policy deposit_rates_write on public.deposit_interest_rates for all to authenticated
  using (organization_id is not null and private.has_permission(organization_id, 'manage_finance'))
  with check (organization_id is not null and private.has_permission(organization_id, 'manage_finance'));
revoke all on public.deposit_rules, public.deposit_interest_rates from anon;
grant select, insert, update, delete on public.deposit_rules, public.deposit_interest_rates to authenticated;

-- Journal entries/lines: deletes are limited to drafts by the guard triggers; no UPDATE of lines after posting.
commit;
