import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8") + "\n" + fs.readFileSync(new URL("../js/weekwise-app.js", import.meta.url), "utf8");
const match = html.match(/async function saveCloudSnapshot\(\)\{[\s\S]*?\n\}\nasync function startCloudForUser\(/);
assert.ok(match, "saveCloudSnapshot function is present");
const functionSource = match[0].replace(/\nasync function startCloudForUser\($/, "");

function makeContext() {
  let resolveRpc;
  let rejectRpc;
  let conflictRow = null;
  const statuses = [];
  let payload = { version: 1, tasks: ["before"] };
  let queueCalls = 0;
  const context = {
    plannerStorageBlocked: false,localStorage:{getItem:()=>null},STORE_KEY:'planner',lastSavedDisk:null,
    WeekwiseData: {blockedKeys:()=>[]},
    cloudClient: { rpc: () => new Promise((resolve, reject) => { resolveRpc = resolve; rejectRpc = reject; }) },
    cloudUser: { id: "test-user" },
    cloudReady: true,
    cloudApplyingRemote: false,
    cloudConflict: null,
    showCloudConflict: (row) => { conflictRow = row; context.cloudConflict = row; },
    cloudBusy: false,
    cloudSessionEpoch: 1,
    cloudRevision: 4,
    requestCloudSave: (data,revision) => context.cloudClient.rpc('weekwise_save',{p_data:data,p_expected_revision:revision}),
    buildCloudPayload: () => payload,
    cloudFingerprint: (value) => JSON.stringify(value),
    writeCloudMeta: () => {},
    setCloudStatus: (message) => statuses.push(message),
    $: () => null,
    queueCloudSave: () => {
      assert.equal(context.cloudBusy, false, "retry must be scheduled after releasing the save lock");
      queueCalls += 1;
    },
    console: { error: () => {}, warn:()=>{} },
    Date,
    Number,
    Array,
    Promise,
  };
  vm.runInNewContext(functionSource, context);
  return {
    context,
    setPayload(value) { payload = value; },
    resolveRpc,
    getQueueCalls: () => queueCalls,
    getResolveRpc: () => resolveRpc,
    getRejectRpc: () => rejectRpc,
    getConflict: () => conflictRow,
    getStatuses: () => statuses,
  };
}

test("edits made during an in-flight cloud save are queued again after the lock is released", async () => {
  const fixture = makeContext();
  const saving = fixture.context.saveCloudSnapshot();
  await Promise.resolve();
  fixture.setPayload({ version: 1, tasks: ["before", "during-save"] });
  fixture.getResolveRpc()({
    data: [{ saved: true, revision: 5, updated_at: "2026-01-01T00:00:00Z" }],
    error: null,
  });
  await saving;
  assert.equal(fixture.getQueueCalls(), 1);
  assert.equal(fixture.context.cloudBusy, false);
});

test("a successful save does not schedule a redundant retry when no newer edits exist", async () => {
  const fixture = makeContext();
  const saving = fixture.context.saveCloudSnapshot();
  await Promise.resolve();
  fixture.getResolveRpc()({
    data: [{ saved: true, revision: 5, updated_at: "2026-01-01T00:00:00Z" }],
    error: null,
  });
  await saving;
  assert.equal(fixture.getQueueCalls(), 0);
  assert.equal(fixture.context.cloudBusy, false);
});

test("revision conflicts pause automatic saving and preserve the server revision", async () => {
  const fixture = makeContext();
  const saving = fixture.context.saveCloudSnapshot();
  await Promise.resolve();
  fixture.getResolveRpc()({
    data: [{ saved: false, revision: 9, data: { version: 1, tasks: ["remote"] }, updated_at: "2026-01-01T00:00:00Z" }],
    error: null,
  });
  await saving;
  assert.equal(fixture.getConflict().revision, 9);
  assert.deepEqual(fixture.getConflict().data, { version: 1, tasks: ["remote"] });
  assert.equal(fixture.getQueueCalls(), 0);
  assert.equal(fixture.context.cloudBusy, false);
});

test("network errors release the lock and report failure without discarding local edits", async () => {
  const fixture = makeContext();
  const saving = fixture.context.saveCloudSnapshot();
  await Promise.resolve();
  fixture.getRejectRpc()(new Error("network unavailable"));
  await saving;
  assert.equal(fixture.context.cloudBusy, false);
  assert.equal(fixture.getQueueCalls(), 0);
  assert.ok(fixture.getStatuses().some((message) => message.includes("Cloud save failed")));
  assert.deepEqual(fixture.context.buildCloudPayload(), { version: 1, tasks: ["before"] });
});

test('an old account response cannot mark a new account synced or change its revision',async()=>{
 const f=makeContext(),saving=f.context.saveCloudSnapshot();await Promise.resolve();f.context.cloudSessionEpoch++;f.context.cloudUser={id:'new-user'};f.context.cloudRevision=20;f.getResolveRpc()({data:[{saved:true,revision:5}],error:null});await saving;assert.equal(f.context.cloudRevision,20);assert.ok(!f.getStatuses().some(m=>m.startsWith('All changes synced')));
});

test('cloud queue skips unchanged snapshots and queues actual local changes',()=>{const start=html.indexOf('function queueCloudSave(){'),end=html.indexOf('\nasync function saveCloudSnapshot()',start),payload={version:1,store:{}};const fingerprint=JSON.stringify(payload);let timers=0;const c={plannerStorageBlocked:false,localStorage:{getItem:()=>null},STORE_KEY:'planner',lastSavedDisk:null,WeekwiseData:{blockedKeys:()=>[]},cloudClient:{},cloudUser:{id:'a'},cloudReady:true,cloudApplyingRemote:false,cloudConflict:null,cloudSyncTimer:null,readCloudMeta:()=>({userId:'a',fingerprint}),buildCloudPayload:()=>payload,cloudFingerprint:JSON.stringify,setCloudStatus(){},setTimeout:()=>++timers,clearTimeout(){}};vm.runInNewContext(html.slice(start,end),c);c.queueCloudSave();assert.equal(timers,0);payload.localChange=true;c.queueCloudSave();assert.equal(timers,1);});
