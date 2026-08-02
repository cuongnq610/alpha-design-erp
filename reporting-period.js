(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AlphaReportingPeriod=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PRESETS=new Set(['year','quarter','month','custom']);
  const pad=(value)=>String(value).padStart(2,'0');
  function localISODate(value=new Date()){
    const date=value instanceof Date?value:new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function isISODate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const date=new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime())&&localISODate(date)===value;
  }
  function periodForPreset(preset='year',now=new Date()){
    const current=now instanceof Date?new Date(now.getTime()):new Date(now);
    if(Number.isNaN(current.getTime()))throw new TypeError('Invalid reporting-period anchor date');
    const safe=PRESETS.has(preset)&&preset!=='custom'?preset:'year';
    let start,end;
    if(safe==='year'){
      start=new Date(current.getFullYear(),0,1);
      end=new Date(current.getFullYear(),11,31);
    }else if(safe==='quarter'){
      const quarter=Math.floor(current.getMonth()/3);
      start=new Date(current.getFullYear(),quarter*3,1);
      end=new Date(current.getFullYear(),quarter*3+3,0);
    }else{
      start=new Date(current.getFullYear(),current.getMonth(),1);
      end=new Date(current.getFullYear(),current.getMonth()+1,0);
    }
    return {preset:safe,from:localISODate(start),to:localISODate(end),anchorDate:localISODate(current)};
  }
  function normalizeState(raw,now=new Date()){
    const source=raw&&typeof raw==='object'?raw:{};
    const preset=PRESETS.has(source.preset)?source.preset:'year';
    if(preset==='custom'&&isISODate(source.from)&&isISODate(source.to)&&source.from<=source.to){
      return {preset,from:source.from,to:source.to,anchorDate:localISODate(now)};
    }
    return periodForPreset(preset==='custom'?'year':preset,now);
  }
  function statutoryDateText(value){
    if(!isISODate(value))return 'ngày … tháng … năm …';
    const [year,month,day]=value.split('-').map(Number);
    return `ngày ${day} tháng ${month} năm ${year}`;
  }
  function periodLine(form,range={}){
    const endYear=isISODate(range.to)?range.to.slice(0,4):'…';
    return ['B01a-DNN','B01-DNN','B01-DN','B01-DNSN'].includes(String(form||''))?`Tại ${statutoryDateText(range.to)}`:`Năm ${endYear}`;
  }
  return Object.freeze({PRESETS:Object.freeze([...PRESETS]),localISODate,isISODate,periodForPreset,normalizeState,statutoryDateText,periodLine});
});
