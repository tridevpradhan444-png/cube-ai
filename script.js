// ═══════════════════════════════════════════════════════
//  CUBING.JS — industry-standard cube solver via CDN
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  CONSTANTS & DATA
// ═══════════════════════════════════════════════════════
const FACE_COLORS = {U:'#ffd700',D:'#ffffff',F:'#00c853',B:'#2979ff',R:'#ff6d00',L:'#f44336'};
const C = { Y:'#ffd700', W:'#ffffff', G:'#00c853', B:'#2979ff', O:'#ff6d00', R:'#f44336', GRAY:'#2a2a2a', DARK:'#111111' };

// Piece definitions per stage
// Each piece has: id, type (edge/corner), colors (array of face colors), label
const STAGE_PIECES = {
  cross: {
    edges: [
      { id:'e-WG', type:'edge', colors:[C.W, C.G], label:'W-G' },
      { id:'e-WR', type:'edge', colors:[C.W, C.R], label:'W-R' },
      { id:'e-WB', type:'edge', colors:[C.W, C.B], label:'W-B' },
      { id:'e-WO', type:'edge', colors:[C.W, C.O], label:'W-O' },
    ],
    corners: []
  },
  f2l: {
    corners: [
      { id:'c-WGR', type:'corner', colors:[C.W, C.G, C.R], label:'W-G-R' },
      { id:'c-WRB', type:'corner', colors:[C.W, C.R, C.B], label:'W-R-B' },
      { id:'c-WBO', type:'corner', colors:[C.W, C.B, C.O], label:'W-B-O' },
      { id:'c-WOG', type:'corner', colors:[C.W, C.O, C.G], label:'W-O-G' },
    ],
    edges: [
      { id:'e-GR', type:'edge', colors:[C.G, C.R], label:'G-R' },
      { id:'e-RB', type:'edge', colors:[C.R, C.B], label:'R-B' },
      { id:'e-BO', type:'edge', colors:[C.B, C.O], label:'B-O' },
      { id:'e-OG', type:'edge', colors:[C.O, C.G], label:'O-G' },
    ]
  },
  oll: {
    corners: [
      { id:'c-YGR', type:'corner', colors:[C.Y, C.G, C.R], label:'Y-G-R' },
      { id:'c-YRB', type:'corner', colors:[C.Y, C.R, C.B], label:'Y-R-B' },
      { id:'c-YBO', type:'corner', colors:[C.Y, C.B, C.O], label:'Y-B-O' },
      { id:'c-YOG', type:'corner', colors:[C.Y, C.O, C.G], label:'Y-O-G' },
    ],
    edges: [
      { id:'e-YG', type:'edge', colors:[C.Y, C.G], label:'Y-G' },
      { id:'e-YR', type:'edge', colors:[C.Y, C.R], label:'Y-R' },
      { id:'e-YB', type:'edge', colors:[C.Y, C.B], label:'Y-B' },
      { id:'e-YO', type:'edge', colors:[C.Y, C.O], label:'Y-O' },
    ]
  },
  pll: {
    corners: [
      { id:'c-YGR', type:'corner', colors:[C.Y, C.G, C.R], label:'Y-G-R' },
      { id:'c-YRB', type:'corner', colors:[C.Y, C.R, C.B], label:'Y-R-B' },
      { id:'c-YBO', type:'corner', colors:[C.Y, C.B, C.O], label:'Y-B-O' },
      { id:'c-YOG', type:'corner', colors:[C.Y, C.O, C.G], label:'Y-O-G' },
    ],
    edges: [
      { id:'e-YG', type:'edge', colors:[C.Y, C.G], label:'Y-G' },
      { id:'e-YR', type:'edge', colors:[C.Y, C.R], label:'Y-R' },
      { id:'e-YB', type:'edge', colors:[C.Y, C.B], label:'Y-B' },
      { id:'e-YO', type:'edge', colors:[C.Y, C.O], label:'Y-O' },
    ]
  }
};

// Slot definitions — which cube positions each stage uses
// Each slot: position {x,y,z}, type, slotId, defaultPieceId
// Orientations: for edges [orientation 0,1], for corners [0,1,2]
const SLOT_DEFS = {
  cross: [
    // Bottom layer edges (y=-1) — white cross
    { slotId:'s-WG', type:'edge', pos:{x:0,y:-1,z:1},  defaultPieceId:'e-WG' }, // F edge
    { slotId:'s-WR', type:'edge', pos:{x:1,y:-1,z:0},  defaultPieceId:'e-WR' }, // R edge
    { slotId:'s-WB', type:'edge', pos:{x:0,y:-1,z:-1}, defaultPieceId:'e-WB' }, // B edge
    { slotId:'s-WO', type:'edge', pos:{x:-1,y:-1,z:0}, defaultPieceId:'e-WO' }, // L edge
  ],
  f2l: [
    // Bottom layer edges (cross locked in, shown as is)
    { slotId:'s-GR', type:'edge',  pos:{x:1,y:0,z:1},   defaultPieceId:'e-GR' },
    { slotId:'s-RB', type:'edge',  pos:{x:1,y:0,z:-1},  defaultPieceId:'e-RB' },
    { slotId:'s-BO', type:'edge',  pos:{x:-1,y:0,z:-1}, defaultPieceId:'e-BO' },
    { slotId:'s-OG', type:'edge',  pos:{x:-1,y:0,z:1},  defaultPieceId:'e-OG' },
    { slotId:'s-WGR', type:'corner', pos:{x:1,y:-1,z:1},   defaultPieceId:'c-WGR' },
    { slotId:'s-WRB', type:'corner', pos:{x:1,y:-1,z:-1},  defaultPieceId:'c-WRB' },
    { slotId:'s-WBO', type:'corner', pos:{x:-1,y:-1,z:-1}, defaultPieceId:'c-WBO' },
    { slotId:'s-WOG', type:'corner', pos:{x:-1,y:-1,z:1},  defaultPieceId:'c-WOG' },
  ],
  oll: [
    { slotId:'s-YG', type:'edge',  pos:{x:0,y:1,z:1},   defaultPieceId:'e-YG' },
    { slotId:'s-YR', type:'edge',  pos:{x:1,y:1,z:0},   defaultPieceId:'e-YR' },
    { slotId:'s-YB', type:'edge',  pos:{x:0,y:1,z:-1},  defaultPieceId:'e-YB' },
    { slotId:'s-YO', type:'edge',  pos:{x:-1,y:1,z:0},  defaultPieceId:'e-YO' },
    { slotId:'s-YGR', type:'corner', pos:{x:1,y:1,z:1},   defaultPieceId:'c-YGR' },
    { slotId:'s-YRB', type:'corner', pos:{x:1,y:1,z:-1},  defaultPieceId:'c-YRB' },
    { slotId:'s-YBO', type:'corner', pos:{x:-1,y:1,z:-1}, defaultPieceId:'c-YBO' },
    { slotId:'s-YOG', type:'corner', pos:{x:-1,y:1,z:1},  defaultPieceId:'c-YOG' },
  ],
  pll: [
    { slotId:'s-YG', type:'edge',  pos:{x:0,y:1,z:1},   defaultPieceId:'e-YG' },
    { slotId:'s-YR', type:'edge',  pos:{x:1,y:1,z:0},   defaultPieceId:'e-YR' },
    { slotId:'s-YB', type:'edge',  pos:{x:0,y:1,z:-1},  defaultPieceId:'e-YB' },
    { slotId:'s-YO', type:'edge',  pos:{x:-1,y:1,z:0},  defaultPieceId:'e-YO' },
    { slotId:'s-YGR', type:'corner', pos:{x:1,y:1,z:1},   defaultPieceId:'c-YGR' },
    { slotId:'s-YRB', type:'corner', pos:{x:1,y:1,z:-1},  defaultPieceId:'c-YRB' },
    { slotId:'s-YBO', type:'corner', pos:{x:-1,y:1,z:-1}, defaultPieceId:'c-YBO' },
    { slotId:'s-YOG', type:'corner', pos:{x:-1,y:1,z:1},  defaultPieceId:'c-YOG' },
  ]
};

const STAGE_INFO = {
  cross:{ title:'CROSS', desc:'Build the white cross. Select a piece, tap its slot on the cube.' },
  f2l:  { title:'F2L — FIRST TWO LAYERS', desc:'Select a piece from the palette, tap its slot.' },
  oll:  { title:'OLL — ORIENT LAST LAYER', desc:'Place all top-layer pieces. Tap placed piece to change orientation.' },
  pll:  { title:'PLL — PERMUTE LAST LAYER', desc:'Place all top-layer pieces. Orientation is locked.' }
};

// ═══════════════════════════════════════════════════════
//  SETTINGS & SOLVES
// ═══════════════════════════════════════════════════════
let solves = JSON.parse(localStorage.getItem('cubeai_solves')||'[]');
let settings = Object.assign({inspection:false,autoscramble:true,holdDuration:500,scrambleLength:20},
  JSON.parse(localStorage.getItem('cubeai_settings')||'{}'));

// ═══════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════
function showScreen(name){
  try{
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-'+name).classList.add('active');
    const navNames = ['timer','history','virtual-cube','practice','learn','settings','privacy'];
    document.querySelectorAll('.nav-item').forEach((item,i)=>{
      item.classList.toggle('active', navNames[i]===name);
    });
    if(name==='history') renderHistory();
    if(name==='practice'){
      setTimeout(()=>initPScene(), 200);
    }
    if(name==='virtual-cube') setTimeout(()=>initVirtualCube(), 100);
  }catch(e){console.error('showScreen:',e);}
}
function toggleDrawer(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('hamburger').classList.toggle('open'); }
function closeDrawer(){ document.getElementById('drawer').classList.remove('open'); document.getElementById('hamburger').classList.remove('open'); }

// ═══════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════
let timerRunning=false,timerStart=0,timerVal=0,timerInterval=null;
let holdTimeout=null,isHolding=false,isArmed=false;
let inspRunning=false,inspTime=15,inspInterval=null,inspEnded=false;

function fmt(ms){
  if(ms<60000) return (ms/1000).toFixed(3);
  const m=Math.floor(ms/60000),s=((ms%60000)/1000).toFixed(3);
  return m+':'+(s<10?'0':'')+s;
}
function setTimerText(v){ document.getElementById('timer-text').textContent=fmt(v); }

function startTimer(){
  timerRunning=true; timerStart=Date.now();
  timerInterval=setInterval(()=>{timerVal=Date.now()-timerStart;setTimerText(timerVal);},10);
  document.getElementById('timer-display').className='running';
  document.getElementById('timer-hint').classList.add('hidden');
  document.getElementById('bin-btn').classList.remove('visible');
  const id=document.getElementById('inspection-display');
  id.style.display='none'; id.textContent='';
}
function stopTimer(){
  if(!timerRunning) return;
  timerRunning=false; clearInterval(timerInterval);
  timerVal=Date.now()-timerStart; setTimerText(timerVal);
  saveSolve(timerVal);
  document.getElementById('timer-display').className='';
  document.getElementById('timer-hint').classList.remove('hidden');
  document.getElementById('bin-btn').classList.add('visible');
  if(settings.autoscramble) genScramble();
}
function saveSolve(ms){
  solves.push({time:ms,date:new Date().toISOString(),scramble:document.getElementById('scramble-text').textContent});
  localStorage.setItem('cubeai_solves',JSON.stringify(solves));
  updateStats(); showToast(fmt(ms));
}
function deleteLastSolve(){
  if(!solves.length) return;
  solves.pop();
  localStorage.setItem('cubeai_solves',JSON.stringify(solves));
  updateStats();
  document.getElementById('bin-btn').classList.remove('visible');
  timerVal=0; setTimerText(0);
  showToast('Deleted');
}
function clearAllSolves(){
  if(!solves.length) return;
  solves=[]; localStorage.setItem('cubeai_solves',JSON.stringify(solves));
  updateStats(); renderHistory();
  document.getElementById('bin-btn').classList.remove('visible');
  timerVal=0; setTimerText(0);
  showToast('Cleared');
}
function calcAo(n){
  if(solves.length<n) return null;
  const t=[...solves.slice(-n).map(s=>s.time)].sort((a,b)=>a-b).slice(1,-1);
  return t.reduce((a,b)=>a+b,0)/t.length;
}
function updateStats(){
  const t=solves.map(s=>s.time);
  if(!t.length){['best','worst','mean','ao5','ao12'].forEach(id=>document.getElementById('stat-'+id).textContent='—');return;}
  document.getElementById('stat-best').textContent=fmt(Math.min(...t));
  document.getElementById('stat-worst').textContent=fmt(Math.max(...t));
  document.getElementById('stat-mean').textContent=fmt(t.reduce((a,b)=>a+b,0)/t.length);
  const a5=calcAo(5),a12=calcAo(12);
  document.getElementById('stat-ao5').textContent=a5?fmt(a5):'—';
  document.getElementById('stat-ao12').textContent=a12?fmt(a12):'—';
}

// INSPECTION
function startInspection(){
  inspRunning=true; inspEnded=false; inspTime=15;
  const d=document.getElementById('inspection-display');
  d.style.display='block'; d.textContent='15'; d.style.color='';
  inspInterval=setInterval(()=>{
    inspTime--;
    if(inspTime>0){ d.textContent=inspTime; }
    else{ clearInterval(inspInterval); inspRunning=false; inspEnded=true; flashInspectionEnd(); }
  },1000);
}
function flashInspectionEnd(){
  const disp=document.getElementById('timer-display');
  playBeep(); let count=0;
  const flash=setInterval(()=>{
    disp.style.color=count%2===0?'#ff4444':'#ffffff'; count++;
    if(count>=6){ clearInterval(flash); disp.style.color=''; startTimer(); }
  },180);
}
function playBeep(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,200,400].forEach(delay=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value=880;
      gain.gain.setValueAtTime(0.3,ctx.currentTime+delay/1000);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay/1000+0.15);
      osc.start(ctx.currentTime+delay/1000); osc.stop(ctx.currentTime+delay/1000+0.15);
    });
  }catch(e){}
}

// HOLD LOGIC
const TS=document.getElementById('screen-timer');
function onHoldStart(e){
  if(e.target.closest('#stats-bar')||e.target.closest('#bin-btn')) return;
  if(timerRunning){stopTimer();return;}
  isHolding=true;
  document.getElementById('timer-display').classList.add('holding');
  holdTimeout=setTimeout(()=>{
    if(isHolding){isArmed=true;document.getElementById('timer-display').classList.remove('holding');document.getElementById('timer-display').classList.add('ready');}
  },settings.holdDuration);
}
function onHoldEnd(e){
  if(timerRunning) return;
  clearTimeout(holdTimeout); isHolding=false;
  if(isArmed){
    isArmed=false; document.getElementById('timer-display').classList.remove('ready');
    if(inspRunning){ clearInterval(inspInterval); inspRunning=false; startTimer(); }
    else if(settings.inspection&&!inspEnded){ startInspection(); }
    else{ startTimer(); }
    inspEnded=false;
  } else { document.getElementById('timer-display').classList.remove('holding'); }
}
TS.addEventListener('touchstart',onHoldStart,{passive:true});
TS.addEventListener('touchend',onHoldEnd);
TS.addEventListener('mousedown',onHoldStart);
TS.addEventListener('mouseup',onHoldEnd);
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if(e.code==='Space'&&document.getElementById('screen-timer').classList.contains('active')){
    e.preventDefault();
    if(timerRunning){stopTimer();return;}
    if(!isHolding)onHoldStart(e);
  }
});
document.addEventListener('keyup',e=>{ if(e.target.tagName==='INPUT') return; if(e.code==='Space')onHoldEnd(e); });

// ═══════════════════════════════════════════════════════
//  SCRAMBLE
// ═══════════════════════════════════════════════════════
const MOVES=['R','L','U','D','F','B'],MODS=["","'","2"];
const OPP_MOVES={R:'L',L:'R',U:'D',D:'U',F:'B',B:'F'};

function genScrambleStr(len){
  len=len||parseInt(settings.scrambleLength)||20;
  let s=[],last='',sec='';
  for(let i=0;i<len;i++){
    let f; do{f=MOVES[Math.floor(Math.random()*6)];}while(f===last||(f===sec&&OPP_MOVES[f]===last));
    s.push(f+MODS[Math.floor(Math.random()*3)]); sec=last; last=f;
  }
  return s.join(' ');
}
function genScramble(){
  const s=genScrambleStr();
  document.getElementById('scramble-text').textContent=s;
  return s;
}
function genCrossScramble(){ const m=['F2','B2','R2','L2','U',"U'","U2",'D',"D'","D2"]; let s=[],l=''; for(let i=0;i<10;i++){let v;do{v=m[Math.floor(Math.random()*m.length)];}while(v[0]===l[0]);s.push(v);l=v;} return s.join(' '); }
function genF2LScramble(){ const m=['R',"R'","R2",'L',"L'","L2",'U',"U'","U2",'F',"F'","B","B'"]; let s=[],l=''; for(let i=0;i<12;i++){let v;do{v=m[Math.floor(Math.random()*m.length)];}while(v[0]===l[0]);s.push(v);l=v;} return s.join(' '); }
const OLL_CASES=["R U R' U' R' F R F'","F R U R' U' F'","f R U R' U' f'","R U R' U R U2 R'","R U2 R' U' R U' R'","r U R' U R U2 r'","r U2 R' U' R U' r'"];
const PLL_CASES=["R U R' U' R' F R2 U' R' U' R U R' F'","R U R' F' R U R' U' R' F R2 U' R'","M2 U M2 U2 M2 U M2","R' F R' B2 R F' R' B2 R2"];
function genOLLScramble(){ return invertMoves(OLL_CASES[Math.floor(Math.random()*OLL_CASES.length)]); }
function genPLLScramble(){ return invertMoves(PLL_CASES[Math.floor(Math.random()*PLL_CASES.length)]); }
function invertMoves(movesStr){
  if(!movesStr||!movesStr.trim()) return '';
  return movesStr.trim().split(/\s+/).reverse().map(m=>{
    if(m.includes("'")) return m.replace("'","");
    if(m.includes("2")) return m;
    return m+"'";
  }).join(' ');
}

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory(){
  const list=document.getElementById('history-list');
  if(!list) return;
  if(!solves.length){list.innerHTML='<div class="history-empty"><div style="font-size:48px;opacity:0.3;">⏱</div><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;">No solves yet</div></div>';return;}
  list.innerHTML=[...solves].reverse().map((s,i)=>{
    const n=solves.length-i,d=new Date(s.date);
    const ds=d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    return `<div class="solve-item"><div class="solve-num">#${n}</div><div class="solve-time">${fmt(s.time)}</div><div class="solve-date">${ds}</div><div class="solve-del" onclick="delSolve(${solves.length-1-i})">×</div></div>`;
  }).join('');
}
function delSolve(i){solves.splice(i,1);localStorage.setItem('cubeai_solves',JSON.stringify(solves));updateStats();renderHistory();}

// ═══════════════════════════════════════════════════════
//  CUBE STATE ENGINE
// ═══════════════════════════════════════════════════════
let cubeState=null;
function initCubeState(){
  cubeState={};
  for(const [f,c] of Object.entries(FACE_COLORS)) cubeState[f]=Array(9).fill(c);
}
function cloneState(s){const c={};for(const f of Object.keys(s))c[f]=[...s[f]];return c;}

const FACE_MAP_STATIC=[
  {face:'R',axis:'x',val:1},{face:'L',axis:'x',val:-1},
  {face:'U',axis:'y',val:1},{face:'D',axis:'y',val:-1},
  {face:'F',axis:'z',val:1},{face:'B',axis:'z',val:-1}
];

function rotateFaceCW(s,f){
  const o=[...s[f]];
  s[f][0]=o[6];s[f][1]=o[3];s[f][2]=o[0];
  s[f][3]=o[7];s[f][4]=o[4];s[f][5]=o[1];
  s[f][6]=o[8];s[f][7]=o[5];s[f][8]=o[2];
}
function applyMoveCW(s,base){
  if(base==='U'){rotateFaceCW(s,'U');const t=[s.F[0],s.F[1],s.F[2]];s.F[0]=s.R[0];s.F[1]=s.R[1];s.F[2]=s.R[2];s.R[0]=s.B[0];s.R[1]=s.B[1];s.R[2]=s.B[2];s.B[0]=s.L[0];s.B[1]=s.L[1];s.B[2]=s.L[2];s.L[0]=t[0];s.L[1]=t[1];s.L[2]=t[2];}
  else if(base==='D'){rotateFaceCW(s,'D');const t=[s.F[6],s.F[7],s.F[8]];s.F[6]=s.L[6];s.F[7]=s.L[7];s.F[8]=s.L[8];s.L[6]=s.B[6];s.L[7]=s.B[7];s.L[8]=s.B[8];s.B[6]=s.R[6];s.B[7]=s.R[7];s.B[8]=s.R[8];s.R[6]=t[0];s.R[7]=t[1];s.R[8]=t[2];}
  else if(base==='R'){rotateFaceCW(s,'R');const t=[s.U[2],s.U[5],s.U[8]];s.U[2]=s.F[2];s.U[5]=s.F[5];s.U[8]=s.F[8];s.F[2]=s.D[2];s.F[5]=s.D[5];s.F[8]=s.D[8];s.D[2]=s.B[6];s.D[5]=s.B[3];s.D[8]=s.B[0];s.B[6]=t[0];s.B[3]=t[1];s.B[0]=t[2];}
  else if(base==='L'){rotateFaceCW(s,'L');const t=[s.U[0],s.U[3],s.U[6]];s.U[0]=s.B[8];s.U[3]=s.B[5];s.U[6]=s.B[2];s.B[8]=s.D[0];s.B[5]=s.D[3];s.B[2]=s.D[6];s.D[0]=s.F[0];s.D[3]=s.F[3];s.D[6]=s.F[6];s.F[0]=t[0];s.F[3]=t[1];s.F[6]=t[2];}
  else if(base==='F'){rotateFaceCW(s,'F');const t=[s.U[6],s.U[7],s.U[8]];s.U[6]=s.L[8];s.U[7]=s.L[5];s.U[8]=s.L[2];s.L[2]=s.D[0];s.L[5]=s.D[1];s.L[8]=s.D[2];s.D[0]=s.R[6];s.D[1]=s.R[3];s.D[2]=s.R[0];s.R[0]=t[2];s.R[3]=t[1];s.R[6]=t[0];}
  else if(base==='B'){rotateFaceCW(s,'B');const t=[s.U[0],s.U[1],s.U[2]];s.U[0]=s.R[2];s.U[1]=s.R[5];s.U[2]=s.R[8];s.R[2]=s.D[8];s.R[5]=s.D[7];s.R[8]=s.D[6];s.D[6]=s.L[0];s.D[7]=s.L[3];s.D[8]=s.L[6];s.L[0]=t[2];s.L[3]=t[1];s.L[6]=t[0];}
  else if(base==='M'){const t=[s.U[1],s.U[4],s.U[7]];s.U[1]=s.B[7];s.U[4]=s.B[4];s.U[7]=s.B[1];s.B[7]=s.D[1];s.B[4]=s.D[4];s.B[1]=s.D[7];s.D[1]=s.F[1];s.D[4]=s.F[4];s.D[7]=s.F[7];s.F[1]=t[0];s.F[4]=t[1];s.F[7]=t[2];}
}
function applyMove(state,move){
  const s=cloneState(state);
  const base=move.replace(/['\d]/g,'');
  const prime=move.includes("'"),double=move.includes("2");
  const times=double?2:(prime?3:1);
  for(let t=0;t<times;t++) applyMoveCW(s,base);
  return s;
}
function applyMoves(state,movesStr){
  if(!movesStr||!movesStr.trim()) return cloneState(state);
  let s=cloneState(state);
  for(const m of movesStr.trim().split(/\s+/)) if(m) s=applyMove(s,m);
  return s;
}

// ═══════════════════════════════════════════════════════
//  PIECE PALETTE STATE
// ═══════════════════════════════════════════════════════
// slotState: maps slotId -> { pieceId, orientation }
// paletteState: maps pieceId -> 'palette' | 'placed'
let slotState = {};   // slotId -> { pieceId, orientation } | null
let paletteState = {}; // pieceId -> 'palette' | 'placed'
let selectedPieceId = null;
let pStage = 'cross';

function initPieceState(){
  slotState = {};
  paletteState = {};
  selectedPieceId = null;
  const stagePieces = getAllPieces(pStage);
  for(const p of stagePieces) paletteState[p.id] = 'palette';
  for(const slot of SLOT_DEFS[pStage]) slotState[slot.slotId] = null;
}

function getAllPieces(stage){
  const d = STAGE_PIECES[stage];
  return [...(d.corners||[]), ...(d.edges||[])];
}
function getPieceById(id){
  for(const stage of Object.values(STAGE_PIECES)){
    for(const p of [...(stage.corners||[]),...(stage.edges||[])]){
      if(p.id===id) return p;
    }
  }
  return null;
}
function getSlotDef(slotId){ return SLOT_DEFS[pStage].find(s=>s.slotId===slotId)||null; }

// When user selects a piece from palette
function selectPalettePiece(pieceId){
  if(paletteState[pieceId]==='placed'){
    showToast('Already placed');
    return;
  }
  selectedPieceId = pieceId;
  renderPalette();
  showToast('Tap slot on cube to place');
}

// When user taps a slot on the cube
function handleSlotTap(slotId){
  const slot = getSlotDef(slotId);
  if(!slot) return;
  const current = slotState[slotId];

  // Place selected piece
  if(selectedPieceId && paletteState[selectedPieceId]==='palette'){
    if(current) paletteState[current.pieceId] = 'palette';
    slotState[slotId] = { pieceId: selectedPieceId, orientation: 0 };
    paletteState[selectedPieceId] = 'placed';
    selectedPieceId = null;
    rebuildCubeStateFromSlots();
    buildMesh(); renderPalette(); validateState();
    autoRegisterPaintedScramble();
    return;
  }

  // Cycle orientation on placed piece
  if(current){
    const piece = getPieceById(current.pieceId);
    if(!piece) return;
    if(pStage==='pll'){
      paletteState[current.pieceId] = 'palette';
      slotState[slotId] = null;
    } else {
      const maxOrient = piece.type==='edge' ? 2 : 3;
      slotState[slotId] = { pieceId: current.pieceId, orientation: (current.orientation+1)%maxOrient };
      showToast('Orientation: ' + slotState[slotId].orientation);
    }
    rebuildCubeStateFromSlots();
    buildMesh(); renderPalette(); validateState();
    autoRegisterPaintedScramble();
    return;
  }

  showToast('Select a piece from the palette first');
}

// Painting auto-registers as current scramble
// Updates the scramble input field so user can see it, and marks state ready for Solve
function autoRegisterPaintedScramble(){
  // The current cubeState IS the painted state — store it as the active case
  // No scramble string needed; solveCurrentState() reads cubeState directly
  currentScrambleStr = '__painted__';
  const inp = document.getElementById('pscramble-input');
  if(inp) inp.value = '(painted cube state)';
  inp.style.color = 'var(--cY)';
  // Clear any old solution display
  const sp = document.getElementById('solution-panel');
  if(sp) sp.classList.remove('show');
}

function validateState(){
  const bar = document.getElementById('validity-bar');
  if(!bar) return;
  const placed = Object.values(slotState).filter(v=>v!==null).length;
  const total = SLOT_DEFS[pStage].length;
  if(placed===0){ bar.className=''; bar.style.display='none'; return; }
  if(placed===total){
    bar.textContent='✓ All pieces placed — tap Solution to solve';
    bar.className='ok'; bar.style.display='block';
  } else {
    bar.textContent=`${placed} of ${total} pieces placed`;
    bar.className='warn'; bar.style.display='block';
  }
}

// ═══════════════════════════════════════════════════════
//  PALETTE RENDER — grouped by type, uses piece-palette-inner
// ═══════════════════════════════════════════════════════
function renderPalette(){
  const container = document.getElementById('piece-palette-inner');
  if(!container) return;

  const stageDef = STAGE_PIECES[pStage];
  const edges   = stageDef.edges   || [];
  const corners = stageDef.corners || [];

  let html = '';

  // For Cross: edges only
  if(pStage === 'cross'){
    html += `<div class="palette-group">
      <div class="palette-group-label">White Edges</div>
      <div class="palette-row">${edges.map(p => pieceCardHTML(p)).join('')}</div>
    </div>`;
  }

  // For F2L: corners first then edges
  if(pStage === 'f2l'){
    html += `<div class="palette-group">
      <div class="palette-group-label">Corners</div>
      <div class="palette-row">${corners.map(p => pieceCardHTML(p)).join('')}</div>
    </div>
    <div class="palette-group">
      <div class="palette-group-label">Edges</div>
      <div class="palette-row">${edges.map(p => pieceCardHTML(p)).join('')}</div>
    </div>`;
  }

  // For OLL/PLL: corners then edges
  if(pStage === 'oll' || pStage === 'pll'){
    html += `<div class="palette-group">
      <div class="palette-group-label">Corners</div>
      <div class="palette-row">${corners.map(p => pieceCardHTML(p)).join('')}</div>
    </div>
    <div class="palette-group">
      <div class="palette-group-label">Edges</div>
      <div class="palette-row">${edges.map(p => pieceCardHTML(p)).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;
}

function pieceCardHTML(p){
  const placed = paletteState[p.id] === 'placed';
  const sel    = selectedPieceId === p.id;
  const dots   = p.colors.map(col =>
    `<div class="piece-dot${p.type==='corner'?' sm':''}" style="background:${col}"></div>`
  ).join('');
  return `<div class="piece-card${placed?' placed':''}${sel?' selected':''}" onclick="selectPalettePiece('${p.id}')">
    <div class="piece-icon">${dots}</div>
    <div class="piece-label">${p.label}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
//  PIECE → CUBE STATE WRITER
//  Single source of truth: cubeState drives everything
// ═══════════════════════════════════════════════════════

// Face index lookup — given a position (x,y,z) on a face, return the sticker index 0-8
// Layout per face (standard WCA orientation, white bottom, green front):
// U face: viewed from above,  row0=back(z=-1), row2=front(z=1), col0=left(x=-1), col2=right(x=1)
// D face: viewed from below,  row0=front(z=1), row2=back(z=-1)
// F face: viewed from front,  row0=top(y=1),   row2=bottom(y=-1)
// B face: viewed from back,   row0=top(y=1),   row2=bottom(y=-1), cols mirrored
// R face: viewed from right,  row0=top(y=1),   row2=bottom(y=-1), col0=front(z=1), col2=back(z=-1)
// L face: viewed from left,   row0=top(y=1),   row2=bottom(y=-1), col0=back(z=-1), col2=front(z=1)
function getStickerIdx(face, x, y, z){
  let row, col;
  if(face==='U'){ row = z+1; col = x+1; }       // row: z-1=0,z=1,z+1=2
  else if(face==='D'){ row = 1-z; col = x+1; }
  else if(face==='F'){ row = 1-y; col = x+1; }
  else if(face==='B'){ row = 1-y; col = 1-x; }
  else if(face==='R'){ row = 1-y; col = 1-z; }
  else              { row = 1-y; col = z+1; }   // L
  return Math.max(0, Math.min(8, row*3 + col));
}

function writePieceToState(slotId, pieceId, orientation){
  const slot  = getSlotDef(slotId);
  const piece = getPieceById(pieceId);
  if(!slot||!piece||!pCR) return;
  const {x,y,z}=slot.pos;
  const s=pCR.state.s;

  if(piece.type==='edge'){
    const [c0,c1]=orientation===0?[piece.colors[0],piece.colors[1]]:[piece.colors[1],piece.colors[0]];
    let fP,fS;
    if(y===-1){fP='D';fS=z===1?'F':z===-1?'B':x===1?'R':'L';}
    else if(y===1){fP='U';fS=z===1?'F':z===-1?'B':x===1?'R':'L';}
    else{
      if(z===1)      {fP='F';fS=x===1?'R':'L';}
      else if(z===-1){fP='B';fS=x===1?'R':'L';}
      else           {fP='R';fS='F';}
    }
    s[fP][getStickerIdx(fP,x,y,z)]=c0;
    s[fS][getStickerIdx(fS,x,y,z)]=c1;
  } else if(piece.type==='corner'){
    const c=[piece.colors[orientation%3],piece.colors[(orientation+1)%3],piece.colors[(orientation+2)%3]];
    const fy=y===1?'U':'D', fz=z===1?'F':'B', fx=x===1?'R':'L';
    s[fy][getStickerIdx(fy,x,y,z)]=c[0];
    s[fz][getStickerIdx(fz,x,y,z)]=c[1];
    s[fx][getStickerIdx(fx,x,y,z)]=c[2];
  }
}

// Rebuild cube state from current piece placements
function rebuildCubeStateFromSlots(){
  if(!pCR) return;
  pCR.state.reset();
  // F2L: write solved cross first
  if(pStage==='f2l'){
    const f=pCR.state.s;
    // D-F edge
    f.D[7]='#ffffff'; f.F[7]='#00c853';
    // D-R edge
    f.D[5]='#ffffff'; f.R[7]='#ff6d00';
    // D-B edge
    f.D[1]='#ffffff'; f.B[7]='#2979ff';
    // D-L edge
    f.D[3]='#ffffff'; f.L[7]='#f44336';
  }
  for(const [slotId,val] of Object.entries(slotState)){
    if(val) writePieceToState(slotId, val.pieceId, val.orientation);
  }
  pCR.setFilter(_practiceFilter());
}


// ═══════════════════════════════════════════════════════
//  PRACTICE 3D — uses shared CubeRenderer from virtual-cube.js
// ═══════════════════════════════════════════════════════
let pCR = null;
let pStageInit = false;
let animSpeed = 400;
let isAnimating = false;
let currentScrambleStr = '';
let currentSolution = '';

function initPScene(){
  if(!window.CubeRenderer){ setTimeout(initPScene,200); return; }
  const canvas = document.getElementById('practice-canvas');
  const wrap   = document.getElementById('cube-wrap');
  if(!canvas||!wrap) return;

  // If already init and just switching stages — refresh filter
  if(pCR){
    // Resize in case viewport changed
    const w=wrap.clientWidth, h=wrap.clientHeight;
    if(w>0&&h>0){
      pCR.camera.aspect=w/h;
      pCR.camera.updateProjectionMatrix();
      pCR.renderer.setSize(w,h);
    }
    pCR.setFilter(_practiceFilter());
    renderPalette();
    return;
  }

  // Canvas needs real dimensions — wait until visible
  if(wrap.clientWidth===0){
    setTimeout(initPScene,200);
    return;
  }

  pStageInit=true;
  pCR = new window.CubeRenderer(canvas,{tiltX:-0.38,tiltY:0.42,fov:40,camZ:8});
  pCR.state.reset();

  canvas.addEventListener('click',e=>{
    const r=canvas.getBoundingClientRect();
    _practiceTap(e.clientX-r.left,e.clientY-r.top,r.width,r.height);
  });
  canvas.addEventListener('touchend',e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    _practiceTap(e.changedTouches[0].clientX-r.left,e.changedTouches[0].clientY-r.top,r.width,r.height);
  },{passive:false});
  canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

  initPieceState();
  pCR.setFilter(_practiceFilter());
  renderPalette();
}

function _practiceFilter(){
  return (face,x,y,z,color)=>{
    const role=getCubieRole(x,y,z);
    if(role==='irrelevant') return '#111111';
    if(role==='slot-empty') return '#1e1e1e';
    if(role==='center') return window.CUBE_COLORS[face];
    if(role==='cross-solved'){
      if(face==='D') return '#ffffff';
      if(face==='F') return '#00c853';
      if(face==='B') return '#2979ff';
      if(face==='R') return '#ff6d00';
      if(face==='L') return '#f44336';
      return '#111111';
    }
    if((pStage==='cross'||pStage==='f2l')&&color==='#ffd700') return '#111111';
    return color;
  };
}

function _practiceTap(cx,cy,w,h){
  if(!pCR) return;
  const raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((cx/w)*2-1,-(cy/h)*2+1),pCR.camera);
  const meshes=[];
  pCR.cubies.forEach(c=>c.group.children.forEach(ch=>{if(ch.isMesh) meshes.push({mesh:ch,cubie:c});}));
  const hits=raycaster.intersectObjects(meshes.map(m=>m.mesh));
  if(!hits.length) return;
  const entry=meshes.find(m=>m.mesh===hits[0].object);
  if(!entry) return;
  const {x,y,z}=entry.cubie;
  const slot=SLOT_DEFS[pStage]?.find(s=>s.pos.x===x&&s.pos.y===y&&s.pos.z===z);
  if(slot) handleSlotTap(slot.slotId);
  else if(selectedPieceId) showToast('Tap a highlighted slot');
}

function resetCubeAngle(){ if(pCR) pCR._applyTilt(); }

function rotateCube90(){
  if(!pCR) return;
  const startQ=pCR.rootGroup.quaternion.clone();
  const endQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).multiply(startQ);
  const t0=Date.now(),dur=380;
  function step(){
    const p=Math.min((Date.now()-t0)/dur,1),e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    pCR.rootGroup.quaternion.slerpQuaternions(startQ,endQ,e);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function buildMesh(){
  if(!pCR) return;
  pCR._buildCubies();
  pCR.setFilter(_practiceFilter());
}

function animateMoves(movesStr,onDone){
  if(!pCR){if(onDone)onDone();return;}
  isAnimating=true;
  const moves=movesStr.trim().split(/\s+/).filter(m=>m&&!m.startsWith('['));
  let idx=0;
  function doNext(){
    if(!isAnimating){if(onDone)onDone();return;}
    if(idx>=moves.length){
      isAnimating=false;
      document.querySelectorAll('.sol-move-item').forEach(el=>el.classList.add('done'));
      const ov=document.getElementById('move-overlay');if(ov)ov.classList.remove('show');
      if(onDone)onDone();return;
    }
    const mv=moves[idx];
    document.querySelectorAll('.sol-move-item').forEach((el,i)=>{
      el.classList.toggle('done',i<idx);el.classList.toggle('current',i===idx);
    });
    const ov=document.getElementById('move-overlay');
    if(ov){ov.textContent=mv;ov.classList.add('show');}
    pCR.state.move(mv);
    pCR.animateMove(mv,animSpeed,()=>{
      pCR.setFilter(_practiceFilter());
      idx++;setTimeout(doNext,30);
    });
  }
  doNext();
}

// ═══════════════════════════════════════════════════════
//  STAGE SWITCHING
// ═══════════════════════════════════════════════════════
function setPStage(stage){
  pStage = stage;
  document.querySelectorAll('.ptab').forEach((t,i)=>t.classList.toggle('active',['cross','f2l','oll','pll'][i]===stage));
  const st=document.getElementById('stage-title'); if(st) st.textContent=STAGE_INFO[stage].title;
  const sd=document.getElementById('stage-desc');  if(sd) sd.textContent=STAGE_INFO[stage].desc;

  currentScrambleStr=''; currentSolution='';
  const inp=document.getElementById('pscramble-input'); if(inp) inp.value='';
  const sp=document.getElementById('solution-panel'); if(sp) sp.classList.remove('show');

  initPieceState();
  if(pStageInit){ buildMesh(); renderPalette(); validateState(); }
}

function resetPCube(){
  isAnimating=false;
  currentScrambleStr=''; currentSolution='';
  const inp=document.getElementById('pscramble-input');
  if(inp){ inp.value=''; inp.style.color=''; }
  const sp=document.getElementById('solution-panel'); if(sp) sp.classList.remove('show');
  const vb=document.getElementById('validity-bar'); if(vb){vb.style.display='none';vb.className='';}
  const ov=document.getElementById('move-overlay'); if(ov){ov.classList.remove('show');ov.textContent='';}
  initPieceState();
  buildMesh(); renderPalette(); validateState();
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE BUTTONS
// ═══════════════════════════════════════════════════════
function handleGenerateBtn(){
  let s='';
  if(pStage==='cross') s=genCrossScramble();
  else if(pStage==='f2l') s=genF2LScramble();
  else if(pStage==='oll') s=genOLLScramble();
  else s=genPLLScramble();
  const inp=document.getElementById('pscramble-input'); if(inp) inp.value=s;
  currentScrambleStr=s;
  showToast('Tap Apply to scramble');
}

function handleApplyBtn(){
  const inp = document.getElementById('pscramble-input');
  const s = (inp ? inp.value.trim() : '') || currentScrambleStr;
  if(!s){ showToast('Generate a scramble first'); return; }
  currentScrambleStr = s;
  if(!pCR){ showToast('Cube not ready'); return; }
  // Reset to solved, then animate scramble
  pCR.state.reset();
  pCR._buildCubies();
  pCR.setFilter(_practiceFilter());
  showToast('Applying scramble...');
  animateMoves(s, ()=>{ showToast('Done — tap Solution to solve'); });
}

function handleSolutionBtn(){
  const placed = Object.values(slotState).filter(v=>v!==null).length;
  if(placed===0 && !currentScrambleStr){showToast('Place pieces or apply a scramble first');return;}
  showToast('Solving...');
  setTimeout(async ()=>{
    const sol = await solveCurrentState();
    if(!sol && sol!==''){showToast('Could not solve — check piece placement');return;}
    if(sol===''){showToast('Already solved!');return;}
    currentSolution=sol;
    showSolutionMoves(sol);
    animateMoves(sol,()=>{ pCR.setFilter(_practiceFilter()); });
  },50);
}

function showSolutionMoves(movesStr){
  const panel=document.getElementById('solution-panel');
  const disp=document.getElementById('sol-moves-display');
  if(!panel||!disp) return;
  panel.classList.add('show');
  disp.innerHTML=movesStr.trim().split(/\s+/).map((m,i)=>`<span class="sol-move-item" id="smove-${i}">${m}</span>`).join(' ');
}

// ═══════════════════════════════════════════════════════
//  SPEED
// ═══════════════════════════════════════════════════════
function setSpeed(speed){
  if(speed==='slow') animSpeed=900;
  else if(speed==='normal') animSpeed=600;
  else animSpeed=300;
  document.querySelectorAll('.speed-btn').forEach(b=>b.classList.toggle('active-speed',b.dataset.speed===speed));
  showToast(speed.charAt(0).toUpperCase()+speed.slice(1));
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function saveS(k,v){settings[k]=v;localStorage.setItem('cubeai_settings',JSON.stringify(settings));}
function toggleS(k){
  settings[k]=!settings[k];
  const el=document.getElementById('tog-'+k); if(el) el.classList.toggle('on',settings[k]);
  localStorage.setItem('cubeai_settings',JSON.stringify(settings));
}
function loadSettings(){
  const ti=document.getElementById('tog-inspection');
  const ta=document.getElementById('tog-autoscramble');
  const sh=document.getElementById('sel-hold');
  const ss=document.getElementById('sel-slen');
  if(ti) ti.classList.toggle('on',settings.inspection);
  if(ta) ta.classList.toggle('on',settings.autoscramble);
  if(sh) sh.value=settings.holdDuration;
  if(ss) ss.value=settings.scrambleLength;
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
let toastT;
function showToast(msg){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg;
  t.classList.remove('show');
  void t.offsetWidth; // force reflow so transition restarts
  t.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>{
    t.classList.remove('show');
  }, 2200);
}

// ═══════════════════════════════════════════════════════
//  SOLVERS — cubing.js for cross/f2l, lookup for oll/pll
// ═══════════════════════════════════════════════════════
async function solveWithCubingJS(scrambleStr){
  try{
    const { experimentalSolve3x3x3IgnoringCenters } =
      await import('https://cdn.cubing.net/js/cubing/search');
    const sol = await experimentalSolve3x3x3IgnoringCenters(scrambleStr);
    return sol.toString();
  } catch(e){
    console.warn('cubing.js solver unavailable, using fallback');
    return invertMoves(scrambleStr);
  }
}

async function solveCurrentState(){
  rebuildCubeStateFromSlots();
  const scramble = (currentScrambleStr && currentScrambleStr!=='__painted__') ? currentScrambleStr : null;

  if(pStage==='cross'||pStage==='f2l'){
    if(!scramble){ showToast('Apply a scramble first'); return null; }
    showToast('Solving...');
    return await solveWithCubingJS(scramble);
  }
  if(pStage==='oll') return solveOLL(pCR?.state?.s || {});
  if(pStage==='pll') return solvePLL(pCR?.state?.s || {});
  return null;
}

function solveOLL(state){
  function isOLLSolved(s){ return s.U.every(c=>c===C.Y); }
  if(isOLLSolved(state)) return '';
  const OLL_ALGS=["R U R' U' R' F R F'","F R U R' U' F'","f R U R' U' f'","R U R' U R U2 R'","R U2 R' U' R U' R'","r U R' U R U2 r'","r U2 R' U' R U' r'","F R U R' U' R U R' U' F'","r U R' U' r' R U R' U'","R U R' U' M' U R U' r'","F U R U' R' F'","R' U' R U' R' U R U' R' U2 R","R U R' U R U' R' U R U2 R'","r' U' R U' R' U2 r","F R' F' R2 r' U R U' R' U' M'","R' U' F' U F R","L U F' U' L' U L F L'","R U2 R2 U' R2 U' R2 U2 R","r' U' R U' R' U R U' R' U2 r","R U R' U R U2 R' F R U R' U' F'"];
  for(const alg of OLL_ALGS){
    for(const pre of ['','U',"U'","U2"]){
      let s=pre?applyMoves(cloneState(state),pre):cloneState(state);
      s=applyMoves(s,alg);
      if(isOLLSolved(s)) return (pre?pre+' ':'')+alg;
    }
  }
  return 'OLL not recognized';
}

function solvePLL(state){
  if(!state.U.every(c=>c===C.Y)) return 'Solve OLL first';
  const PLL_ALGS=[
    {name:'Ua',alg:"M2 U M U2 M' U M2"},{name:'Ub',alg:"M2 U' M U2 M' U' M2"},
    {name:'H', alg:"M2 U M2 U2 M2 U M2"},{name:'Z',alg:"M2 U M2 U M' U2 M2 U2 M'"},
    {name:'T', alg:"R U R' U' R' F R2 U' R' U' R U R' F'"},
    {name:'Jb',alg:"R U R' F' R U R' U' R' F R2 U' R'"},
    {name:'Y', alg:"F R U' R' U' R U R' F' R U R' U' R' F R F'"},
    {name:'Aa',alg:"x R' U R' D2 R U' R' D2 R2 x'"},{name:'Ab',alg:"x R2 D2 R U R' D2 R U' R x'"},
  ];
  function isPLLSolved(s){ return ['F','B','R','L'].every(f=>s[f][0]===s[f][1]&&s[f][1]===s[f][2]); }
  if(isPLLSolved(state)) return '';
  for(const {name,alg} of PLL_ALGS){
    for(const pre of ['','U',"U'","U2"]){
      let s=pre?applyMoves(cloneState(state),pre):cloneState(state);
      s=applyMoves(s,alg);
      for(const auf of ['','U',"U'","U2"]){
        const sf=auf?applyMoves(cloneState(s),auf):cloneState(s);
        if(isPLLSolved(sf)) return [pre,`[${name}] ${alg}`,auf].filter(Boolean).join(' ');
      }
    }
  }
  return 'PLL not recognized';
}

// ═══════════════════════════════════════════════════════
//  EXPOSE GLOBALS (required because script is type=module)
// ═══════════════════════════════════════════════════════
Object.assign(window,{
  showScreen,toggleDrawer,closeDrawer,
  setPStage,resetPCube,rotateCube90,resetCubeAngle,
  handleSolutionBtn,handleGenerateBtn,handleApplyBtn,
  setSpeed,selectPalettePiece,
  deleteLastSolve,clearAllSolves,delSolve,
  saveS,toggleS,
  toggleVCSetting,updateVCTheme,
  vcUndo:()=>window.vCube?.undo(),
  vcRedo:()=>window.vCube?.redo(),
  vcScramble:()=>window.vCube?.scramble(),
  vcReset:()=>window.vCube?.reset(),
  initVirtualCube,
});

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
// Run after DOM fully loaded
function appInit(){
  genScramble();
  updateStats();
  loadSettings();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', appInit);
} else {
  appInit();
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
