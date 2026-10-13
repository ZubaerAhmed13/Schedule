/* Exact RFC 5545 date conversion. Never silently guess a DST gap/fold in a TZID. */
(function(root){'use strict';
 function checkedComponents(year,month,day,hour=0,minute=0,second=0){
  if(![year,month,day,hour,minute,second].every(Number.isInteger)||
     year<1000||year>9999||month<1||month>12||day<1||day>31||
     hour<0||hour>23||minute<0||minute>59||second<0||second>59)throw new Error('Invalid iCalendar date or time.');
  const value=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if(value.getUTCFullYear()!==year||value.getUTCMonth()+1!==month||value.getUTCDate()!==day)throw new Error('Invalid iCalendar date.');
  return value;
 }
 function zonedParts(timestamp,zone){
  const format=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=Object.fromEntries(format.formatToParts(timestamp).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
  return [parts.year,parts.month,parts.day,parts.hour,parts.minute,parts.second];
 }
 function wallTimeInZone({year,month,day,hour,minute,second=0},zone){
  const naive=checkedComponents(year,month,day,hour,minute,second).getTime();
  if(typeof zone!=='string'||!zone||zone.length>128)throw new Error('Invalid IANA time zone.');
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone});}
  catch(_){throw new Error('Unsupported iCalendar time zone: '+zone);}
  const fields=[year,month,day,hour,minute,second],offsets=new Set();
  for(let hours=-36;hours<=36;hours+=6){
   const sample=naive+hours*3600000,local=zonedParts(sample,zone);
   offsets.add(Date.UTC(local[0],local[1]-1,local[2],local[3],local[4],local[5])-sample);
  }
  const matches=[];
  for(const offset of offsets){
   const time=naive-offset;
   if(zonedParts(time,zone).every((item,i)=>item===fields[i]))matches.push(time);
  }
  if(!matches.length)throw new Error('Nonexistent local time during a daylight-saving change in '+zone+'.');
  if(matches.length!==1)throw new Error('Ambiguous local time during a daylight-saving change in '+zone+'.');
  return new Date(matches[0]);
 }
 function parseDateProperty(property){
  if(!property||typeof property.value!=='string')throw new Error('Missing iCalendar date.');
  const value=property.value.trim(),params=property.params||{},tzid=params.TZID;
  if(/^\\d{8}$/.test(value)){
   const date=checkedComponents(Number(value.slice(0,4)),Number(value.slice(4,6)),Number(value.slice(6,8)));
   if(tzid)throw new Error('A date-only iCalendar value cannot use TZID.');
   return {date:new Date(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),12),allDay:true};
  }
  const match=/^(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})?(Z)?$/.exec(value);
  if(!match)throw new Error('Unsupported iCalendar date format.');
  const [year,month,day,hour,minute,second]=[Number(match[1]),Number(match[2]),Number(match[3]),Number(match[4]),Number(match[5]),Number(match[6]||0)];
  const utc=checkedComponents(year,month,day,hour,minute,second);
  if(match[7]){
   if(tzid)throw new Error('UTC dates must not also declare TZID.');
   return {date:utc,allDay:false};
  }
  if(tzid)return {date:wallTimeInZone({year,month,day,hour,minute,second},tzid),allDay:false};
  // A floating iCalendar clock belongs to the importing device's current time zone.
  const date=new Date(year,month-1,day,hour,minute,second);
  if(date.getFullYear()!==year||date.getMonth()+1!==month||date.getDate()!==day||
     date.getHours()!==hour||date.getMinutes()!==minute||date.getSeconds()!==second)
     throw new Error('Nonexistent floating local calendar time.');
  return {date,allDay:false};
 }
 root.WeekwiseTimeZones=Object.freeze({checkedComponents,wallTimeInZone,parseDateProperty,zonedParts});
})(typeof window!=='undefined'?window:globalThis);
