#!/usr/bin/env node
/**
 * Dependency-free release sanity checks for the actual GitHub Pages source.
 * This is not a security audit or end-to-end browser test.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
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

if (failures.length) {
  console.error(`\\n${failures.length} release sanity check(s) failed.`);
  process.exit(1);
}
console.log("\\nAll release sanity checks passed. This does not replace browser, backend, or deployment tests.");
