-- Fix: audit_events.action CHECK was a fixed enum (INSERT/UPDATE/DELETE/POST/UNPOST/
-- LOCK/UNLOCK/SIGNOFF) defined in 002, but later features emit many more action codes
-- (UPSERT, SOFT_DELETE, APPROVE_RELEASE, SET_OPERATIONAL_MODE, UPDATE_ACCESS,
-- UPDATE_MODULE_ACCESS, PIPELINE_GATE, CERTIFY_TT133_RELEASE, ACTIVATE, ...). Any of
-- those writes — including every entity_records upsert via apply_entity_change — fails
-- the old constraint (SQLSTATE 23514). Replace the enum with a lenient format check that
-- accepts any uppercase action token, so current and future audit codes are all valid.
alter table public.audit_events drop constraint if exists audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action ~ '^[A-Z][A-Z0-9_]{1,63}$');
