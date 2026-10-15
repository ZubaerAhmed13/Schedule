/* Owner-scoped editor drafts, with original bytes retained when recovery is needed. */
(function(root){'use strict';const FIELDS=new Set(['editTaskId','modalTitleInput','modalDay','modalCategory','modalListId','modalFolder','modalSection','modalSchedulingMode','modalPriority','modalStatus','modalFocusEstimate','modalDurationEstimate','modalRequiresCompletion','modalTodayPriority','modalImportance','modalUrgency','modalRecurrence','modalRecurrenceScope','modalRepeatEndMode','modalRepeatUntil','modalRepeatCount','modalRecurringBulkMetadata','modalDueDate','modalTaskColor','modalBreakAfter','modalReminderAt','modalReminderAt2','modalReminderAt3','modalReminderAt4','modalReminderAt5','modalTags','modalSubtasks','modalAllDay','modalNoSchedule','modalDuration','modalTime','modalEndTime','modalEndNextDay','modalNote','modalAttachments','taskTemplateSelect']);
function key(owner){return 'weekwise-editor-draft-v1:'+owner;}
function parse(raw,owner){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>64000)throw new Error('This editor draft needs recovery.');const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid editor draft.');const draft=value.version===2?value:{version:1,owner,fields:value,week:null,base:null,sessionId:'legacy'};if(draft.owner!==owner)throw new Error('This editor draft belongs to a different planner.');if(!draft.fields||typeof draft.fields!=='object'||Array.isArray(draft.fields))throw new Error('Invalid draft fields.');for(const [name,value]of Object.entries(draft.fields)){if(!FIELDS.has(name)||!['string','boolean'].includes(typeof value)||(typeof value==='string'&&value.length>12000))throw new Error('Unsupported field in editor draft.');}if(draft.week!=null&&!root.WeekwiseData.validDate(draft.week))throw new Error('Invalid draft week.');if(draft.base!=null&&typeof draft.base!=='string')throw new Error('Invalid draft baseline.');if(typeof draft.sessionId!=='string')throw new Error('Invalid draft session.');return draft;}
function read(storage,owner){const raw=storage.getItem(key(owner));if(raw===null)return null;try{return {raw,draft:parse(raw,owner)};}catch(error){return {raw,error:error.message};}}
function archiveKey(owner){return 'weekwise-editor-draft-archive-v1:'+owner+':'+Date.now()+':'+Math.random().toString(36).slice(2,8);}
function save(storage,draft){parse(JSON.stringify(draft),draft.owner);const current=read(storage,draft.owner);if(current?.error)throw new Error('A damaged editor draft is preserved. Download or discard it before saving another draft.');const raw=JSON.stringify(draft);if(current?.raw===raw)return;const entries=[];if(current&&current.draft.sessionId!==draft.sessionId)entries.push([archiveKey(draft.owner),current.raw]);entries.push([key(draft.owner),raw]);root.WeekwiseData.commitStorage(storage,entries);}
function discard(storage,owner,expectedRaw){const current=storage.getItem(key(owner));if(current!==expectedRaw)throw new Error('The draft changed in another tab. Review it again before discarding.');if(current===null)return;root.WeekwiseData.commitStorage(storage,[[archiveKey(owner),current],[key(owner),null]]);}
// Archived drafts are intentionally omitted from ordinary planner backups. Export their
// original bytes separately, including malformed records, without parsing or deleting them.
function exportHistory(storage,owner){
 if(typeof owner!=='string'||!owner||owner.includes(':'))throw new Error('Invalid planner owner.');
 if(!storage||typeof storage.key!=='function')throw new Error('Storage history is unavailable.');
 const current=key(owner),prefix='weekwise-editor-draft-archive-v1:'+owner+':',entries=[];
 let total=0;
 for(let i=0;i<storage.length;i++){
  const name=storage.key(i);
  if(name!==current&&!name?.startsWith(prefix))continue;
  const raw=storage.getItem(name);
  if(raw===null)continue;
  total+=new TextEncoder().encode(raw).byteLength;
  if(entries.length>=2000||total>10*1024*1024)throw new Error('Editor history is too large to export in one file. Existing drafts remain unchanged.');
  entries.push({key:name,raw});
 }
 entries.sort((a,b)=>a.key.localeCompare(b.key));
 return {app:'Weekwise',kind:'editor-draft-history',version:1,owner,exportedAt:new Date().toISOString(),entries};
}
root.WeekwiseDrafts=Object.freeze({key,parse,read,save,discard,exportHistory,FIELDS});})(typeof window!=='undefined'?window:globalThis);
