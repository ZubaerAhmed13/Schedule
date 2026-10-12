/* Deterministic planning in local calendar minutes; no persistence or network. */
(function (root) {
  'use strict';
  const DAY = 1440;
  const clone = value => JSON.parse(JSON.stringify(value));
  const sum = intervals => intervals.reduce((total, [a, b]) => total + b - a, 0);
  function ordinal(key) {
    if (!root.WeekwiseData.validDate(key)) throw new Error('Choose a valid planning date.');
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0);
    return date.getTime() / 86400000;
  }
  function dateAt(week, offset) {
    const date = new Date((ordinal(week) + offset) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  function merge(intervals) {
    const sorted = intervals.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).map(x => x.slice()).sort((a,b) => a[0]-b[0]);
    const result = [];
    for (const item of sorted) {
      const prior = result[result.length - 1];
      if (prior && item[0] <= prior[1]) prior[1] = Math.max(prior[1], item[1]);
      else result.push(item);
    }
    return result;
  }
  function subtract(windows, blockers) {
    const result = [];
    for (const [a,b] of windows) {
      let cursor = a;
      for (const [x,y] of merge(blockers)) {
        if (y <= cursor || x >= b) continue;
        if (x > cursor) result.push([cursor, Math.min(x,b)]);
        cursor = Math.max(cursor,y); if (cursor >= b) break;
      }
      if (cursor < b) result.push([cursor,b]);
    }
    return result;
  }
  function reserveTail(intervals, minutes) {
    const result = intervals.map(x => x.slice()); let remaining = minutes;
    for (let i = result.length-1; i >= 0 && remaining > 0; i--) {
      const take = Math.min(remaining, result[i][1]-result[i][0]); result[i][1] -= take; remaining -= take;
    }
    return result.filter(([a,b]) => b > a);
  }
  function preferences(value = {}) {
    const p = { days:[1,2,3,4,5], start:540, end:1020, buffer:60, breakMinutes:10, ...value };
    if (!Array.isArray(p.days) || p.days.some(d => !Number.isInteger(d) || d<0 || d>6)) throw new Error('Choose valid planning weekdays.');
    for (const key of ['start','end','buffer','breakMinutes']) if (!Number.isInteger(p[key])) throw new Error('Planning times must be whole minutes.');
    if (p.start<0 || p.end>DAY || p.end<=p.start || p.buffer<0 || p.buffer>DAY || p.breakMinutes<0 || p.breakMinutes>120) throw new Error('Review your planning hours, buffer and breaks.');
    return {...p,days:[...new Set(p.days)].sort((a,b)=>a-b)};
  }
  function isProtected(task) {
    return !!(task.fixed || task.workday || task.type==='fixed' || task.schedulingMode==='fixed' || task.allDay || task.seriesId || (task.recurrence && task.recurrence!=='none'));
  }
  function records(store) {
    return Object.entries(store.weeks).flatMap(([week,value]) => value.tasks.map(task => ({week,task})));
  }
  function build({ store, weekStart, prefs, notBefore }) {
    root.WeekwiseData.validateStore(store);
    const p = preferences(prefs), base = ordinal(weekStart), all = records(store);
    const earliest = notBefore ? (ordinal(notBefore.date)-base)*DAY+notBefore.minute : 0;
    if (!Number.isFinite(earliest)) throw new Error('Invalid planning start.');
    const busy = [], breaks = [], protectedRecords = [];
    for (const record of all) {
      const t = record.task, offset=(ordinal(record.week)-base)+t.day;
      if (t.allDay) {busy.push([offset*DAY,(offset+1)*DAY]);protectedRecords.push(record);}
      else if (t.start!=null && !t.unscheduled && t.duration>0) {
        const a=offset*DAY+t.start, b=a+t.duration;busy.push([a,b]);breaks.push([b,b+p.breakMinutes]);protectedRecords.push(record);
      }
    }
    const days = []; let windows = [], free = [];
    for (const day of p.days) {
      const a=Math.max(day*DAY+p.start,earliest), b=day*DAY+p.end;
      if (a>=b) continue;
      const window=[[a,b]], afterBusy=subtract(window,busy), afterBreaks=subtract(afterBusy,breaks), usable=reserveTail(afterBreaks,p.buffer);
      windows.push(...window); free.push(...usable);
      days.push({day,date:dateAt(weekStart,day),available:sum(window),committed:sum(window)-sum(afterBusy),breaks:sum(afterBusy)-sum(afterBreaks),buffer:sum(afterBreaks)-sum(usable),capacity:sum(usable)});
    }
    const candidates=all.filter(({week,task:t}) => !t.done && t.status!=='done' && !isProtected(t) && (t.start==null || t.unscheduled) && ordinal(week)+t.day<=base+6);
    const priority = t => ({high:3,medium:2,low:1})[t.priority]||0;
    candidates.sort((a,b) => (a.task.dueDate||'9999-12-31').localeCompare(b.task.dueDate||'9999-12-31') || priority(b.task)-priority(a.task) || Number(a.task.schedulingMode==='optional')-Number(b.task.schedulingMode==='optional') || a.week.localeCompare(b.week) || a.task.id.localeCompare(b.task.id));
    const proposals=[],unscheduled=[]; let requested=0, unknown=0, consumedBreaks=0;
    const initialCapacity=sum(free);
    for (const record of candidates) {
      const t=record.task, duration=t.focusEstimateMinutes;
      const fail=reason=>unscheduled.push({week:record.week,id:t.id,title:t.title,reason});
      if (!Number.isInteger(duration) || duration<=0 || duration>DAY) {unknown++;fail('Duration unknown. Set Estimated focus in the task editor.');continue;}
      requested+=duration;
      if (t.dueDate && !root.WeekwiseData.validDate(t.dueDate)) {fail('Deadline needs a valid date.');continue;}
      const deadline=t.dueDate?(ordinal(t.dueDate)-base+1)*DAY:7*DAY;
      let slot=null;
      for (const [a,b] of free) {
        const start=Math.ceil(a/15)*15;
        if (start+duration<=Math.min(b,deadline) && start+duration+p.breakMinutes<=b) {slot=start;break;}
      }
      if (slot===null) {fail(deadline<=earliest?'Deadline has passed. Review the deadline before planning.':'No continuous slot fits before the deadline with your breaks and buffer.');continue;}
      const day=Math.floor(slot/DAY),start=slot%DAY;
      proposals.push({week:record.week,id:t.id,title:t.title,day,start,duration,date:dateAt(weekStart,day),reason:(t.dueDate?'Before the '+t.dueDate+' deadline. ':'')+'Earliest free slot; existing commitments, breaks and buffer are protected.'});
      free=subtract(free,[[slot,slot+duration+p.breakMinutes]]);consumedBreaks+=p.breakMinutes;
    }
    const overlaps=[];
    const sorted=busy.slice().sort((a,b)=>a[0]-b[0]);let priorEnd=-Infinity;
    for (const [a,b] of sorted) {if(a<priorEnd && b>0 && a<7*DAY)overlaps.push([Math.max(a,0),Math.min(b,priorEnd,7*DAY)]);priorEnd=Math.max(priorEnd,b);}
    return {weekStart,preferences:p,days,proposals,unscheduled,unknown,requested,available:sum(windows),committed:days.reduce((n,d)=>n+d.committed,0),reservedBuffer:days.reduce((n,d)=>n+d.buffer,0),existingBreaks:days.reduce((n,d)=>n+d.breaks,0),capacity:initialCapacity,remaining:sum(free),proposalBreaks:consumedBreaks,overcommitted:Math.max(0,requested+consumedBreaks-initialCapacity),overlaps:merge(overlaps),protectedCount:protectedRecords.filter(({week,task})=>{const day=ordinal(week)-base+task.day;return day>=0&&day<7;}).length};
  }
  function apply(store, plan, selectedIds) {
    root.WeekwiseData.validateStore(store);
    const next=clone(store), chosen=plan.proposals.filter(p=>selectedIds.includes(p.week+'::'+p.id));
    if (!chosen.length) throw new Error('Select at least one suggested task.');
    for (const p of chosen) {
      const source=next.weeks[p.week], task=source?.tasks.find(t=>t.id===p.id);
      if (!task || task.done || task.status==='done' || isProtected(task) || (task.start!=null && !task.unscheduled)) throw new Error('A task changed. Build a fresh preview.');
      if (p.week!==plan.weekStart && next.weeks[plan.weekStart]?.tasks.some(t=>t.id===p.id)) throw new Error('Task ID already exists in the destination week. Nothing was changed.');
      if (p.week!==plan.weekStart) {
        source.tasks=source.tasks.filter(t=>t.id!==p.id);
        if (!next.weeks[plan.weekStart]) next.weeks[plan.weekStart]={tasks:[]};
        next.weeks[plan.weekStart].tasks.push(task);
      }
      Object.assign(task,{day:p.day,start:p.start,duration:p.duration,unscheduled:false});
    }
    return root.WeekwiseData.validateStore(next);
  }
  root.WeekwisePlanning=Object.freeze({merge,subtract,preferences,ordinal,dateAt,build,apply,isProtected});
})(typeof window !== 'undefined' ? window : globalThis);
