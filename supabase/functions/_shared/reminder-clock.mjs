import '../../../js/weekwise-timezones.js';
// Reuse the exact saved-zone converter; uncertain clock values never trigger a guess.
/** @returns {Date|null} */
export function reminderTime(value,zone,anchor=null){
 if(typeof value!=='string'||value.length>40)return null;const text=value.trim();
 if(typeof anchor==='number'&&Number.isFinite(anchor)&&Math.abs(anchor)<=8640000000000000)return new Date(anchor);
 const local=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
 if(local){try{return globalThis.WeekwiseTimeZones.wallTimeInZone({year:Number(local[1]),month:Number(local[2]),day:Number(local[3]),hour:Number(local[4]),minute:Number(local[5]),second:Number(local[6]||0)},zone);}catch(_){return null;}}
 const explicit=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(text);if(!explicit)return null;
 try{globalThis.WeekwiseTimeZones.checkedComponents(...explicit.slice(1,7).map(part=>Number(part||0)));}catch(_){return null;}
 const parsed=new Date(text);return Number.isFinite(parsed.getTime())?parsed:null;
}
export function taskReminderTime(task,value,zone){
 const anchors=task?.reminderInstants,anchor=anchors&&typeof anchors==='object'&&!Array.isArray(anchors)?anchors[value]:null;
 return reminderTime(value,task?.reminderTimeZone||zone,anchor);
}
export function reminderZone(data,subscriptionZone){
 const saved=data?.store?.settings?.timeZone,zone=typeof saved==='string'&&saved?saved:subscriptionZone;
 try{if(typeof zone!=='string'||!zone||zone.length>128)return null;new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone;}catch(_){return null;}
}
