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
  if (/addEventListener\(['"]push['"]/.test(fs.readFileSync(sw, "utf8")) &&
    /addEventListener\(['"]notificationclick['"]/.test(fs.readFileSync(sw, "utf8")) &&
    /weekwise-push\.js/.test(fs.readFileSync(sw, "utf8")) &&
    /weekwise-calendar\.js/.test(fs.readFileSync(sw, "utf8"))) {
  pass("service worker handles Web Push and caches both integration clients");
} else fail("service worker handles Web Push and caches both integration clients");

if (failures.length) {
  console.error(`\\n${failures.length} release sanity check(s) failed.`);
  process.exit(1);
}
console.log("\\nAll release sanity checks passed. This does not replace browser, backend, or deployment tests.");
