#!/usr/bin/env node
import { decode } from "../codec.js";
import { countSolutions as statueCount, check as statueCheck } from "../engines/statue-rules.js";
import { countSolutions as knightCount, check as knightCheck } from "../engines/knight-rules.js";
import { countSolutions as caveCount, check as caveCheck } from "../engines/cave-rules.js";
import { countSolutions as noriCount, check as noriCheck } from "../engines/norinori-rules.js";
import { countSolutions as gokiCount, check as gokiCheck } from "../engines/gokigen-rules.js";
const cases = [[75, statueCount, statueCheck], [76, knightCount, knightCheck], [77, caveCount, caveCheck], [78, noriCount, noriCheck], [79, gokiCount, gokiCheck]];
let fail = 0;
for (const [n, solve, grade] of cases) {
  const mod = await import(`../puzzles/${String(n).padStart(3, "0")}.js`), payload = decode(mod.blob, n), spec = payload.data.rounds[0].spec;
  const r = solve(spec, 2);
  const ok = r.count === 1 && r.exhausted && grade(spec, r.solutions[0]).ok;
  console.log(ok ? `ok: #${n} unique and grader accepts solution` : `FAIL: #${n} count=${r.count} exhausted=${r.exhausted}`);
  if (!ok) fail++;
  const broken = n === 75 ? r.solutions[0].slice(0, -1) : n === 76 ? r.solutions[0].slice(0, -1) : n === 79 ? r.solutions[0].slice(0, -1) : r.solutions[0].slice(0, -1);
  const bad = n === 75 ? grade(spec, broken) : n === 76 ? grade(spec, broken) : n === 77 ? grade(spec, broken) : n === 78 ? grade(spec, broken) : grade(spec, broken);
  if (bad.ok) { console.log(`FAIL: #${n} accepted incomplete answer`); fail++; } else console.log(`ok: #${n} rejects incomplete answer`);
}
process.exit(fail ? 1 : 0);
