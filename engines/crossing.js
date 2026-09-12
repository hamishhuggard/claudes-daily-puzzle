import { el } from "./shared.js";
import { pathsFor, countSolutions, check } from "./crossing-rules.js";

export default { usesTimer: false, mount(root, puzzle, api) {
  const rounds = puzzle.data.rounds;
  const solved = rounds.map(({ spec }) => { const r = countSolutions(spec, 2); if (r.count !== 1 || !r.exhausted) throw Error("crossing puzzle is not unique"); return r.solutions[0]; });
  let round = 0, hints = 0, wrong = 0, choices;
  const wrap = el("div", "stack"); root.append(wrap);
  const candidates = (s, pair, i) => pathsFor(s, pair[0], pair[1]).filter(path => !s.required?.[i] || s.required[i].every(([r,c]) => path.some(([rr,cc]) => rr===r && cc===c)));
  const selected = s => s.pairs.map((p,i) => candidates(s,p,i)[choices[i]]);
  function start() { choices = rounds[round].spec.pairs.map(() => 0); render(); }
  function render() {
    const s = rounds[round].spec, paths = selected(s); wrap.innerHTML = "";
    wrap.append(el("p", "q-detail center", `Board ${round+1} of ${rounds.length} · choose one route for each pair`));
    const board = el("div"); board.style.display="grid"; board.style.gridTemplateColumns=`repeat(${s.cols},1fr)`;
    const labels = Array.from({length:s.rows*s.cols},()=>[]); paths.forEach((p,i)=>p.forEach(([r,c])=>labels[r*s.cols+c].push(i+1)));
    for(let r=0;r<s.rows;r++) for(let c=0;c<s.cols;c++) { const cell=el("div","frm-cell",labels[r*s.cols+c].join("/")||"·"); cell.style.aspectRatio="1"; cell.style.display="grid"; cell.style.placeItems="center"; if(s.crossings.some(([rr,cc])=>rr===r&&cc===c)) cell.style.outline="2px solid var(--accent, #d6a85f)"; board.append(cell); }
    wrap.append(board);
    s.pairs.forEach((pair,i)=>{ const all=candidates(s,pair,i), row=el("div","fairy-bar"); row.append(el("span","q-detail",`Path ${i+1} · route ${choices[i]+1}/${all.length}`)); const prev=el("button","ghost compact","Previous"),next=el("button","ghost compact","Next"); prev.onclick=()=>{choices[i]=(choices[i]+all.length-1)%all.length;render()}; next.onclick=()=>{choices[i]=(choices[i]+1)%all.length;render()}; row.append(prev,next); wrap.append(row); });
    const bar=el("div","fairy-bar"), hint=el("button","ghost compact","Hint"), done=el("button","primary compact","Check paths");
    hint.onclick=()=>{const i=choices.findIndex((x,j)=>JSON.stringify(candidates(s,s.pairs[j],j)[x])!==JSON.stringify(solved[round][j]));if(i>=0){choices[i]=candidates(s,s.pairs[i],i).findIndex(p=>JSON.stringify(p)===JSON.stringify(solved[round][i]));hints++;render();}};
    done.onclick=()=>{if(!check(s,selected(s)).ok){wrong++;return}if(++round<rounds.length)start();else api.finish({headline:hints?`All crossings joined · ${hints} hints`:"Every crossing joined",squares:rounds.map(()=>hints?"🟨":"🟩").join(""),stats:[["Boards",`${rounds.length}/${rounds.length}`],["Hints",String(hints)],["Wrong paths",String(wrong)]],perfect:!hints&&!wrong,extra:[]});};
    bar.append(hint,done); wrap.append(bar);
  }
  start();
}};
