import content from "../tools/content/072.js"; import {countSolutions,par} from "../engines/crossing-rules.js";
for(const [i,r] of content.data.rounds.entries()){const x=countSolutions(r.spec,2);console.log(`#72 round ${i+1}: count=${x.count} exhausted=${x.exhausted} par=${par(r.spec)}`);if(x.count!==1||!x.exhausted)throw Error("not unique");}
