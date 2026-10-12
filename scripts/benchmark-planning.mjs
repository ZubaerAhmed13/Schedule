#!/usr/bin/env node
import {performance} from 'node:perf_hooks';import '../js/weekwise-data.js';import '../js/weekwise-planning.js';
const results=[];
for(const count of [1000,5000,10000]){const store={settings:{},weeks:{'2026-10-11':{tasks:Array.from({length:count},(_,i)=>({id:'synthetic-'+i,title:'Synthetic task '+i,day:i%7,start:i%3===0?540+i%240:null,unscheduled:i%3!==0,duration:30,estimatedDurationMinutes:30,priority:i%5===0?'high':'none'}))}}};const times=[];for(let run=0;run<6;run++){const t=performance.now(),plan=WeekwisePlanning.build({store,weekStart:'2026-10-11'});times.push(performance.now()-t);if(run===5)results.push({records:count,medianMs:Number(times.slice(1).sort((a,b)=>a-b)[2].toFixed(2)),suggestions:plan.proposals.length,capacityMinutes:plan.capacity});}}
console.log(JSON.stringify({kind:'synthetic Node scheduling benchmark; not browser Core Web Vitals',runtime:process.version,results},null,2));
