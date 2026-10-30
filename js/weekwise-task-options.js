/* Optional task metadata. Safe defaults preserve every existing schedule and theme. */
(function(root){'use strict';
const PALETTE=Object.freeze({auto:null,blue:'#397bc4',teal:'#168781',green:'#40865b',purple:'#8564ba',rose:'#bd5b82',orange:'#b87236',slate:'#69788c'});
const BREAKS=Object.freeze([0,5,10,15,20,30,45,60]);
const colour=value=>Object.prototype.hasOwnProperty.call(PALETTE,value)?value:'auto';
const breakAfter=value=>BREAKS.includes(Number(value))?Number(value):0;
const accent=value=>PALETTE[colour(value)]||null;
function attributes(task,displayColour){const name=colour(task?.taskColor)==='auto'?colour(displayColour):colour(task.taskColor),value=accent(name);return value?' data-task-color="'+name+'" style="--ww-task-accent:'+value+'"':'';}
// Boundary indexes keep this linear apart from deterministic sorting.
function consecutive(records){
 const result=new Map(),days=new Map(),palette=['blue','purple','teal','orange','rose','green','slate'];
 for(const record of records){
  if(record.allDay||record.zoneError||record.task?.allDay||record.task?.unscheduled||!Number.isFinite(record.start)||!Number.isFinite(record.duration)||record.duration<=0)continue;
  const day=record.date;if(!days.has(day))days.set(day,[]);days.get(day).push(record);
 }
 for(const items of days.values()){
  items.sort((a,b)=>a.start-b.start||String(a.task.id).localeCompare(String(b.task.id)));
  const starts=new Set(items.map(r=>r.start)),ends=new Set(items.map(r=>r.start+r.duration)),manualStarts=new Map(),endColours=new Map();
  for(const r of items){const name=colour(r.task.taskColor);if(name!=='auto'){if(!manualStarts.has(r.start))manualStarts.set(r.start,new Set());manualStarts.get(r.start).add(name);}}
  for(const r of items){
   const end=r.start+r.duration,manual=colour(r.task.taskColor),touches=ends.has(r.start)||starts.has(end);let name=manual;
   if(manual==='auto'&&touches){
    const avoid=new Set([...(endColours.get(r.start)||[]),...(manualStarts.get(end)||[])]);
    name=palette.find(c=>!avoid.has(c))||palette[0];
   }
   if(name!=='auto'){
    result.set(r,name);if(!endColours.has(end))endColours.set(end,new Set());endColours.get(end).add(name);
   }
  }
 }
 return result;
}
function zones(){
 const favorites=['Europe/Berlin','Europe/London','Europe/Paris','Europe/Rome','Europe/Amsterdam','Europe/Brussels','Europe/Zurich','Europe/Vienna','Europe/Madrid','Europe/Lisbon','Europe/Helsinki','Europe/Warsaw','Europe/Istanbul','Asia/Dhaka','Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Seoul','Asia/Shanghai','Australia/Sydney','Pacific/Auckland','Africa/Cairo','Africa/Johannesburg','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Sao_Paulo','Etc/UTC'];
 const known=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):[];
 const all=[...new Set([...favorites,...known,Intl.DateTimeFormat().resolvedOptions().timeZone])];
 return all.filter(value=>{try{new Intl.DateTimeFormat('en-GB',{timeZone:value});return true;}catch(_){return false;}}).sort((a,b)=>a.localeCompare(b));
}
function populateZones(doc){const list=doc.getElementById('calendarZones');if(!list)return;const frag=doc.createDocumentFragment();for(const zone of zones()){const option=doc.createElement('option');option.value=zone;frag.append(option);}list.replaceChildren(frag);}
root.WeekwiseTaskOptions=Object.freeze({PALETTE,BREAKS,colour,breakAfter,accent,attributes,consecutive,zones,populateZones});
})(typeof window!=='undefined'?window:globalThis);
