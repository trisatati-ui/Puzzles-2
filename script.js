/* Manchester United Logo Sliding Puzzle
   - Uses background-position to slice the image into tiles
   - Ensures solvable shuffles by performing random valid moves
*/

const boardEl = document.getElementById('board');
const sizeSel = document.getElementById('size');
const shuffleBtn = document.getElementById('shuffle');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const imgUpload = document.getElementById('imgUpload');

const winOverlay = document.getElementById('win');
const winMoves = document.getElementById('winMoves');
const winTime = document.getElementById('winTime');
const playAgain = document.getElementById('playAgain');
const confetti = document.getElementById('confetti');

const state = {
  n: 3,
  order: [],      // order[row * n + col] = tileIndex, or -1 for empty
  pos: [],        // pos[tileIndex] = {row, col}
  empty: { row: 0, col: 0 },
  imgSrc: 'assets/logo.png',
  started: false,
  moves: 0,
  seconds: 0,
  timerId: null,
  lastEmpty: null, // for shuffle anti-backtrack
};

function pad2(num){ return num.toString().padStart(2, '0'); }
function fmtTime(s){ const m = Math.floor(s/60); const r = s % 60; return `${pad2(m)}:${pad2(r)}`; }

function resetStats(){
  state.moves = 0;
  state.seconds = 0;
  movesEl.textContent = '0';
  timerEl.textContent = '00:00';
  state.started = false;
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function startTimerIfNeeded(){
  if (state.started) return;
  state.started = true;
  state.timerId = setInterval(()=>{
    state.seconds++;
    timerEl.textContent = fmtTime(state.seconds);
  }, 1000);
}

function stopTimer(){
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function setBoardVars(){
  const sizePx = Math.min(window.innerWidth * 0.92, 520);
  const tileSize = (sizePx - 2*8 - (state.n - 1)*8) / state.n; // container padding & gaps
  boardEl.style.setProperty('--tile-size', `${tileSize}px`);
  // background-size: N*100% so each tile shows correct fraction
  boardEl.style.setProperty('--bg-size', `${state.n*100}% ${state.n*100}%`);
}

function buildSolved(){
  state.order = [];
  state.pos = [];
  const total = state.n * state.n;
  for (let i=0;i<total;i++){
    if (i === total - 1){
      state.order.push(-1); // empty
      state.empty = { row: Math.floor(i/state.n), col: i % state.n };
    } else {
      state.order.push(i);
      state.pos[i] = { row: Math.floor(i/state.n), col: i % state.n };
    }
  }
}

function indexFromRC(row, col){ return row * state.n + col; }

function neighborsOfEmpty(){
  const {row, col} = state.empty;
  const nb = [];
  if (row > 0) nb.push({row: row-1, col});
  if (row < state.n-1) nb.push({row: row+1, col});
  if (col > 0) nb.push({row, col: col-1});
  if (col < state.n-1) nb.push({row, col: col+1});
  return nb;
}

function swapWithEmpty(tileRow, tileCol){
  const emptyIdx = indexFromRC(state.empty.row, state.empty.col);
  const tileIdx = indexFromRC(tileRow, tileCol);
  const tileNum = state.order[tileIdx];

  // move tile into empty spot
  state.order[emptyIdx] = tileNum;
  state.order[tileIdx] = -1;

  if (tileNum !== -1){
    state.pos[tileNum] = { row: state.empty.row, col: state.empty.col };
  }

  // remember prior empty
  state.lastEmpty = { ...state.empty };
  // update empty
  state.empty = { row: tileRow, col: tileCol };
}

function shuffleRandomMoves(steps=200){
  for (let s=0; s<steps; s++){
    const nb = neighborsOfEmpty();
    // avoid immediately undoing last move
    const choices = state.lastEmpty
      ? nb.filter(n => !(n.row === state.lastEmpty.row && n.col === state.lastEmpty.col))
      : nb;
    const pick = choices.length ? choices[Math.floor(Math.random()*choices.length)]
                                : nb[Math.floor(Math.random()*nb.length)];
    swapWithEmpty(pick.row, pick.col);
  }
}

function createTiles(){
  boardEl.innerHTML = '';
  const total = state.n * state.n;

  for (let row=0; row<state.n; row++){
    for (let col=0; col<state.n; col++){
      const idx = indexFromRC(row, col);
      const tileNum = state.order[idx];

      if (tileNum === -1) continue; // skip empty

      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.type = 'button';
      tile.setAttribute('aria-label', `Tile piece ${tileNum+1}`);
      tile.dataset.tilenum = tileNum;

      // Original (correct) row/col for this tile number:
      const or = Math.floor(tileNum / state.n);
      const oc = tileNum % state.n;

      // Position slice within the image using percentages
      const posX = (oc/(state.n-1))*100;
      const posY = (or/(state.n-1))*100;
      tile.style.setProperty('--bg-pos', `${posX}% ${posY}%`);
      tile.style.backgroundImage = `url('${state.imgSrc}')`;

      boardEl.appendChild(tile);
    }
  }

  layoutTiles();
}

function layoutTiles(){
  const rect = boardEl.getBoundingClientRect();
  const tileSize = (rect.width - 2*8 - (state.n - 1)*8) / state.n;
  // position each tile by its current row/col (from state.order)
  [...boardEl.children].forEach(tile => {
    const t = parseInt(tile.dataset.tilenum, 10);
    const {row, col} = state.pos[t];
    const x = 8 + col * (tileSize + 8);
    const y = 8 + row * (tileSize + 8);
    tile.style.setProperty('--x', `${x}px`);
    tile.style.setProperty('--y', `${y}px`);
    tile.style.transform = `translate(${x}px, ${y}px)`;
  });
}

function isSolved(){
  const total = state.n * state.n;
  for (let i=0;i<total-1;i++){
    if (state.order[i] !== i) return false;
  }
  return state.order[total-1] === -1;
}

function incrementMoves(){
  state.moves++;
  movesEl.textContent = state.moves.toString();
}

function onTileClick(e){
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const t = parseInt(tile.dataset.tilenum, 10);
  const { row, col } = state.pos[t];

  // Adjacent to empty?
  const md = Math.abs(row - state.empty.row) + Math.abs(col - state.empty.col);
  if (md !== 1) return;

  startTimerIfNeeded();
  swapWithEmpty(row, col);
  layoutTiles();
  incrementMoves();

  if (isSolved()){
    stopTimer();
    celebrate();
  }
}

function celebrate(){
  winMoves.textContent = `${state.moves}`;
  winTime.textContent = fmtTime(state.seconds);
  winOverlay.classList.remove('hidden');
  winOverlay.setAttribute('aria-hidden', 'false');
  sprayConfetti();
}

function sprayConfetti(){
  confetti.innerHTML = '';
  const colors = ['#ffd600','#ff7a59','#23d5ab','#23a6d5','#e4002b','#ffffff'];
  const pieces = 140;

  for (let i=0;i<pieces;i++){
    const p = document.createElement('div');
    p.className = 'p';
    const sx = (Math.random()*100) + 'vw';
    const ex = (Math.random()*100) + 'vw';
    const rot = (Math.random()*360) + 'deg';
    const dur = 1500 + Math.random()*1500;
    p.style.setProperty('--sx', sx);
    p.style.setProperty('--ex', ex);
    p.style.setProperty('--r', rot);
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = dur + 'ms';
    p.style.left = '0';
    confetti.appendChild(p);
  }
}

function hideWin(){
  winOverlay.classList.add('hidden');
  winOverlay.setAttribute('aria-hidden', 'true');
  confetti.innerHTML = '';
}

function rebuild(n){
  state.n = n;
  resetStats();
  buildSolved();
  setBoardVars();
  createTiles();
}

function shuffleStart(){
  resetStats();
  buildSolved();
  shuffleRandomMoves(220 + state.n*40);
  createTiles();
  // start timer on first player move (keeps UX crisp)
}

function handleKey(e){
  // Arrow keys move the empty space (invert logic: move tile towards empty)
  const {row, col} = state.empty;
  let target = null;
  if (e.key === 'ArrowUp' && row < state.n-1) target = {row: row+1, col};
  if (e.key === 'ArrowDown' && row > 0)     target = {row: row-1, col};
  if (e.key === 'ArrowLeft' && col < state.n-1) target = {row, col: col+1};
  if (e.key === 'ArrowRight' && col > 0)       target = {row, col: col-1};
  if (!target) return;

  startTimerIfNeeded();
  swapWithEmpty(target.row, target.col);
  layoutTiles();
  incrementMoves();
  if (isSolved()){
    stopTimer();
    celebrate();
  }
}

function changeImage(src){
  state.imgSrc = src;
  // Update tile backgrounds
  [...boardEl.children].forEach(tile=>{
    tile.style.backgroundImage = `url('${state.imgSrc}')`;
  });
}

/* Event wiring */
window.addEventListener('resize', ()=> { setBoardVars(); layoutTiles(); });
boardEl.addEventListener('click', onTileClick);
boardEl.addEventListener('keydown', handleKey);

sizeSel.addEventListener('change', (e)=>{
  const n = parseInt(e.target.value, 10);
  rebuild(n);
});

shuffleBtn.addEventListener('click', shuffleStart);

imgUpload.addEventListener('change', (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  changeImage(url);
});

playAgain.addEventListener('click', ()=>{
  hideWin();
  shuffleStart();
});

/* Init */
rebuild(3);
// If you already placed assets/logo.png, the game uses it by default.
// Otherwise, upload a custom image via the control.
