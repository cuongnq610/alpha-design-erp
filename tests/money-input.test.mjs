import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const M=require(path.join(root,'money-input.js'));
const {formatMoneyInput,numericToDisplay,parseMoneyInput,formatMoneyCaret}=M;

// --- numericToDisplay: initial / programmatic values (vi-VN: "." thousands, "," decimal) ---
assert.equal(numericToDisplay(0,{decimals:0}),'0','zero renders as 0');
assert.equal(numericToDisplay(1000000,{decimals:0}),'1.000.000','integer VND grouped with dots');
assert.equal(numericToDisplay(1234567,{decimals:0}),'1.234.567');
assert.equal(numericToDisplay(1234567.89,{decimals:2}),'1.234.567,89','decimals use a comma');
assert.equal(numericToDisplay(1500000.5,{decimals:2}),'1.500.000,5','large grouped value keeps decimal comma');
assert.equal(numericToDisplay('',{decimals:0}),'','empty stays empty');
assert.equal(numericToDisplay(null,{decimals:0}),'','null stays empty');
assert.equal(numericToDisplay(NaN,{decimals:0}),'','non-finite stays empty');
assert.equal(numericToDisplay('abc',{decimals:0}),'','non-numeric stays empty');

// --- formatMoneyInput: live editing ---
assert.equal(formatMoneyInput('',{decimals:0}),'','empty typed stays empty');
assert.equal(formatMoneyInput('0',{decimals:0}),'0');
assert.equal(formatMoneyInput('1000000',{decimals:0}),'1.000.000','groups as you type');
assert.equal(formatMoneyInput('1234567',{decimals:0}),'1.234.567');
assert.equal(formatMoneyInput('007',{decimals:0}),'7','strips leading zeros');
assert.equal(formatMoneyInput('1.000.000',{decimals:0}),'1.000.000','re-formatting is stable');
assert.equal(formatMoneyInput('1.5',{decimals:0}),'15','decimals:0 ignores separators');
// decimals:2 in-progress typing
assert.equal(formatMoneyInput('1234,',{decimals:2}),'1.234,','keeps a trailing decimal separator');
assert.equal(formatMoneyInput('1234,5',{decimals:2}),'1.234,5');
assert.equal(formatMoneyInput('1234,567',{decimals:2}),'1.234,56','truncates beyond the decimal limit');
assert.equal(formatMoneyInput(',5',{decimals:2}),'0,5','leading decimal gets a 0');
assert.equal(formatMoneyInput('1.500.000,5',{decimals:2}),'1.500.000,5','large grouped + decimal is stable');

// --- parseMoneyInput: display -> plain JS-numeric string (Number-safe) ---
assert.equal(parseMoneyInput(''),'','empty parses to empty');
assert.equal(parseMoneyInput('0'),'0');
assert.equal(parseMoneyInput('1.000.000'),'1000000','strips grouping dots');
assert.equal(parseMoneyInput('1.234.567,89'),'1234567.89','comma decimal -> dot decimal');
assert.equal(parseMoneyInput(',5'),'0.5');
assert.equal(parseMoneyInput('1.234,'),'1234','trailing comma dropped');
assert.equal(parseMoneyInput('abc'),'','garbage parses to empty');
assert.equal(Number(parseMoneyInput('1.234.567,89')),1234567.89,'Number() round-trips');
assert.ok(Number.isNaN(Number(parseMoneyInput('')||NaN))===false||parseMoneyInput('')==='','empty is safe');

// --- round-trip: numericToDisplay -> parseMoneyInput ---
for(const n of [0,1,999,1000,1000000,1234567,999999999999]){
  assert.equal(parseMoneyInput(numericToDisplay(n,{decimals:0})),String(n),`round-trip integer ${n}`);
}
assert.equal(Number(parseMoneyInput(numericToDisplay(1234567.89,{decimals:2}))),1234567.89,'round-trip decimal');

// --- formatMoneyCaret: caret preservation ---
let r=formatMoneyCaret('1000',4,{decimals:0});
assert.equal(r.value,'1.000');
assert.equal(r.caret,5,'caret at end stays at end after a group dot is inserted');
r=formatMoneyCaret('1000000',1,{decimals:0});
assert.equal(r.value,'1.000.000');
assert.equal(r.caret,1,'caret after the first digit stays after that digit');
r=formatMoneyCaret('1234,5',6,{decimals:2});
assert.equal(r.value,'1.234,5');
assert.equal(r.caret,7,'caret after the decimal digit is preserved');

console.log('PASS money-input: format/parse/caret for vi-VN currency inputs');
