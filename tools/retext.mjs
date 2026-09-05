#!/usr/bin/env node
/* ============================================================================
   RETEXT — bulk-edits the prose of the working copies in tools/content.

     node tools/retext.mjs <patch.json>

   The patch is { "<n>": { note, help } }. `note` replaces the author's note,
   `help` is the detailed how-to-play behind the ? button, and the old `notes`
   array is dropped wherever it is found — the result screen no longer has
   anywhere to put it.

   Working copies are gitignored scratch, so this rewrites them as plain JSON
   rather than trying to preserve hand formatting. Only the packed blob is
   committed, and pack regenerates that from here.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "tools", "content");
const pad = (n) => String(n).padStart(3, "0");

const patch = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const words = (s) => s.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;

let touched = 0;
for (const key of Object.keys(patch).sort((a, b) => a - b)) {
  const n = Number(key);
  const file = path.join(CONTENT, `${pad(n)}.js`);
  if (!fs.existsSync(file)) { console.log(`  ! #${n} has no working copy`); continue; }

  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  const obj = { ...mod.default };

  if (patch[key].note) obj.note = patch[key].note;
  if (patch[key].help) obj.help = patch[key].help;
  if (obj.data && obj.data.notes) delete obj.data.notes;
  if (obj.notes) delete obj.notes;

  fs.writeFileSync(file,
    `/* Puzzle #${n} working copy — edit here, then: node tools/puzzle.js pack ${n} */\n\n`
    + `export default ${JSON.stringify(obj, null, 2)};\n`);

  const w = words(obj.note);
  const flag = w > 90 ? "  <-- long" : "";
  console.log(`  ✓ #${pad(n)} note ${String(w).padStart(3)}w, help ${String(words(obj.help || "")).padStart(3)}w${flag}`);
  touched++;
}
console.log(`\n${touched} working copies rewritten`);
