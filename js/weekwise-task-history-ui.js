(function(root){
 'use strict';let app=null,undo=null,query='',kind='archive';
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const fingerprint=()=>JSON.stringify(app.snapshot());
 const announce=message=>{$('taskHistoryStatus').textContent=message;app.announce(message);};
 function render(){
  if(!app)return;if(undo&&undo.owner!==app.account())undo=null;if(!$('taskHistoryPanel').closest('#utilityModal')||$('utilityModal').hidden)return;
  const entries=(app.snapshot().store.taskHistory||[]).filter(entry=>entry.kind===kind&&entry.items.some(item=>(item.task.title+' '+(item.task.note||'')).toLowerCase().includes(query.toLowerCase()))).slice().reverse();
  const page=root.WeekwiseListWindow.page(app.account()+'::history:'+kind+':'+query,entries);
  $('taskHistoryCount').textContent=entries.length+' saved '+(entries.length===1?'entry':'entries')+' · '+page.shown+' shown';
  $('taskHistoryEntries').innerHTML=page.records.map(entry=>'<article class="history-entry"><div><strong>'+esc(entry.items[0].task.title)+'</strong><small>'+esc(entry.createdAt.slice(0,10))+' · '+entry.items.length+' task'+(entry.items.length===1?'':'s')+'</small></div><button class="btn" type="button" data-history-restore="'+esc(entry.id)+'">Restore</button></article>').join('')||'<p>No saved tasks here.</p>';
  $('taskHistoryMore').hidden=!page.hasMore;$('taskHistoryUndo').hidden=!undo;
 }
 function remove(id,week,action='trash'){
  try{
   const snapshot=app.snapshot(),task=snapshot.store.weeks[week]?.tasks.find(task=>task.id===id);if(!task)return false;
   const count=1+(task.planningChildren?.length||0);
   if(!confirm((action==='archive'?'Archive':'Remove')+' “'+task.title+'”'+(count>1?' and its '+(count-1)+' linked parts':'')+'? You can restore '+(count>1?'them':'it')+' from '+(action==='archive'?'Archive':'Recently removed')+'.'))return false;
   const next=root.WeekwiseTaskHistory.move(snapshot.store,{id,week,kind:action,historyId:crypto.randomUUID()});
   app.commit(JSON.stringify(snapshot),app.account(),next,'weekwise-pre-task-history-v1');
   undo={owner:app.account(),store:snapshot.store,expected:fingerprint()};render();announce('Task '+(action==='archive'?'archived':'removed')+'. Restore it or use Undo in Task history.');return true;
  }catch(error){announce(error.message);return false;}
 }
 function init(bridge){
  app=bridge;document.addEventListener('click',event=>{const button=event.target.closest('[data-task-history]');if(button)open(button.dataset.taskHistory);});
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
