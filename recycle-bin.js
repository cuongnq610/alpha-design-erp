(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AlphaRecycleBin=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const RETENTION_DAYS=30;
  const DAY_MS=24*60*60*1000;
  const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
  const sameId=(left,right)=>String(left??'')===String(right??'');
  const asDate=value=>{
    const date=value instanceof Date?new Date(value.getTime()):new Date(value);
    if(Number.isNaN(date.getTime()))throw new Error('INVALID_TRASH_DATE');
    return date;
  };
  const cleanText=(value,max=240)=>String(value??'').trim().slice(0,max);
  const safeIndex=value=>Math.max(0,Math.min(10_000_000,Math.trunc(Number(value)||0)));
  const makeId=(prefix='trash')=>{
    const strongId=globalThis.crypto?.randomUUID?.();
    return strongId?`${prefix}-${strongId}`:`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  };

  function retentionDeadline(deletedAt){
    return new Date(asDate(deletedAt).getTime()+RETENTION_DAYS*DAY_MS).toISOString();
  }

  function normalizeRelatedRecord(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_RELATED_RECORD');
    const entityType=cleanText(value.entityType,80);
    const record=value.record&&typeof value.record==='object'&&!Array.isArray(value.record)?clone(value.record):null;
    if(!entityType||!record||!cleanText(record.id,180))throw new Error('INVALID_RELATED_RECORD');
    return {entityType,record,originalIndex:safeIndex(value.originalIndex)};
  }

  function createEntry(options={}){
    const entityType=cleanText(options.entityType,80);
    const record=options.record&&typeof options.record==='object'&&!Array.isArray(options.record)?clone(options.record):null;
    if(!entityType||!record||!cleanText(record.id,180))throw new Error('INVALID_TRASH_RECORD');
    const deletedAt=asDate(options.deletedAt||new Date()).toISOString();
    const id=cleanText(options.id,180)||makeId('trash');
    return {
      id,
      entityType,
      recordId:cleanText(record.id,180),
      record,
      relatedRecords:(options.relatedRecords||[]).map(normalizeRelatedRecord),
      originalIndex:safeIndex(options.originalIndex),
      sourceView:cleanText(options.sourceView,80)||entityType,
      sourceLabel:cleanText(options.sourceLabel,160)||entityType,
      sourceContext:options.sourceContext&&typeof options.sourceContext==='object'&&!Array.isArray(options.sourceContext)?clone(options.sourceContext):{},
      displayName:cleanText(options.displayName,320)||cleanText(record.name||record.title||record.code||record.id,320),
      deletedAt,
      expiresAt:retentionDeadline(deletedAt),
      deletedBy:cleanText(options.deletedBy,240)||'Người dùng',
      deletedByUserId:cleanText(options.deletedByUserId,180),
      deletionReason:cleanText(options.deletionReason,500),
      externalSource:cleanText(options.externalSource,80),
      external:Boolean(options.externalSource||options.external),
      retentionDays:RETENTION_DAYS
    };
  }

  function ensureStore(db){
    if(!db||typeof db!=='object'||Array.isArray(db))throw new Error('INVALID_DATABASE');
    if(!Array.isArray(db.trashEntries))db.trashEntries=[];
    return db.trashEntries;
  }

  function move(db,entityType,recordId,options={}){
    const store=ensureStore(db);
    const collection=db[entityType];
    if(!Array.isArray(collection))throw new Error('INVALID_TRASH_COLLECTION');
    const index=collection.findIndex(item=>sameId(item?.id,recordId));
    if(index<0)throw new Error('TRASH_RECORD_NOT_FOUND');
    const related=(options.relatedRecords||[]).map(normalizeRelatedRecord);
    const seen=new Set([`${entityType}:${String(recordId)}`]);
    for(const item of related){
      const key=`${item.entityType}:${String(item.record.id)}`;
      if(seen.has(key))throw new Error('DUPLICATE_TRASH_RECORD');
      seen.add(key);
      const rows=db[item.entityType];
      const actualIndex=Array.isArray(rows)?rows.findIndex(row=>sameId(row?.id,item.record.id)):-1;
      if(actualIndex<0)throw new Error('RELATED_TRASH_RECORD_NOT_FOUND');
      item.originalIndex=actualIndex;
      item.record=clone(rows[actualIndex]);
    }
    const entry=createEntry({...options,entityType,record:collection[index],originalIndex:index,relatedRecords:related});
    if(store.some(item=>sameId(item.id,entry.id)))throw new Error('DUPLICATE_TRASH_ENTRY');
    const removalPlan=[...related].sort((left,right)=>left.entityType===right.entityType?right.originalIndex-left.originalIndex:left.entityType.localeCompare(right.entityType));
    for(const item of removalPlan){db[item.entityType].splice(item.originalIndex,1);}
    collection.splice(index,1);
    store.unshift(entry);
    return clone(entry);
  }

  function addExternal(db,options={}){
    const store=ensureStore(db);
    const entry=createEntry({...options,external:true});
    if(store.some(item=>sameId(item.id,entry.id)))throw new Error('DUPLICATE_TRASH_ENTRY');
    store.unshift(entry);
    return clone(entry);
  }

  function findEntry(db,entryId){
    return ensureStore(db).find(item=>sameId(item?.id,entryId))||null;
  }

  function restore(db,entryId){
    const store=ensureStore(db);
    const entryIndex=store.findIndex(item=>sameId(item?.id,entryId));
    if(entryIndex<0)throw new Error('TRASH_ENTRY_NOT_FOUND');
    const entry=store[entryIndex];
    if(entry.external)throw new Error('EXTERNAL_TRASH_HANDLER_REQUIRED');
    const records=[{entityType:entry.entityType,record:entry.record,originalIndex:entry.originalIndex},...(entry.relatedRecords||[])].map(normalizeRelatedRecord);
    for(const item of records){
      if(!Array.isArray(db[item.entityType]))db[item.entityType]=[];
      if(db[item.entityType].some(row=>sameId(row?.id,item.record.id)))throw new Error(`RESTORE_CONFLICT:${item.entityType}:${item.record.id}`);
    }
    const restorePlan=[...records].sort((left,right)=>left.entityType===right.entityType?left.originalIndex-right.originalIndex:0);
    for(const item of restorePlan){
      const index=Math.min(safeIndex(item.originalIndex),db[item.entityType].length);
      db[item.entityType].splice(index,0,clone(item.record));
    }
    store.splice(entryIndex,1);
    return clone(entry);
  }

  function removeEntry(db,entryId){
    const store=ensureStore(db);
    const index=store.findIndex(item=>sameId(item?.id,entryId));
    if(index<0)throw new Error('TRASH_ENTRY_NOT_FOUND');
    return clone(store.splice(index,1)[0]);
  }

  function expiredEntries(db,now=new Date()){
    const timestamp=asDate(now).getTime();
    return ensureStore(db).filter(entry=>{
      const expiry=new Date(entry?.expiresAt||retentionDeadline(entry?.deletedAt)).getTime();
      return Number.isFinite(expiry)&&expiry<=timestamp;
    }).map(clone);
  }

  function daysRemaining(entry,now=new Date()){
    const expiry=new Date(entry?.expiresAt||retentionDeadline(entry?.deletedAt)).getTime();
    if(!Number.isFinite(expiry))return 0;
    return Math.max(0,Math.ceil((expiry-asDate(now).getTime())/DAY_MS));
  }

  return Object.freeze({RETENTION_DAYS,DAY_MS,retentionDeadline,createEntry,ensureStore,move,addExternal,findEntry,restore,removeEntry,expiredEntries,daysRemaining});
});
