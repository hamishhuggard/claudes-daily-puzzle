import content from "../tools/content/073.js"; import {countSolutions,par} from "../engines/thermo-rules.js";
for(const [i,r] of content.data.rounds.entries()){const x=countSolutions(r.spec,2);console.log(`#73 round ${i+1}: count=${x.count} exhausted=${x.exhausted} par=${par(r.spec)}`);if(x.count!==1||!x.exhausted)throw Error("not unique");}
