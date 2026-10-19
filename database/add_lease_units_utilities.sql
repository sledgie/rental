-- Multi-unit leases and utility responsibility.
-- Already included in schema_oracle.sql. Run this file on its own (Run Script) only if your database was created
-- before these tables existed. Safe to run once.
--
-- lease_unit     every unit a lease covers (one contract can cover several units, or a whole house).
--                lease.unit_id stays as the lead unit; the lead unit is also listed here.
--                rent_cents is this unit's share of the rent; NULL means "use the lease's monthly_rent_cents as a single total".
-- lease_utility  who pays each bill type for a lease:
--                  LANDLORD  the landlord pays, nothing is charged to tenants
--                  TENANT    the tenants pay 100%
--                  SPLIT     tenants pay tenant_pct percent, the landlord pays the rest
--                The tenants' part is divided between the liable tenants (primary and co-tenants) by
--                lease_utility_share.pct, or equally when no shares are set.
-- lease_utility_share  tenant-to-tenant percentages for one lease_utility row (must add up to 100).
CREATE TABLE lease_unit (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  lease_id RAW(16) NOT NULL,
  unit_id RAW(16) NOT NULL,
  rent_cents NUMBER(10),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lease_unit PRIMARY KEY (id),
  CONSTRAINT uq_lease_unit UNIQUE (lease_id, unit_id)
);
ALTER TABLE lease_unit ADD CONSTRAINT fk_lease_unit_lease FOREIGN KEY (lease_id) REFERENCES lease (id) ON DELETE CASCADE;

CREATE TABLE lease_utility (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  lease_id RAW(16) NOT NULL,
  bill_type VARCHAR2(40 CHAR) NOT NULL,
  payer VARCHAR2(10 CHAR) DEFAULT 'LANDLORD' NOT NULL,
  tenant_pct NUMBER(5,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lease_utility PRIMARY KEY (id),
  CONSTRAINT ck_lease_utility_payer CHECK (payer IN ('LANDLORD','TENANT','SPLIT')),
  CONSTRAINT ck_lease_utility_pct CHECK (tenant_pct BETWEEN 0 AND 100),
  CONSTRAINT uq_lease_utility UNIQUE (lease_id, bill_type)
);
ALTER TABLE lease_utility ADD CONSTRAINT fk_lease_utility_lease FOREIGN KEY (lease_id) REFERENCES lease (id) ON DELETE CASCADE;

CREATE TABLE lease_utility_share (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  lease_utility_id RAW(16) NOT NULL,
  tenant_id RAW(16) NOT NULL,
  pct NUMBER(5,2) NOT NULL,
  CONSTRAINT pk_lease_utility_share PRIMARY KEY (id),
  CONSTRAINT ck_lease_utility_share CHECK (pct BETWEEN 0 AND 100),
  CONSTRAINT uq_lease_utility_share UNIQUE (lease_utility_id, tenant_id)
);
ALTER TABLE lease_utility_share ADD CONSTRAINT fk_lease_utility_share FOREIGN KEY (lease_utility_id) REFERENCES lease_utility (id) ON DELETE CASCADE;

-- Existing leases cover just their own unit.
INSERT INTO lease_unit (lease_id, unit_id) SELECT id, unit_id FROM lease;
COMMIT;
