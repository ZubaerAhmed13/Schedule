#!/usr/bin/env node
/**
 * Dependency-free release sanity checks for the actual GitHub Pages source.
 * This is not a security audit or end-to-end browser test.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const pass = (message) => console.log("PASS " + message);
const fail = (message) => { failures.push(message); console.error("FAIL " + message); };

const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath)) {
  fail("index.html exists");
} else {
  const html = fs.readFileSync(indexPath, "utf8");
  if (/<title>\s*Weekwise/i.test(html)) pass("Weekwise document title exists");
  else fail("Weekwise document title exists");

  if (/<meta[^>]+name=["']viewport["'][^>]+content=/i.test(html)) pass("responsive viewport metadata exists");
  else fail("responsive viewport metadata exists");

  if (/SUPABASE_SERVICE_ROLE_KEY|service_role_key\s*[:=]\s*["'][^"']+["']/i.test(html)) {
    fail("no Supabase service-role secret embedded in public HTML");
  } else pass("no obvious service-role secret embedded in public HTML");

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let checked = 0;
  for (const [index, match] of scripts.entries()) {
    const attrs = match[1] || "";
    const source = match[2] || "";
    if (/\bsrc\s*=/i.test(attrs) || !source.trim()) continue;
    try {
      new vm.Script(source, { filename: `index.html:inline-script-${index + 1}` });
      checked += 1;
    } catch (error) {
      fail(`inline script ${index + 1} parses: ${error.message}`);
    }
  }
  if (checked > 0 && failures.length === 0) pass(`${checked} inline JavaScript block(s) parse`);
  else if (checked === 0) fail("at least one inline JavaScript block can be checked");

  for (const attr of ["href", "src"]) {
    const regex = new RegExp(`\\b${attr}=["']([^"']+)["']`, "gi");
    for (const match of html.matchAll(regex)) {
      const ref = match[1].trim();
      if (!ref || ref.startsWith("#") || /^(?:[a-z]+:|\/\/|data:|mailto:|tel:)/i.test(ref)) continue;
      const clean = decodeURIComponent(ref.split(/[?#]/, 1)[0]);
      if (!clean) continue;
      const resolved = path.resolve(root, clean);
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        fail(`local ${attr} reference stays inside repository: ${ref}`);
      } else if (!fs.existsSync(resolved)) {
        fail(`local ${attr} reference exists: ${ref}`);
      }
    }
  }
}

for (const filename of ["manifest.webmanifest"]) {
  const full = path.join(root, filename);
  try {
    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    if (data.name && data.start_url && data.display) pass(`${filename} is valid JSON with install metadata`);
    else fail(`${filename} has required install metadata`);
  } catch (error) {
    fail(`${filename} parses as JSON: ${error.message}`);
  }
}

const sw = path.join(root, "sw.js");
if (fs.existsSync(sw)) {
  const swText = fs.readFileSync(sw, "utf8");
  if (/addEventListener\s*\(\s*["']fetch["']/.test(swText)) pass("service worker has a fetch handler");
  else fail("service worker has a fetch handler");
} else {
  fail("sw.js exists");
}


// Focused regression checks for the cloud-save race and invite-trigger hardening.
const appSource = fs.readFileSync(indexPath, "utf8");
if (/let savedPayload=null;[\s\S]*?finally\{\s*cloudBusy=false;[\s\S]*?if\(savedPayload&&cloudUser&&cloudReady&&!cloudConflict&&cloudFingerprint\(buildCloudPayload\(\)\)!==cloudFingerprint\(savedPayload\)\)queueCloudSave\(\);/.test(appSource)) {
  pass("cloud save re-queues edits made while a request is in flight");
} else {
  fail("cloud save re-queues edits made while a request is in flight");
}

const inviteSqlPath = path.join(root, "supabase_invite_code_setup.sql");
if (fs.existsSync(inviteSqlPath)) {
  const inviteSql = fs.readFileSync(inviteSqlPath, "utf8");
  if (/set search_path = pg_catalog, extensions, private/i.test(inviteSql) &&
      /extensions\.digest\(submitted_code,\s*'sha256'\)/i.test(inviteSql)) {
    pass("invite trigger uses a restricted search path and schema-qualified digest");
  } else fail("invite trigger uses a restricted search path and schema-qualified digest");
  if (/on conflict \(code_hash\) do nothing;/i.test(inviteSql)) {
    pass("rerunning invite setup does not reactivate a revoked invite");
  } else fail("rerunning invite setup does not reactivate a revoked invite");
} else fail("invite-code SQL exists for validation");


// Integration-readiness artifacts must exist and remain explicitly non-destructive.
const diagnosticPath = path.join(root, "supabase_verify_setup.sql");
if (fs.existsSync(diagnosticPath)) {
  const diagnostic = fs.readFileSync(diagnosticPath, "utf8");
  if (/read-only integration diagnostics/i.test(diagnostic) &&
      /public\.weekwise_cloud_data/i.test(diagnostic) &&
      /public\.weekwise_save/i.test(diagnostic) &&
      /weekwise_require_referral_code/i.test(diagnostic) &&
      /select check_name, status, details/i.test(diagnostic) &&
      ! /^\s*(?:insert\s+into|update\s+\w|delete\s+from|drop\s+|create\s+|alter\s+)/im.test(diagnostic.replace(/^\s*--.*$/gm, ""))) {
    pass("Supabase diagnostics cover schema, RPC, RLS and invite setup without writes");
  } else fail("Supabase diagnostics cover schema, RPC, RLS and invite setup without writes");
} else fail("read-only Supabase diagnostic SQL exists");

const integrationGuidePath = path.join(root, "docs", "INTEGRATION_READINESS.md");
if (fs.existsSync(integrationGuidePath)) {
  const integrationGuide = fs.readFileSync(integrationGuidePath, "utf8");
  if (/OAuth status and requirements/i.test(integrationGuide) &&
      /Background push status and requirements/i.test(integrationGuide) &&
      /Data safety/i.test(integrationGuide) &&
      /not implemented/i.test(integrationGuide)) {
    pass("integration guide distinguishes implemented features from external setup requirements");
  } else fail("integration guide distinguishes implemented features from external setup requirements");
} else fail("integration readiness guide exists");


// The Pages deployment must identify its build and verify the live site serves that exact revision.
const deploymentWorkflowPath = path.join(root, ".github", "workflows", "deploy-pages.yml");
if (fs.existsSync(deploymentWorkflowPath)) {
  const deploymentWorkflow = fs.readFileSync(deploymentWorkflowPath, "utf8");
  if (/Embed deployment identity/.test(deploymentWorkflow) &&
      /build-info\.json/.test(deploymentWorkflow) &&
      /EXPECTED_COMMIT/.test(deploymentWorkflow) &&
      /EXPECTED_RUN_ID/.test(deploymentWorkflow) &&
      /published_commit/.test(deploymentWorkflow) &&
      /published_run_id/.test(deploymentWorkflow) &&
      /Smoke-test the published Weekwise app/.test(deploymentWorkflow)) {
    pass("Pages deployment publishes a build marker and checks the live commit/run identity");
  } else fail("Pages deployment publishes a build marker and checks the live commit/run identity");

  const lines = deploymentWorkflow.split("\n");
  const shellBlocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^ {8}run:\s*\|\s*$/.test(lines[i])) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") {
        body.push("");
        continue;
      }
      if (!/^ {10}/.test(lines[j])) break;
      body.push(lines[j].slice(10));
    }
    shellBlocks.push(body.join("\n"));
  }
  if (shellBlocks.length >= 2) {
    for (const [index, shell] of shellBlocks.entries()) {
      const result = spawnSync("bash", ["-n"], { input: shell, encoding: "utf8" });
      if (result.status === 0) pass(`Pages deploy shell block ${index + 1} parses`);
      else fail(`Pages deploy shell block ${index + 1} parses: ${result.stderr.trim()}`);
    }
  } else fail("Pages deploy workflow contains both shell blocks");
} else fail("Pages deployment workflow exists for validation");


// Keep the opt-in/live-triggered Supabase diagnostic read-only and syntax-valid.
const liveDiagnosticsPath = path.join(root, ".github", "workflows", "supabase-live-diagnostics.yml");
if (fs.existsSync(liveDiagnosticsPath)) {
  const liveWorkflow = fs.readFileSync(liveDiagnosticsPath, "utf8");
  if (/workflow_dispatch/.test(liveWorkflow) &&
      /\/auth\/v1\/health/.test(liveWorkflow) &&
      /\/auth\/v1\/settings/.test(liveWorkflow) &&
      /Google OAuth sign-in/.test(liveWorkflow) &&
      /Microsoft\/Azure OAuth sign-in/.test(liveWorkflow) &&
      /not an end-to-end OAuth test/.test(liveWorkflow) &&
      /GITHUB_STEP_SUMMARY/.test(liveWorkflow) &&
      !/SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(liveWorkflow)) {
    pass("live Supabase workflow checks public Auth health/provider flags without service-role credentials");
  } else fail("live Supabase workflow checks public Auth health/provider flags without service-role credentials");

  const lines = liveWorkflow.split("\n");
  const shellBlocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^ {8}run:\s*\|\s*$/.test(lines[i])) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") {
        body.push("");
        continue;
      }
      if (!/^ {10}/.test(lines[j])) break;
      body.push(lines[j].slice(10));
    }
    shellBlocks.push(body.join("\n"));
  }
  if (shellBlocks.length === 3) {
    for (const [index, shell] of shellBlocks.entries()) {
      const result = spawnSync("bash", ["-n"], { input: shell, encoding: "utf8" });
      if (result.status === 0) pass(`Supabase diagnostics shell block ${index + 1} parses`);
      else fail(`Supabase diagnostics shell block ${index + 1} parses: ${result.stderr.trim()}`);
    }
  } else fail("Supabase diagnostic workflow contains all three shell blocks");
} else fail("live Supabase diagnostic workflow exists");

if (failures.length) {
  console.error(`\\n${failures.length} release sanity check(s) failed.`);
  process.exit(1);
}
console.log("\\nAll release sanity checks passed. This does not replace browser, backend, or deployment tests.");
