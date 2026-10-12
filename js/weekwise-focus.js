/* Timestamp-based focus timer. Pauses never count as active focus. */
(function(root){
 'use strict';
 function create({id,owner,mode='focus',seconds=1500,task=null},now=Date.now()){
  if(!id||!owner||!['focus','break','long-break'].includes(mode)||!Number.isInteger(seconds)||seconds<1||seconds>14400)throw new Error('Invalid focus session.');
  return {version:1,id,owner,mode,totalSeconds:seconds,activeMs:0,runningSince:null,startedAt:null,task,logged:false};
 }
 function validate(state){
  if(!state||state.version!==1||typeof state.id!=='string'||typeof state.owner!=='string'||!['focus','break','long-break'].includes(state.mode)||!Number.isInteger(state.totalSeconds)||state.totalSeconds<1||state.totalSeconds>14400||!Number.isFinite(state.activeMs)||state.activeMs<0||(state.runningSince!==null&&!Number.isFinite(state.runningSince)))throw new Error('Saved focus session needs recovery.');
  return state;
 }
 function elapsed(state,now=Date.now()){
  validate(state);return Math.min(state.totalSeconds*1000,state.activeMs+(state.runningSince===null?0:Math.max(0,now-state.runningSince)));
 }
 function remaining(state,now=Date.now()){return Math.max(0,Math.ceil((state.totalSeconds*1000-elapsed(state,now))/1000));}
 function resume(state,now=Date.now()){
  validate(state);if(state.runningSince!==null||remaining(state,now)===0)return {...state};
  return {...state,runningSince:now,startedAt:state.startedAt||new Date(now).toISOString()};
 }
 function pause(state,now=Date.now()){return {...state,activeMs:elapsed(state,now),runningSince:null};}
 function finish(state,now=Date.now()){
  const value=pause(state,now),seconds=Math.floor(value.activeMs/1000);
  return {state:{...value,logged:true},record:value.mode==='focus'&&seconds>0?{id:value.id,taskId:value.task?.id||null,taskWeek:value.task?.week||null,taskTitle:value.task?.title||'',startedAt:value.startedAt,endedAt:new Date(now).toISOString(),seconds,minutes:seconds/60,completed:seconds>=value.totalSeconds}:null};
 }
 root.WeekwiseFocus=Object.freeze({create,validate,elapsed,remaining,resume,pause,finish});
})(typeof window!=='undefined'?window:globalThis);
