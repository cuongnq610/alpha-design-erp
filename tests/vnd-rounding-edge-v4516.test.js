const assert=require('node:assert/strict');
const Calc=require('../calculation-core.js');
const cases=[
  [0,0],[-0,0],[0.49,0],[-0.49,0],[0.5,1],[-0.5,-1],[1.5,2],[-1.5,-2],
  [2.499999999,2],[-2.499999999,-2],[2.500000001,3],[-2.500000001,-3],
  [1004.5,1005],[-1004.5,-1005],[1.005*1000,1005],[-1.005*1000,-1005]
];
for(const [input,expected] of cases){
  assert.equal(Calc.vnd(input),expected,`vnd(${input})`);
  assert.equal(Object.is(Calc.vnd(input),-0),false,'VND result must never be negative zero');
}
// Property: rounding must be odd/symmetric for finite inputs.
let seed=0x4516;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
for(let i=0;i<20000;i++){
  const value=(rnd()-0.5)*2e12+rnd();
  assert.equal(Calc.vnd(-value),-Calc.vnd(value),`symmetric rounding at ${value}`);
  assert.ok(Number.isInteger(Calc.vnd(value)));
}
// Exact schedule invariant including values that leave a final VND remainder.
for(let cost=1;cost<=5000;cost+=37){
  for(let months=1;months<=60;months+=7){
    const rows=Calc.straightLineSchedule({sourceId:'X',kind:'tool',cost,residualValue:0,months,startDate:'2026-01-01'});
    assert.equal(rows.reduce((s,row)=>s+row.amount,0),cost,`schedule total ${cost}/${months}`);
  }
}
console.log('PASS v4.5.18 symmetric VND half-away-from-zero rounding and exact schedule remainder invariants');
