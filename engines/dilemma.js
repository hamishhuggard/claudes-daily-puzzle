import { el } from "./shared.js";
import { STRATEGIES, payoff, playMatch, C, D } from "./dilemma-rules.js";

/* ============================================================================
   DILEMMA — "the long game"
   ----------------------------------------------------------------------------
   Four opponents, eight rounds each, the ordinary prisoner's dilemma payoffs.
   You are shown the full roster of strategies at the start and told nothing
   about which four you are facing. Play the round, then name your opponent.

   The design is built on one fact, which the puzzle is really about: five of
   the strategies on that roster are INDISTINGUISHABLE from one another to a
   player who only ever cooperates. The Saint, the Mirror, the Grudge, the
   Patient and Pavlov all sit there cooperating back, forever, and no amount
   of further cooperation will ever separate them. The only way to learn who
   is across the table is to defect and watch what happens.

   And that is expensive, and unevenly so. One probe costs three points
   against the Mirror, which forgives. It costs eighteen against the Grudge,
   which does not. It costs nothing at all against the Saint, and pays sixteen.
   You cannot know in advance which of those you are buying.

   So the two things being scored pull against each other on purpose: naming
   all four opponents requires probes, and every probe you can afford is a
   probe that might cost you the match. There is no line that is safe and
   informative at once. That, rather than the arithmetic, is the puzzle.
   ========================================================================== */

const ROUNDS = 8;

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const lineup = puzzle.data.lineup;              // strategy keys, in order
    const { par, baseline, ceiling } = puzzle.data;
    const roster = Object.keys(STRATEGIES);

    let mi = 0;                                     // which match
    let moves = [];                                 // player's moves this match
    let phase = "play";                             // play | name | reveal
    let guess = null;
    const results = lineup.map(() => ({ score: 0, named: null, right: false }));

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const state = () => playMatch(lineup[mi], moves);

    function choose(move) {
      if (phase !== "play") return;
      moves.push(move);
      if (moves.length === ROUNDS) {
        results[mi].score = state().you;
        phase = "name";
      }
      render();
    }

    function accuse(key) {
      guess = key;
      render();
    }

    function confirmName() {
      results[mi].named = guess;
      results[mi].right = guess === lineup[mi];
      phase = "reveal";
      render();
    }

    function nextMatch() {
      mi++;
      moves = []; guess = null; phase = "play";
      if (mi === lineup.length) return done();
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const r = state();

      wrap.appendChild(el("p", "q-num", `Opponent ${mi + 1} of ${lineup.length}`));
      wrap.appendChild(el("div", "pips", lineup.map((_, i) =>
        `<i class="${i < mi ? "done" : i === mi ? "now" : ""}"></i>`).join("")));

      const total = results.reduce((a, x) => a + x.score, 0)
        + (phase === "play" ? r.you : 0);
      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Round</small><b>${Math.min(moves.length + 1, ROUNDS)}/${ROUNDS}</b>`),
        el("div", "grid-score-cell", `<small>This match</small><b>${r.you}</b>`),
        el("div", "grid-score-cell", `<small>Total</small><b>${total}</b>`),
        el("div", "grid-score-cell", `<small>Named</small><b>${results.filter((x) => x.right).length}/${lineup.length}</b>`),
      );
      wrap.appendChild(head);

      /* The transcript. Both rows are shown together because the whole game is
         reading their row against yours. */
      const tape = el("div", "dil-tape");
      const rowYou = el("div", "dil-row"), rowThem = el("div", "dil-row");
      rowYou.appendChild(el("span", "dil-rowlabel", "You"));
      rowThem.appendChild(el("span", "dil-rowlabel", "Them"));
      for (let i = 0; i < ROUNDS; i++) {
        const played = i < r.rounds.length;
        const mine = played ? r.rounds[i].you : null;
        const theirs = played ? r.rounds[i].them : null;
        const a = el("span", "dil-move" + (played ? (mine === D ? " defect" : " coop") : " blank"));
        a.textContent = played ? (mine === D ? "D" : "C") : "·";
        const b = el("span", "dil-move" + (played ? (theirs === D ? " defect" : " coop") : " blank"));
        b.textContent = played ? (theirs === D ? "D" : "C") : "·";
        if (played) {
          a.title = `round ${i + 1}: you scored ${r.rounds[i].gained}`;
          a.appendChild(el("i", "dil-pts", String(r.rounds[i].gained)));
        }
        rowYou.appendChild(a);
        rowThem.appendChild(b);
      }
      tape.append(rowThem, rowYou);
      wrap.appendChild(tape);

      const msg = el("p", "q-detail center dil-msg");
      if (phase === "play") {
        msg.innerHTML = "Both of you choose at the same time. <b>Cooperate</b> and they cooperate: 3 each. "
          + "Defect while they cooperate: <b>5</b> to you, nothing to them. Both defect: 1 each.";
      } else if (phase === "name") {
        msg.innerHTML = "Eight rounds played. <b>Who were you up against?</b>";
      } else {
        const truth = STRATEGIES[lineup[mi]];
        msg.innerHTML = results[mi].right
          ? `Right — that was <b>${truth.name}</b>. ${truth.blurb} You scored <b>${results[mi].score}</b>.`
          : `No — that was <b>${truth.name}</b>. ${truth.blurb} You scored <b>${results[mi].score}</b>.`;
      }
      wrap.appendChild(msg);

      /* The roster is on screen the whole time. Without it this is guesswork;
         with it, it is deduction with a price attached. */
      const list = el("div", "dil-roster");
      list.appendChild(el("div", "section-label",
        phase === "name" ? "Pick one" : `The eight possible opponents`));
      roster.forEach((key) => {
        const s = STRATEGIES[key];
        const usedBy = results.findIndex((x, i) => i < mi && lineup[i] === key);
        const row = el("button", "dil-strat"
          + (guess === key ? " picked" : "")
          + (phase === "reveal" && key === lineup[mi] ? " truth" : "")
          + (usedBy !== -1 ? " spent" : ""));
        row.innerHTML = `<b>${s.name}</b><span>${s.blurb}</span>`
          + (usedBy !== -1 ? `<em>opponent ${usedBy + 1}</em>` : "");
        row.disabled = phase !== "name";
        row.onclick = () => accuse(key);
        list.appendChild(row);
      });
      wrap.appendChild(list);

      const bar = el("div", "fairy-bar grid-bar");
      if (phase === "play") {
        const c = el("button", "primary compact", "Cooperate");
        c.onclick = () => choose(C);
        const d = el("button", "ghost compact", "Defect");
        d.onclick = () => choose(D);
        bar.append(c, d);
      } else if (phase === "name") {
        const b = el("button", "primary compact", "Name them");
        b.disabled = guess === null;
        b.onclick = confirmName;
        bar.appendChild(b);
      } else {
        const b = el("button", "primary compact",
          mi === lineup.length - 1 ? "See your score" : "Next opponent");
        b.onclick = nextMatch;
        bar.appendChild(b);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const points = results.reduce((a, x) => a + x.score, 0);
      const named = results.filter((x) => x.right).length;
      const squares = results.map((x) => (x.right ? "🟩" : "🟥")).join("");

      api.finish({
        headline: named === lineup.length
          ? `All four named, ${points} points`
          : `${named} of ${lineup.length} named, ${points} points`,
        squares,
        stats: [
          ["Points", `${points}`],
          ["Par", `${par}`],
          ["Named", `${named}/${lineup.length}`],
        ],
        perfect: named === lineup.length && points >= par,
        extra: [
          named === lineup.length ? "🕵️ knew every one of them" : `❓ ${lineup.length - named} misread`,
          points >= par ? "💰 beat par"
            : points > baseline ? `🤝 ${points - baseline} ahead of the trusting line`
            : points === baseline ? "🤝 exactly the trusting line"
            : `📉 ${baseline - points} worse than never defecting`,
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
