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
    const p = { days:[1,2,3,4,5], start:540, end:1020, buffer:60, breakMinutes:10, weeklyBuffer:0, maxDailyMinutes:1440, focusStart:null, focusEnd:null, windows:[], ...value };
    if (!Array.isArray(p.days) || p.days.some(d => !Number.isInteger(d) || d<0 || d>6)) throw new Error('Choose valid planning weekdays.');
    for (const key of ['start','end','buffer','breakMinutes','weeklyBuffer','maxDailyMinutes']) if (!Number.isInteger(p[key])) throw new Error('Planning times must be whole minutes.');
    if (p.start<0 || p.end>DAY || p.end<=p.start || p.buffer<0 || p.buffer>DAY || p.breakMinutes<0 || p.breakMinutes>120 || p.weeklyBuffer<0 || p.weeklyBuffer>7*DAY || p.maxDailyMinutes<0 || p.maxDailyMinutes>DAY) throw new Error('Review your planning hours, buffer, daily limit and breaks.');
    if ((p.focusStart!==null||p.focusEnd!==null)&&(!Number.isInteger(p.focusStart)||!Number.isInteger(p.focusEnd)||p.focusStart<0||p.focusEnd>DAY||p.focusEnd<=p.focusStart))throw new Error('Choose both ends of a valid preferred focus period.');
    if(!Array.isArray(p.windows)||p.windows.length>28)throw new Error('Use up to 28 availability windows.');
    for(const window of p.windows)if(!window||!Array.isArray(window.days)||window.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!Number.isInteger(window.start)||!Number.isInteger(window.end)||window.start<0||window.end>DAY||window.end<=window.start)throw new Error('Each availability window needs a weekday and valid start/end.');
    return {...p,days:[...new Set(p.days)].sort((a,b)=>a-b),windows:p.windows.map(w=>({...w,days:[...new Set(w.days)]}))};
  }
  function isFixed(task){return !!(task.fixed||task.workday||task.type==='fixed'||task.schedulingMode==='fixed'||task.allDay||task.requiresCompletion===false||task.planningChildren?.length);}
  function isProtected(task) {
    return !!(isFixed(task)||task.seriesId||(task.recurrence&&task.recurrence!=='none'));
  }
  function records(store) {
    return Object.entries(store.weeks).flatMap(([week,value]) => value.tasks.map(task => ({week,task})));
  }
  const unfinished=t=>!t.done&&t.status!=='done'&&t.status!=='skipped'&&!t.archived&&!t.deleted;
  const estimate=t=>t.estimatedDurationMinutes??t.focusEstimateMinutes;
  const knownEstimate=n=>Number.isInteger(n)&&n>0&&n<=DAY;
  const flexible=t=>unfinished(t)&&!isProtected(t)&&(t.start==null||t.unscheduled);
  function readiness(store,weekStart){
    root.WeekwiseData.validateStore(store);const base=ordinal(weekStart),end=base+6,all=records(store);
    const eligible=all.filter(r=>flexible(r.task)&&ordinal(r.week)+r.task.day<=end);
    const ready=eligible.filter(r=>knownEstimate(estimate(r.task))),missing=eligible.filter(r=>!knownEstimate(estimate(r.task)));
    return {ready,missing,highlighted:eligible.filter(r=>r.task.todayPriority),future:all.filter(r=>flexible(r.task)&&ordinal(r.week)+r.task.day>end).length,
      scheduled:all.filter(r=>{const day=ordinal(r.week)+r.task.day;return unfinished(r.task)&&day>=base&&day<=end&&(r.task.allDay||(!r.task.unscheduled&&r.task.start!=null));}).length};
  }
  function review(plan,selectedIds){
    const refs=new Set(selectedIds),selected=plan.proposals.filter(p=>refs.has(p.week+'::'+p.id));
    const taskMinutes=selected.reduce((n,p)=>n+p.duration,0),breakMinutes=selected.length*plan.preferences.breakMinutes;
    return {count:selected.length,unchanged:plan.proposals.length-selected.length,taskMinutes,breakMinutes,remaining:Math.max(0,plan.capacity-taskMinutes-breakMinutes),
      days:plan.days.map(day=>{const items=selected.filter(p=>p.date===day.date),minutes=items.reduce((n,p)=>n+p.duration,0),breaks=items.length*plan.preferences.breakMinutes;
        return {...day,selectedMinutes:minutes,selectedBreaks:breaks,remaining:Math.max(0,day.capacity-minutes-breaks),lastFinish:items.length?Math.max(...items.map(p=>p.start+p.duration)):null};})};
  }
  const clockBlockCache=new Map();
  function clockBlocks(date,zone){
    if(!zone)return [];if(!root.WeekwiseCalendarRange)throw new Error('The planner clock utility is unavailable. Reload before planning.');
    const key=zone+'::'+date;if(clockBlockCache.has(key))return clockBlockCache.get(key);
    const wall=minute=>root.WeekwiseCalendarRange.wall(date,minute,zone);let changed=false,prior=null;
    for(let minute=0;minute<=DAY;minute+=60){try{const instant=wall(minute);if(prior!==null&&instant-prior!==3600000)changed=true;prior=instant;}catch(_){changed=true;prior=null;}}
    const blocked=[];
    if(changed){let start=null;for(let minute=0;minute<DAY;minute++){let valid=false;try{valid=wall(minute+1)-wall(minute)===60000;}catch(_){}if(!valid&&start===null)start=minute;if(valid&&start!==null){blocked.push([start,minute]);start=null;}}if(start!==null)blocked.push([start,DAY]);}
    if(clockBlockCache.size>=64)clockBlockCache.delete(clockBlockCache.keys().next().value);clockBlockCache.set(key,blocked);return blocked;
  }
  function planningClock(store,epoch=Date.now()){
    const zone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(!root.WeekwiseCalendarRange)throw new Error('The planner clock utility is unavailable. Reload before planning.');
    return {zone,...root.WeekwiseCalendarRange.parts(epoch,zone)};
  }
  function planningSlot(store,item){
    const zone=store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(!root.WeekwiseCalendarRange)throw new Error('The planner clock utility is unavailable. Reload before planning.');
    return root.WeekwiseCalendarRange.slot(item.date,item.start,item.duration,zone,zone);
  }
  function build({ store, weekStart, prefs, notBefore, mode='build', overrides={} }) {
    root.WeekwiseData.validateStore(store);
    const p = preferences(prefs), base = ordinal(weekStart), all = records(store);
    const earliest = notBefore ? (ordinal(notBefore.date)-base)*DAY+notBefore.minute : 0;
    if (!Number.isFinite(earliest)) throw new Error('Invalid planning start.');
    const busy = [], breaks = [], protectedRecords = [], timedRecords=[];
    for (const record of all) {
      const t = record.task, offset=(ordinal(record.week)-base)+t.day;
      if (t.allDay) {busy.push([offset*DAY,(offset+Math.max(1,Math.ceil((t.duration||0)/DAY)))*DAY]);protectedRecords.push(record);}
      else if (t.start!=null && !t.unscheduled && t.duration>0) {
        const a=offset*DAY+t.start, b=a+t.duration;busy.push([a,b]);breaks.push([b,b+p.breakMinutes]);protectedRecords.push(record);timedRecords.push({...record,a,b,ref:record.week+'::'+t.id});
      }
    }
    const conflicts=new Set();
    const sortedRecords=timedRecords.slice().sort((a,b)=>a.a-b.a);let latestEnd=-Infinity,latestRef=null;
    for(const entry of sortedRecords){if(entry.a<latestEnd){conflicts.add(entry.ref);conflicts.add(latestRef);}if(entry.b>latestEnd){latestEnd=entry.b;latestRef=entry.ref;}}
    const days = []; let windows = [], free = [],clockChangeReserved=0;
    for (let day=0;day<7;day++) {
      const weekday=new Date((base+day)*86400000).getUTCDay();if(!p.days.includes(weekday))continue;
      const custom=p.windows.filter(window=>window.days.includes(weekday));
      const candidates=custom.length?custom:[{start:p.start,end:p.end}];
      const rawWindow=merge(candidates.map(w=>[Math.max(day*DAY+w.start,earliest),day*DAY+w.end])),window=subtract(rawWindow,clockBlocks(dateAt(weekStart,day),store.settings.timeZone).map(([a,b])=>[a+day*DAY,b+day*DAY]));clockChangeReserved+=sum(rawWindow)-sum(window);
      if(!window.length)continue;
      const afterBusy=subtract(window,busy),afterBreaks=subtract(afterBusy,breaks),afterBuffer=reserveTail(afterBreaks,p.buffer),committed=sum(window)-sum(afterBusy);
      const usable=reserveTail(afterBuffer,Math.max(0,sum(afterBuffer)-Math.max(0,p.maxDailyMinutes-committed)));
      windows.push(...window);free.push(...usable);
      days.push({day,weekday,date:dateAt(weekStart,day),available:sum(window),committed,breaks:sum(afterBusy)-sum(afterBreaks),buffer:sum(afterBreaks)-sum(afterBuffer),dailyLimitReserved:sum(afterBuffer)-sum(usable),capacity:sum(usable)});
    }
    const beforeWeeklyBuffer=sum(free);free=reserveTail(free,p.weeklyBuffer);const weeklyBufferReserved=beforeWeeklyBuffer-sum(free);
    for(const day of days)day.capacity=sum(free.filter(([a])=>Math.floor(a/DAY)===day.day));
    const candidates=all.filter(({week,task:t}) => {
      if(!unfinished(t)||isFixed(t)||ordinal(week)+t.day>base+6)return false;
      if(mode==='recover'){
        if(t.start==null||t.unscheduled)return false;
        const end=(ordinal(week)-base+t.day)*DAY+t.start+(t.duration||0);
        return end<=earliest||conflicts.has(week+'::'+t.id);
      }
      return !isProtected(t)&&(t.start==null||t.unscheduled);
    });
    const priority = t => ({high:3,medium:2,low:1})[t.priority]||0;
    candidates.sort((a,b) => (a.task.dueDate||'9999-12-31').localeCompare(b.task.dueDate||'9999-12-31') || priority(b.task)-priority(a.task) || Number(a.task.schedulingMode==='optional')-Number(b.task.schedulingMode==='optional') || a.week.localeCompare(b.week) || a.task.id.localeCompare(b.task.id));
    const proposals=[],unscheduled=[]; let requested=0, unknown=0, consumedBreaks=0;
    const initialCapacity=sum(free);
    for (const record of candidates) {
      const t=record.task, duration=t.estimatedDurationMinutes??(mode==='recover'?t.duration:t.focusEstimateMinutes);
      const fail=(code,reason,details={})=>unscheduled.push({week:record.week,id:t.id,title:t.title,estimate:duration,code,reason,...details});
      if (!knownEstimate(duration)) {unknown++;fail('estimate','Duration unknown. Set Estimated duration (or your existing focus estimate) in the task editor.');continue;}
      requested+=duration;
      if (t.dueDate && !root.WeekwiseData.validDate(t.dueDate)) {fail('deadline-invalid','Deadline needs a valid date.');continue;}
      const deadline=t.dueDate?(ordinal(t.dueDate)-base+1)*DAY:7*DAY;
      let slot=null,preferred=false;const validClock=value=>{if(!store.settings.timeZone)return true;try{planningSlot(store,{date:dateAt(weekStart,Math.floor(value/DAY)),start:value%DAY,duration});return true;}catch(_){return false;}};const ref=record.week+'::'+t.id,override=overrides[ref],options=[];
      for (const [a,b] of free) {
        const day=Math.floor(a/DAY),earliestStart=Math.ceil(a/15)*15;
        options.push({start:earliestStart,preferred:false,end:b});
        if(p.focusStart!==null){const start=Math.ceil(Math.max(a,day*DAY+p.focusStart)/15)*15;if(start+duration<=day*DAY+p.focusEnd)options.push({start,preferred:true,end:b,taskEnd:day*DAY+p.focusEnd});}
      }
      options.sort((a,b)=>Number(b.preferred)-Number(a.preferred)||a.start-b.start);
      if(override){
        if(root.WeekwiseData.validDate(override.date)&&Number.isInteger(override.start)){
          const requestedSlot=(ordinal(override.date)-base)*DAY+override.start;
          if(validClock(requestedSlot)&&requestedSlot>=earliest&&requestedSlot>=0&&requestedSlot+duration<=deadline&&free.some(([a,b])=>requestedSlot>=a&&requestedSlot+duration+p.breakMinutes<=b))slot=requestedSlot;
        }
      }else for(const option of options){for(let candidate=option.start;candidate+duration<=Math.min(option.end,deadline,option.taskEnd??Infinity)&&candidate+duration+p.breakMinutes<=option.end;candidate+=15){if(validClock(candidate)){slot=candidate;preferred=option.preferred;break;}}if(slot!==null)break;}
      if (slot===null) {
        const largestSlotMinutes=Math.max(0,...free.map(([a,b])=>Math.min(b-p.breakMinutes,deadline)-Math.ceil(a/15)*15));
        if(override)fail('placement','Your requested time is outside availability, overlaps another block, or misses the deadline. Use the suggested time or check another slot.');
        else if(deadline<=earliest)fail('deadline-passed','Deadline has passed. Review the deadline before planning.');
        else if(deadline<=0)fail('deadline-week','Deadline is before this planning week. Choose an earlier week or review the deadline.');
        else if(!windows.length)fail('availability','No planning hours remain in this week. Choose another week or review your available days and hours.');
        else if(!free.length)fail('capacity','No flexible time remains after commitments, breaks, buffers, daily limits and earlier suggestions. Review your hours or plan fewer tasks.');
        else fail(t.dueDate?'deadline-slot':'continuous-slot','No continuous slot fits'+(t.dueDate?' by '+t.dueDate:' in this week')+'. The largest remaining task slot is '+largestSlotMinutes+' min after allowing for breaks; this task needs '+duration+' min. Review your hours, split the task or choose another week.',{largestSlotMinutes});
        continue;
      }
      const day=Math.floor(slot/DAY),start=slot%DAY;
      proposals.push({week:record.week,id:t.id,title:t.title,day:new Date((base+day)*86400000).getUTCDay(),start,duration,date:dateAt(weekStart,day),recovery:mode==='recover',placement:override?'chosen':preferred?'preferred':'earliest',from:{day:t.day,start:t.start,duration:t.duration,unscheduled:!!t.unscheduled},reason:(mode==='recover'?'Move unfinished or conflicting work. ':'')+(override?'Your chosen slot. ':preferred?'Earliest fitting slot in your preferred focus hours. ':'Earliest fitting free slot. ')+(t.dueDate?'Finishes by the '+t.dueDate+' deadline. ':'')+'Existing commitments, breaks and buffer are protected.'});
      free=subtract(free,[[slot,slot+duration+p.breakMinutes]]);consumedBreaks+=p.breakMinutes;
    }
    const overlaps=[];
    const sorted=busy.slice().sort((a,b)=>a[0]-b[0]);let priorEnd=-Infinity;
    for (const [a,b] of sorted) {if(a<priorEnd && b>0 && a<7*DAY)overlaps.push([Math.max(a,0),Math.min(b,priorEnd,7*DAY)]);priorEnd=Math.max(priorEnd,b);}
    return {weekStart,mode,timeZone:store.settings.timeZone||null,notBefore:notBefore?clone(notBefore):null,overrides:clone(overrides),preferences:p,days,clockChangeReserved,weeklyBufferReserved,dailyLimitReserved:days.reduce((n,d)=>n+d.dailyLimitReserved,0),proposals,unscheduled,unknown,requested,available:sum(windows),committed:days.reduce((n,d)=>n+d.committed,0),reservedBuffer:weeklyBufferReserved+days.reduce((n,d)=>n+d.buffer,0),existingBreaks:days.reduce((n,d)=>n+d.breaks,0),capacity:initialCapacity,remaining:sum(free),proposalBreaks:consumedBreaks,overcommitted:Math.max(0,requested+consumedBreaks-initialCapacity),overlaps:merge(overlaps),protectedCount:protectedRecords.filter(({week,task})=>{const begin=(ordinal(week)-base+task.day)*DAY+(task.allDay?0:task.start||0),span=task.allDay?Math.max(1,Math.ceil((task.duration||0)/DAY))*DAY:task.duration||0;return begin<7*DAY&&begin+span>0;}).length};
  }
  function apply(store, plan, selectedIds) {
    root.WeekwiseData.validateStore(store);
    if((store.settings.timeZone||null)!==plan.timeZone)throw new Error('The planning time zone changed. Build a fresh preview.');
    const next=clone(store), chosen=plan.proposals.filter(p=>selectedIds.includes(p.week+'::'+p.id));
    if (!chosen.length) throw new Error('Select at least one suggested task.');
    const verified=build({store,weekStart:plan.weekStart,prefs:plan.preferences,notBefore:plan.notBefore,mode:plan.mode,overrides:plan.overrides||{}});
    for(const p of chosen){const expected=verified.proposals.find(x=>x.week===p.week&&x.id===p.id);if(!expected||['date','day','start','duration','recovery'].some(key=>expected[key]!==p[key]))throw new Error('A proposed placement is no longer feasible. Build a fresh preview.');}
    for (const p of chosen) {
      const source=next.weeks[p.week], task=source?.tasks.find(t=>t.id===p.id);
      if (!task || task.done || task.status==='done' || isFixed(task) || (!p.recovery&&(isProtected(task)||(task.start!=null&&!task.unscheduled))) || (p.from&&(p.from.day!==task.day||p.from.start!==task.start||p.from.duration!==task.duration))) throw new Error('A task changed. Build a fresh preview.');
      const exact=store.settings.timeZone?planningSlot(store,p):null;
      const targetWeek=dateAt(p.date,-new Date(p.date+'T12:00:00Z').getUTCDay());
      if (p.week!==targetWeek && next.weeks[targetWeek]?.tasks.some(t=>t.id===p.id)) throw new Error('Task ID already exists in the destination week. Nothing was changed.');
      if (p.week!==targetWeek) {
        source.tasks=source.tasks.filter(t=>t.id!==p.id);
        if (!next.weeks[targetWeek]) next.weeks[targetWeek]={tasks:[]};
        next.weeks[targetWeek].tasks.push(task);
      }
      if(p.recovery){
        task.reschedulingHistory=[...(task.reschedulingHistory||[]),{fromWeek:p.week,fromDay:task.day,fromStart:task.start,fromDuration:task.duration,toWeek:targetWeek,toDay:p.day,toStart:p.start,changedAt:new Date().toISOString(),reason:'User-approved recovery'}];
        if(task.seriesId)task.recurrenceOverride=true;
      }
      Object.assign(task,{day:p.day,start:p.start,duration:p.duration,unscheduled:false});
      if(exact)task.scheduleInstant=exact.scheduleInstant;else delete task.scheduleInstant;
    }
    return root.WeekwiseData.validateStore(next);
  }
  function splitTask(store,ref,parts,idFactory){
    root.WeekwiseData.validateStore(store);const next=clone(store),task=next.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);
    if(!task||task.done||isProtected(task)||task.planningChildren?.length)throw new Error('Only an unfinished flexible, non-recurring task can be split.');
    if(!Array.isArray(parts)||parts.length<2||parts.length>12||parts.some(p=>!p.title?.trim()||!Number.isInteger(p.minutes)||p.minutes<5||p.minutes>DAY))throw new Error('Use 2–12 named parts, each with a duration of 5–1440 minutes.');
    const ids=new Set(records(next).map(r=>r.task.id));task.planningChildren=[];
    for(const part of parts){const id=idFactory();if(ids.has(id))throw new Error('Could not create unique task IDs. Nothing was changed.');ids.add(id);
      const child={...clone(task),id,title:part.title.trim(),start:null,unscheduled:true,done:false,status:'todo',duration:part.minutes,estimatedDurationMinutes:part.minutes,focusEstimateMinutes:null,parentTaskId:task.id,parentWeek:ref.week,planningChildren:[],subtasks:[],reminderAt:null,reminderTimes:[],reminderNotifiedTimes:[],recurrence:'none',seriesId:null,custom:true};
      next.weeks[ref.week].tasks.push(child);task.planningChildren.push(id);
      task.subtasks=[...(task.subtasks||[]),{id:id+'_link',title:child.title,done:false,taskId:id}];
    }
    task.planningOriginalSchedule={day:task.day,start:task.start,duration:task.duration,unscheduled:!!task.unscheduled};task.start=null;task.unscheduled=true;
    task.planningOriginalEstimate=task.estimatedDurationMinutes??task.focusEstimateMinutes??null;task.estimatedDurationMinutes=parts.reduce((n,p)=>n+p.minutes,0);
    return root.WeekwiseData.validateStore(next);
  }
  root.WeekwisePlanning=Object.freeze({merge,subtract,preferences,ordinal,dateAt,planningClock,planningSlot,readiness,review,build,apply,isProtected,isFixed,splitTask});
})(typeof window !== 'undefined' ? window : globalThis);
