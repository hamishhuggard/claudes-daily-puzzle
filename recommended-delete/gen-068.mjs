#!/usr/bin/env node
import{makeSpec,countSolutions,check}from"../engines/shakashaka-rules.js";
const rounds=[
 {spec:makeSpec(3,3,{"1,0":2,"1,1":3,"1,2":2,"2,0":0,"2,1":0,"2,2":0}),answer:[[0,0],[0,1],[0,2]]},
 {spec:makeSpec(4,4,{"0,0":2,"0,1":3,"0,2":3,"0,3":2,"2,0":2,"2,1":3,"2,2":3,"2,3":2,"3,0":0,"3,1":0,"3,2":0,"3,3":0}),answer:[[1,0],[1,1],[1,2],[1,3]]}
];
for(const[i,r]of rounds.entries()){const x=countSolutions(r.spec,2),g=check(r.spec,r.answer);console.log(`round ${i+1}: solutions=${x.count} exhausted=${x.exhausted} grade=${g.ok}`);if(x.count!==1||!x.exhausted||!g.ok)process.exit(1);}console.log("Shakashaka rounds verified.");
