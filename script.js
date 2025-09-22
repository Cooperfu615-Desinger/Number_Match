/* Number Pair — MVP
   Simplified Number Match–style game to learn front-end + logic + persistence.
   Rules (MVP):
   - 9x9 grid, numbers 1..9 generated in pairs.
   - Remove two ORTHOGONALLY adjacent tiles if:
       a) sum to 10 (e.g., 1+9, 2+8, 3+7, 4+6, 5+5)  [toggleable]
       b) equal numbers (e.g., 4 & 4)                 [toggleable]
   - If stuck, Shuffle randomizes remaining tiles' positions.
   - Autosave game state to localStorage.
   - Undo supports one step.
   Roadmap comments inside for adding "line-of-sight" matching and row appends later.
*/
const BOARD_SIZE = 9;
const STORAGE_KEY = "number-pair-v1";
const elBoard = document.getElementById('board');
const elScore = document.getElementById('score');
const elMoves = document.getElementById('moves');
const elTime  = document.getElementById('time');
const elNew = document.getElementById('new');
const elUndo = document.getElementById('undo');
const elHint = document.getElementById('hint');
const elShuffle = document.getElementById('shuffle');
const ruleSum = document.getElementById('rule-sum');
const ruleEq = document.getElementById('rule-eq');

let state = {
  grid: [],         // numbers or 0 for empty
  sel: null,        // {r,c}
  score: 0,
  moves: 0,
  startTs: Date.now(),
  history: [],      // for single-step undo
};

function newDeckPairs(count) {
  // Create pairs for numbers 1..9 distributed fairly.
  const nums = [];
  const per = Math.ceil((count)/2);
  for (let n=1; n<=9; n++) {
    for (let i=0; i<per; i++) { nums.push(n,n); }
  }
  // Trim to exact count
  return nums.slice(0, count);
}

function shuffle(a){
  for (let i=a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function newGame(){
  const total = BOARD_SIZE*BOARD_SIZE;
  const deck = shuffle(newDeckPairs(total));
  state.grid = [];
  let idx = 0;
  for (let r=0; r<BOARD_SIZE; r++) {
    const row = [];
    for (let c=0; c<BOARD_SIZE; c++) row.push(deck[idx++]);
    state.grid.push(row);
  }
  state.sel = null;
  state.score = 0;
  state.moves = 0;
  state.startTs = Date.now();
  state.history = [];
  save();
  render();
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    grid: state.grid, score: state.score, moves: state.moves,
    startTs: state.startTs
  }));
}

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try{
    const d = JSON.parse(raw);
    if (!d.grid || !Array.isArray(d.grid)) return false;
    state.grid = d.grid;
    state.score = d.score||0;
    state.moves = d.moves||0;
    state.startTs = d.startTs||Date.now();
    state.sel = null;
    state.history = [];
    render();
    return true;
  }catch(e){ return false; }
}

function timeTick(){
  const sec = Math.floor((Date.now()-state.startTs)/1000);
  const mm = String(Math.floor(sec/60)).padStart(2,'0');
  const ss = String(sec%60).padStart(2,'0');
  elTime.textContent = mm+":"+ss;
  requestAnimationFrame(()=>setTimeout(timeTick, 250));
}

function cellId(r,c){ return `r${r}c${c}`; }
function get(r,c){ return state.grid[r][c]; }
function set(r,c,val){ state.grid[r][c]=val; }

function render(){
  elBoard.innerHTML = '';
  elBoard.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
  for (let r=0; r<BOARD_SIZE; r++){
    for (let c=0; c<BOARD_SIZE; c++){
      const v = get(r,c);
      const tile = document.createElement('button');
      tile.className = 'tile'+(v===0?' empty':'');
      tile.id = cellId(r,c);
      tile.setAttribute('role','gridcell');
      tile.setAttribute('aria-label', v===0 ? 'empty' : String(v));
      tile.disabled = v===0;
      tile.textContent = v===0 ? '' : v;
      tile.addEventListener('click', ()=>onTap(r,c));
      elBoard.appendChild(tile);
    }
  }
  elScore.textContent = state.score;
  elMoves.textContent = state.moves;
  updateHints(false);
}

function neighbors(r,c){
  return [
    [r-1,c],[r+1,c],[r,c-1],[r,c+1]
  ].filter(([rr,cc])=> rr>=0 && rr<BOARD_SIZE && cc>=0 && cc<BOARD_SIZE);
}

function validPair(a,b){
  if (a===0 || b===0) return false;
  const sum10 = ruleSum.checked && (a+b===10);
  const equal = ruleEq.checked && (a===b);
  return sum10 || equal;
}

function onTap(r,c){
  const v = get(r,c);
  if (v===0) return;
  const current = state.sel;
  if (!current){
    state.sel = {r,c};
    markSelected(r,c,true);
    return;
  }
  // second selection
  if (current.r===r && current.c===c){
    // same tile: deselect
    markSelected(r,c,false);
    state.sel = null;
    return;
  }
  const v2 = get(current.r, current.c);
  const adj = neighbors(r,c).some(([rr,cc])=> rr===current.r && cc===current.c);
  if (adj && validPair(v,v2)){
    // record history for undo
    pushHistory();
    // clear both
    set(r,c,0); set(current.r,current.c,0);
    flashMatch(r,c); flashMatch(current.r,current.c);
    state.score += 10;
    state.moves += 1;
    state.sel = null;
    save();
    render();
    checkWin();
  }else{
    // move selection
    markSelected(current.r,current.c,false);
    state.sel = {r,c};
    markSelected(r,c,true);
  }
}

function markSelected(r,c,on){
  const el = document.getElementById(cellId(r,c));
  if (!el) return;
  el.classList.toggle('selected', !!on);
}

function flashMatch(r,c){
  const el = document.getElementById(cellId(r,c));
  if (!el) return;
  el.classList.add('match');
  setTimeout(()=>el && el.classList.remove('match'), 300);
}

function hasMoves(){
  for (let r=0;r<BOARD_SIZE;r++){
    for (let c=0;c<BOARD_SIZE;c++){
      const v = get(r,c);
      if (v===0) continue;
      for (const [rr,cc] of neighbors(r,c)){
        const w = get(rr,cc);
        if (validPair(v,w)) return true;
      }
    }
  }
  return false;
}

function updateHints(highlight=true){
  // clear current hints
  document.querySelectorAll('.tile.hint').forEach(el=>el.classList.remove('hint'));
  if (!highlight) return;
  outer:
  for (let r=0;r<BOARD_SIZE;r++){
    for (let c=0;c<BOARD_SIZE;c++){
      const v = get(r,c); if (v===0) continue;
      for (const [rr,cc] of neighbors(r,c)){
        const w = get(rr,cc); if (w===0) continue;
        if (validPair(v,w)){
          // show one hint pair
          document.getElementById(cellId(r,c))?.classList.add('hint');
          document.getElementById(cellId(rr,cc))?.classList.add('hint');
          break outer;
        }
      }
    }
  }
}

function checkWin(){
  const remaining = state.grid.flat().some(v=>v!==0);
  if (!remaining){
    setTimeout(()=>alert('You cleared the board! 🎉'), 50);
  } else if (!hasMoves()){
    // suggest shuffle
    // (non-blocking)
  }
}

function doShuffle(){
  pushHistory();
  const vals = state.grid.flat().filter(v=>v!==0);
  shuffle(vals);
  let i=0;
  for (let r=0;r<BOARD_SIZE;r++){
    for (let c=0;c<BOARD_SIZE;c++){
      if (get(r,c)!==0) set(r,c, vals[i++]);
    }
  }
  state.moves += 1;
  save();
  render();
}

function pushHistory(){
  // keep only last snapshot to keep it simple
  state.history = [JSON.stringify({grid: state.grid, score: state.score, moves: state.moves})];
}

function undo(){
  if (!state.history.length) return;
  const last = JSON.parse(state.history.pop());
  state.grid = last.grid;
  state.score = last.score;
  state.moves = last.moves;
  state.sel = null;
  save();
  render();
}

// Event wiring
elNew.addEventListener('click', newGame);
elUndo.addEventListener('click', undo);
elHint.addEventListener('click', ()=>updateHints(true));
elShuffle.addEventListener('click', doShuffle);
ruleSum.addEventListener('change', ()=>updateHints(false));
ruleEq.addEventListener('change', ()=>updateHints(false));

// boot
if (!load()) newGame();
timeTick();

/* Roadmap to a fuller Number Match:
   1) Connectivity beyond adjacency (line-of-sight through empty tiles in straight lines).
   2) Row appends when stuck: append new row from a generated bag of numbers.
   3) Daily challenge seeded by date (deterministic deck).
   4) Animations (slide-out, collapse) and sound.
   5) Leaderboard (requires simple backend — e.g., Firebase or your Node API).
*/
