(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AlphaMoneyInput=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Vietnamese (vi-VN) convention, matching the app's fmtMoney display:
  //   thousands separator = "."   decimal separator = ","
  const GROUP='.';
  const DECIMAL=',';

  function clampDecimals(value){
    const d=Math.trunc(Number(value)||0);
    return d<0?0:d>6?6:d;
  }

  function group(digits){
    return digits?digits.replace(/\B(?=(\d{3})+(?!\d))/g,GROUP):'';
  }

  // Break a display/editing string into normalized integer + decimal digit runs.
  // The decimal separator is "," (vi-VN); "." is always grouping and is ignored on input.
  function split(raw,decimals){
    const s=String(raw==null?'':raw);
    let intRaw='',decRaw='';
    const at=decimals>0?s.lastIndexOf(DECIMAL):-1;
    if(at>=0){intRaw=s.slice(0,at);decRaw=s.slice(at+1);}
    else intRaw=s;
    return {
      intDigits:intRaw.replace(/\D/g,'').replace(/^0+(?=\d)/,''),
      decDigits:decRaw.replace(/\D/g,'').slice(0,decimals),
      hasDecimalSep:at>=0
    };
  }

  // Live formatting for what the user is actively typing. Preserves a trailing
  // decimal separator and in-progress decimals so editing feels natural
  // (e.g. "1234," -> "1.234,",  "1234,5" -> "1.234,5").
  function formatMoneyInput(raw,opts){
    const decimals=clampDecimals(opts&&opts.decimals);
    const {intDigits,decDigits,hasDecimalSep}=split(raw,decimals);
    if(intDigits===''&&decDigits===''&&!hasDecimalSep)return '';
    let out=intDigits===''?(hasDecimalSep?'0':''):group(intDigits);
    if(hasDecimalSep)out+=DECIMAL+decDigits;
    return out;
  }

  // Format a real numeric value (JS number or JS-numeric string like "1234567.89")
  // into a vi-VN display string. Used for initial/programmatic values.
  function numericToDisplay(value,opts){
    const decimals=clampDecimals(opts&&opts.decimals);
    if(value===''||value==null)return '';
    const n=Number(value);
    if(!Number.isFinite(n))return '';
    return new Intl.NumberFormat('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:decimals}).format(n);
  }

  // Convert a display/editing string back into a plain JS-numeric string
  // ("1.234.567,89" -> "1234567.89"), or "" when empty. Number(parseMoneyInput(x))
  // is always safe.
  function parseMoneyInput(raw){
    const s=String(raw==null?'':raw);
    const at=s.lastIndexOf(DECIMAL);
    const intRaw=at>=0?s.slice(0,at):s;
    const decRaw=at>=0?s.slice(at+1):'';
    const intDigits=intRaw.replace(/\D/g,'').replace(/^0+(?=\d)/,'');
    const decDigits=decRaw.replace(/\D/g,'');
    if(intDigits===''&&decDigits==='')return '';
    return decDigits?(intDigits||'0')+'.'+decDigits:(intDigits||'0');
  }

  // Live formatting with caret preservation: place the caret after the same number
  // of significant characters (digits + decimal separator) it followed before.
  function formatMoneyCaret(raw,caret,opts){
    const decimals=clampDecimals(opts&&opts.decimals);
    const s=String(raw==null?'':raw);
    const pos=Math.max(0,Math.min(Number(caret)||0,s.length));
    let sig=0;
    for(let i=0;i<pos;i++){const ch=s[i];if(/\d/.test(ch)||(decimals>0&&ch===DECIMAL))sig++;}
    const value=formatMoneyInput(s,{decimals});
    let out=0,seen=0;
    while(out<value.length&&seen<sig){const ch=value[out];if(/\d/.test(ch)||ch===DECIMAL)seen++;out++;}
    return {value,caret:out};
  }

  return Object.freeze({formatMoneyInput,numericToDisplay,parseMoneyInput,formatMoneyCaret,GROUP,DECIMAL});
});
