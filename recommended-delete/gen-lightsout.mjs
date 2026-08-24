import { EFFECT, N, minimalSolution, cellsOf, popcount } from "../engines/lightsout-rules.js";

function randBoardFromPresses(seed, count) {
  let s = seed;
  const rand = () => { s ^= s<<13; s>>>=0; s ^= s>>17; s ^= s<<5; s>>>=0; return s/4294967296; };
  const cells = new Set();
  while (cells.size < count) cells.add(Math.floor(rand()*N));
  let board = 0;
  for (const c of cells) board ^= EFFECT[c];
  return board;
}

function find(targetPar, minPar, seedStart) {
  for (let seed = seedStart; seed < seedStart+50000; seed++) {
    for (let count = 3; count <= 8; count++) {
      const board = randBoardFromPresses(seed*7+count, count);
      const sol = minimalSolution(board);
      if (sol && sol.taps >= minPar && sol.taps <= targetPar) {
        return { board, sol, seed, count };
      }
    }
  }
  return null;
}

const r1 = find(4, 3, 1);
const r2 = find(7, 6, 99999);

for (const [name, r] of [["round1", r1], ["round2", r2]]) {
  console.log(name, "par=", r.sol.taps, "pressCells=", cellsOf(r.sol.pressMask));
  const grid = [];
  for (let row=0; row<5; row++) {
    let line = "";
    for (let col=0; col<5; col++) line += (r.board & (1<<(row*5+col))) ? "1" : "0";
    grid.push(line);
  }
  console.log(grid.join("\n"));
  console.log(JSON.stringify(cellsOf(r.board)));
}
