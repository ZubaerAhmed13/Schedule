import '../../../js/weekwise-timezones.js';
// Reuse the exact saved-zone converter; uncertain clock values never trigger a guess.
/** @returns {Date|null} */
export function reminderTime(value,zone){
 if(typeof value!=='string'||value.length>40)return null;const text=value.trim();
 const local=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
 if(local){try{return globalThis.WeekwiseTimeZones.wallTimeInZone({year:Number(local[1]),month:Number(local[2]),day:Number(local[3]),hour:Number(local[4]),minute:Number(local[5]),second:Number(local[6]||0)},zone);}catch(_){return null;}}
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text))return null;
 const parsed=new Date(text);return Number.isFinite(parsed.getTime())?parsed:null;
}
export function reminderZone(data,subscriptionZone){
 const saved=data?.store?.settings?.timeZone,zone=typeof saved==='string'&&saved?saved:subscriptionZone;
 try{if(typeof zone!=='string'||!zone||zone.length>128)return null;new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone;}catch(_){return null;}
}
