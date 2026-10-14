import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../weekwise-calendar.js',import.meta.url),'utf8');
const configured={google:true,microsoft:false,encryption:true},connected={provider_account_email:'fixture-google@example.invalid'};
function fixture(){
 let owner='a',handler,domReady,service=async body=>body.action==='status'?{configured,providers:{google:connected,microsoft:null}}:{},prepare=async()=>{},reloads=0;
 const elements=new Map(),calls=[],redirects=[],toasts=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},disabled:false,hidden:false,addEventListener(){}});return elements.get(id);};
 const window={weekwiseCalendarBridge:{owner:()=>owner,async prepareSync(){await prepare();},async reloadAfterSync(){reloads++;},toast:t=>toasts.push(t),openPanel(){}},weekwiseCloudClient:{auth:{async getSession(){return {data:{session:owner?{user:{id:owner},access_token:'fixture-token-'+owner}:null}}},onAuthStateChange(fn){handler=fn;}},functions:{async invoke(name,args){calls.push({name,...args});return {data:await service(args.body,args.headers)}}}},location:{href:'https://fixture.invalid/',assign:url=>redirects.push(url)},confirm:()=>true,setTimeout(){},addEventListener(){}};
 const context={window,document:{readyState:'loading',getElementById:el,addEventListener(name,fn){if(name==='DOMContentLoaded')domReady=fn;}},history:{replaceState(){}},URL,Intl,Date,console};vm.runInNewContext(source,context);domReady();
 return {api:window.WeekwiseCalendarUI,window,el,calls,redirects,toasts,get reloads(){return reloads},setService(fn){service=fn},setPrepare(fn){prepare=fn},switchOwner(next){owner=next;handler('SIGNED_IN',next?{user:{id:next}}:null)}};
}
const turn=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('calendar status scopes requests to the active account and never enables an unconfigured sibling provider',async()=>{
 const f=fixture();await f.api.refreshStatus();assert.equal(f.el('connectGoogleCalendarBtn').disabled,false);assert.equal(f.el('connectMicrosoftCalendarBtn').disabled,true);assert.equal(f.el('syncMicrosoftCalendarBtn').hidden,true);assert.ok(f.calls.every(c=>c.headers.Authorization==='Bearer fixture-token-a'));
 await f.api.sync('google');assert.equal(f.el('connectMicrosoftCalendarBtn').disabled,true);assert.equal(f.el('syncMicrosoftCalendarBtn').disabled,true);assert.match(f.el('calendarConnectionsStatus').textContent,/sync finished/);
});
test('calendar failures and conflict feedback survive connection-status refresh',async()=>{
 const f=fixture();await f.api.refreshStatus();f.setService(async body=>body.action==='status'?{configured,providers:{google:connected}}:{error:'Provider refused the controlled request'});await f.api.sync('google');assert.match(f.el('calendarConnectionsStatus').textContent,/Provider refused/);await f.api.refreshStatus();assert.match(f.el('calendarConnectionsStatus').textContent,/Provider refused/);assert.equal(f.el('calendarConnectionsStatus').dataset.tone,'error');
 f.setService(async body=>body.action==='status'?{configured,providers:{google:connected}}:{imported:1,conflicts:[{title:'Fixture task',reason:'Both copies changed'}]});await f.api.sync('google');assert.match(f.el('calendarConnectionsStatus').textContent,/1 conflicts.*Both copies changed/);assert.equal(f.reloads,1);
});
test('a pending old-account authorization cannot redirect or overwrite the new account status',async()=>{
 const f=fixture();await f.api.refreshStatus();let resolve;f.setService(body=>body.action==='connect'?new Promise(r=>resolve=r):Promise.resolve({configured,providers:{}}));const pending=f.api.connect('google');await turn();assert.ok(resolve);assert.equal(f.calls.at(-1).headers.Authorization,'Bearer fixture-token-a');f.switchOwner('b');await f.api.refreshStatus();resolve({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'});await pending;assert.equal(f.redirects.length,0);assert.doesNotMatch(f.el('googleCalendarConnectionDetail').textContent,/fixture-google/);assert.equal(f.calls.at(-1).headers.Authorization,'Bearer fixture-token-b');
});
test('an account switch during cloud preparation prevents provider writes and planner reload',async()=>{
 const f=fixture();await f.api.refreshStatus();let release;f.setPrepare(()=>new Promise(r=>release=r));const pending=f.api.sync('google');await turn();f.switchOwner('b');release();await pending;assert.equal(f.calls.filter(c=>c.body.action==='sync').length,0);assert.equal(f.reloads,0);
});
test('unsafe authorization URLs are rejected and both valid provider hosts remain supported',async()=>{
 const f=fixture();await f.api.refreshStatus();for(const url of ['http://accounts.google.com/','https://attacker.invalid/','https://name:password@accounts.google.com/']){f.setService(async body=>body.action==='status'?{configured,providers:{}}:{authorizationUrl:url});await f.api.connect('google');assert.match(f.el('calendarConnectionsStatus').textContent,/unexpected authorization/);}assert.equal(f.redirects.length,0);
 f.setService(async body=>body.action==='status'?{configured:{...configured,microsoft:true},providers:{}}:{authorizationUrl:body.provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'});await f.api.connect('google');await f.api.connect('microsoft');assert.equal(f.redirects.length,2);
});
test('an older status result cannot restore the previous owner’s connection or unlock controls after sign-out',async()=>{
 const f=fixture();await f.api.refreshStatus();let release;f.setService(()=>new Promise(r=>release=r));const pending=f.api.refreshStatus();await turn();f.switchOwner(null);release({configured,providers:{google:connected}});await pending;assert.doesNotMatch(f.el('googleCalendarConnectionDetail').textContent,/fixture-google/);assert.equal(f.el('connectGoogleCalendarBtn').disabled,true);assert.equal(f.el('syncGoogleCalendarBtn').hidden,true);
});
