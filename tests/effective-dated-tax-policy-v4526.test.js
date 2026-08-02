'use strict';
const assert = require('assert');
const C = require('../calculation-core.js');

const approved = {
  citRateMode: 'Auto by revenue',
  citStandardRate: 20,
  citReducedRateEligibility: 'Approved',
  citExemptionEligibility: 'Approved',
  citExemptionRevenueThreshold: 1000000000,
  citReducedRateEffectiveYear: 2025,
  citExemptionEffectiveYear: 2026,
  previousYearTaxRevenueBasis: 1000000000
};

assert.equal(C.citPolicyYear({taxYear: 2024}), 2024);
assert.equal(C.citPolicyYear({from: '2025-01-01', to: '2025-12-31'}), 2025);
assert.equal(C.citRate(approved, {taxYear: 2024}), 20, 'Pre-2025 periods must not inherit later reduced or exemption rules');
assert.equal(C.citRate(approved, {taxYear: 2025}), 15, 'The 2025 reduced-rate band applies, but the 2026 exemption does not');
assert.equal(C.citRate(approved, {taxYear: 2026}), 0, 'The approved exemption may apply from its configured effective year');
assert.equal(C.citRate({...approved, previousYearTaxRevenueBasis: 3000000000}, {taxYear: 2025}), 15);
assert.equal(C.citRate({...approved, previousYearTaxRevenueBasis: 49999999999}, {taxYear: 2025}), 17);
assert.equal(C.citRate({...approved, previousYearTaxRevenueBasis: 50000000000}, {taxYear: 2025}), 17);
assert.equal(C.citRate({...approved, previousYearTaxRevenueBasis: 50000000001}, {taxYear: 2026}), 20);
assert.equal(C.citRate({...approved, citRateMode: 'Manual', corporateTaxRate: 18}, {taxYear: 2024}), 18, 'An explicitly approved manual rate remains authoritative');

const db = {
  settings: approved,
  accounts: [],
  openingBalances: [],
  journalEntries: [],
  citAdjustments: []
};
const historical = C.citEstimate(db, {from: '2024-01-01', to: '2024-12-31'});
assert.equal(historical.taxYear, 2024);
assert.equal(historical.rate, 20);
assert.equal(historical.exemptionApplied, false);
assert.equal(historical.requiresExemptionReview, false);
assert.equal(historical.requiresEffectiveDateReview, false);

const effective = C.citEstimate(db, {from: '2026-01-01', to: '2026-12-31'});
assert.equal(effective.taxYear, 2026);
assert.equal(effective.rate, 0);
assert.equal(effective.exemptionApplied, true);
assert.equal(effective.requiresEffectiveDateReview, false);

const mixedPeriod = C.citEstimate(db, {from: '2025-07-01', to: '2026-06-30'});
assert.equal(mixedPeriod.taxYear, 2026);
assert.equal(mixedPeriod.requiresEffectiveDateReview, true, 'A period crossing policy years must require explicit review');

console.log('PASS v4.5.26 effective-dated CIT policy, historical-period isolation and cross-year review checks');
