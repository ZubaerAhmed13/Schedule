(function(root){
 'use strict';let app=null,ref=null,preview=null,undo=null,owner=null;
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const snapshot=()=>JSON.stringify(app.snapshot()),announce=message=>{$('seriesScheduleStatus').textContent=message;};
 function clear(){preview=null;$('seriesScheduleApply').disabled=true;$('seriesScheduleReviewed').checked=false;$('seriesSchedulePreview').replaceChildren();}
 function render(){if(app&&owner!==app.account()){owner=app.account();ref=null;preview=null;undo=null;$('seriesScheduleUndo').hidden=true;clear();}}
 function build(){try{
  const state=app.snapshot(),task=state.store.weeks[ref.week]?.tasks.find(t=>t.id===ref.id);if(!task)throw new Error('The selected occurrence moved. Reopen its schedule review.');
  const allDay=$('seriesScheduleAllDay').checked,unscheduled=$('seriesScheduleUnscheduled').checked,time=$('seriesScheduleTime').value;
  if(!allDay&&!unscheduled&&!/^\d{2}:\d{2}$/.test(time))throw new Error('Choose a valid start time.');
  const request={seriesId:task.seriesId,fromDate:ref.fromDate,newStartDate:$('seriesScheduleDate').value,frequency:$('seriesScheduleFrequency').value,start:allDay||unscheduled?null:Number(time.slice(0,2))*60+Number(time.slice(3)),duration:Number($('seriesScheduleDuration').value),endDate:$('seriesScheduleEnd').value||null,allDay,zone:state.store.settings.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone};
  const plan=root.WeekwiseSeriesSchedule.preview(state.store,request);preview={plan,expected:JSON.stringify(state),owner:app.account(),at:Date.now()};
  $('seriesSchedulePreview').innerHTML='<p>'+plan.changes.length+' saved occurrences reviewed. '+plan.skipped.completed+' completed/in-progress and '+plan.skipped.customized+' independently edited occurrences retained.</p>'+plan.changes.slice(0,200).map(change=>{const old=JSON.parse(change.before);return '<article class="history-entry"><div><strong>'+esc(old.title)+'</strong><small>'+esc(old.occurrenceDate)+' → '+esc(change.date)+' · '+(change.task.allDay?'All day':change.task.start===null?'Unscheduled':String(Math.floor(change.task.start/60)).padStart(2,'0')+':'+String(change.task.start%60).padStart(2,'0')+' · '+change.task.duration+' min')+'</small></div></article>';}).join('')+(plan.changes.length>200?'<p>More than 200 saved occurrences: export a backup to inspect the complete data before applying.</p>':'')+plan.blocked.map(message=>'<p>'+esc(message)+'</p>').join('');
  $('seriesScheduleApply').disabled=plan.blocked.length>0||plan.changes.length>200;announce(plan.blocked.length?'Resolve the blocked placements and rebuild.':'Review each saved move and the future rule before applying. Relative deadlines and reminders move with the occurrence; completed history stays unchanged.');
 }catch(error){clear();announce(error.message);}}
 function init(bridge){app=bridge;owner=app.account();
  $('seriesScheduleForm').onsubmit=event=>{event.preventDefault();build();};
  $('seriesScheduleForm').oninput=()=>{clear();announce('Inputs changed. Build a fresh preview.');};
  $('seriesScheduleApply').onclick=()=>{try{
   if(!preview||!$('seriesScheduleReviewed').checked)throw new Error('Confirm that you reviewed the preview.');
   if(preview.owner!==app.account()||preview.expected!==snapshot()||Date.now()-preview.at>300000)throw new Error('The planner, account or preview age changed. Rebuild before applying.');
   if(!confirm('Apply this future recurring rule and '+preview.plan.changes.length+' reviewed saved moves? Completed and independently edited occurrences stay unchanged.'))return;
   const before=app.snapshot().store,next=root.WeekwiseSeriesSchedule.apply(before,preview.plan);
   app.commit(preview.expected,preview.owner,next,'weekwise-pre-series-schedule-v1');undo={store:before,owner:app.account(),expected:snapshot()};clear();$('seriesScheduleUndo').hidden=false;announce('Recurring schedule saved. Use Undo before making another planner change.');
  }catch(error){announce(error.message);}};
  $('seriesScheduleUndo').onclick=()=>{try{if(!undo)return;if(undo.owner!==app.account()||undo.expected!==snapshot())throw new Error('Newer changes are protected. The pre-change checkpoint remains available.');app.commit(undo.expected,undo.owner,undo.store);undo=null;$('seriesScheduleUndo').hidden=true;clear();announce('Recurring schedule changes undone.');}catch(error){announce(error.message);}};
 }
 function open(selected){render();const state=app.snapshot(),task=state.store.weeks[selected.week]?.tasks.find(t=>t.id===selected.id),rule=state.store.recurringTemplates?.find(r=>r.id===task?.seriesId);if(!rule){app.announce('This task has no available recurring rule.');return;}
  ref={...selected,fromDate:task.occurrenceDate>app.todayKey()?task.occurrenceDate:app.todayKey()};clear();$('seriesScheduleTitle').textContent=rule.title;
  $('seriesScheduleDate').value=ref.fromDate;$('seriesScheduleFrequency').value=rule.frequency;$('seriesScheduleTime').value=rule.start==null?'09:00':String(Math.floor(rule.start/60)).padStart(2,'0')+':'+String(rule.start%60).padStart(2,'0');$('seriesScheduleDuration').value=rule.duration||30;$('seriesScheduleEnd').value=rule.endDate||'';$('seriesScheduleAllDay').checked=!!rule.allDay;$('seriesScheduleUnscheduled').checked=!rule.allDay&&rule.start==null;
  announce('Build a preview. Existing completed and customized occurrences are protected. New cadence dates may create additional occurrences when their weeks are opened.');app.panel('seriesSchedulePanel','Recurring schedule');
 }
 root.WeekwiseSeriesScheduleUI=Object.freeze({init,open,render});
})(window);
