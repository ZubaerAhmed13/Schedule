/* Non-destructive validation and checked local transactions. No network access. */
(function (root) {
  'use strict';
  const baselines=new WeakMap();
  function remember(storage,key,raw){let values=baselines.get(storage);if(!values){values=new Map();baselines.set(storage,values);}values.set(key,raw);}
  function unchanged(storage,key){const values=baselines.get(storage);return !values?.has(key)||values.get(key)===storage.getItem(key);}
  const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  function validDate(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(0); date.setFullYear(y, m - 1, d); date.setHours(0, 0, 0, 0);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }
  function assertSafeObject(value) {
    const stack = [value]; let visited = 0;
    while (stack.length) {
      const item = stack.pop();
      if (!item || typeof item !== 'object') continue;
      if (++visited > 200000) throw new Error('Backup has too many nested records.');
      for (const key of Object.keys(item)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe property in planner data.');
        stack.push(item[key]);
      }
    }
  }
  function validateTask(task,ids=new Set()){
        if (!plain(task) || typeof task.id !== 'string' || !task.id || ids.has(task.id)) throw new Error('Task IDs must be present and unique within each week.');
        ids.add(task.id);
        if (typeof task.title !== 'string') throw new Error('Task title must be text.');
        if (!Number.isInteger(task.day) || task.day < 0 || task.day > 6) throw new Error('Invalid task weekday.');
        if (task.start != null && (!Number.isFinite(task.start) || task.start < 0 || task.start >= 1440)) throw new Error('Invalid task start time.');
        if (task.duration != null && (!Number.isFinite(task.duration) || task.duration < 0 || task.duration > 10080)) throw new Error('Invalid task duration.');
  }
  function validateStore(value) {
    if (!plain(value) || !plain(value.settings) || !plain(value.weeks)) throw new Error('Planner settings and weeks must be objects.');
    assertSafeObject(value);
    if (value.settings.shifts !== undefined && (!Array.isArray(value.settings.shifts) || value.settings.shifts.some(s => !plain(s)))) throw new Error('Invalid work-shift settings.');
    for (const key of ['recurringTemplates', 'customLists']) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error('Invalid ' + key + '.');
    }
    for (const [weekKey, week] of Object.entries(value.weeks)) {
      if (!validDate(weekKey) || !plain(week) || !Array.isArray(week.tasks)) throw new Error('Invalid week in planner data.');
      const ids = new Set();
      for (const task of week.tasks) {
        validateTask(task,ids);
      }
    }
    if(value.taskHistory!==undefined){
      if(!Array.isArray(value.taskHistory)||value.taskHistory.length>10000)throw new Error('Invalid task history.');
      const historyIds=new Set();
      for(const entry of value.taskHistory){
        if(!plain(entry)||typeof entry.id!=='string'||!entry.id||historyIds.has(entry.id)||!['archive','trash'].includes(entry.kind)||typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt))||!Array.isArray(entry.items)||!entry.items.length||!Array.isArray(entry.rules))throw new Error('Invalid task history entry.');
        historyIds.add(entry.id);const taskIds=new Set();
        for(const item of entry.items){if(!plain(item)||!validDate(item.week))throw new Error('Invalid task history location.');validateTask(item.task,taskIds);}
        for(const rule of entry.rules)if(!plain(rule)||typeof rule.id!=='string'||!plain(rule.before)||!plain(rule.after))throw new Error('Invalid archived recurrence rule.');
      }
    }
    return value; // Preserve every field, record, identifier and history entry.
  }
  function parseStore(raw) { return validateStore(JSON.parse(raw)); }
  function parseBackup(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('Backup must be smaller than 10 MB.');
    const value = JSON.parse(raw);
    if (value.app !== undefined && value.app !== 'Weekwise') throw new Error('This backup belongs to a different app.');
    if (value.version !== undefined && (!Number.isInteger(value.version) || value.version < 1 || value.version > 6)) throw new Error('This backup version is not supported.');
    validateStore(value);
    for (const key of ['reminders', 'focusSessions', 'habits', 'countdowns', 'savedTaskFilters', 'taskTemplates']) {
      if (value[key] !== undefined)validateCollection(value[key],key);
    }
    return value;
  }
  function storeFromBackup(value) {
    const { app, version, exportedAt, reminders, focusSessions, habits, countdowns, savedTaskFilters, taskTemplates, ...store } = value;
    return store;
  }
  function commitStorage(storage, entries, checkpointKey) {
    for(const [key] of entries)if(!unchanged(storage,key))throw new Error('Another tab changed this collection. Reload it before saving.');
    const before = entries.map(([key]) => [key, storage.getItem(key)]);
    if (checkpointKey) storage.setItem(checkpointKey, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), entries: before }));
    try {
      for (const [key, raw] of entries) {if(raw===null)storage.removeItem(key);else storage.setItem(key, raw);}
      for(const [key,raw] of entries)remember(storage,key,raw);
    } catch (error) {
      let rollbackFailed = false;
      for (const [key, raw] of before) {
        try { if (raw === null) storage.removeItem(key); else storage.setItem(key, raw); }
        catch (_) { rollbackFailed = true; }
      }
      throw new Error(rollbackFailed ? 'Saving failed and automatic rollback was incomplete. Keep the pre-restore checkpoint and export your data.' : 'Saving failed. Previous local data was restored.');
    }
  }
  const blocked = new Map();
  function readJSON(storage,key,validator,fallback) {
    try { const raw=storage.getItem(key);remember(storage,key,raw); if(raw===null)return fallback;return validator(JSON.parse(raw)); }
    catch(error) { blocked.set(key,error.message||'Stored data cannot be read.');return fallback; }
  }
  function validateCollection(value,kind='') {
    if(!Array.isArray(value)||value.some(item=>!plain(item)))throw new Error('Saved collection must contain records.');
    assertSafeObject(value);
    for(const item of value){
      for(const field of ['id','title','name'])if(item[field]!==undefined&&typeof item[field]!=='string')throw new Error('Invalid '+field+' in saved '+kind+' records.');
      if(/habit/.test(kind)){
        for(const field of ['checkIns','skippedDates'])if(item[field]!==undefined&&(!Array.isArray(item[field])||item[field].some(day=>!validDate(day))))throw new Error('Invalid habit '+field+' history.');
        if(item.scheduledDays!==undefined&&(!Array.isArray(item.scheduledDays)||item.scheduledDays.some(day=>!Number.isInteger(day)||day<0||day>6)))throw new Error('Invalid scheduled habit days.');
        if(item.frequencyMode!==undefined&&!['scheduled-days','weekly-flexible'].includes(item.frequencyMode))throw new Error('Invalid habit frequency mode.');
      }
      if(/focus/.test(kind)){
        for(const field of ['minutes','seconds'])if(item[field]!==undefined&&(!Number.isFinite(item[field])||item[field]<0))throw new Error('Invalid recorded focus time.');
        if(item.endedAt!==undefined&&(typeof item.endedAt!=='string'||!Number.isFinite(new Date(item.endedAt).getTime())))throw new Error('Invalid focus timestamp.');
      }
    }
    return value;
  }
  function readCollection(storage,key) {return readJSON(storage,key,value=>validateCollection(value,key),[]);}
  function writeCollection(storage,key,value) {
    if(blocked.has(key))throw new Error('This saved collection needs recovery before it can be changed.');
    if(!unchanged(storage,key))throw new Error('Another tab changed this collection. Reload it before saving.');
    validateCollection(value,key);const raw=JSON.stringify(value);storage.setItem(key,raw);remember(storage,key,raw);return true;
  }
  function clearBlocked(keys) {for(const key of keys)blocked.delete(key);}
  function blockedKeys() {return [...blocked.keys()];}
  function syncLabel(message, signedIn, conflict) {
    if (conflict) return 'Needs review';
    if (!signedIn) return 'Local';
    if (/fail|error|could not|unavailable|not ready|unable/i.test(message)) return 'Sync failed';
    if (/syncing|saving|loading|checking/i.test(message)) return 'Syncing';
    if (/^All changes synced|^Account created and cloud sync is ready/i.test(message)) return 'Synced';
    return 'Saved locally';
  }
  root.WeekwiseData = Object.freeze({ MAX_BACKUP_BYTES, validDate, validateStore, parseStore, parseBackup, storeFromBackup, commitStorage, syncLabel, readJSON, validateCollection, readCollection, writeCollection, clearBlocked, blockedKeys, unchanged });
})(typeof window !== 'undefined' ? window : globalThis);
