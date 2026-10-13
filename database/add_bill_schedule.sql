-- Bill schedules: expected bills that repeat (daily, weekly, monthly or every N days/weeks/months).
-- Already included in schema_oracle.sql. Run this file on its own only if your database was created before bill schedules existed.
CREATE TABLE bill_schedule (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  business_id RAW(16) NOT NULL,
  property_id RAW(16) NOT NULL,
  vendor_id RAW(16) NOT NULL,
  bill_type VARCHAR2(40 CHAR) NOT NULL,
  amount_cents NUMBER(10) NOT NULL,
  frequency VARCHAR2(40 CHAR) NOT NULL,
  repeat_every NUMBER(5) DEFAULT 1 NOT NULL,
  repeat_unit VARCHAR2(10 CHAR) DEFAULT 'MONTH' NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes VARCHAR2(2000 CHAR),
  is_active NUMBER(1) DEFAULT 1 NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_bill_schedule PRIMARY KEY (id),
  CONSTRAINT ck_bill_schedule_f CHECK (frequency IN ('DAILY','WEEKLY','MONTHLY','CUSTOM')),
  CONSTRAINT ck_bill_schedule_u CHECK (repeat_unit IN ('DAY','WEEK','MONTH')),
  CONSTRAINT ck_bill_schedule_a CHECK (is_active IN (0,1))
);

-- One row per occurrence that has been handled (posted as a bill or skipped).
CREATE TABLE bill_schedule_run (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  schedule_id RAW(16) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR2(10 CHAR) NOT NULL,
  journal_entry_id RAW(16),
  handled_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_bill_schedule_run PRIMARY KEY (id),
  CONSTRAINT ck_bill_schedule_run_s CHECK (status IN ('POSTED','SKIPPED')),
  CONSTRAINT uq_bill_schedule_run UNIQUE (schedule_id, due_date)
);
ALTER TABLE bill_schedule_run ADD CONSTRAINT fk_bill_schedule_run FOREIGN KEY (schedule_id) REFERENCES bill_schedule (id) ON DELETE CASCADE;
