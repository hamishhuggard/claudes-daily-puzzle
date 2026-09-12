import { el } from "./shared.js";
import { countSolutions, check } from "./fillomino-rules.js";
export default { usesTimer:false, mount(root,puzzle,api){
  const rounds=puzzle.data.rounds; const solved=rounds.map(x=>{const r=countSolutions(x.spec,2);if(r.count!==1||!r.exhausted)throw new Error("fillomino puzzle is not unique");return r.solutions[0];});
  let i=0,hints=0,wrong=0; const wrap=el("div","stack");root.appendChild(wrap);
  let board;
  function draw(){const rd=rounds[i],s=rd.spec;board=board||s.givens.map(r=>r.slice());wrap.innerHTML="";wrap.append(el("p","q-detail center",`Board ${i+1} of ${rounds.length} · enter region sizes`));const b=el("div");b.style.display="grid";b.style.gridTemplateColumns=`repeat(${s.cols},1fr)`;for(let r=0;r<s.rows;r++)for(let c=0;c<s.cols;c++){const x=el("button","frm-cell",board[r][c]?String(board[r][c]):"");x.style.aspectRatio="1";x.onclick=()=>{if(!s.givens[r][c]){board[r][c]=board[r][c]>=s.rows*s.cols?1:board[r][c]+1;x.textContent=String(board[r][c]);}};b.appendChild(x);}wrap.appendChild(b);const bar=el("div","fairy-bar");const hint=el("button","ghost compact","Hint");hint.onclick=()=>{h++;board=solved[i].map(r=>r.slice());draw()};const done=el("button","primary compact","Check board");done.onclick=()=>{const x=check(s,board);if(!x.ok){wrong++;return;}if(i<rounds.length-1){i++;board=null;draw()}else api.finish({headline:h?`Boards grown · ${h} hints`:`Every region grown`,squares:rounds.map(()=>h?"🟨":"🟩").join(""),stats:[["Boards",`${rounds.length}/${rounds.length}`],["Hints",String(h)],["Wrong boards",String(wrong)]],perfect:!h&&!wrong,extra:[]});};bar.append(hint,done);wrap.appendChild(bar);}
  draw();
} };
