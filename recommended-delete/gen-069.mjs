#!/usr/bin/env node
import{makeSpec,countSolutions,check}from"../engines/aquarium-rules.js";
const rounds=[
 {spec:{...makeSpec(4,4,[[[0,0],[1,0],[2,0],[3,0]],[[0,1],[1,1],[2,1],[3,1]],[[0,2],[1,2],[2,2],[3,2]],[[0,3],[1,3],[2,3]]],[0,1,2,3],[0,1]),fixed:{3:1}},answer:[3,3,2,1]},
 {spec:{...makeSpec(5,5,[[[0,0],[1,0],[2,0],[3,0],[4,0]],[[0,1],[1,1],[2,1],[3,1],[4,1]],[[0,2],[1,2],[2,2],[3,2],[4,2]],[[0,3],[1,3],[2,3],[3,3],[4,3]],[[0,4],[1,4],[2,4],[3,4]]],[0,1,2,3,4],[0,1]),fixed:{3:1,4:2}},answer:[4,4,3,1,2]}
];
for(const[i,r]of rounds.entries()){const x=countSolutions(r.spec,2),g=check(r.spec,r.answer);console.log(`round ${i+1}: solutions=${x.count} exhausted=${x.exhausted} grade=${g.ok}`);if(x.count!==1||!x.exhausted||!g.ok)process.exit(1);}console.log("Aquarium rounds verified.");
