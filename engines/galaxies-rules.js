/* DOM-free core for Split the Difference. A galaxy is a rotationally balanced
   region around its printed centre; authoring stores the small set of legal
   candidate regions and the solver chooses one per centre. The variant rule
   is that chosen regions must all have different areas. */
export function makeSpec(rows, cols, centers, candidates) { return { rows, cols, centers, candidates }; }
const key = ([r,c]) => `${r},${c}`;
function validShape(spec, cells) { const seen = new Set(); for (const cell of cells) { const [r,c]=cell; if(r<0||c<0||r>=spec.rows||c>=spec.cols||seen.has(key(cell))) return false; seen.add(key(cell)); } return true; }
export function check(spec, choices) {
  if (!Array.isArray(choices) || choices.length !== spec.centers.length) return { ok:false, why:"choose one galaxy for every centre" };
  const used = new Set(), sizes = [];
  for (let i=0;i<choices.length;i++) { const shape=spec.candidates[i]?.[choices[i]]; if(!shape||!validShape(spec,shape)) return {ok:false,why:`centre ${i+1} has no such region`}; sizes.push(shape.length); for(const cell of shape){const k=key(cell);if(used.has(k))return{ok:false,why:"two galaxies overlap"};used.add(k);} }
  if (used.size !== spec.rows*spec.cols) return {ok:false,why:"the galaxies do not cover the whole board"};
  if (new Set(sizes).size !== sizes.length) return {ok:false,why:"galaxy areas must all be different"};
  return {ok:true, sizes};
}
export function countSolutions(spec, limit=2) {
  const solutions=[]; let found=0;
  function go(i, choices) { if(found>=limit)return; if(i===spec.centers.length){if(check(spec,choices).ok){found++;solutions.push(choices.slice());}return;} for(let j=0;j<(spec.candidates[i]||[]).length;j++){choices.push(j);go(i+1,choices);choices.pop();} }
  go(0,[]); return {count:found,solutions,exhausted:true};
}
export function par(spec) { const r=countSolutions(spec,2); if(r.count!==1)throw new Error("galaxies: puzzle is not unique"); return spec.centers.length; }
