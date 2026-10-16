-- Rental Property Management & Accounting System: PostgreSQL schema (for Supabase)
-- Converted from the earlier Oracle schema; this file is now the source of truth.
-- Run in the Supabase SQL Editor. Ids are uuid; money is whole cents; booleans are smallint 0/1;
-- arrays and JSON are plain text. Row Level Security is switched on for every table with no policies,
-- so Supabase's public API (anon key) can read nothing; the Node API connects directly as the database owner.


CREATE TABLE business (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name varchar(255) NOT NULL,
  currency CHAR(3) DEFAULT 'CAD' NOT NULL,
  timezone varchar(255) DEFAULT 'America/Toronto' NOT NULL,
  jurisdiction varchar(255),
  fiscal_year_start_month integer DEFAULT 1 NOT NULL,
  books_closed_through DATE,
  settings text DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_business PRIMARY KEY (id)
);

CREATE TABLE app_user (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  is_active smallint DEFAULT 1 NOT NULL,
  mfa_secret_enc varchar(255),
  mfa_enabled smallint DEFAULT 0 NOT NULL,
  failed_logins integer DEFAULT 0 NOT NULL,
  locked_until timestamptz,
  last_login_at timestamptz,
  tenant_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_app_user PRIMARY KEY (id),
  CONSTRAINT ck_app_user_2 CHECK (is_active IN (0,1)),
  CONSTRAINT ck_app_user_3 CHECK (mfa_enabled IN (0,1)),
  CONSTRAINT uq_app_user_1 UNIQUE (email),
  CONSTRAINT uq_app_user_2 UNIQUE (tenant_id)
);

CREATE TABLE user_session (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  refresh_token_hash varchar(255) NOT NULL,
  user_agent varchar(255),
  ip varchar(255),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_user_session PRIMARY KEY (id),
  CONSTRAINT uq_user_session_3 UNIQUE (refresh_token_hash)
);

CREATE TABLE app_role (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  key varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  is_system smallint DEFAULT 0 NOT NULL,
  permissions text DEFAULT '[]' NOT NULL,
  CONSTRAINT pk_app_role PRIMARY KEY (id),
  CONSTRAINT ck_app_role_4 CHECK (is_system IN (0,1)),
  CONSTRAINT uq_app_role_4 UNIQUE (business_id, key)
);

CREATE TABLE membership (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  role_id uuid NOT NULL,
  all_properties smallint DEFAULT 1 NOT NULL,
  property_ids text DEFAULT '[]' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_membership PRIMARY KEY (id),
  CONSTRAINT ck_membership_6 CHECK (all_properties IN (0,1)),
  CONSTRAINT uq_membership_5 UNIQUE (user_id, business_id)
);

CREATE TABLE api_key (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  key_hash varchar(255) NOT NULL,
  prefix varchar(255) NOT NULL,
  permissions text DEFAULT '[]' NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_api_key PRIMARY KEY (id),
  CONSTRAINT uq_api_key_6 UNIQUE (key_hash)
);

CREATE TABLE property (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(40) NOT NULL,
  address_line1 varchar(2000) NOT NULL,
  address_line2 varchar(2000),
  city varchar(255) NOT NULL,
  region varchar(255) NOT NULL,
  postal_code varchar(255) NOT NULL,
  country varchar(255) DEFAULT 'CA' NOT NULL,
  purchase_date DATE,
  purchase_price_cents bigint,
  estimated_value_cents bigint,
  mortgage_info text,
  tax_info text,
  insurance_info text,
  insurance_expires_on DATE,
  notes varchar(2000),
  image_data text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_property PRIMARY KEY (id),
  CONSTRAINT ck_property_9 CHECK (type IN ('SINGLE_FAMILY','MULTI_FAMILY','APARTMENT_BUILDING','CONDO','COMMERCIAL','MIXED_USE','OTHER'))
);

CREATE TABLE unit (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_number varchar(255) NOT NULL,
  unit_type varchar(255),
  bedrooms numeric(3,1),
  bathrooms numeric(3,1),
  square_feet integer,
  market_rent_cents integer,
  deposit_cents integer,
  status varchar(40) DEFAULT 'VACANT' NOT NULL,
  available_on DATE,
  allow_multiple_active_leases smallint DEFAULT 0 NOT NULL,
  notes varchar(2000),
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_unit PRIMARY KEY (id),
  CONSTRAINT ck_unit_13 CHECK (status IN ('OCCUPIED','VACANT','RESERVED','MAINTENANCE','UNAVAILABLE')),
  CONSTRAINT ck_unit_14 CHECK (allow_multiple_active_leases IN (0,1)),
  CONSTRAINT uq_unit_7 UNIQUE (property_id, unit_number)
);

CREATE TABLE tenant (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(255),
  date_of_birth_enc varchar(255),
  emergency_contact varchar(255),
  emergency_phone varchar(255),
  status varchar(40) DEFAULT 'APPLICANT' NOT NULL,
  move_in_date DATE,
  move_out_date DATE,
  notes varchar(2000),
  photo_data text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_tenant PRIMARY KEY (id),
  CONSTRAINT ck_tenant_15 CHECK (status IN ('APPLICANT','ACTIVE','PAST','PENDING_MOVE_IN','PENDING_MOVE_OUT'))
);

CREATE TABLE tenant_id_document (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL,
  id_type varchar(40) NOT NULL,
  expires_on DATE,
  verification varchar(40) DEFAULT 'UNVERIFIED' NOT NULL,
  verified_by_id uuid,
  verified_at timestamptz,
  CONSTRAINT pk_tenant_id_document PRIMARY KEY (id),
  CONSTRAINT ck_tenant_id_docu_16 CHECK (id_type IN ('DRIVERS_LICENSE','PASSPORT','GOVERNMENT_ID','OTHER')),
  CONSTRAINT ck_tenant_id_docu_17 CHECK (verification IN ('UNVERIFIED','VERIFIED','REJECTED')),
  CONSTRAINT uq_tenant_id_docu_8 UNIQUE (document_id)
);

CREATE TABLE lease (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  status varchar(40) DEFAULT 'DRAFT' NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent_cents integer NOT NULL,
  deposit_cents integer DEFAULT 0 NOT NULL,
  rent_due_day integer DEFAULT 1 NOT NULL,
  late_fee_cents integer DEFAULT 0 NOT NULL,
  late_fee_grace_days integer DEFAULT 0 NOT NULL,
  frequency varchar(40) DEFAULT 'MONTHLY' NOT NULL,
  renewal_terms varchar(2000),
  notes varchar(2000),
  terminated_at DATE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_lease PRIMARY KEY (id),
  CONSTRAINT ck_lease_18 CHECK (status IN ('DRAFT','PENDING_SIGNATURE','PARTIALLY_SIGNED','SIGNED','ACTIVE','EXPIRING','EXPIRED','TERMINATED')),
  CONSTRAINT ck_lease_19 CHECK (frequency IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','ANNUALLY'))
);

CREATE TABLE rent_charge (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  type varchar(40) DEFAULT 'RENT' NOT NULL,
  description varchar(2000) NOT NULL,
  period_start DATE,
  due_date DATE NOT NULL,
  amount_cents integer NOT NULL,
  paid_cents integer DEFAULT 0 NOT NULL,
  status varchar(40) DEFAULT 'OPEN' NOT NULL,
  account_id uuid,
  recurring_template_id uuid,
  journal_entry_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_rent_charge PRIMARY KEY (id),
  CONSTRAINT ck_rent_charge_20 CHECK (type IN ('RENT','LATE_FEE','DEPOSIT','CREDIT','ADJUSTMENT','OTHER')),
  CONSTRAINT ck_rent_charge_21 CHECK (status IN ('OPEN','PARTIALLY_PAID','PAID','VOID')),
  CONSTRAINT uq_rent_charge_9 UNIQUE (journal_entry_id)
);

CREATE TABLE payment (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  received_on DATE NOT NULL,
  method varchar(40) NOT NULL,
  reference varchar(255),
  status varchar(40) DEFAULT 'COMPLETED' NOT NULL,
  bank_account_id uuid,
  notes varchar(2000),
  idempotency_key varchar(255),
  journal_entry_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_payment PRIMARY KEY (id),
  CONSTRAINT ck_payment_22 CHECK (method IN ('CASH','CHEQUE','BANK_TRANSFER','CREDIT_CARD','DEBIT_CARD','OTHER')),
  CONSTRAINT ck_payment_23 CHECK (status IN ('PENDING','COMPLETED','FAILED','REFUNDED')),
  CONSTRAINT uq_payment_11 UNIQUE (journal_entry_id)
);

CREATE TABLE payment_application (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payment_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  CONSTRAINT pk_payment_application PRIMARY KEY (id),
  CONSTRAINT uq_payment_applic_13 UNIQUE (payment_id, charge_id)
);

CREATE TABLE vendor (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  company varchar(255) NOT NULL,
  contact_name varchar(255),
  phone varchar(255),
  email varchar(255),
  address varchar(2000),
  tax_info_enc varchar(255),
  services text DEFAULT '[]' NOT NULL,
  property_ids text DEFAULT '[]' NOT NULL,
  notes varchar(2000),
  archived_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_vendor PRIMARY KEY (id)
);

CREATE TABLE expense_category (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  account_id uuid NOT NULL,
  CONSTRAINT pk_expense_category PRIMARY KEY (id),
  CONSTRAINT uq_expense_catego_14 UNIQUE (business_id, name)
);

CREATE TABLE expense (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid,
  unit_id uuid,
  category_id uuid NOT NULL,
  vendor_id uuid,
  work_order_id uuid,
  entry_date DATE NOT NULL,
  amount_cents integer NOT NULL,
  tax_cents integer DEFAULT 0 NOT NULL,
  payment_account_id uuid,
  description varchar(2000) NOT NULL,
  notes varchar(2000),
  is_allocated smallint DEFAULT 0 NOT NULL,
  journal_entry_id uuid,
  recurring_template_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_expense PRIMARY KEY (id),
  CONSTRAINT ck_expense_26 CHECK (is_allocated IN (0,1)),
  CONSTRAINT uq_expense_15 UNIQUE (work_order_id),
  CONSTRAINT uq_expense_16 UNIQUE (journal_entry_id)
);

CREATE TABLE expense_allocation (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid,
  amount_cents integer NOT NULL,
  CONSTRAINT pk_expense_allocation PRIMARY KEY (id)
);

CREATE TABLE bill (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  property_id uuid,
  unit_id uuid,
  category_id uuid NOT NULL,
  bill_number varchar(255),
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_cents integer NOT NULL,
  tax_cents integer DEFAULT 0 NOT NULL,
  paid_cents integer DEFAULT 0 NOT NULL,
  status varchar(40) DEFAULT 'DRAFT' NOT NULL,
  notes varchar(2000),
  recurring_template_id uuid,
  journal_entry_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_bill PRIMARY KEY (id),
  CONSTRAINT ck_bill_27 CHECK (status IN ('DRAFT','OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  CONSTRAINT uq_bill_17 UNIQUE (journal_entry_id)
);

CREATE TABLE bill_payment (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  bill_id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  paid_on DATE NOT NULL,
  reference varchar(255),
  journal_entry_id uuid,
  CONSTRAINT pk_bill_payment PRIMARY KEY (id),
  CONSTRAINT uq_bill_payment_18 UNIQUE (journal_entry_id)
);

CREATE TABLE invoice (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  doc_number varchar(255) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  period_start DATE,
  status varchar(40) DEFAULT 'DRAFT' NOT NULL,
  notes varchar(2000),
  send_to varchar(255),
  include_payment_instructions smallint DEFAULT 1 NOT NULL,
  sent_at timestamptz,
  viewed_at timestamptz,
  view_token_hash varchar(255),
  pdf_version_id uuid,
  recurring_template_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_invoice PRIMARY KEY (id),
  CONSTRAINT ck_invoice_28 CHECK (status IN ('DRAFT','SENT','VIEWED','PARTIALLY_PAID','PAID','OVERDUE','VOID')),
  CONSTRAINT ck_invoice_29 CHECK (include_payment_instructions IN (0,1)),
  CONSTRAINT uq_invoice_19 UNIQUE (view_token_hash),
  CONSTRAINT uq_invoice_20 UNIQUE (business_id, doc_number)
);

CREATE TABLE invoice_line (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  charge_id uuid,
  description varchar(2000) NOT NULL,
  amount_cents integer NOT NULL,
  CONSTRAINT pk_invoice_line PRIMARY KEY (id)
);

CREATE TABLE credit_note (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  lease_id uuid,
  invoice_id uuid,
  doc_number varchar(255) NOT NULL,
  reference_number varchar(255),
  subject varchar(255),
  status varchar(40) DEFAULT 'DRAFT' NOT NULL,
  customer_notes varchar(2000),
  terms varchar(2000),
  issue_date DATE NOT NULL,
  amount_cents integer NOT NULL,
  applied_cents integer DEFAULT 0 NOT NULL,
  reason varchar(2000) NOT NULL,
  auto_apply smallint DEFAULT 0 NOT NULL,
  voided_at timestamptz,
  journal_entry_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_credit_note PRIMARY KEY (id),
  CONSTRAINT ck_credit_note_30 CHECK (status IN ('DRAFT','OPEN','PARTIALLY_APPLIED','APPLIED','VOID')),
  CONSTRAINT ck_credit_note_31 CHECK (auto_apply IN (0,1)),
  CONSTRAINT uq_credit_note_21 UNIQUE (journal_entry_id),
  CONSTRAINT uq_credit_note_22 UNIQUE (business_id, doc_number)
);

CREATE TABLE item (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  description varchar(2000),
  rate_cents integer DEFAULT 0 NOT NULL,
  account_id uuid NOT NULL,
  is_active smallint DEFAULT 1 NOT NULL,
  CONSTRAINT pk_item PRIMARY KEY (id),
  CONSTRAINT ck_item_32 CHECK (is_active IN (0,1)),
  CONSTRAINT uq_item_23 UNIQUE (business_id, name)
);

CREATE TABLE credit_note_line (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  credit_note_id uuid NOT NULL,
  item_id uuid,
  account_id uuid NOT NULL,
  description varchar(2000),
  quantity numeric(12,2) DEFAULT 1 NOT NULL,
  rate_cents integer DEFAULT 0 NOT NULL,
  discount_cents integer DEFAULT 0 NOT NULL,
  amount_cents integer NOT NULL,
  line_position integer NOT NULL,
  CONSTRAINT pk_credit_note_line PRIMARY KEY (id)
);

CREATE TABLE credit_application (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  credit_note_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  applied_on DATE NOT NULL,
  journal_entry_id uuid,
  CONSTRAINT pk_credit_application PRIMARY KEY (id),
  CONSTRAINT uq_credit_applica_24 UNIQUE (journal_entry_id)
);

CREATE TABLE maintenance_request (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  tenant_id uuid,
  issue varchar(255) NOT NULL,
  description varchar(2000),
  priority varchar(40) DEFAULT 'MEDIUM' NOT NULL,
  status varchar(40) DEFAULT 'NEW' NOT NULL,
  preferred_access varchar(255),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_maintenance_request PRIMARY KEY (id),
  CONSTRAINT ck_maintenance_re_33 CHECK (priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  CONSTRAINT ck_maintenance_re_34 CHECK (status IN ('NEW','OPEN','CLOSED','CANCELLED'))
);

CREATE TABLE work_order (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  request_id uuid,
  property_id uuid NOT NULL,
  unit_id uuid,
  tenant_id uuid,
  vendor_id uuid,
  issue varchar(255) NOT NULL,
  description varchar(2000),
  priority varchar(40) DEFAULT 'MEDIUM' NOT NULL,
  status varchar(40) DEFAULT 'NEW' NOT NULL,
  assigned_on DATE,
  scheduled_on timestamptz,
  completed_on DATE,
  estimated_cost_cents integer,
  actual_cost_cents integer,
  notes varchar(2000),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_work_order PRIMARY KEY (id),
  CONSTRAINT ck_work_order_35 CHECK (priority IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  CONSTRAINT ck_work_order_36 CHECK (status IN ('NEW','OPEN','ASSIGNED','SCHEDULED','IN_PROGRESS','WAITING','COMPLETED','CANCELLED'))
);

CREATE TABLE bank_account (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(40) DEFAULT 'CHECKING' NOT NULL,
  institution varchar(255),
  last4 CHAR(4),
  gl_account_id uuid NOT NULL,
  opening_balance_cents bigint DEFAULT 0 NOT NULL,
  archived_at timestamptz,
  CONSTRAINT pk_bank_account PRIMARY KEY (id),
  CONSTRAINT ck_bank_account_37 CHECK (type IN ('CHECKING','SAVINGS','CREDIT_CARD','CASH','OTHER')),
  CONSTRAINT uq_bank_account_25 UNIQUE (gl_account_id)
);

CREATE TABLE bank_transaction (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  entry_date DATE NOT NULL,
  type varchar(40) NOT NULL,
  amount_cents integer NOT NULL,
  description varchar(2000),
  status varchar(40) DEFAULT 'UNCATEGORIZED' NOT NULL,
  category_account_id uuid,
  property_id uuid,
  unit_id uuid,
  vendor_id uuid,
  transfer_pair_id uuid,
  reconciliation_id uuid,
  external_id varchar(255),
  journal_entry_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_bank_transaction PRIMARY KEY (id),
  CONSTRAINT ck_bank_transacti_38 CHECK (type IN ('DEPOSIT','WITHDRAWAL','TRANSFER_IN','TRANSFER_OUT','FEE','INTEREST')),
  CONSTRAINT ck_bank_transacti_39 CHECK (status IN ('UNCATEGORIZED','CATEGORIZED','RECONCILED')),
  CONSTRAINT uq_bank_transacti_26 UNIQUE (journal_entry_id)
);

CREATE TABLE reconciliation (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  bank_account_id uuid NOT NULL,
  statement_date DATE NOT NULL,
  statement_balance_cents bigint NOT NULL,
  completed_at timestamptz,
  CONSTRAINT pk_reconciliation PRIMARY KEY (id)
);

CREATE TABLE account (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  code varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(40) NOT NULL,
  subtype varchar(255),
  system_key varchar(255),
  parent_id uuid,
  is_active smallint DEFAULT 1 NOT NULL,
  description varchar(2000),
  CONSTRAINT pk_account PRIMARY KEY (id),
  CONSTRAINT ck_account_40 CHECK (type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  CONSTRAINT ck_account_41 CHECK (is_active IN (0,1)),
  CONSTRAINT uq_account_28 UNIQUE (business_id, code)
);

CREATE TABLE journal_entry (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  entry_number integer NOT NULL,
  entry_date DATE NOT NULL,
  memo varchar(2000),
  source varchar(40) NOT NULL,
  source_type varchar(255),
  source_id uuid,
  status varchar(40) DEFAULT 'POSTED' NOT NULL,
  reversal_of_id uuid,
  created_by_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_journal_entry PRIMARY KEY (id),
  CONSTRAINT ck_journal_entry_42 CHECK (source IN ('MANUAL','RENT_CHARGE','PAYMENT','EXPENSE','BILL','BILL_PAYMENT','BANK_TXN','TRANSFER','DEPOSIT','RECURRING','REVERSAL','OPENING')),
  CONSTRAINT ck_journal_entry_43 CHECK (status IN ('POSTED','REVERSED')),
  CONSTRAINT uq_journal_entry_30 UNIQUE (reversal_of_id),
  CONSTRAINT uq_journal_entry_31 UNIQUE (business_id, entry_number)
);

CREATE TABLE journal_entry_line (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  entry_id uuid NOT NULL,
  business_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit_cents bigint DEFAULT 0 NOT NULL,
  credit_cents bigint DEFAULT 0 NOT NULL,
  memo varchar(2000),
  property_id uuid,
  unit_id uuid,
  tenant_id uuid,
  lease_id uuid,
  vendor_id uuid,
  bank_account_id uuid,
  category_id uuid,
  entry_date DATE NOT NULL,
  CONSTRAINT pk_journal_entry_line PRIMARY KEY (id)
);

CREATE TABLE recurring_template (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  kind varchar(40) NOT NULL,
  frequency varchar(40) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_on DATE NOT NULL,
  payload text NOT NULL,
  is_active smallint DEFAULT 1 NOT NULL,
  CONSTRAINT pk_recurring_template PRIMARY KEY (id),
  CONSTRAINT ck_recurring_temp_44 CHECK (kind IN ('RENT_CHARGE','BILL','EXPENSE','PAYMENT','JOURNAL_ENTRY')),
  CONSTRAINT ck_recurring_temp_45 CHECK (frequency IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','ANNUALLY')),
  CONSTRAINT ck_recurring_temp_47 CHECK (is_active IN (0,1))
);

CREATE TABLE document (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  type varchar(40) NOT NULL,
  owner_type varchar(40) NOT NULL,
  owner_id uuid,
  property_id uuid,
  tenant_id uuid,
  lease_id uuid,
  expires_on DATE,
  status varchar(40) DEFAULT 'ACTIVE' NOT NULL,
  is_sensitive smallint DEFAULT 0 NOT NULL,
  current_version_id uuid,
  uploaded_by_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_document PRIMARY KEY (id),
  CONSTRAINT ck_document_48 CHECK (type IN ('IDENTIFICATION','LEASE','LEASE_ADDENDUM','INSURANCE','PROPERTY_TAX','INVOICE','RECEIPT','MAINTENANCE','NOTICE','INSPECTION','FINANCIAL','OTHER')),
  CONSTRAINT ck_document_49 CHECK (owner_type IN ('BUSINESS','PROPERTY','UNIT','TENANT','LEASE','VENDOR','WORK_ORDER','TRANSACTION')),
  CONSTRAINT ck_document_50 CHECK (status IN ('ACTIVE','ARCHIVED','SIGNED')),
  CONSTRAINT ck_document_51 CHECK (is_sensitive IN (0,1)),
  CONSTRAINT uq_document_32 UNIQUE (current_version_id)
);

CREATE TABLE document_version (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  version integer NOT NULL,
  storage_key varchar(255) NOT NULL,
  file_name varchar(255) NOT NULL,
  mime_type varchar(255) NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 varchar(255) NOT NULL,
  page_count integer,
  is_immutable smallint DEFAULT 0 NOT NULL,
  is_certificate smallint DEFAULT 0 NOT NULL,
  uploaded_by_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_document_version PRIMARY KEY (id),
  CONSTRAINT ck_document_versi_52 CHECK (is_immutable IN (0,1)),
  CONSTRAINT ck_document_versi_53 CHECK (is_certificate IN (0,1)),
  CONSTRAINT uq_document_versi_33 UNIQUE (storage_key),
  CONSTRAINT uq_document_versi_34 UNIQUE (document_id, version)
);

CREATE TABLE signature_request (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  document_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  source_sha256 varchar(255),
  lease_id uuid,
  tenant_id uuid,
  title varchar(255) NOT NULL,
  message varchar(2000),
  status varchar(40) DEFAULT 'DRAFT' NOT NULL,
  signing_order_enforced smallint DEFAULT 1 NOT NULL,
  expires_at timestamptz,
  completed_at timestamptz,
  completed_version_id uuid,
  certificate_version_id uuid,
  created_by_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_signature_request PRIMARY KEY (id),
  CONSTRAINT ck_signature_requ_54 CHECK (status IN ('DRAFT','FIELDS_ADDED','READY_TO_SEND','SENT','VIEWED','PARTIALLY_SIGNED','COMPLETED','DECLINED','VOIDED','EXPIRED')),
  CONSTRAINT ck_signature_requ_55 CHECK (signing_order_enforced IN (0,1))
);

CREATE TABLE signer (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  role varchar(255) NOT NULL,
  sign_order integer DEFAULT 1 NOT NULL,
  required smallint DEFAULT 1 NOT NULL,
  status varchar(40) DEFAULT 'PENDING' NOT NULL,
  token_hash varchar(255),
  token_expires_at timestamptz,
  pin_hash varchar(255),
  verification varchar(255) DEFAULT 'none' NOT NULL,
  otp_hash varchar(255),
  otp_expires_at timestamptz,
  otp_attempts integer DEFAULT 0 NOT NULL,
  signed_at timestamptz,
  signature_image_key varchar(255),
  CONSTRAINT pk_signer PRIMARY KEY (id),
  CONSTRAINT ck_signer_56 CHECK (required IN (0,1)),
  CONSTRAINT ck_signer_57 CHECK (status IN ('PENDING','SENT','VIEWED','SIGNED','DECLINED')),
  CONSTRAINT uq_signer_35 UNIQUE (token_hash)
);

CREATE TABLE signature_field (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  signer_id uuid NOT NULL,
  type varchar(40) NOT NULL,
  page integer NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision NOT NULL,
  height double precision NOT NULL,
  required smallint DEFAULT 1 NOT NULL,
  label varchar(255),
  value varchar(255),
  filled_at timestamptz,
  CONSTRAINT pk_signature_field PRIMARY KEY (id),
  CONSTRAINT ck_signature_fiel_58 CHECK (type IN ('SIGNATURE','INITIALS','FULL_NAME','DATE','TEXT','CHECKBOX')),
  CONSTRAINT ck_signature_fiel_59 CHECK (required IN (0,1))
);

CREATE TABLE signature_event (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_id uuid NOT NULL,
  signer_id uuid,
  action varchar(40) NOT NULL,
  email varchar(255),
  ip varchar(255),
  user_agent varchar(255),
  document_version_id uuid,
  document_sha256 varchar(255),
  status varchar(255),
  metadata text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_signature_event PRIMARY KEY (id),
  CONSTRAINT ck_signature_even_60 CHECK (action IN ('SENT','DELIVERED','OPENED','VIEWED','SIGNED','DECLINED','COMPLETED','VERIFIED_OTP','VOIDED'))
);

CREATE TABLE notification_rule (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  type varchar(40) NOT NULL,
  enabled smallint DEFAULT 1 NOT NULL,
  lead_days text DEFAULT '[]' NOT NULL,
  channels text DEFAULT '[]' NOT NULL,
  CONSTRAINT pk_notification_rule PRIMARY KEY (id),
  CONSTRAINT ck_notification_r_62 CHECK (type IN ('RENT_OVERDUE','RENT_DUE_SOON','LEASE_EXPIRING','ID_EXPIRING','INSURANCE_EXPIRING','BILL_DUE','BILL_OVERDUE','MAINTENANCE_REQUEST','SIGNATURE_REQUESTED','SIGNATURE_PENDING','DOCUMENT_EXPIRED')),
  CONSTRAINT ck_notification_r_63 CHECK (enabled IN (0,1)),
  CONSTRAINT uq_notification_r_36 UNIQUE (business_id, type)
);

CREATE TABLE notification (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  user_id uuid,
  type varchar(40) NOT NULL,
  title varchar(255) NOT NULL,
  body varchar(255),
  entity_type varchar(255),
  entity_id uuid,
  dedupe_key varchar(255),
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_notification PRIMARY KEY (id),
  CONSTRAINT ck_notification_66 CHECK (type IN ('RENT_OVERDUE','RENT_DUE_SOON','LEASE_EXPIRING','ID_EXPIRING','INSURANCE_EXPIRING','BILL_DUE','BILL_OVERDUE','MAINTENANCE_REQUEST','SIGNATURE_REQUESTED','SIGNATURE_PENDING','DOCUMENT_EXPIRED'))
);

CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  user_id uuid,
  action varchar(255) NOT NULL,
  entity_type varchar(255) NOT NULL,
  entity_id uuid,
  before text,
  after text,
  ip varchar(255),
  user_agent varchar(255),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_audit_log PRIMARY KEY (id)
);

CREATE TABLE domain_event (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  type varchar(255) NOT NULL,
  payload text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_domain_event PRIMARY KEY (id)
);

CREATE TABLE webhook_endpoint (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  url varchar(255) NOT NULL,
  secret_enc varchar(255) NOT NULL,
  event_types text DEFAULT '[]' NOT NULL,
  is_active smallint DEFAULT 1 NOT NULL,
  CONSTRAINT pk_webhook_endpoint PRIMARY KEY (id),
  CONSTRAINT ck_webhook_endpoi_71 CHECK (is_active IN (0,1))
);

CREATE TABLE webhook_delivery (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  endpoint_id uuid NOT NULL,
  status varchar(40) DEFAULT 'PENDING' NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamptz,
  last_error varchar(2000),
  CONSTRAINT pk_webhook_delivery PRIMARY KEY (id),
  CONSTRAINT ck_webhook_delive_72 CHECK (status IN ('PENDING','DELIVERED','FAILED'))
);

-- Foreign keys

ALTER TABLE app_user ADD CONSTRAINT fk_app_user_1 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE user_session ADD CONSTRAINT fk_user_session_2 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE;
ALTER TABLE app_role ADD CONSTRAINT fk_app_role_3 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE membership ADD CONSTRAINT fk_membership_4 FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE;
ALTER TABLE membership ADD CONSTRAINT fk_membership_5 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE membership ADD CONSTRAINT fk_membership_6 FOREIGN KEY (role_id) REFERENCES app_role (id);
ALTER TABLE api_key ADD CONSTRAINT fk_api_key_7 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE property ADD CONSTRAINT fk_property_8 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE unit ADD CONSTRAINT fk_unit_9 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE unit ADD CONSTRAINT fk_unit_10 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE tenant ADD CONSTRAINT fk_tenant_11 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE tenant_id_document ADD CONSTRAINT fk_tenant_id_docu_12 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE tenant_id_document ADD CONSTRAINT fk_tenant_id_docu_13 FOREIGN KEY (document_id) REFERENCES document (id);
ALTER TABLE lease ADD CONSTRAINT fk_lease_14 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE lease ADD CONSTRAINT fk_lease_15 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE lease ADD CONSTRAINT fk_lease_16 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE lease ADD CONSTRAINT fk_lease_17 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE rent_charge ADD CONSTRAINT fk_rent_charge_18 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE rent_charge ADD CONSTRAINT fk_rent_charge_19 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE rent_charge ADD CONSTRAINT fk_rent_charge_20 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE rent_charge ADD CONSTRAINT fk_rent_charge_21 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE rent_charge ADD CONSTRAINT fk_rent_charge_22 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_23 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_24 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_25 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_26 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_27 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE payment ADD CONSTRAINT fk_payment_28 FOREIGN KEY (bank_account_id) REFERENCES bank_account (id);
ALTER TABLE payment_application ADD CONSTRAINT fk_payment_applic_29 FOREIGN KEY (payment_id) REFERENCES payment (id);
ALTER TABLE payment_application ADD CONSTRAINT fk_payment_applic_30 FOREIGN KEY (charge_id) REFERENCES rent_charge (id);
ALTER TABLE vendor ADD CONSTRAINT fk_vendor_31 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE expense_category ADD CONSTRAINT fk_expense_catego_32 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE expense_category ADD CONSTRAINT fk_expense_catego_33 FOREIGN KEY (account_id) REFERENCES account (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_34 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_35 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_36 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_37 FOREIGN KEY (category_id) REFERENCES expense_category (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_38 FOREIGN KEY (vendor_id) REFERENCES vendor (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_39 FOREIGN KEY (payment_account_id) REFERENCES bank_account (id);
ALTER TABLE expense ADD CONSTRAINT fk_expense_40 FOREIGN KEY (work_order_id) REFERENCES work_order (id);
ALTER TABLE expense_allocation ADD CONSTRAINT fk_expense_alloca_41 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE expense_allocation ADD CONSTRAINT fk_expense_alloca_42 FOREIGN KEY (expense_id) REFERENCES expense (id) ON DELETE CASCADE;
ALTER TABLE expense_allocation ADD CONSTRAINT fk_expense_alloca_43 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE bill ADD CONSTRAINT fk_bill_44 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE bill ADD CONSTRAINT fk_bill_45 FOREIGN KEY (vendor_id) REFERENCES vendor (id);
ALTER TABLE bill ADD CONSTRAINT fk_bill_46 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE bill ADD CONSTRAINT fk_bill_47 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE bill ADD CONSTRAINT fk_bill_48 FOREIGN KEY (category_id) REFERENCES expense_category (id);
ALTER TABLE bill_payment ADD CONSTRAINT fk_bill_payment_49 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE bill_payment ADD CONSTRAINT fk_bill_payment_50 FOREIGN KEY (bill_id) REFERENCES bill (id);
ALTER TABLE bill_payment ADD CONSTRAINT fk_bill_payment_51 FOREIGN KEY (bank_account_id) REFERENCES bank_account (id);
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_52 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_53 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_54 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE invoice_line ADD CONSTRAINT fk_invoice_line_55 FOREIGN KEY (invoice_id) REFERENCES invoice (id) ON DELETE CASCADE;
ALTER TABLE invoice_line ADD CONSTRAINT fk_invoice_line_56 FOREIGN KEY (charge_id) REFERENCES rent_charge (id);
ALTER TABLE credit_note ADD CONSTRAINT fk_credit_note_57 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE credit_note ADD CONSTRAINT fk_credit_note_58 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE credit_note ADD CONSTRAINT fk_credit_note_59 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE credit_note ADD CONSTRAINT fk_credit_note_60 FOREIGN KEY (invoice_id) REFERENCES invoice (id);
ALTER TABLE item ADD CONSTRAINT fk_item_61 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE item ADD CONSTRAINT fk_item_62 FOREIGN KEY (account_id) REFERENCES account (id);
ALTER TABLE credit_note_line ADD CONSTRAINT fk_credit_note_li_63 FOREIGN KEY (credit_note_id) REFERENCES credit_note (id) ON DELETE CASCADE;
ALTER TABLE credit_note_line ADD CONSTRAINT fk_credit_note_li_64 FOREIGN KEY (item_id) REFERENCES item (id);
ALTER TABLE credit_note_line ADD CONSTRAINT fk_credit_note_li_65 FOREIGN KEY (account_id) REFERENCES account (id);
ALTER TABLE credit_application ADD CONSTRAINT fk_credit_applica_66 FOREIGN KEY (credit_note_id) REFERENCES credit_note (id);
ALTER TABLE credit_application ADD CONSTRAINT fk_credit_applica_67 FOREIGN KEY (charge_id) REFERENCES rent_charge (id);
ALTER TABLE maintenance_request ADD CONSTRAINT fk_maintenance_re_68 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE maintenance_request ADD CONSTRAINT fk_maintenance_re_69 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE maintenance_request ADD CONSTRAINT fk_maintenance_re_70 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE maintenance_request ADD CONSTRAINT fk_maintenance_re_71 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_72 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_73 FOREIGN KEY (request_id) REFERENCES maintenance_request (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_74 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_75 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_76 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE work_order ADD CONSTRAINT fk_work_order_77 FOREIGN KEY (vendor_id) REFERENCES vendor (id);
ALTER TABLE bank_account ADD CONSTRAINT fk_bank_account_78 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE bank_account ADD CONSTRAINT fk_bank_account_79 FOREIGN KEY (gl_account_id) REFERENCES account (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_80 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_81 FOREIGN KEY (bank_account_id) REFERENCES bank_account (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_82 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_83 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_84 FOREIGN KEY (vendor_id) REFERENCES vendor (id);
ALTER TABLE bank_transaction ADD CONSTRAINT fk_bank_transacti_85 FOREIGN KEY (reconciliation_id) REFERENCES reconciliation (id);
ALTER TABLE reconciliation ADD CONSTRAINT fk_reconciliation_86 FOREIGN KEY (bank_account_id) REFERENCES bank_account (id);
ALTER TABLE account ADD CONSTRAINT fk_account_87 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE account ADD CONSTRAINT fk_account_88 FOREIGN KEY (parent_id) REFERENCES account (id);
ALTER TABLE journal_entry ADD CONSTRAINT fk_journal_entry_89 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE journal_entry ADD CONSTRAINT fk_journal_entry_90 FOREIGN KEY (reversal_of_id) REFERENCES journal_entry (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__91 FOREIGN KEY (entry_id) REFERENCES journal_entry (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__92 FOREIGN KEY (account_id) REFERENCES account (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__93 FOREIGN KEY (property_id) REFERENCES property (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__94 FOREIGN KEY (unit_id) REFERENCES unit (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__95 FOREIGN KEY (tenant_id) REFERENCES tenant (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__96 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__97 FOREIGN KEY (vendor_id) REFERENCES vendor (id);
ALTER TABLE journal_entry_line ADD CONSTRAINT fk_journal_entry__98 FOREIGN KEY (bank_account_id) REFERENCES bank_account (id);
ALTER TABLE recurring_template ADD CONSTRAINT fk_recurring_temp_99 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE document ADD CONSTRAINT fk_document_100 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE document_version ADD CONSTRAINT fk_document_versi_101 FOREIGN KEY (document_id) REFERENCES document (id);
ALTER TABLE signature_request ADD CONSTRAINT fk_signature_requ_102 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE signature_request ADD CONSTRAINT fk_signature_requ_103 FOREIGN KEY (document_id) REFERENCES document (id);
ALTER TABLE signature_request ADD CONSTRAINT fk_signature_requ_104 FOREIGN KEY (lease_id) REFERENCES lease (id);
ALTER TABLE signer ADD CONSTRAINT fk_signer_105 FOREIGN KEY (request_id) REFERENCES signature_request (id) ON DELETE CASCADE;
ALTER TABLE signature_field ADD CONSTRAINT fk_signature_fiel_106 FOREIGN KEY (request_id) REFERENCES signature_request (id) ON DELETE CASCADE;
ALTER TABLE signature_field ADD CONSTRAINT fk_signature_fiel_107 FOREIGN KEY (signer_id) REFERENCES signer (id) ON DELETE CASCADE;
ALTER TABLE signature_event ADD CONSTRAINT fk_signature_even_108 FOREIGN KEY (request_id) REFERENCES signature_request (id);
ALTER TABLE signature_event ADD CONSTRAINT fk_signature_even_109 FOREIGN KEY (signer_id) REFERENCES signer (id);
ALTER TABLE notification_rule ADD CONSTRAINT fk_notification_r_110 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE notification ADD CONSTRAINT fk_notification_111 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE notification ADD CONSTRAINT fk_notification_112 FOREIGN KEY (user_id) REFERENCES app_user (id);
ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_113 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_114 FOREIGN KEY (user_id) REFERENCES app_user (id);
ALTER TABLE domain_event ADD CONSTRAINT fk_domain_event_115 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE webhook_endpoint ADD CONSTRAINT fk_webhook_endpoi_116 FOREIGN KEY (business_id) REFERENCES business (id);
ALTER TABLE webhook_delivery ADD CONSTRAINT fk_webhook_delive_117 FOREIGN KEY (event_id) REFERENCES domain_event (id);
ALTER TABLE webhook_delivery ADD CONSTRAINT fk_webhook_delive_118 FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoint (id);

-- Indexes (including unique indexes that tolerate NULLs the way PostgreSQL does)

CREATE INDEX ix_user_session_1 ON user_session (user_id);
CREATE INDEX ix_property_2 ON property (business_id);
CREATE INDEX ix_unit_3 ON unit (business_id, property_id);
CREATE INDEX ix_tenant_4 ON tenant (business_id, last_name);
CREATE INDEX ix_tenant_id_docu_5 ON tenant_id_document (tenant_id);
CREATE INDEX ix_lease_6 ON lease (business_id, status);
CREATE INDEX ix_lease_7 ON lease (unit_id, status);
CREATE INDEX ix_lease_8 ON lease (tenant_id);
CREATE UNIQUE INDEX uq_rent_charge_10 ON rent_charge (lease_id, type, period_start);
CREATE INDEX ix_rent_charge_9 ON rent_charge (business_id, status, due_date);
CREATE UNIQUE INDEX uq_payment_12 ON payment (business_id, idempotency_key);
CREATE INDEX ix_payment_10 ON payment (business_id, received_on);
CREATE INDEX ix_vendor_11 ON vendor (business_id, company);
CREATE INDEX ix_expense_12 ON expense (business_id, entry_date);
CREATE INDEX ix_expense_13 ON expense (business_id, property_id);
CREATE INDEX ix_expense_alloca_14 ON expense_allocation (expense_id);
CREATE INDEX ix_bill_15 ON bill (business_id, status, due_date);
CREATE INDEX ix_invoice_16 ON invoice (business_id, status, due_date);
CREATE INDEX ix_invoice_line_17 ON invoice_line (invoice_id);
CREATE INDEX ix_credit_note_18 ON credit_note (business_id, tenant_id);
CREATE INDEX ix_credit_note_li_19 ON credit_note_line (credit_note_id);
CREATE INDEX ix_credit_applica_20 ON credit_application (charge_id);
CREATE INDEX ix_maintenance_re_21 ON maintenance_request (business_id, status);
CREATE INDEX ix_work_order_22 ON work_order (business_id, status);
CREATE UNIQUE INDEX uq_bank_transacti_27 ON bank_transaction (bank_account_id, external_id);
CREATE INDEX ix_bank_transacti_23 ON bank_transaction (business_id, bank_account_id, entry_date);
CREATE UNIQUE INDEX uq_account_29 ON account (business_id, system_key);
CREATE INDEX ix_journal_entry_24 ON journal_entry (business_id, entry_date);
CREATE INDEX ix_journal_entry_25 ON journal_entry (source_type, source_id);
CREATE INDEX ix_journal_entry__26 ON journal_entry_line (business_id, account_id, entry_date);
CREATE INDEX ix_journal_entry__27 ON journal_entry_line (business_id, property_id, entry_date);
CREATE INDEX ix_journal_entry__28 ON journal_entry_line (business_id, unit_id, entry_date);
CREATE INDEX ix_journal_entry__29 ON journal_entry_line (business_id, tenant_id);
CREATE INDEX ix_recurring_temp_30 ON recurring_template (is_active, next_run_on);
CREATE INDEX ix_document_31 ON document (business_id, owner_type, owner_id);
CREATE INDEX ix_document_32 ON document (business_id, expires_on);
CREATE INDEX ix_signature_requ_33 ON signature_request (business_id, status);
CREATE INDEX ix_signer_34 ON signer (request_id);
CREATE INDEX ix_signature_fiel_35 ON signature_field (request_id, signer_id);
CREATE INDEX ix_signature_even_36 ON signature_event (request_id, created_at);
CREATE UNIQUE INDEX uq_notification_37 ON notification (business_id, dedupe_key);
CREATE INDEX ix_notification_37 ON notification (user_id, read_at);
CREATE INDEX ix_audit_log_38 ON audit_log (business_id, entity_type, entity_id);
CREATE INDEX ix_audit_log_39 ON audit_log (business_id, created_at);
CREATE INDEX ix_domain_event_40 ON domain_event (business_id, type, created_at);
CREATE INDEX ix_webhook_delive_41 ON webhook_delivery (status, next_attempt_at);

-- Business rule: a ledger line is either a debit or a credit, never both
ALTER TABLE journal_entry_line ADD CONSTRAINT ck_jel_one_side CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0));

-- Not included yet (need triggers): balanced journal entries, immutable posted entries and signed documents,
-- append-only audit and signature logs, one active lease per unit.

-- Bill schedules (also available on its own as add_bill_schedule.sql)
CREATE TABLE bill_schedule (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  property_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  bill_type varchar(40) NOT NULL,
  amount_cents integer NOT NULL,
  frequency varchar(40) NOT NULL,
  repeat_every integer DEFAULT 1 NOT NULL,
  repeat_unit varchar(10) DEFAULT 'MONTH' NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes varchar(2000),
  is_active smallint DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_bill_schedule PRIMARY KEY (id),
  CONSTRAINT ck_bill_schedule_f CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','CUSTOM')),
  CONSTRAINT ck_bill_schedule_u CHECK (repeat_unit IN ('DAY','WEEK','MONTH')),
  CONSTRAINT ck_bill_schedule_a CHECK (is_active IN (0,1))
);

-- One row per occurrence that has been handled (posted as a bill or skipped).
CREATE TABLE bill_schedule_run (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL,
  due_date DATE NOT NULL,
  status varchar(10) NOT NULL,
  journal_entry_id uuid,
  handled_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_bill_schedule_run PRIMARY KEY (id),
  CONSTRAINT ck_bill_schedule_run_s CHECK (status IN ('POSTED','SKIPPED')),
  CONSTRAINT uq_bill_schedule_run UNIQUE (schedule_id, due_date)
);
ALTER TABLE bill_schedule_run ADD CONSTRAINT fk_bill_schedule_run FOREIGN KEY (schedule_id) REFERENCES bill_schedule (id) ON DELETE CASCADE;

-- Households: who is on each lease (also available on its own as add_lease_tenant.sql)
CREATE TABLE lease_tenant (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lease_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  role varchar(20) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pk_lease_tenant PRIMARY KEY (id),
  CONSTRAINT ck_lease_tenant_role CHECK (role IN ('PRIMARY','CO_TENANT','OCCUPANT')),
  CONSTRAINT uq_lease_tenant UNIQUE (lease_id, tenant_id)
);
ALTER TABLE lease_tenant ADD CONSTRAINT fk_lease_tenant_lease FOREIGN KEY (lease_id) REFERENCES lease (id) ON DELETE CASCADE;

-- Lock down Supabase's auto-generated REST API
ALTER TABLE business ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE property ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_id_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_charge ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE item ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE signer ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_schedule_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_tenant ENABLE ROW LEVEL SECURITY;
