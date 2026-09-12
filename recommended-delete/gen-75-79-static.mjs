#!/usr/bin/env node
/* Reproducible authoring audit for #75-#79. The authored seeds are explicit;
   each is proved with the browser's rules core before printing its answer. */
import { countSolutions as statue } from "../engines/statue-rules.js";
import { countSolutions as knight } from "../engines/knight-rules.js";
import { countSolutions as cave } from "../engines/cave-rules.js";
import { countSolutions as nori } from "../engines/norinori-rules.js";
import { countSolutions as goki } from "../engines/gokigen-rules.js";
const specs = {
  75: { rows: 5, cols: 5, pieces: [{ id: "P1", shape: [[0,0],[1,0],[0,1],[0,2],[0,3]] }, { id: "P2", shape: [[0,2],[1,2],[1,1],[1,0],[2,1]] }, { id: "P3", shape: [[0,1],[1,1],[1,0],[2,0],[1,2]] }, { id: "P4", shape: [[0,2],[1,2],[1,1],[2,2],[1,0]] }, { id: "P5", shape: [[0,1],[1,1],[1,2],[1,3],[1,0]] }] },
  76: { rows: 5, cols: 5, start: [0,0], end: [4,4], kingAt: [12,20], checkpoints: [{ i: 17, cell: [1,3] }] },
  77: { rows: 4, cols: 4, clues: [[6,3,3,6],[3,2,2,3],[3,2,2,3],[6,3,3,6]] },
  78: { rows: 4, cols: 4, regions: [[0,5,3,4],[0,1,3,4],[0,5,2,1],[0,0,3,4]], regionCounts: [2,0,0,2,2,2] },
  79: { rows: 3, cols: 3, clues: [[0,2,0,1],[2,0,4,0],[0,4,1,1],[1,0,1,1]] },
};
const fns = { 75: statue, 76: knight, 77: cave, 78: nori, 79: goki };
for (const n of Object.keys(specs)) { const r = fns[n](specs[n], 2); if (r.count !== 1 || !r.exhausted) throw new Error(`#${n}: expected one exhausted solution`); console.log(`#${n}: unique and exhausted; solution`, JSON.stringify(r.solutions[0])); }
console.log(JSON.stringify(specs, null, 2));
