#!/usr/bin/env node
import content from "../tools/content/067.js";
import { countSolutions, check, par } from "../engines/mirrors-rules.js";
let fail=0; for(const [i,rd] of content.data.rounds.entries()){const r=countSolutions(rd.spec,rd.crossN,2),g=check(rd.spec,rd.answer,rd.crossN);console.log(`round ${i+1}: solutions=${r.count} exhausted=${r.exhausted} par=${par(rd.spec,rd.crossN)} grade=${g.ok}`);if(r.count!==1||!r.exhausted||!g.ok)fail++;} if(fail)process.exit(1); console.log("All #67 checks passed.");
