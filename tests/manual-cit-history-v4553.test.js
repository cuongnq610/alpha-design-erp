const assert=require('node:assert/strict');
const C=require('../calculation-core.js');
const settings={
  citRateMode:'Manual',
  corporateTaxRate:19,
  citManualRateHistory:[
    {effectiveFrom:'2025-01-01',rate:20},
    {effectiveFrom:'2026-07-01',rate:17},
    {effectiveFrom:'2027-01-01',rate:18}
  ]
};
assert.equal(C.citRate(settings,{to:'2026-06-30'}),20);
assert.equal(C.citRate(settings,{to:'2026-07-01'}),17);
assert.equal(C.citRate(settings,{to:'2026-12-31'}),17);
assert.equal(C.citRate(settings,{to:'2027-01-01'}),18);
assert.equal(C.citRate(settings,{to:'2024-12-31'}),19,'Before first history date, use current manual fallback');
console.log('PASS v4.5.53 effective-dated manual CIT history');
