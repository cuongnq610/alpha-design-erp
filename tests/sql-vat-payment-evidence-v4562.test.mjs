import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/070_vat_payment_evidence_tk242_parity_v4562.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../SUPABASE_PRODUCTION_SCHEMA.sql',import.meta.url),'utf8');

for(const marker of [
  'validate_entity_payload_pre_v4562',
  'VAT_PAYMENT_IMMUTABLE',
  'VAT_INPUT_INVOICE_REQUIRED',
  'VAT_PAYMENT_BANK_EVIDENCE',
  'VAT_PAYMENT_VENDOR_EVIDENCE',
  'VAT_PAYMENT_OVERPAYMENT',
  'VAT_LINKED_INVOICE_IMMUTABLE',
  'linked Input-invoice payment evidence cannot be deleted',
  "active_release_version set default '4.5.62'",
  "p_release_version<>'4.5.62' or p_migration_version<>70"
]) assert.ok(migration.includes(marker),`Migration 070 is missing ${marker}`);

assert.match(migration,/account 112 must fund the exact amount and account 111 must be zero/);
assert.match(migration,/pg_advisory_xact_lock\(hashtextextended\(p_company::text\|\|'\|input-vat-payment\|'/);
assert.match(migration,/revoke all on function app\.validate_entity_payload\(uuid,text,text,jsonb\) from public,anon,authenticated/);
assert.ok(schema.includes(migration.trim()),'Consolidated schema must contain exact migration 070 source');

console.log('PASS inherited v4.5.62 server-side Input-VAT bank evidence, immutability, overpayment and certification guards');
