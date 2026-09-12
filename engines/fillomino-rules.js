/* GROW YOUR OWN — Fillomino with globally unique region sizes.
   Standard Fillomino fills every cell with a number; orthogonally connected
   equal numbers form a region whose size equals that number. Here every region
   size is different, so a size already used elsewhere is unavailable. */

const D4 = [[-1,0],[1,0],[0,-1],[0,1]];
export function makeSpec(rows, cols, givens) { return { rows, cols, givens }; }

export function regionsOf(grid) {
  const rows = grid.length, cols = grid[0].length, seen = new Set(), out = [];
  for (let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    const id=r*cols+c; if(seen.has(id)) continue;
    const value=grid[r][c]; if(!Number.isInteger(value)||value<1) return null;
    const cells=[], stack=[[r,c]]; seen.add(id);
    while(stack.length){const [rr,cc]=stack.pop();cells.push([rr,cc]);for(const[dr,dc]of D4){const nr=rr+dr,nc=cc+dc;const ni=nr*cols+nc;if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&!seen.has(ni)&&grid[nr][nc]===value){seen.add(ni);stack.push([nr,nc]);}}}
    out.push({ value, cells });
  }
  return out;
}
export function check(spec, grid) {
  const {rows,cols,givens}=spec;
  if(!Array.isArray(grid)||grid.length!==rows||grid.some(r=>!Array.isArray(r)||r.length!==cols)) return {ok:false,why:"wrong grid size"};
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(givens?.[r]?.[c]&&grid[r][c]!==givens[r][c])return{ok:false,why:"a given number changed"};
  const regs=regionsOf(grid); if(!regs)return{ok:false,why:"every cell needs a positive number"};
  const sizes=new Set(); for(const x of regs){if(x.cells.length!==x.value)return{ok:false,why:`a ${x.value}-region has ${x.cells.length} cells`};if(sizes.has(x.value))return{ok:false,why:"two regions share a size"};sizes.add(x.value);}
  return {ok:true};
}
export function countSolutions(spec, limit=2, nodeBudget=Infinity) {
  const {rows,cols,givens}=spec, g=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>givens?.[r]?.[c]||0));
  const sols=[];let found=0,nodes=0,budgetHit=false;const n=rows*cols;
  function go(k){if(found>=limit||budgetHit)return;if(++nodes>nodeBudget){budgetHit=true;return;}if(k===n){const x=check(spec,g);if(x.ok){found++;sols.push(g.map(r=>r.slice()));}return;}const r=Math.floor(k/cols),c=k%cols;if(g[r][c])return go(k+1);for(let v=1;v<=n;v++){g[r][c]=v;go(k+1);g[r][c]=0;if(found>=limit||budgetHit)return;}}
  go(0); return {count:found,solutions:sols,exhausted:!budgetHit};
}
export function par(spec){const r=countSolutions(spec,1);if(r.count!==1)throw new Error(`fillomino: expected one solution, found ${r.count}`);return r.solutions[0].flat().length;}
