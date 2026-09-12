#!/usr/bin/env node
/* Authoring record for #67. Spare cells are blocked so an off-path mirror
   cannot create a second answer. */
import { makeSpec, countSolutions, trace } from "../engines/mirrors-rules.js";
const ports = (rows, cols) => ({ N:{r:0,c:Math.floor(cols/2),dir:0}, S:{r:rows-1,c:Math.floor(cols/2)-1,dir:2}, W:{r:Math.floor(rows/2),c:0,dir:3}, E:{r:Math.floor(rows/2)-1,c:cols-1,dir:1} });
const round = (rows, cols, entry, target, budget, crossN, answer) => { const grid=Array.from({length:rows},()=>Array(cols).fill("#")); for(const k of Object.keys(answer)){const [r,c]=k.split(",").map(Number);grid[r][c]=".";} return {spec:makeSpec(rows,cols,grid,ports(rows,cols),entry,target,budget),crossN,answer}; };
const rounds = [
  round(5,5,"W","E",{slash:2,back:2},1,{"0,0":"/","0,1":"\\","1,0":"\\","2,1":"/"}),
  round(6,6,"N","S",{slash:2,back:1},0,{"0,0":"\\","0,2":"/","0,3":"/"}),
  round(7,7,"W","S",{slash:1,back:1},0,{"0,0":"/","3,2":"\\"}),
];
for (const [i,rd] of rounds.entries()) { const res=countSolutions(rd.spec,rd.crossN,2); console.log(`round ${i+1}: count=${res.count} exhausted=${res.exhausted} trace=${JSON.stringify(trace(rd.spec,new Map(Object.entries(rd.answer))))}`); if(res.count!==1||!res.exhausted) throw new Error("uniqueness failure"); }
console.log("ROUNDS_JSON_START"); console.log(JSON.stringify(rounds)); console.log("ROUNDS_JSON_END");
