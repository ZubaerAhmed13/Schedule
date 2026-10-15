(function(root){
 'use strict';let app=null,undo=null,query='',kind='archive',pendingSeries=null;
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const fingerprint=()=>JSON.stringify(app.snapshot());
 const announce=message=>{$('taskHistoryStatus').textContent=message;app.announce(message);};
 function render(){
  if(!app)return;if(undo&&undo.owner!==app.account())undo=null;if(!$('taskHistoryPanel').closest('#utilityModal')||$('utilityModal').hidden)return;
  const entries=(app.snapshot().store.taskHistory||[]).filter(entry=>entry.kind===kind&&(!query||entry.items.some(item=>(item.task.title+' '+(item.task.note||'')).toLowerCase().includes(query.toLowerCase())))).slice().reverse();
  const page=root.WeekwiseListWindow.page(app.account()+'::history:'+kind+':'+query,entries);
  $('taskHistoryCount').textContent=entries.length+' saved '+(entries.length===1?'entry':'entries')+' · '+page.shown+' shown';
  $('taskHistoryEntries').innerHTML=page.records.map(entry=>'<article class="history-entry"><div><strong>'+esc(entry.items[0]?.task?.title||'Recurring series')+'</strong><small>'+esc(entry.createdAt.slice(0,10))+' · '+entry.items.length+' task'+(entry.items.length===1?'':'s')+'</small></div><button class="btn" type="button" data-history-restore="'+esc(entry.id)+'">Restore</button></article>').join('')||'<p>No saved tasks here.</p>';
  $('taskHistoryMore').hidden=!page.hasMore;$('taskHistoryUndo').hidden=!undo;
 }

 function previewSeries(){
  const dialog=$('recurringRemoveDialog');if(!dialog?.open||!pendingSeries)return;
  const scope=dialog.querySelector('input[name="recurringRemoveScope"]:checked')?.value||'future';
  const view=$('recurringRemovePreview'),confirmWrap=$('recurringRemoveConfirmWrap'),confirmInput=$('recurringRemoveConfirm');
  confirmWrap.hidden=scope!=='all';if(scope!=='all')confirmInput.checked=false;
  try{
   const data=root.WeekwiseTaskHistory.seriesPreview(app.snapshot().store,{...pendingSeries,scope});
   const history=data.retainedCompleted||0,personalised=data.retainedCustomized||0;
   view.textContent=scope==='single'?'One occurrence will be moved to Recently removed. Other repeats continue.':
     scope==='future'?data.items.length+' current and future occurrence'+(data.items.length===1?'':'s')+' will be removed; '+history+' completed or in-progress and '+personalised+' individually edited future occurrence'+(personalised===1?'':'s')+' retained. The repeating rule will stop before '+data.anchor+'.':
     data.items.length+' saved occurrence'+(data.items.length===1?'':'s')+' (including past and completed records) will be removed. The entire recurring rule will stop.';
   $('recurringRemoveApply').disabled=scope==='all'&&!confirmInput.checked;
  }catch(error){view.textContent=error.message;$('recurringRemoveApply').disabled=true;}
 }
 function closeSeries(){const dialog=$('recurringRemoveDialog');if(dialog.open)dialog.close();pendingSeries=null;}
 function openSeries(id,week){
  pendingSeries={id,week,owner:app.account()};
  const dialog=$('recurringRemoveDialog');dialog.querySelector('input[value="future"]').checked=true;
  $('recurringRemoveConfirm').checked=false;dialog.showModal();previewSeries();$('recurringRemoveCancel').focus();
 }
 function applySeries(event){
  event.preventDefault();if(!pendingSeries)return;
  const scope=$('recurringRemoveDialog').querySelector('input[name="recurringRemoveScope"]:checked')?.value||'future';
  if(scope==='all'&&!$('recurringRemoveConfirm').checked)return;
  try{
   if(app.account()!==pendingSeries.owner)throw new Error('The active planner changed. Reopen the task.');
   const snapshot=app.snapshot();
   root.WeekwiseTaskHistory.seriesPreview(snapshot.store,{...pendingSeries,scope});
   const next=root.WeekwiseTaskHistory.moveSeries(snapshot.store,{...pendingSeries,scope,historyId:crypto.randomUUID()});
   app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-task-history-v1');
   undo={owner:app.account(),store:snapshot.store,expected:fingerprint()};
   closeSeries();app.closeEditor?.();render();
   announce('Repeating tasks updated. Restore from Recently removed or use Undo in Task history.');
  }catch(error){$('recurringRemovePreview').textContent=error.message;}
 }
 function remove(id,week,action='trash'){
  try{
   const snapshot=app.snapshot(),task=snapshot.store.weeks[week]?.tasks.find(task=>task.id===id);if(!task)return false;
   if(task.seriesId&&action==='trash'){openSeries(id,week);return false;}
   const count=1+(task.planningChildren?.length||0);
   if(!confirm((action==='archive'?'Archive':'Remove')+' “'+task.title+'”'+(count>1?' and its '+(count-1)+' linked parts':'')+'? You can restore '+(count>1?'them':'it')+' from '+(action==='archive'?'Archive':'Recently removed')+'.'))return false;
   const next=root.WeekwiseTaskHistory.move(snapshot.store,{id,week,kind:action,historyId:crypto.randomUUID()});
   app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-task-history-v1');
   undo={owner:app.account(),store:snapshot.store,expected:fingerprint()};render();announce('Task '+(action==='archive'?'archived':'removed')+'. Restore it or use Undo in Task history.');return true;
  }catch(error){announce(error.message);return false;}
 }
 function init(bridge){
  app=bridge;const dialog=$('recurringRemoveDialog');dialog.querySelectorAll('input[name="recurringRemoveScope"]').forEach(input=>input.addEventListener('change',previewSeries));$('recurringRemoveConfirm').addEventListener('change',previewSeries);$('recurringRemoveCancel').addEventListener('click',closeSeries);$('recurringRemoveForm').addEventListener('submit',applySeries);dialog.addEventListener('close',()=>{pendingSeries=null;});document.addEventListener('click',event=>{const button=event.target.closest('[data-task-history]');if(button)open(button.dataset.taskHistory);});
  $('taskHistoryKind').onchange=()=>{kind=$('taskHistoryKind').value;render();};
  $('taskHistorySearch').oninput=()=>{query=$('taskHistorySearch').value;render();};
  $('taskHistoryMore').onclick=()=>{root.WeekwiseListWindow.more(app.account()+'::history:'+kind+':'+query);render();};
  $('taskHistoryEntries').onclick=event=>{const button=event.target.closest('[data-history-restore]');if(!button)return;try{const snapshot=app.snapshot(),next=root.WeekwiseTaskHistory.restore(snapshot.store,button.dataset.historyRestore,{unscheduled:$('taskHistoryUnscheduled').checked});app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-task-restore-v1');undo=null;render();$('taskHistoryHeading').focus();announce('Original task records restored.');}catch(error){announce(error.message);}};
  $('taskHistoryUndo').onclick=()=>{try{if(!undo)return;if(undo.owner!==app.account()||undo.expected!==fingerprint())throw new Error('Newer changes are protected. Restore individual tasks from history instead.');app.commit(undo.expected,undo.owner,undo.store);undo=null;render();announce('Last task removal undone.');}catch(error){announce(error.message);}};
  render();
 }
 function open(action='archive'){if(!app)return;kind=action;query='';$('taskHistoryKind').value=kind;$('taskHistorySearch').value='';$('taskHistoryUnscheduled').checked=false;$('taskHistoryStatus').textContent='';app.panel('taskHistoryPanel','Task history');render();}
 root.WeekwiseTaskHistoryUI=Object.freeze({init,render,remove,open});
})(window);
