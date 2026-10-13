/* countdowns controller. Explicit live state access; no runtime evaluation or new dependency. */
(function(root){
'use strict';
function create(weekwiseRuntime){
function persistCountdowns(){weekwiseRuntime.checkedCollectionSave(weekwiseRuntime.COUNTDOWNS_KEY,weekwiseRuntime.countdowns,value=>weekwiseRuntime.countdowns=value);}

function resetCountdownForm(){weekwiseRuntime.$('countdownEditId').value='';weekwiseRuntime.$('countdownTitle').value='';weekwiseRuntime.$('countdownDate').value='';weekwiseRuntime.$('countdownIcon').value='';weekwiseRuntime.$('countdownNote').value='';weekwiseRuntime.$('saveCountdownBtn').textContent='＋ Add countdown';weekwiseRuntime.$('cancelCountdownEdit').hidden=true;}

function saveCountdownForm(e){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}
 e.preventDefault();const title=weekwiseRuntime.$('countdownTitle').value.trim(),date=weekwiseRuntime.$('countdownDate').value;if(!title||!date){weekwiseRuntime.$('countdownForm').reportValidity();return;}
 const id=weekwiseRuntime.$('countdownEditId').value,fields={title,date,icon:weekwiseRuntime.$('countdownIcon').value.trim()||'⌛',note:weekwiseRuntime.$('countdownNote').value.trim(),updatedAt:new Date().toISOString()};
 if(id){const item=weekwiseRuntime.countdowns.find(c=>c.id===id);if(item)Object.assign(item,fields);}
 else weekwiseRuntime.countdowns.push({id:'cd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),...fields,createdAt:new Date().toISOString()});
 weekwiseRuntime.persistCountdowns();weekwiseRuntime.resetCountdownForm();weekwiseRuntime.renderCountdowns();weekwiseRuntime.showToast(id?'Countdown updated':'Countdown added');
}

function editCountdown(id){const item=weekwiseRuntime.countdowns.find(c=>c.id===id);if(!item)return;weekwiseRuntime.$('countdownEditId').value=id;weekwiseRuntime.$('countdownTitle').value=item.title||'';weekwiseRuntime.$('countdownDate').value=item.date||'';weekwiseRuntime.$('countdownIcon').value=item.icon||'';weekwiseRuntime.$('countdownNote').value=item.note||'';weekwiseRuntime.$('saveCountdownBtn').textContent='Save changes';weekwiseRuntime.$('cancelCountdownEdit').hidden=false;weekwiseRuntime.$('countdownTitle').focus();}

function deleteCountdown(id){if(!weekwiseRuntime.dataCanWrite()){arguments[0]?.preventDefault?.();return;}const item=weekwiseRuntime.countdowns.find(c=>c.id===id);if(!item)return;if(!confirm('Delete countdown "'+item.title+'"?'))return;weekwiseRuntime.countdowns=weekwiseRuntime.countdowns.filter(c=>c.id!==id);weekwiseRuntime.persistCountdowns();weekwiseRuntime.renderCountdowns();weekwiseRuntime.showToast('Countdown deleted');}

function wireCountdownControls(){
 weekwiseRuntime.$('countdownForm').addEventListener('submit',weekwiseRuntime.saveCountdownForm);weekwiseRuntime.$('cancelCountdownEdit').addEventListener('click',weekwiseRuntime.resetCountdownForm);
 weekwiseRuntime.$('countdownList').addEventListener('click',e=>{const edit=e.target.closest('[data-countdown-edit]');if(edit){weekwiseRuntime.editCountdown(edit.dataset.countdownEdit);return;}const del=e.target.closest('[data-countdown-delete]');if(del)weekwiseRuntime.deleteCountdown(del.dataset.countdownDelete);});
}

function taskBoardStatus(task){return task?.done||task?.status==='done'?'done':task?.status==='in-progress'?'in-progress':'todo';}

function renderKanbanCard(record){
 const t=record.task,status=weekwiseRuntime.taskBoardStatus(t),priority=t.priority||'none',due=t.dueDate?'<span class="kanban-chip">Due '+weekwiseRuntime.escapeHtml(weekwiseRuntime.fmtDate(weekwiseRuntime.parseKey(t.dueDate),{day:'numeric',month:'short'}))+'</span>':'';
 const priorityChip=priority!=='none'?'<span class="kanban-chip priority-'+weekwiseRuntime.escapeHtml(priority)+'">'+weekwiseRuntime.escapeHtml(({high:'↑ High',medium:'→ Medium',low:'↓ Low'})[priority]||priority)+'</span>':'';
 const listLabel=weekwiseRuntime.WORKSPACE_LISTS.find(x=>x.id===record.listId)?.label||'Inbox',focusTarget=Number(t.focusEstimateMinutes)||0,focusLogged=weekwiseRuntime.taskLoggedFocusMinutes(t.id);
 const focusHtml=focusTarget?'<span class="kanban-chip">'+focusTarget+'m focus'+(focusLogged?' · '+focusLogged+'m logged':'')+'</span>':'';
 return '<article class="kanban-card" data-board-task="'+weekwiseRuntime.escapeHtml(t.id)+'" data-board-week="'+weekwiseRuntime.escapeHtml(record.week)+'"><div class="kanban-card-top"><button type="button" class="kanban-card-title" data-board-edit="'+weekwiseRuntime.escapeHtml(t.id)+'" data-board-week="'+weekwiseRuntime.escapeHtml(record.week)+'">'+weekwiseRuntime.escapeHtml(t.title)+'</button></div>'+(t.note?'<div class="kanban-card-note">'+weekwiseRuntime.escapeHtml(t.note)+'</div>':'')+'<div class="kanban-card-meta"><span class="kanban-chip">'+weekwiseRuntime.escapeHtml(listLabel)+'</span>'+priorityChip+due+focusHtml+'</div><footer class="kanban-card-footer"><select data-board-status="'+weekwiseRuntime.escapeHtml(t.id)+'" data-board-week="'+weekwiseRuntime.escapeHtml(record.week)+'" aria-label="Change status of '+weekwiseRuntime.escapeHtml(t.title)+'"><option value="todo" '+(status==='todo'?'selected':'')+'>To do</option><option value="in-progress" '+(status==='in-progress'?'selected':'')+'>In progress</option><option value="done" '+(status==='done'?'selected':'')+'>Completed</option></select><button type="button" class="kanban-card-edit" title="Edit task" aria-label="Edit '+weekwiseRuntime.escapeHtml(t.title)+'" data-board-edit="'+weekwiseRuntime.escapeHtml(t.id)+'" data-board-week="'+weekwiseRuntime.escapeHtml(record.week)+'">✎</button></footer></article>';
}
return Object.freeze({persistCountdowns,resetCountdownForm,saveCountdownForm,editCountdown,deleteCountdown,wireCountdownControls,taskBoardStatus,renderKanbanCard});
}
root.WeekwiseAppCountdowns=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
