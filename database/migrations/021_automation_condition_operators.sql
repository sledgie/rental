-- =====================================================================================================================
-- 021_automation_condition_operators.sql
-- The rule editor can test whether a field is empty or not empty; the allowed operator list of automation_rule_conditions did not include them.
-- =====================================================================================================================
begin;
set local search_path = public, extensions;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.automation_rule_conditions'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%operator%'
  loop
    execute format('alter table public.automation_rule_conditions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.automation_rule_conditions
  add constraint automation_rule_conditions_operator_check
  check (operator in ('equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'contains', 'in', 'is_true', 'is_false', 'is_empty', 'is_not_empty'));

commit;
