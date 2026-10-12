/* Non-destructive validation and checked local transactions. No network access. */
(function (root) {
  'use strict';
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
        if (!plain(task) || typeof task.id !== 'string' || !task.id || ids.has(task.id)) throw new Error('Task IDs must be present and unique within each week.');
        ids.add(task.id);
        if (typeof task.title !== 'string') throw new Error('Task title must be text.');
        if (!Number.isInteger(task.day) || task.day < 0 || task.day > 6) throw new Error('Invalid task weekday.');
        if (task.start != null && (!Number.isFinite(task.start) || task.start < 0 || task.start >= 1440)) throw new Error('Invalid task start time.');
        if (task.duration != null && (!Number.isFinite(task.duration) || task.duration < 0 || task.duration > 10080)) throw new Error('Invalid task duration.');
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
      if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some(item => !plain(item)))) throw new Error('Invalid ' + key + ' collection.');
    }
    return value;
  }
  function storeFromBackup(value) {
    const { app, version, exportedAt, reminders, focusSessions, habits, countdowns, savedTaskFilters, taskTemplates, ...store } = value;
    return store;
  }
  function commitStorage(storage, entries, checkpointKey) {
    const before = entries.map(([key]) => [key, storage.getItem(key)]);
    if (checkpointKey) storage.setItem(checkpointKey, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), entries: before }));
    try {
      for (const [key, raw] of entries) storage.setItem(key, raw);
    } catch (error) {
      let rollbackFailed = false;
      for (const [key, raw] of before) {
        try { if (raw === null) storage.removeItem(key); else storage.setItem(key, raw); }
        catch (_) { rollbackFailed = true; }
      }
      throw new Error(rollbackFailed ? 'Saving failed and automatic rollback was incomplete. Keep the pre-restore checkpoint and export your data.' : 'Saving failed. Previous local data was restored.');
    }
  }
  function syncLabel(message, signedIn, conflict) {
    if (conflict) return 'Needs review';
    if (!signedIn) return 'Local';
    if (/fail|error|could not|unavailable|not ready|unable/i.test(message)) return 'Sync failed';
    if (/syncing|saving|loading|checking/i.test(message)) return 'Syncing';
    if (/^All changes synced|^Account created and cloud sync is ready/i.test(message)) return 'Synced';
    return 'Saved locally';
  }
  root.WeekwiseData = Object.freeze({ MAX_BACKUP_BYTES, validDate, validateStore, parseStore, parseBackup, storeFromBackup, commitStorage, syncLabel });
})(typeof window !== 'undefined' ? window : globalThis);
