#!/usr/bin/env node
/* Pack #75-#79 without rewriting the shared manifest. The parent agent merges
   the five metadata rows once all concurrent batches have landed. */
import fs from "node:fs";
import { encode, decode } from "../codec.js";
for (let n = 75; n <= 79; n++) {
  const c = (await import(`../tools/content/${String(n).padStart(3, "0")}.js?${Date.now()}`)).default;
  if (c.note.split(/\s+/).length < 60 || c.note.split(/\s+/).length > 90) throw new Error(`#${n} note word count`);
  if (c.help.split(/\s+/).length < 60 || c.help.split(/\s+/).length > 90) throw new Error(`#${n} help word count`);
  const blob = encode({ type: c.type, note: c.note, help: c.help, data: c.data }, n);
  const back = decode(blob, n);
  if (JSON.stringify(back.data) !== JSON.stringify(c.data)) throw new Error(`#${n} codec round trip changed data`);
  fs.writeFileSync(`puzzles/${String(n).padStart(3, "0")}.js`, `/* Puzzle #${n} — "${c.title}"\n   Encoded on purpose; see codec.js. To edit: use tools/content/${String(n).padStart(3, "0")}.js */\n\nexport const blob = "${blob}";\n`);
  console.log(`#${n} packed (${blob.length} bytes)`);
}
