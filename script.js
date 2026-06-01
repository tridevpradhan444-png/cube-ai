// ═══════════════════════════════════════════════════════
//  DATA & SETTINGS
// ═══════════════════════════════════════════════════════
let solves = JSON.parse(localStorage.getItem('cubeai_solves') || '[]');
let settings = Object.assign(
  { inspection: false, autoscramble: true, holdDuration: 500, scrambleLength: 20 },
  JSON.parse(localStorage.getItem('cubeai_settings') || '{}')
);

const FACE_COLORS = { U: '#ffd700', D: '#ffffff', F: '#00c853', B: '#2979ff', R: '#ff6d00', L: '#f44336' };
const OPPOSITE_COLORS = {
  '#ffd700': '#ffffff', '#ffffff': '#ffd700',
  '#00c853': '#2979ff', '#2979ff': '#00c853',
  '#ff6d00': '#f44336', '#f44336': '#ff6d00'
};
const COLOR_NAMES = {
  '#ffd700': 'Yellow', '#ffffff': 'White',
  '#00c853': 'Green', '#2979ff': 'Blue',
  '#ff6d00': 'Orange', '#f44336': 'Red'
};

const STAGE_INFO = {
  cross: { title: 'CROSS', desc: 'Build the white cross. Tap a sticker, pick a color to move it there. Only visible edge stickers participate.' },
  f2l: { title: 'F2L — FIRST TWO LAYERS', desc: 'Cross is locked. Paint F2L pairs. Only visible non-yellow stickers can be swapped.' },
  oll: { title: 'OLL — ORIENT LAST LAYER', desc: 'Orient the top face. Paint yellow on top-layer stickers to match your case.' },
  pll: { title: 'PLL — PERMUTE LAST LAYER', desc: 'Permute the top layer to solve. Paint the side colors of the top layer.' }
};

// ═══════════════════════════════════════════════════════
//  FACE MAP
// ═══════════════════════════════════════════════════════
const FACE_MAP_STATIC = [
  { face: 'R', axis: 'x', val: 1 }, { face: 'L', axis: 'x', val: -1 },
  { face: 'U', axis: 'y', val: 1 }, { face: 'D', axis: 'y', val: -1 },
  { face: 'F', axis: 'z', val: 1 }, { face: 'B', axis: 'z', val: -1 }
];

let animSpeed = 600;
let animFrameId = null;

// ═══════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════
function showScreen(name) {
  try {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + name).classList.add('active');
    document.querySelectorAll('.nav-item').forEach((item, i) => {
      item.classList.toggle('active', ['timer', 'history', 'practice', 'learn', 'settings', 'virtual-cube', 'privacy'][i] === name);
    });
    if (name === 'history') renderHistory();
    if (name === 'practice') initPScene();
  } catch (e) { console.error('showScreen:', e); }
}
function goLearn() { showScreen('learn'); closeDrawer(); }
function toggleDrawer() { document.getElementById('drawer').classList.toggle('open'); document.getElementById('hamburger').classList.toggle('open'); }
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('hamburger').classList.remove('open'); }

// ═══════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════
let timerRunning = false, timerStart = 0, timerVal = 0, timerInterval = null;
let holdTimeout = null, isHolding = false, isArmed = false;
let inspRunning = false, inspTime = 15, inspInterval = null, inspEnded = false;

function fmt(ms) {
  if (ms < 60000) return (ms / 1000).toFixed(3);
  const m = Math.floor(ms / 60000), s = ((ms % 60000) / 1000).toFixed(3);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function setTimerText(v) { document.getElementById('timer-text').textContent = fmt(v); }

function startTimer() {
  timerRunning = true; timerStart = Date.now();
  timerInterval = setInterval(() => { timerVal = Date.now() - timerStart; setTimerText(timerVal); }, 10);
  document.getElementById('timer-display').className = 'running';
  document.getElementById('timer-hint').classList.add('hidden');
  document.getElementById('bin-btn').classList.remove('visible');
  const id = document.getElementById('inspection-display');
  id.style.display = 'none'; id.textContent = '';
}
function stopTimer() {
  if (!timerRunning) return;
  timerRunning = false; clearInterval(timerInterval);
  timerVal = Date.now() - timerStart; setTimerText(timerVal);
  saveSolve(timerVal);
  document.getElementById('timer-display').className = '';
  document.getElementById('timer-hint').classList.remove('hidden');
  document.getElementById('bin-btn').classList.add('visible');
  if (settings.autoscramble) genScramble();
}
function saveSolve(ms) {
  solves.push({ time: ms, date: new Date().toISOString(), scramble: document.getElementById('scramble-text').textContent });
  localStorage.setItem('cubeai_solves', JSON.stringify(solves));
  updateStats(); showToast(fmt(ms));
}
function deleteLastSolve() {
  if (!solves.length) return;
  solves.pop();
  localStorage.setItem('cubeai_solves', JSON.stringify(solves));
  updateStats();
  document.getElementById('bin-btn').classList.remove('visible');
  timerVal = 0; setTimerText(0);
  showToast('Deleted');
}
function clearAllSolves() {
  if (!solves.length) return;
  solves = []; localStorage.setItem('cubeai_solves', JSON.stringify(solves));
  updateStats(); renderHistory();
  document.getElementById('bin-btn').classList.remove('visible');
  timerVal = 0; setTimerText(0);
  showToast('Cleared');
}
function calcAo(n) {
  if (solves.length < n) return null;
  const t = [...solves.slice(-n).map(s => s.time)].sort((a, b) => a - b).slice(1, -1);
  return t.reduce((a, b) => a + b, 0) / t.length;
}
function updateStats() {
  const t = solves.map(s => s.time);
  if (!t.length) { ['best', 'worst', 'mean', 'ao5', 'ao12'].forEach(id => document.getElementById('stat-' + id).textContent = '—'); return; }
  document.getElementById('stat-best').textContent = fmt(Math.min(...t));
  document.getElementById('stat-worst').textContent = fmt(Math.max(...t));
  document.getElementById('stat-mean').textContent = fmt(t.reduce((a, b) => a + b, 0) / t.length);
  const a5 = calcAo(5), a12 = calcAo(12);
  document.getElementById('stat-ao5').textContent = a5 ? fmt(a5) : '—';
  document.getElementById('stat-ao12').textContent = a12 ? fmt(a12) : '—';
}

// ═══════════════════════════════════════════════════════
//  2D SCRAMBLE NET (Timer page)
// ═══════════════════════════════════════════════════════
let timerCubeState = null;

function initTimerCubeState() {
  timerCubeState = {};
  for (const [f, c] of Object.entries(FACE_COLORS)) timerCubeState[f] = Array(9).fill(c);
}

function applyScrambleToTimerNet(scrambleStr) {
  initTimerCubeState();
  if (!scrambleStr || !scrambleStr.trim()) return;
  const moves = scrambleStr.trim().split(/\s+/);
  for (const m of moves) { if (m) timerCubeState = applyMoveToState(timerCubeState, m); }
  renderTimerNet();
}

function applyMoveToState(state, move) {
  const s = cloneState(state);
  const base = move.replace(/['\d]/g, '');
  const prime = move.includes("'"), double = move.includes("2");
  const times = double ? 2 : (prime ? 3 : 1);
  for (let t = 0; t < times; t++) applyMoveCW(s, base);
  return s;
}

function renderTimerNet() {
  const net = document.getElementById('timer-net');
  if (!net || !timerCubeState) return;
  const cs = 10, gap = 1, fs = cs * 3 + gap * 2;
  const tw = 4 * (fs + gap) - gap, th = 3 * (fs + gap) - gap;
  const layout = [
    { face: 'U', ro: 0, co: 1 }, { face: 'L', ro: 1, co: 0 }, { face: 'F', ro: 1, co: 1 },
    { face: 'R', ro: 1, co: 2 }, { face: 'B', ro: 1, co: 3 }, { face: 'D', ro: 2, co: 1 }
  ];
  let html = `<svg width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">`;
  for (const { face, ro, co } of layout) {
    const ox = co * (fs + gap), oy = ro * (fs + gap);
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      const sx = ox + c * (cs + gap), sy = oy + r * (cs + gap);
      const color = timerCubeState[face][i] || FACE_COLORS[face];
      html += `<rect x="${sx}" y="${sy}" width="${cs}" height="${cs}" fill="${color}" rx="1"/>`;
    }
  }
  html += '</svg>';
  net.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  INSPECTION
// ═══════════════════════════════════════════════════════
function startInspection() {
  inspRunning = true; inspEnded = false; inspTime = 15;
  const d = document.getElementById('inspection-display');
  d.style.display = 'block'; d.textContent = '15'; d.style.color = '';
  inspInterval = setInterval(() => {
    inspTime--;
    if (inspTime > 0) { d.textContent = inspTime; }
    else { clearInterval(inspInterval); inspRunning = false; inspEnded = true; flashInspectionEnd(); }
  }, 1000);
}
function flashInspectionEnd() {
  const disp = document.getElementById('timer-display');
  playBeep();
  let count = 0;
  const flash = setInterval(() => {
    disp.style.color = count % 2 === 0 ? '#ff4444' : '#ffffff';
    count++;
    if (count >= 6) { clearInterval(flash); disp.style.color = ''; startTimer(); }
  }, 180);
}
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 200, 400].forEach(delay => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.15);
      osc.start(ctx.currentTime + delay / 1000); osc.stop(ctx.currentTime + delay / 1000 + 0.15);
    });
  } catch (e) { }
}

// ═══════════════════════════════════════════════════════
//  HOLD LOGIC
// ═══════════════════════════════════════════════════════
const TS = document.getElementById('screen-timer');
function onHoldStart(e) {
  if (e.target.closest('#stats-bar') || e.target.closest('#bin-btn')) return;
  if (timerRunning) { stopTimer(); return; }
  isHolding = true;
  document.getElementById('timer-display').classList.add('holding');
  holdTimeout = setTimeout(() => {
    if (isHolding) { isArmed = true; document.getElementById('timer-display').classList.remove('holding'); document.getElementById('timer-display').classList.add('ready'); }
  }, settings.holdDuration);
}
function onHoldEnd(e) {
  if (timerRunning) return;
  clearTimeout(holdTimeout); isHolding = false;
  if (isArmed) {
    isArmed = false; document.getElementById('timer-display').classList.remove('ready');
    if (inspRunning) { clearInterval(inspInterval); inspRunning = false; startTimer(); }
    else if (settings.inspection && !inspEnded) { startInspection(); }
    else { startTimer(); }
    inspEnded = false;
  } else { document.getElementById('timer-display').classList.remove('holding'); }
}
TS.addEventListener('touchstart', onHoldStart, { passive: true });
TS.addEventListener('touchend', onHoldEnd);
TS.addEventListener('mousedown', onHoldStart);
TS.addEventListener('mouseup', onHoldEnd);
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' && document.getElementById('screen-timer').classList.contains('active')) {
    e.preventDefault();
    if (timerRunning) { stopTimer(); return; }
    if (!isHolding) onHoldStart(e);
  }
});
document.addEventListener('keyup', e => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space') onHoldEnd(e); });

// ═══════════════════════════════════════════════════════
//  SCRAMBLE GENERATORS
// ═══════════════════════════════════════════════════════
const MOVES = ['R', 'L', 'U', 'D', 'F', 'B'], MODS = ["", "'", "2"];
const OPP_MOVES = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'B', B: 'F' };

function genScrambleStr(len) {
  len = len || parseInt(settings.scrambleLength) || 20;
  let s = [], last = '', sec = '';
  for (let i = 0; i < len; i++) {
    let f; do { f = MOVES[Math.floor(Math.random() * 6)]; } while (f === last || (f === sec && OPP_MOVES[f] === last));
    s.push(f + MODS[Math.floor(Math.random() * 3)]); sec = last; last = f;
  }
  return s.join(' ');
}
function genScramble() {
  const s = genScrambleStr();
  document.getElementById('scramble-text').textContent = s;
  applyScrambleToTimerNet(s);
  return s;
}

// ═══════════════════════════════════════════════════════
//  OLL & PLL CASE DATABASES
// ═══════════════════════════════════════════════════════

// OLL cases: {name, alg, setup (inverse applied to solved to get the case)}
// setup is what you apply to a solved cube to get the OLL case on top
// alg solves it
const OLL_DB = [
  { name: 'OLL 21 (H)', alg: 'F R U R\' U\' R U R\' U\' R U R\' U\' F\'', setup: 'F R U R\' U\' R U R\' U\' R U R\' U\' F\'' },
  { name: 'OLL 22 (Pi)', alg: 'R U2 R2 U\' R2 U\' R2 U2 R', setup: 'R U2 R2 U\' R2 U\' R2 U2 R' },
  { name: 'OLL 23 (Headlights)', alg: 'R2 D R\' U2 R D\' R\' U2 R\'', setup: 'R2 D R\' U2 R D\' R\' U2 R\'' },
  { name: 'OLL 24', alg: 'r U R\' U\' r\' F R F\'', setup: 'r U R\' U\' r\' F R F\'' },
  { name: 'OLL 25', alg: 'F\' r U R\' U\' r\' F R', setup: 'F\' r U R\' U\' r\' F R' },
  { name: 'OLL 26 (Anti-Sune)', alg: 'R U2 R\' U\' R U\' R\'', setup: 'R U2 R\' U\' R U\' R\'' },
  { name: 'OLL 27 (Sune)', alg: 'R U R\' U R U2 R\'', setup: 'R U R\' U R U2 R\'' },
  { name: 'OLL 28', alg: 'r U R\' U\' M U R U\' R\'', setup: 'r U R\' U\' M U R U\' R\'' },
  { name: 'OLL 29', alg: 'R U R\' U\' R U\' R\' F\' U\' F R U R\'', setup: 'R U R\' F\' U F R U\' R\' U R U\' R\'' },
  { name: 'OLL 30', alg: 'F U R U\' R2 F\' R U R U\' R\'', setup: 'F U R U\' R\' F\' R\' U\' R U F U\' F\'' },
  { name: 'OLL 33', alg: 'R U R\' U\' R\' F R F\'', setup: 'R U R\' U\' R\' F R F\'' },
  { name: 'OLL 36', alg: 'R\' U\' R U\' R\' U R U l U\' R\' U', setup: 'U\' R U R\' U R U\' R\' U\' l\' U R U\'' },
  { name: 'OLL 37', alg: 'F R U\' R\' U\' R U R\' F\'', setup: 'F R U\' R\' U\' R U R\' F\'' },
  { name: 'OLL 44', alg: 'f R U R\' U\' f\'', setup: 'f R U R\' U\' f\'' },
  { name: 'OLL 45', alg: 'F R U R\' U\' F\'', setup: 'F R U R\' U\' F\'' },
  { name: 'OLL 46', alg: 'R\' U\' R\' F R F\' U R', setup: 'R\' U\' F\' R U R\' U\' F U R' },
  { name: 'OLL 47', alg: 'R\' U\' R\' F R F\' R\' F R F\' U R', setup: 'R\' U\' F R F\' R U F\' R\' F R\' U R' },
  { name: 'OLL 48', alg: 'F R U R\' U\' R U R\' U\' F\'', setup: 'F R U R\' U\' R U R\' U\' F\'' },
  { name: 'OLL 49', alg: 'r U\' r2 U r2 U r2 U\' r', setup: 'r U r2 U\' r2 U\' r2 U r\'' },
  { name: 'OLL 50', alg: 'r\' U r2 U\' r2 U\' r2 U r\'', setup: 'r U\' r2 U r2 U r2 U\' r' },
  { name: 'OLL 51', alg: 'f R U R\' U\' R U R\' U\' f\'', setup: 'f R U R\' U\' R U R\' U\' f\'' },
  { name: 'OLL 52', alg: 'R U R\' U R U\' B U\' B\' R\'', setup: 'R B U B\' U\' R\' U\' R U\' R\'' },
  { name: 'OLL 53', alg: 'l\' U2 L U L\' U l', setup: 'l\' U\' L U\' L\' U2 l' },
  { name: 'OLL 54', alg: 'r U2 R\' U\' R U\' r\'', setup: 'r U R\' U R U2 r\'' },
  { name: 'OLL 55', alg: 'R U2 R2 U\' R U\' R\' U2 F R F\'', setup: 'F R\' F\' U2 R U R\' U R2 U2 R\'' },
  { name: 'OLL 56', alg: 'r\' U\' r U\' R\' U R U\' R\' U R r\' U r', setup: 'r\' U\' r U R U\' R\' U R U\' R\' r\' U r' },
  { name: 'OLL 57 (Skew)', alg: 'R U R\' U\' M\' U R U\' r\'', setup: 'r U R\' U M U\' R U\' R\'' },
];

// PLL cases
const PLL_DB = [
  { name: 'T Perm', alg: 'R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'', setup: 'F R U\' R\' U R U R\' F\' R U R\' U\' R\' F R F\'' },
  { name: 'Y Perm', alg: 'F R U\' R\' U\' R U R\' F\' R U R\' U\' R\' F R F\'', setup: 'F R\' F R2 U\' R\' U\' R U R\' F\' R U\' R\' U F\'' },
  { name: 'Ua Perm', alg: 'M2 U M U2 M\' U M2', setup: 'M2 U\' M U2 M\' U\' M2' },
  { name: 'Ub Perm', alg: 'M2 U\' M U2 M\' U\' M2', setup: 'M2 U M U2 M\' U M2' },
  { name: 'H Perm', alg: 'M2 U M2 U2 M2 U M2', setup: 'M2 U M2 U2 M2 U M2' },
  { name: 'Z Perm', alg: 'M\' U M2 U M2 U M\' U2 M2', setup: 'M2 U2 M\' U2 M2 U2 M\' U2' },
  { name: 'Aa Perm', alg: 'x R\' U R\' D2 R U\' R\' D2 R2 x\'', setup: 'x\' R2 D2 R U R\' D2 R U\' R x' },
  { name: 'Ab Perm', alg: 'x R2 D2 R\' U\' R D2 R\' U R\' x\'', setup: 'x R\' U R D2 R\' U\' R D2 R2 x\'' },
  { name: 'E Perm', alg: 'x\' L U\' L D L\' U L D\' L\' U\' L D L\' U\' L D\' x', setup: 'x D L\' U L\' D\' L U\' L D L\' U L\' D\' L U L x\'' },
  { name: 'F Perm', alg: 'R\' U\' F\' R U R\' U\' R\' F R2 U\' R\' U\' R U R\' U R', setup: 'R\' U\' R U\' R U R\' U R2 F\' R\' U\' F R U\' R U R\'' },
  { name: 'Ga Perm', alg: 'R2 U R\' U R\' U\' R U\' R2 D U\' R\' U R D\'', setup: 'D R\' U\' R U D\' R2 U R\' U\' R U R U\' R2' },
  { name: 'Gb Perm', alg: 'R\' U\' R U D\' R2 U R\' U R U\' R U\' R2 D', setup: 'D\' R2 U\' R U\' R\' U R\' U R2 D R U R\' U\'' },
  { name: 'Gc Perm', alg: 'R2 U\' R U\' R U R\' U R2 D\' U R U\' R\' D', setup: 'D\' R U\' R\' D R2 U\' R U R\' U\' R\' U R2' },
  { name: 'Gd Perm', alg: 'R U R\' U\' D R2 U\' R U\' R\' U R\' U R2 D\'', setup: 'D R2\' U R\' U R U\' R U R2 D\' R\' U R U\'' },
  { name: 'Ja Perm', alg: 'x R2 F R F\' R U2 r\' U r U2 x\'', setup: 'x U2 r\' U\' r U2 R F\' R\' F R2 x\'' },
  { name: 'Jb Perm', alg: 'R U R\' F\' R U R\' U\' R\' F R2 U\' R\'', setup: 'R U R2\' F\' R U R\' U\' R\' F R U\' R\'' },
  { name: 'Na Perm', alg: 'R U R\' U R U R\' F\' R U R\' U\' R\' F R2 U\' R\' U2 R U\' R\'', setup: 'R U R\' U2 R U\' R2\' F R U R\' U\' R\' F\' R U\' R\' U R U\' R\'' },
  { name: 'Nb Perm', alg: 'R\' U R U\' R\' F\' U\' F R U R\' F R\' F\' R U\' R', setup: 'R U\' R F\' R U\' R\' F U R U\' R F\' U F R\' U\' R' },
  { name: 'Ra Perm', alg: 'R U R\' F\' R U2 R\' U2 R\' F R U R U2 R\'', setup: 'R U2\' R\' U2 R F\' R U2 R\' U2 R\' F R U\' R\'' },
  { name: 'Rb Perm', alg: 'R\' U2 R U2 R\' F R U R\' U\' R\' F\' R2', setup: 'R2\' F R U R\' U\' F\' R U2\' R\' U2 R' },
  { name: 'V Perm', alg: 'R\' U R\' d\' R\' F\' R2 U\' R\' U R\' F R F', setup: 'F\' R\' F\' R2 U R U\' R\' d R U\' R' },
];

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (!solves.length) { list.innerHTML = '<div class="history-empty"><div style="font-size:48px;opacity:0.3;">⏱</div><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;">No solves yet</div></div>'; return; }
  list.innerHTML = [...solves].reverse().map((s, i) => {
    const n = solves.length - i, d = new Date(s.date);
    const ds = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `<div class="solve-item"><div class="solve-num">#${n}</div><div class="solve-time">${fmt(s.time)}</div><div class="solve-date">${ds}</div><div class="solve-del" onclick="delSolve(${solves.length - 1 - i})">×</div></div>`;
  }).join('');
}
function delSolve(i) { solves.splice(i, 1); localStorage.setItem('cubeai_solves', JSON.stringify(solves)); updateStats(); renderHistory(); }

// ═══════════════════════════════════════════════════════
//  CUBE STATE ENGINE
// ═══════════════════════════════════════════════════════
let cubeState = null;

function initCubeState() {
  cubeState = {};
  for (const [f, c] of Object.entries(FACE_COLORS)) cubeState[f] = Array(9).fill(c);
}
function cloneState(s) { const c = {}; for (const f of Object.keys(s)) c[f] = [...s[f]]; return c; }

function rotateFaceCW(s, f) {
  const o = [...s[f]];
  s[f][0] = o[6]; s[f][1] = o[3]; s[f][2] = o[0];
  s[f][3] = o[7]; s[f][4] = o[4]; s[f][5] = o[1];
  s[f][6] = o[8]; s[f][7] = o[5]; s[f][8] = o[2];
}
function applyMoveCW(s, base) {
  if (base === 'U') { rotateFaceCW(s, 'U'); const t = [s.F[0], s.F[1], s.F[2]]; s.F[0] = s.R[0]; s.F[1] = s.R[1]; s.F[2] = s.R[2]; s.R[0] = s.B[0]; s.R[1] = s.B[1]; s.R[2] = s.B[2]; s.B[0] = s.L[0]; s.B[1] = s.L[1]; s.B[2] = s.L[2]; s.L[0] = t[0]; s.L[1] = t[1]; s.L[2] = t[2]; }
  else if (base === 'D') { rotateFaceCW(s, 'D'); const t = [s.F[6], s.F[7], s.F[8]]; s.F[6] = s.L[6]; s.F[7] = s.L[7]; s.F[8] = s.L[8]; s.L[6] = s.B[6]; s.L[7] = s.B[7]; s.L[8] = s.B[8]; s.B[6] = s.R[6]; s.B[7] = s.R[7]; s.B[8] = s.R[8]; s.R[6] = t[0]; s.R[7] = t[1]; s.R[8] = t[2]; }
  else if (base === 'R') { rotateFaceCW(s, 'R'); const t = [s.U[2], s.U[5], s.U[8]]; s.U[2] = s.F[2]; s.U[5] = s.F[5]; s.U[8] = s.F[8]; s.F[2] = s.D[2]; s.F[5] = s.D[5]; s.F[8] = s.D[8]; s.D[2] = s.B[6]; s.D[5] = s.B[3]; s.D[8] = s.B[0]; s.B[6] = t[0]; s.B[3] = t[1]; s.B[0] = t[2]; }
  else if (base === 'L') { rotateFaceCW(s, 'L'); const t = [s.U[0], s.U[3], s.U[6]]; s.U[0] = s.B[8]; s.U[3] = s.B[5]; s.U[6] = s.B[2]; s.B[8] = s.D[0]; s.B[5] = s.D[3]; s.B[2] = s.D[6]; s.D[0] = s.F[0]; s.D[3] = s.F[3]; s.D[6] = s.F[6]; s.F[0] = t[0]; s.F[3] = t[1]; s.F[6] = t[2]; }
  else if (base === 'F') { rotateFaceCW(s, 'F'); const t = [s.U[6], s.U[7], s.U[8]]; s.U[6] = s.L[8]; s.U[7] = s.L[5]; s.U[8] = s.L[2]; s.L[2] = s.D[0]; s.L[5] = s.D[1]; s.L[8] = s.D[2]; s.D[0] = s.R[6]; s.D[1] = s.R[3]; s.D[2] = s.R[0]; s.R[0] = t[2]; s.R[3] = t[1]; s.R[6] = t[0]; }
  else if (base === 'B') { rotateFaceCW(s, 'B'); const t = [s.U[0], s.U[1], s.U[2]]; s.U[0] = s.R[2]; s.U[1] = s.R[5]; s.U[2] = s.R[8]; s.R[2] = s.D[8]; s.R[5] = s.D[7]; s.R[8] = s.D[6]; s.D[6] = s.L[0]; s.D[7] = s.L[3]; s.D[8] = s.L[6]; s.L[0] = t[2]; s.L[3] = t[1]; s.L[6] = t[0]; }
  else if (base === 'M') {
    // M = L layer (x = -1 in R convention), opposite direction to L
    const t = [s.U[1], s.U[4], s.U[7]];
    s.U[1] = s.F[1]; s.U[4] = s.F[4]; s.U[7] = s.F[7];
    s.F[1] = s.D[1]; s.F[4] = s.D[4]; s.F[7] = s.D[7];
    s.D[1] = s.B[7]; s.D[4] = s.B[4]; s.D[7] = s.B[1];
    s.B[7] = t[0]; s.B[4] = t[1]; s.B[1] = t[2];
  }
}

function applyMove(state, move) {
  const s = cloneState(state);
  const base = move.replace(/['\d]/g, '');
  const prime = move.includes("'"), double = move.includes("2");
  const times = double ? 2 : (prime ? 3 : 1);
  for (let t = 0; t < times; t++) applyMoveCW(s, base);
  return s;
}
function applyMoves(state, movesStr) {
  if (!movesStr || !movesStr.trim()) return cloneState(state);
  let s = cloneState(state);
  for (const m of movesStr.trim().split(/\s+/)) if (m) s = applyMove(s, m);
  return s;
}
function invertMoves(movesStr) {
  if (!movesStr || !movesStr.trim()) return '';
  return movesStr.trim().split(/\s+/).reverse().map(m => {
    if (m.includes("'")) return m.replace("'", "");
    if (m.includes("2")) return m;
    return m + "'";
  }).join(' ');
}

// ═══════════════════════════════════════════════════════
//  PIECE HELPERS
// ═══════════════════════════════════════════════════════
function isEdgePiece(x, y, z) { return (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 2; }
function isCenterPiece(x, y, z) { return (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1; }
function isCornerPiece(x, y, z) { return Math.abs(x) === 1 && Math.abs(y) === 1 && Math.abs(z) === 1; }
function getPieceType(x, y, z) {
  if (isCenterPiece(x, y, z)) return 'center';
  if (isEdgePiece(x, y, z)) return 'edge';
  if (isCornerPiece(x, y, z)) return 'corner';
  return 'core';
}

function getStickerIndex(face, x, y, z) {
  let row, col;
  if (face === 'U') { row = 1 - z; col = x + 1; } else if (face === 'D') { row = z + 1; col = x + 1; }
  else if (face === 'F') { row = 1 - y; col = x + 1; } else if (face === 'B') { row = 1 - y; col = 1 - x; }
  else if (face === 'R') { row = 1 - y; col = 1 - z; } else { row = 1 - y; col = z + 1; }
  return Math.max(0, Math.min(8, row * 3 + col));
}
function getStickerColor(face, x, y, z) {
  if (!cubeState) return FACE_COLORS[face];
  const idx = getStickerIndex(face, x, y, z);
  return cubeState[face][idx] || FACE_COLORS[face];
}

// ═══════════════════════════════════════════════════════
//  VISIBILITY — determines which stickers are shown/active
// ═══════════════════════════════════════════════════════
function isStickerVisible(stage, face, x, y, z) {
  const ptype = getPieceType(x, y, z);
  if (ptype === 'core') return false;

  if (stage === 'cross') {
    // Only white-side edge stickers visible, no yellow, no corners
    if (ptype === 'corner') return false;
    if (ptype === 'center') return true; // centers for guidance
    if (ptype === 'edge') {
      // Hide yellow face
      if (face === 'U') return false;
      // Hide D-layer edges that are NOT part of the cross bottom
      // Actually show all edges EXCEPT on U face
      return true;
    }
  }
  if (stage === 'f2l') {
    const color = getStickerColor(face, x, y, z);
    // Hide yellow stickers everywhere (top layer orientation not done yet)
    if (color === '#ffd700') return false;
    // Hide D-layer edges (cross — those are locked/solved)
    if (ptype === 'edge' && y === -1) return false;
    // All remaining non-yellow pieces visible
    return true;
  }
  if (stage === 'oll') {
    // Show entire top layer (y=1) — face U + the side stickers of y=1 pieces
    if (y === 1) return true;
    if (face === 'U') return true;
    return false;
  }
  if (stage === 'pll') {
    // Show top layer + just enough side to see permutation
    if (y === 1) return true;
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════
//  PAINTABLE — which stickers can be painted by user
// ═══════════════════════════════════════════════════════
function isPaintable(stage, face, x, y, z) {
  const ptype = getPieceType(x, y, z);
  if (ptype === 'center' || ptype === 'core') return false;
  if (!isStickerVisible(stage, face, x, y, z)) return false;
  if (stage === 'cross') return ptype === 'edge' && face !== 'U';
  if (stage === 'f2l') {
    if (ptype === 'edge' && y === -1) return false; // cross locked
    return true;
  }
  if (stage === 'oll') return face === 'U' || y === 1;
  if (stage === 'pll') return y === 1;
  return true;
}

// ═══════════════════════════════════════════════════════
//  STAGE INITIALIZATION
// ═══════════════════════════════════════════════════════
function applyStageDefaults(stage) {
  initCubeState();
  if (stage === 'cross') {
    // Scramble only the cross edges — other pieces solved
    // Give a gentle random state for cross pieces
  } else if (stage === 'f2l') {
    // Cross is solved at bottom — randomize F2L slots
    // Keep D-face solved
  } else if (stage === 'oll') {
    // F2L solved — only last layer orientation wrong
    // Make all top stickers NOT yellow (unsolved OLL)
    // Apply a basic anti-OLL state
  } else if (stage === 'pll') {
    // OLL solved — top is all yellow, but permutation wrong
    cubeState.U = Array(9).fill('#ffd700');
  }
}

// ═══════════════════════════════════════════════════════
//  TAP-TO-MOVE — FIXED: only swaps within VISIBLE stickers
// ═══════════════════════════════════════════════════════
function handleTapToMove(faceName, x, y, z) {
  const ptype = getPieceType(x, y, z);
  const idx = getStickerIndex(faceName, x, y, z);
  const currentColor = cubeState[faceName][idx];

  if (ptype === 'center' || ptype === 'core') return;
  if (!isPaintable(pStage, faceName, x, y, z)) { showToast('Cannot paint here'); return; }

  const newColor = selectedColor;

  // Block yellow in cross/f2l
  if (newColor === '#ffd700' && (pStage === 'cross' || pStage === 'f2l')) {
    showToast('Yellow not allowed here');
    return;
  }

  // If tapping same color — remove it (reset to face default)
  if (currentColor === newColor) {
    cubeState[faceName][idx] = FACE_COLORS[faceName];
    buildMesh(); renderNet();
    return;
  }

  // Validate: check other stickers on SAME piece for conflicts
  const err = validatePiecePaint(faceName, x, y, z, newColor);
  if (err) { showToast(err); return; }

  // ── KEY FIX: only search VISIBLE stickers for color to swap ──
  let swapFace = null, swapIdx = null;
  const searchPtype = ptype; // only swap within same piece type

  outerLoop: for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) for (let sz = -1; sz <= 1; sz++) {
    if (!(searchPtype === 'edge' ? isEdgePiece(sx, sy, sz) : isCornerPiece(sx, sy, sz))) continue;
    if (sx === x && sy === y && sz === z) continue; // skip current piece

    for (const fm of FACE_MAP_STATIC) {
      const cv = fm.axis === 'x' ? sx : fm.axis === 'y' ? sy : sz;
      if (cv !== fm.val) continue;

      // ── ONLY consider sticker if it is currently VISIBLE ──
      if (!isStickerVisible(pStage, fm.face, sx, sy, sz)) continue;

      const si = getStickerIndex(fm.face, sx, sy, sz);
      if (cubeState[fm.face][si] === newColor) {
        swapFace = fm.face; swapIdx = si;
        break outerLoop;
      }
    }
  }

  if (swapFace !== null) {
    // Swap: clear old, paint new
    cubeState[swapFace][swapIdx] = FACE_COLORS[swapFace]; // restore old to face default
    cubeState[faceName][idx] = newColor;
  } else {
    // Color not found among visible — just paint it directly
    cubeState[faceName][idx] = newColor;
  }

  buildMesh(); renderNet();
}

// ═══════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════
function validatePiecePaint(face, x, y, z, newColor) {
  for (const fm of FACE_MAP_STATIC) {
    const cv = fm.axis === 'x' ? x : fm.axis === 'y' ? y : z;
    if (cv !== fm.val) continue;
    if (fm.face === face) continue;
    const c = cubeState[fm.face][getStickerIndex(fm.face, x, y, z)];
    if (c === FACE_COLORS[fm.face]) continue; // default color, ignore
    if (OPPOSITE_COLORS[newColor] === c) return `${COLOR_NAMES[newColor] || newColor} and ${COLOR_NAMES[c] || c} are opposite faces`;
    if (c === newColor) return `${COLOR_NAMES[newColor] || newColor} already on this piece`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE VALIDATION
// ═══════════════════════════════════════════════════════
function validateScrambleInput(str) {
  if (!str || !str.trim()) return { valid: false, error: 'Empty scramble' };
  const validMoves = /^([RLUDFB]2?'?\s*)+$/;
  const cleaned = str.trim();
  if (!validMoves.test(cleaned)) return { valid: false, error: 'Invalid moves detected. Use R, L, U, D, F, B with optional \' or 2' };
  return { valid: true, moves: cleaned };
}

// ═══════════════════════════════════════════════════════
//  PRACTICE STATE
// ═══════════════════════════════════════════════════════
let pStage = 'cross';
let selectedColor = '#ffffff';
let isAnimating = false;
let pSceneInit = false;
let scene, camera, renderer, rootGroup, cubeGroup;
let isDragging = false, prevMouse = { x: 0, y: 0 }, dragMoved = false, touchStartPos = { x: 0, y: 0 };
const DRAG_SPEED = 0.007;

function initPScene() {
  if (pSceneInit) return; pSceneInit = true;
  const container = document.getElementById('cube-wrap');
  const canvas = document.getElementById('practice-canvas');
  if (!container || !canvas) return;
  const w = container.clientWidth, h = container.clientHeight;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x080808);
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(0, 2, 6); camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 8, 6); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.25); dl2.position.set(-3, -2, -4); scene.add(dl2);

  rootGroup = new THREE.Group(); scene.add(rootGroup);
  cubeGroup = new THREE.Group(); rootGroup.add(cubeGroup);

  initCubeState(); applyStageDefaults(pStage); buildMesh();
  resetCubeAngle(); setupDrag();
  requestAnimationFrame(function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); });
  window.addEventListener('resize', () => {
    const w2 = container.clientWidth, h2 = container.clientHeight;
    camera.aspect = w2 / h2; camera.updateProjectionMatrix(); renderer.setSize(w2, h2);
  });
  setupPalette(); renderNet();

  // Check URL params for stage
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab'), stage = params.get('stage');
  if (tab === 'practice' && stage && STAGE_INFO[stage]) { setPStage(stage); }
}

// Track Y rotation as a clean discrete step so tilt never drifts
let cubeYStep = 0; // 0, 1, 2, 3 → 0°, 90°, 180°, 270°
const TILT_X = 0.3; // fixed X tilt in radians

function buildViewQuaternion(yStep) {
  // Always: tilt first (X), then Y rotation on top — never mixed
  const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT_X);
  const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yStep * Math.PI / 2);
  // Apply Y first in world space, then X tilt: qY then qX
  return qX.clone().multiply(qY);
}

function resetCubeAngle() {
  if (!rootGroup) return;
  cubeYStep = 0;
  rootGroup.quaternion.copy(buildViewQuaternion(0));
}

function rotateCube90() {
  if (!rootGroup || isAnimating) return;
  const startQ = rootGroup.quaternion.clone();
  cubeYStep = (cubeYStep + 1) % 4;
  const endQ = buildViewQuaternion(cubeYStep);
  const dur = 350, start = Date.now();
  function step() {
    const p = Math.min((Date.now() - start) / dur, 1);
    const e = p < 0.5 ? 2 * p * p : (1 - Math.pow(-2 * p + 2, 2) / 2);
    rootGroup.quaternion.slerpQuaternions(startQ, endQ, e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════
//  MESH BUILD
// ═══════════════════════════════════════════════════════
const FACE_MAP = [
  { face: 'R', axis: 'x', val: 1 }, { face: 'L', axis: 'x', val: -1 },
  { face: 'U', axis: 'y', val: 1 }, { face: 'D', axis: 'y', val: -1 },
  { face: 'F', axis: 'z', val: 1 }, { face: 'B', axis: 'z', val: -1 }
];

function buildMesh() {
  if (!cubeGroup || !cubeState) return;
  while (cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
  const gap = 0.06;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const geo = new THREE.BoxGeometry(1 - gap, 1 - gap, 1 - gap);
    const mats = FACE_MAP.map(fm => {
      const cv = fm.axis === 'x' ? x : fm.axis === 'y' ? y : z;
      if (cv !== fm.val) return new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
      const visible = isStickerVisible(pStage, fm.face, x, y, z);
      if (!visible) return new THREE.MeshLambertMaterial({ color: 0x111111 });
      const color = getStickerColor(fm.face, x, y, z);
      return new THREE.MeshLambertMaterial({ color: parseInt(color.replace('#', ''), 16) });
    });
    const mesh = new THREE.Mesh(geo, mats);
    mesh.position.set(x, y, z); mesh.userData = { x, y, z };
    cubeGroup.add(mesh);
  }
}

// ═══════════════════════════════════════════════════════
//  DRAG
// ═══════════════════════════════════════════════════════
function setupDrag() {
  const canvas = document.getElementById('practice-canvas');
  canvas.addEventListener('touchstart', e => {
    isDragging = true; dragMoved = false;
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - prevMouse.x, dy = e.touches[0].clientY - prevMouse.y;
    if (Math.sqrt((e.touches[0].clientX - touchStartPos.x) ** 2 + (e.touches[0].clientY - touchStartPos.y) ** 2) > 8) dragMoved = true;
    if (!dragMoved) return;
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * DRAG_SPEED);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * DRAG_SPEED);
    rootGroup.quaternion.premultiply(qY).premultiply(qX);
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (Math.sqrt((e.changedTouches[0].clientX - touchStartPos.x) ** 2 + (e.changedTouches[0].clientY - touchStartPos.y) ** 2) < 10)
      handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    isDragging = false; dragMoved = false;
  });
  canvas.addEventListener('mousedown', e => { isDragging = true; dragMoved = false; prevMouse = { x: e.clientX, y: e.clientY }; touchStartPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return; dragMoved = true;
    const dx = e.clientX - prevMouse.x, dy = e.clientY - prevMouse.y;
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * DRAG_SPEED);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * DRAG_SPEED);
    rootGroup.quaternion.premultiply(qY).premultiply(qX);
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mouseup', e => {
    if (Math.sqrt((e.clientX - touchStartPos.x) ** 2 + (e.clientY - touchStartPos.y) ** 2) < 5)
      handleTap(e.clientX, e.clientY);
    isDragging = false; dragMoved = false;
  });
}

// ═══════════════════════════════════════════════════════
//  TAP HANDLER
// ═══════════════════════════════════════════════════════
function handleTap(clientX, clientY) {
  if (!scene || !camera || !cubeGroup) return;
  const canvas = document.getElementById('practice-canvas');
  const raycaster = new THREE.Raycaster();
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(cubeGroup.children, false);
  if (!hits.length) return;

  const hit = hits[0];
  const fi = hit.face.materialIndex;
  const faceNames = ['R', 'L', 'U', 'D', 'F', 'B'];
  const faceName = faceNames[fi];
  const { x, y, z } = hit.object.userData;

  handleTapToMove(faceName, x, y, z);
}

// ═══════════════════════════════════════════════════════
//  PALETTE
// ═══════════════════════════════════════════════════════
const STAGE_COLORS = {
  cross: [{ c: '#ffffff', l: 'White' }, { c: '#00c853', l: 'Green' }, { c: '#ff6d00', l: 'Orange' }, { c: '#2979ff', l: 'Blue' }, { c: '#f44336', l: 'Red' }],
  f2l: [{ c: '#ffffff', l: 'W' }, { c: '#00c853', l: 'G' }, { c: '#ff6d00', l: 'O' }, { c: '#2979ff', l: 'B' }, { c: '#f44336', l: 'R' }],
  oll: [{ c: '#ffd700', l: 'Yellow' }],
  pll: [{ c: '#ffd700', l: 'Y' }, { c: '#00c853', l: 'G' }, { c: '#ff6d00', l: 'O' }, { c: '#2979ff', l: 'B' }, { c: '#f44336', l: 'R' }, { c: '#ffffff', l: 'W' }]
};
function setupPalette() {
  const colors = STAGE_COLORS[pStage];
  selectedColor = colors[0].c;
  const hint = { cross: 'White edges only', f2l: 'F2L pairs, cross locked', oll: 'Yellow top face', pll: 'All colors — top layer' };
  const pr = document.getElementById('paint-restrict');
  if (pr) pr.textContent = '— ' + hint[pStage];
  const cp = document.getElementById('cpalette');
  if (cp) cp.innerHTML = colors.map(c => `<div class="cswatch${c.c === selectedColor ? ' sel' : ''}" style="background:${c.c}" onclick="selColor('${c.c}')" title="${c.l}"></div>`).join('');
}
function selColor(c) {
  selectedColor = c;
  document.querySelectorAll('.cswatch').forEach(s => s.classList.toggle('sel', s.getAttribute('onclick') === `selColor('${c}')`));
}

// ═══════════════════════════════════════════════════════
//  2D NET
// ═══════════════════════════════════════════════════════
function renderNet() {
  const net = document.getElementById('cube-net');
  if (!net || !cubeState) return;
  const cs = 16, gap = 2, fs = cs * 3 + gap * 2;
  const tw = 4 * (fs + gap) - gap, th = 3 * (fs + gap) - gap;
  const layout = [
    { face: 'U', ro: 0, co: 1 }, { face: 'L', ro: 1, co: 0 }, { face: 'F', ro: 1, co: 1 },
    { face: 'R', ro: 1, co: 2 }, { face: 'B', ro: 1, co: 3 }, { face: 'D', ro: 2, co: 1 }
  ];
  function idxToXYZ(face, i) {
    const r = Math.floor(i / 3) - 1, c = (i % 3) - 1;
    if (face === 'U') return { x: c, y: 1, z: -r }; if (face === 'D') return { x: c, y: -1, z: r };
    if (face === 'F') return { x: c, y: -r, z: 1 }; if (face === 'B') return { x: -c, y: -r, z: -1 };
    if (face === 'R') return { x: 1, y: -r, z: -c }; return { x: -1, y: -r, z: c };
  }
  let html = `<svg width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">`;
  for (const { face, ro, co } of layout) {
    const ox = co * (fs + gap), oy = ro * (fs + gap);
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      const sx = ox + c * (cs + gap), sy = oy + r * (cs + gap);
      const pos = idxToXYZ(face, i);
      const visible = isStickerVisible(pStage, face, pos.x, pos.y, pos.z);
      const color = cubeState[face][i] || FACE_COLORS[face];
      html += `<rect x="${sx}" y="${sy}" width="${cs}" height="${cs}" fill="${visible ? color : '#1a1a1a'}" rx="1" stroke="#080808" stroke-width="0.5"/>`;
    }
    html += `<text x="${ox + fs / 2}" y="${oy - 2}" fill="#333" font-size="8" text-anchor="middle" font-family="Rajdhani,sans-serif">${face}</text>`;
  }
  html += '</svg>';
  net.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE CONTROLS — SEPARATE BUTTONS
// ═══════════════════════════════════════════════════════
let currentScrambleStr = '';

function handleGenerateBtn() {
  if (isAnimating) return;
  let s = '';
  if (pStage === 'cross') s = genCrossScramble();
  else if (pStage === 'f2l') s = genF2LScramble();
  else if (pStage === 'oll') s = genOLLScramble();
  else s = genPLLScramble();

  currentScrambleStr = s;
  const input = document.getElementById('pscramble-input');
  if (input) input.value = s;
  showToast('Generated — tap Apply to scramble');
}

function handleApplyBtn() {
  if (isAnimating) return;
  const input = document.getElementById('pscramble-input');
  const val = input ? input.value.trim() : currentScrambleStr;
  if (!val) { showToast('Generate or type a scramble first'); return; }

  const check = validateScrambleInput(val);
  if (!check.valid) { showToast(check.error); return; }

  currentScrambleStr = val;
  applyStageDefaults(pStage);
  cubeState = applyMoves(cubeState, currentScrambleStr);
  animateMoves(currentScrambleStr, () => { buildMesh(); renderNet(); });
}

function resetPCube() {
  isAnimating = false;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  currentScrambleStr = '';
  const inp = document.getElementById('pscramble-input'); if (inp) inp.value = '';
  const sp = document.getElementById('solution-panel'); if (sp) sp.classList.remove('show');
  const ov = document.getElementById('move-overlay'); if (ov) { ov.classList.remove('show'); ov.textContent = ''; }
  applyStageDefaults(pStage);
  buildMesh(); renderNet();
}

// ═══════════════════════════════════════════════════════
//  CASE DETECTION & SOLUTION GENERATION
// ═══════════════════════════════════════════════════════

// ── CROSS SOLVER ──
// Find actual solution for white cross from current state
function solveCross(state) {
  // White edges must end up in D face with matching side colors
  // Edge positions (face, index) for D edges:
  // D-F edge: D[1] + F[7]  → D[1]=white, F[7]=green
  // D-R edge: D[5] + R[7]  → D[5]=white, R[7]=orange
  // D-B edge: D[7] + B[7]  → D[7]=white, B[7]=blue
  // D-L edge: D[3] + L[7]  → D[3]=white, L[7]=red

  // Simple BFS cross solver
  const TARGET = { D: [1, 3, 5, 7], faces: ['F', 'L', 'R', 'B'] };
  const WHITE = '#ffffff';
  const SIDE_COLORS = { F: '#00c853', R: '#ff6d00', B: '#2979ff', L: '#f44336' };

  function isCrossSolved(s) {
    if (s.D[1] !== WHITE || s.D[3] !== WHITE || s.D[5] !== WHITE || s.D[7] !== WHITE) return false;
    if (s.F[7] !== SIDE_COLORS.F) return false;
    if (s.R[7] !== SIDE_COLORS.R) return false;
    if (s.B[7] !== SIDE_COLORS.B) return false;
    if (s.L[7] !== SIDE_COLORS.L) return false;
    return true;
  }

  if (isCrossSolved(state)) return '(Already solved)';

  // BFS with move sequence
  const movesToTry = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
  const queue = [{ state: cloneState(state), moves: [] }];
  const seen = new Set();
  seen.add(stateKey(state));

  while (queue.length > 0) {
    const { state: cur, moves } = queue.shift();
    if (moves.length > 8) continue; // limit search depth

    for (const mv of movesToTry) {
      const next = applyMove(cur, mv);
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const newMoves = [...moves, mv];
      if (isCrossSolved(next)) return newMoves.join(' ');
      queue.push({ state: next, moves: newMoves });
    }
  }
  return null;
}

function stateKey(s) {
  // Only key on cross-relevant stickers for efficiency
  return [s.D[1], s.D[3], s.D[5], s.D[7], s.F[7], s.R[7], s.B[7], s.L[7]].join(',');
}

// ── OLL DETECTION ──
// Returns the OLL alg for the current state, or null
function detectAndSolveOLL(state) {
  const YELLOW = '#ffd700';

  // Try each OLL case: apply its setup to solved state, see if top face matches
  // Better: try all OLL algs on current state, see which one results in all-yellow top
  for (const oll of OLL_DB) {
    // Try alg on current state
    const result = applyMoves(state, oll.alg);
    if (isTopFaceAllYellow(result)) {
      return { name: oll.name, alg: oll.alg };
    }
    // Try with U rotations (case may need rotation)
    for (const pre of ["U", "U'", "U2"]) {
      const rotated = applyMove(state, pre);
      const result2 = applyMoves(rotated, oll.alg);
      if (isTopFaceAllYellow(result2)) {
        return { name: oll.name, alg: pre + ' ' + oll.alg };
      }
    }
  }

  // Check if already solved
  if (isTopFaceAllYellow(state)) return { name: 'Already OLL solved', alg: '' };

  // Try 2-look approach: cross first, then corners
  const crossAlgs = [
    'F R U R\' U\' F\'',
    'f R U R\' U\' f\'',
  ];
  const cornerAlgs = [
    'R U R\' U R U2 R\'',
    'R U2 R\' U\' R U\' R\'',
    'F R U R\' U\' R U R\' U\' R U R\' U\' F\'',
  ];

  for (const ca of crossAlgs) {
    const after = applyMoves(state, ca);
    for (const co of cornerAlgs) {
      const final = applyMoves(after, co);
      if (isTopFaceAllYellow(final)) return { name: '2-Look OLL', alg: ca + ' ' + co };
      for (const u of ["U", "U'", "U2"]) {
        const final2 = applyMoves(applyMove(after, u), co);
        if (isTopFaceAllYellow(final2)) return { name: '2-Look OLL', alg: ca + ' ' + u + ' ' + co };
      }
    }
  }

  return null;
}

function isTopFaceAllYellow(s) {
  return s.U.every(c => c === '#ffd700');
}

// ── PLL DETECTION ──
function detectAndSolvePLL(state) {
  for (const pll of PLL_DB) {
    const result = applyMoves(state, pll.alg);
    if (isLastLayerSolved(result)) {
      return { name: pll.name, alg: pll.alg };
    }
    for (const pre of ["U", "U'", "U2"]) {
      const rotated = applyMove(state, pre);
      const result2 = applyMoves(rotated, pll.alg);
      if (isLastLayerSolved(result2)) {
        return { name: pll.name, alg: pre + ' ' + pll.alg };
      }
      // Also try AUF after
      for (const post of ["U", "U'", "U2"]) {
        const result3 = applyMove(result2, post);
        if (isLastLayerSolved(result3)) {
          return { name: pll.name, alg: pre + ' ' + pll.alg + ' ' + post };
        }
      }
    }
  }
  if (isLastLayerSolved(state)) return { name: 'Already PLL solved', alg: '' };
  return null;
}

function isLastLayerSolved(s) {
  if (!isTopFaceAllYellow(s)) return false;
  // Check each side of top layer has uniform color
  const sides = [
    [s.F[0], s.F[1], s.F[2]],
    [s.R[0], s.R[1], s.R[2]],
    [s.B[0], s.B[1], s.B[2]],
    [s.L[0], s.L[1], s.L[2]],
  ];
  for (const side of sides) {
    if (side[0] !== side[1] || side[1] !== side[2]) return false;
  }
  return true;
}

// ── F2L DETECTION ──
// Simple: search common F2L cases by trying algs
function detectAndSolveF2L(state) {
  const F2L_ALGS = [
    // Basic insertions — the most common cases
    { name: 'Basic insert (right)', alg: 'U R U\' R\'' },
    { name: 'Basic insert (left)', alg: 'U\' L\' U L' },
    { name: 'White up, pair right', alg: 'R U\' R\' U R U\' R\'' },
    { name: 'White up, pair left', alg: 'L\' U L U\' L\' U L' },
    { name: 'Corner right slot', alg: 'R U R\' U\' R U R\' U\' R U R\'' },
    { name: 'F2L case 1', alg: 'U R U\' R\' U\' F\' U F' },
    { name: 'F2L case 2', alg: 'U\' F\' U F U R U\' R\'' },
    { name: 'F2L case 3', alg: 'R U\' R\' U2 F\' U\' F' },
    { name: 'F2L case 4', alg: 'F\' U\' F U2 R U R\'' },
    { name: 'F2L case 5', alg: 'R U R\' U\' R U R\'' },
    { name: 'F2L case 6', alg: 'R U2 R\' U\' R U R\'' },
    { name: 'F2L case 7', alg: 'U R U2 R\' U R U\' R\'' },
    { name: 'F2L case 8', alg: 'U\' R U R\' U R U\' R\'' },
    { name: 'F2L case 9', alg: 'R U\' R\' U R U R\'' },
    { name: 'F2L case 10', alg: 'R U\' R\' U2 F\' U F' },
    { name: 'FR pair — white right', alg: 'U R U\' R\' U\' R U R\'' },
  ];

  for (const f2l of F2L_ALGS) {
    for (const pre of ['', 'U', "U'", 'U2']) {
      const s = pre ? applyMove(state, pre) : cloneState(state);
      const result = applyMoves(s, f2l.alg);
      if (isF2LImproved(state, result)) {
        return { name: f2l.name, alg: (pre ? pre + ' ' : '') + f2l.alg };
      }
    }
  }
  return null;
}

function isF2LImproved(original, after) {
  // Check if more F2L slots are filled in 'after' than in 'original'
  return countF2LSlots(after) > countF2LSlots(original);
}

function countF2LSlots(s) {
  let count = 0;
  // FR slot: R[7]=orange, F[5]=green, D[5]=white (corner+edge pair)
  const slots = [
    { c1: ['F', 5, '#00c853'], c2: ['R', 7, '#ff6d00'] },  // FR
    { c1: ['R', 5, '#ff6d00'], c2: ['B', 7, '#2979ff'] },  // RB
    { c1: ['B', 5, '#2979ff'], c2: ['L', 7, '#f44336'] },  // BL
    { c1: ['L', 5, '#f44336'], c2: ['F', 7, '#00c853'] },  // LF
  ];
  for (const slot of slots) {
    if (s[slot.c1[0]][slot.c1[1]] === slot.c1[2] && s[slot.c2[0]][slot.c2[1]] === slot.c2[2]) count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════
//  SOLUTION BUTTON — derives from current state
// ═══════════════════════════════════════════════════════
function handleSolutionBtn() {
  if (isAnimating) { showToast('Wait for animation to finish'); return; }
  if (!cubeState) { showToast('No cube state'); return; }

  let result = null;

  if (pStage === 'cross') {
    const sol = solveCross(cubeState);
    if (sol) result = { name: 'Cross Solution', alg: sol };
    else showToast('Could not find solution (try fewer moves)');
  } else if (pStage === 'f2l') {
    result = detectAndSolveF2L(cubeState);
    if (!result) showToast('F2L looks complete or case not recognized');
  } else if (pStage === 'oll') {
    result = detectAndSolveOLL(cubeState);
    if (!result) showToast('OLL case not recognized — try adjusting U layer');
  } else if (pStage === 'pll') {
    result = detectAndSolvePLL(cubeState);
    if (!result) showToast('PLL case not recognized — try adjusting U layer');
  }

  if (result && result.alg) {
    showSolutionMoves(result.alg, result.name);
    // Animate the solution, updating cubeState along the way
    animateMoves(result.alg, () => {
      buildMesh(); renderNet();
      showToast('Solved! (' + result.name + ')');
    });
  } else if (result && !result.alg) {
    showToast(result.name);
  }
}

function showSolutionMoves(movesStr, name) {
  const panel = document.getElementById('solution-panel');
  const disp = document.getElementById('sol-moves-display');
  if (!panel || !disp) return;
  panel.classList.add('show');
  const nameEl = panel.querySelector('.sol-label');
  if (nameEl) nameEl.textContent = name || 'Solution';
  disp.innerHTML = movesStr.trim().split(/\s+/).map((m, i) => `<span class="sol-move-item" id="smove-${i}">${m}</span>`).join(' ');
}

// ═══════════════════════════════════════════════════════
//  ANIMATION — updates cubeState on every move
// ═══════════════════════════════════════════════════════
function animateMoves(movesStr, onDone) {
  if (isAnimating) { if (onDone) onDone(); return; }
  isAnimating = true;
  const moves = movesStr.trim().split(/\s+/).filter(m => m);
  // Update cubeState IMMEDIATELY to final state — but animate visually
  // This ensures logical state always matches
  let idx = 0;

  function doNext() {
    if (!isAnimating) { if (onDone) onDone(); return; }
    if (idx >= moves.length) {
      isAnimating = false;
      const ov = document.getElementById('move-overlay'); if (ov) ov.classList.remove('show');
      document.querySelectorAll('.sol-move-item').forEach(el => el.classList.add('done'));
      if (onDone) onDone();
      return;
    }
    const move = moves[idx];
    document.querySelectorAll('.sol-move-item').forEach((el, i) => {
      el.classList.remove('current'); el.classList.toggle('done', i < idx);
      if (i === idx) el.classList.add('current');
    });
    const ov = document.getElementById('move-overlay');
    if (ov) { ov.textContent = move; ov.classList.add('show'); }

    // Update cube state BEFORE animating so state is always accurate
    cubeState = applyMove(cubeState, move);

    animateSingleMove(move, () => {
      // Rebuild mesh from updated state after each move
      buildMesh();
      idx++;
      setTimeout(doNext, 30);
    });
  }
  doNext();
}

function animateSingleMove(move, onDone) {
  const base = move.replace(/['\d]/g, '');
  const prime = move.includes("'"), double = move.includes("2");
  const times = double ? 2 : 1;
  let t = 0;

  function doOnce(cb) {
    if (!isAnimating) { cb(); return; }
    const localAxis = getMoveAxis(base);
    const layerVal = getMoveLayerVal(base);
    const cwAngle = prime ? Math.PI / 2 : -Math.PI / 2;

    const moving = [];
    for (const c of cubeGroup.children) {
      const dot = c.position.dot(localAxis);
      if (Math.abs(Math.round(dot) - layerVal) < 0.15) moving.push(c);
    }
    if (!moving.length) { cb(); return; }

    const saved = moving.map(m => ({ mesh: m, pos: m.position.clone(), quat: m.quaternion.clone() }));
    const rotQ = new THREE.Quaternion().setFromAxisAngle(localAxis, cwAngle);
    const duration = animSpeed, start = Date.now();

    function step() {
      if (!isAnimating) { saved.forEach(({ mesh, pos, quat }) => { mesh.position.copy(pos); mesh.quaternion.copy(quat); }); cb(); return; }
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : (1 - Math.pow(-2 * progress + 2, 2) / 2);
      const interpQ = new THREE.Quaternion().slerp(rotQ, eased);
      saved.forEach(({ mesh, pos, quat }) => {
        mesh.position.copy(pos.clone().applyQuaternion(interpQ));
        mesh.quaternion.copy(interpQ.clone().multiply(quat));
      });
      if (progress < 1) {
        animFrameId = requestAnimationFrame(step);
      } else {
        saved.forEach(({ mesh, pos, quat }) => {
          const finalPos = pos.clone().applyQuaternion(rotQ);
          mesh.position.set(Math.round(finalPos.x), Math.round(finalPos.y), Math.round(finalPos.z));
          mesh.quaternion.copy(rotQ.clone().multiply(quat));
        });
        cb();
      }
    }
    animFrameId = requestAnimationFrame(step);
  }

  function run() { if (t >= times) { onDone(); return; } t++; doOnce(run); }
  run();
}

function getMoveAxis(base) {
  if (base === 'R' || base === 'L' || base === 'M') return new THREE.Vector3(1, 0, 0);
  if (base === 'U' || base === 'D') return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}
function getMoveLayerVal(base) {
  if (base === 'R') return 1; if (base === 'L' || base === 'M') return -1;
  if (base === 'U') return 1; if (base === 'D') return -1;
  if (base === 'F') return 1; if (base === 'B') return -1;
  return 0;
}

// ═══════════════════════════════════════════════════════
//  CASE GENERATORS FOR PRACTICE
// ═══════════════════════════════════════════════════════
function genCrossScramble() {
  const m = ['F2', 'B2', 'R2', 'L2', 'U', "U'", "U2", 'D', "D'", "D2", 'F', "F'", 'B', "B'"];
  let s = [], l = '';
  for (let i = 0; i < 10; i++) { let v; do { v = m[Math.floor(Math.random() * m.length)]; } while (v[0] === l[0]); s.push(v); l = v; }
  return s.join(' ');
}
function genF2LScramble() {
  const m = ['R', "R'", 'R2', 'L', "L'", 'L2', 'U', "U'", 'U2', 'F', "F'", 'B', "B'"];
  let s = [], l = '';
  for (let i = 0; i < 12; i++) { let v; do { v = m[Math.floor(Math.random() * m.length)]; } while (v[0] === l[0]); s.push(v); l = v; }
  return s.join(' ');
}
function genOLLScramble() {
  const oll = OLL_DB[Math.floor(Math.random() * OLL_DB.length)];
  return invertMoves(oll.alg);
}
function genPLLScramble() {
  const pll = PLL_DB[Math.floor(Math.random() * PLL_DB.length)];
  return invertMoves(pll.alg);
}

// ═══════════════════════════════════════════════════════
//  setPStage
// ═══════════════════════════════════════════════════════
function setPStage(stage) {
  pStage = stage;
  document.querySelectorAll('.ptab').forEach((t, i) => t.classList.toggle('active', ['cross', 'f2l', 'oll', 'pll'][i] === stage));
  const st = document.getElementById('stage-title'); if (st) st.textContent = STAGE_INFO[stage].title;
  const sd = document.getElementById('stage-desc'); if (sd) sd.textContent = STAGE_INFO[stage].desc;
  resetPCube();
  if (pSceneInit) setupPalette();
}

// ═══════════════════════════════════════════════════════
//  SPEED
// ═══════════════════════════════════════════════════════
function setSpeed(speed) {
  if (speed === 'slow') animSpeed = 900;
  else if (speed === 'normal') animSpeed = 600;
  else if (speed === 'fast') animSpeed = 300;
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active-speed', b.dataset.speed === speed));
  showToast(speed.charAt(0).toUpperCase() + speed.slice(1));
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function saveS(k, v) { settings[k] = v; localStorage.setItem('cubeai_settings', JSON.stringify(settings)); }
function toggleS(k) {
  settings[k] = !settings[k];
  const el = document.getElementById('tog-' + k); if (el) el.classList.toggle('on', settings[k]);
  localStorage.setItem('cubeai_settings', JSON.stringify(settings));
}
function loadSettings() {
  const ti = document.getElementById('tog-inspection');
  const ta = document.getElementById('tog-autoscramble');
  const sh = document.getElementById('sel-hold');
  const ss = document.getElementById('sel-slen');
  if (ti) ti.classList.toggle('on', settings.inspection);
  if (ta) ta.classList.toggle('on', settings.autoscramble);
  if (sh) sh.value = settings.holdDuration;
  if (ss) ss.value = settings.scrambleLength;
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
let toastT;
function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
initTimerCubeState();
genScramble();
updateStats();
loadSettings();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
