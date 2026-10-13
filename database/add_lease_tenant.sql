-- Households: one lease per unit, with several people on it.
--   PRIMARY    the tenant responsible for the rent (lease.tenant_id always points at this person)
--   CO_TENANT  also on the lease and liable; can pay
--   OCCUPANT   lives there (for example a child) but is not on the lease and owes nothing
-- Already included in schema_oracle.sql. Run this file on its own (Run Script) only if your database was created
-- before households existed. Safe to run once; it also merges units that had one lease per tenant.
CREATE TABLE lease_tenant (
  id RAW(16) DEFAULT SYS_GUID() NOT NULL,
  lease_id RAW(16) NOT NULL,
  tenant_id RAW(16) NOT NULL,
  role VARCHAR2(20 CHAR) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_lease_tenant PRIMARY KEY (id),
  CONSTRAINT ck_lease_tenant_role CHECK (role IN ('PRIMARY','CO_TENANT','OCCUPANT')),
  CONSTRAINT uq_lease_tenant UNIQUE (lease_id, tenant_id)
);
ALTER TABLE lease_tenant ADD CONSTRAINT fk_lease_tenant_lease FOREIGN KEY (lease_id) REFERENCES lease (id) ON DELETE CASCADE;

-- Every current lease starts with its tenant as the primary.
INSERT INTO lease_tenant (lease_id, tenant_id, role)
  SELECT id, tenant_id, 'PRIMARY' FROM lease WHERE status IN ('ACTIVE','DRAFT');

-- Old model: a unit with several current leases (one per co-tenant). Keep the oldest lease as the household lease,
-- turn the other tenants into co-tenants on it and end their separate leases.
DECLARE
  keeper RAW(16);
BEGIN
  FOR x IN (SELECT id, unit_id, ROW_NUMBER() OVER (PARTITION BY unit_id ORDER BY created_at, id) rn
              FROM lease WHERE status IN ('ACTIVE','DRAFT')) LOOP
    IF x.rn > 1 THEN
      SELECT id INTO keeper FROM lease WHERE unit_id = x.unit_id AND status IN ('ACTIVE','DRAFT') ORDER BY created_at, id FETCH FIRST 1 ROWS ONLY;
      UPDATE lease_tenant SET lease_id = keeper, role = 'CO_TENANT' WHERE lease_id = x.id;
      UPDATE lease SET status = 'TERMINATED', terminated_at = TRUNC(SYSDATE) WHERE id = x.id;
    END IF;
  END LOOP;
  COMMIT;
END;
/
