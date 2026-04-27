#!/usr/bin/env node
/**
 * verify-isolation.mjs
 *
 * Vérifie que le module bandstream-shop n'a pas modifié bandstream-app.
 * Stratégie : snapshot des mtime + tailles + sha256 des fichiers de bandstream-app/
 * stocké dans scripts/.app-baseline.json. Toute différence = échec.
 *
 * Usage :
 *   node scripts/verify-isolation.mjs --init    # crée le baseline initial
 *   node scripts/verify-isolation.mjs           # vérifie contre le baseline
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const APP_DIR = resolve(__dirname, "..", "..", "bandstream-app");
const BASELINE_FILE = resolve(__dirname, ".app-baseline.json");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "test-results",
  "playwright-report",
]);

const IGNORE_FILES = new Set([".DS_Store"]);

function walk(dir, basePath) {
  const out = {};
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
    if (e.isFile() && IGNORE_FILES.has(e.name)) continue;
    const full = join(dir, e.name);
    const rel = relative(basePath, full);
    if (e.isDirectory()) {
      Object.assign(out, walk(full, basePath));
    } else if (e.isFile()) {
      const st = statSync(full);
      const buf = readFileSync(full);
      const hash = createHash("sha256").update(buf).digest("hex");
      out[rel] = { size: st.size, sha256: hash };
    }
  }
  return out;
}

function main() {
  if (!existsSync(APP_DIR)) {
    console.error(`[verify-isolation] bandstream-app not found at ${APP_DIR}`);
    process.exit(1);
  }

  const args = new Set(process.argv.slice(2));
  const isInit = args.has("--init");
  const snapshot = walk(APP_DIR, APP_DIR);

  if (isInit) {
    writeFileSync(BASELINE_FILE, JSON.stringify(snapshot, null, 2));
    console.log(`[verify-isolation] Baseline saved (${Object.keys(snapshot).length} files).`);
    return;
  }

  if (!existsSync(BASELINE_FILE)) {
    console.error(`[verify-isolation] No baseline. Run with --init first.`);
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  const diffs = [];

  for (const [path, meta] of Object.entries(baseline)) {
    const cur = snapshot[path];
    if (!cur) {
      diffs.push(`DELETED: ${path}`);
    } else if (cur.sha256 !== meta.sha256) {
      diffs.push(`MODIFIED: ${path}`);
    }
  }

  for (const path of Object.keys(snapshot)) {
    if (!baseline[path]) {
      diffs.push(`ADDED: ${path}`);
    }
  }

  if (diffs.length === 0) {
    console.log(`[verify-isolation] OK — bandstream-app is untouched (${Object.keys(snapshot).length} files).`);
    return;
  }

  console.error(`[verify-isolation] FAIL — ${diffs.length} change(s) detected in bandstream-app:`);
  for (const d of diffs.slice(0, 50)) console.error(`  ${d}`);
  if (diffs.length > 50) console.error(`  ... and ${diffs.length - 50} more`);
  process.exit(2);
}

main();
