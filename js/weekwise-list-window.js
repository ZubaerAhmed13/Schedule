/* Bounded DOM rendering; all records remain available to search and export. */
(function(root){'use strict';const limits=new Map(),SIZE=100;
function page(key,records){if(typeof key!=='string'||!Array.isArray(records))throw new Error('Invalid task list.');if(!limits.has(key)){if(limits.size>=60)limits.delete(limits.keys().next().value);limits.set(key,SIZE);}const shown=Math.min(limits.get(key),records.length);return {records:records.slice(0,shown),shown,total:records.length,hasMore:shown<records.length};}
function more(key){limits.set(key,(limits.get(key)||SIZE)+SIZE);}
function reset(){limits.clear();}
root.WeekwiseListWindow=Object.freeze({page,more,reset,SIZE});})(typeof window!=='undefined'?window:globalThis);
