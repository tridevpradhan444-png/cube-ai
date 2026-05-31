// ═══════════════════════════════════════════════════════
//  DATA & SETTINGS
// ═══════════════════════════════════════════════════════
let solves = JSON.parse(localStorage.getItem('cubeai_solves')||'[]');
let settings = Object.assign({inspection:false,autoscramble:true,holdDuration:500,scrambleLength:20},
  JSON.parse(localStorage.getItem('cubeai_settings')||'{}'));

const FACE_COLORS = {U:'#ffd700',D:'#ffffff',F:'#00c853',B:'#2979ff',R:'#ff6d00',L:'#f44336'};
const STAGE_INFO = {
  cross:{title:'CROSS',desc:'Only the 4 white edges are scrambled. Cross pieces shown, rest solved.'},
  f2l:{title:'F2L — FIRST TWO LAYERS',desc:'Cross is locked solved. Only the 4 corner-edge pairs are scrambled.'},
  oll:{title:'OLL — ORIENT LAST LAYER',desc:'F2L is locked solved. All OLL cases possible on the top face.'},
  pll:{title:'PLL — PERMUTE LAST LAYER',desc:'F2L locked, top face yellow locked. All 21 PLL cases possible.'}
};

// ═══════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((item,i)=>{
    item.classList.toggle('active',['timer','history','practice','','settings','privacy'][i]===name);
  });
  if(name==='history') renderHistory();
  if(name==='practice') initPScene();
}
function goLearn(){ window.open('learn.html','_blank'); closeDrawer(); }
function toggleDrawer(){ document.getElementById('drawer').classList.toggle('open'); document.getElementById('hamburger').classList.toggle('open'); }
function closeDrawer(){ document.getElementById('drawer').classList.remove('open'); document.getElementById('hamburger').classList.remove('open'); }

// ═══════════════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════════════
let timerRunning=false,timerStart=0,timerVal=0,timerInterval=null;
let holdTimeout=null,isHolding=false,isArmed=false;
let inspInterval=null,inspTime=15;

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
  solves.pop(); localStorage.setItem('cubeai_solves',JSON.stringify(solves));
  updateStats(); document.getElementById('bin-btn').classList.remove('visible'); showToast('Deleted');
}
function clearAllSolves(){
  if(!solves.length) return;
  solves=[]; localStorage.setItem('cubeai_solves',JSON.stringify(solves));
  updateStats(); renderHistory(); document.getElementById('bin-btn').classList.remove('visible'); showToast('Cleared');
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

const TS=document.getElementById('screen-timer');
function onHoldStart(e){
  if(e.target.closest('#stats-bar')||e.target.closest('#bin-btn')) return;
  if(timerRunning){stopTimer();return;}
  isHolding=true;
  document.getElementById('timer-display').classList.add('holding');
  
  holdTimeout=setTimeout(()=>{if(isHolding){isArmed=true;document.getElementById('timer-display').classList.remove('holding');document.getElementById('timer-display').classList.add('ready');}},settings.holdDuration);
}
function onHoldEnd(e){
  if(timerRunning) return;
  clearTimeout(holdTimeout); isHolding=false;
  if(isArmed){
    isArmed=false; document.getElementById('timer-display').classList.remove('ready');
    if(settings.inspection) startInsp(); else startTimer();
  } else { document.getElementById('timer-display').classList.remove('holding'); }
}
TS.addEventListener('touchstart',onHoldStart,{passive:true});
TS.addEventListener('touchend',onHoldEnd);
TS.addEventListener('mousedown',onHoldStart);
TS.addEventListener('mouseup',onHoldEnd);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&document.getElementById('screen-timer').classList.contains('active')){e.preventDefault();if(timerRunning){stopTimer();return;}if(!isHolding)onHoldStart(e);}});
document.addEventListener('keyup',e=>{if(e.code==='Space')onHoldEnd(e);});

function startInsp(){
  inspTime=15; const d=document.getElementById('inspection-display'); d.style.display='block'; d.textContent=15;
  inspInterval=setInterval(()=>{inspTime--;d.textContent=inspTime>0?inspTime:'GO';if(inspTime<=0){clearInterval(inspInterval);d.style.display='none';startTimer();}},1000);
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE GENERATOR
// ═══════════════════════════════════════════════════════
const MOVES=['R','L','U','D','F','B'],MODS=["","'","2"];
const OPP={R:'L',L:'R',U:'D',D:'U',F:'B',B:'F'};

function genScrambleStr(len){
  len=len||parseInt(settings.scrambleLength)||20;
  let s=[],last='',sec='';
  for(let i=0;i<len;i++){
    let f; do{f=MOVES[Math.floor(Math.random()*6)];}while(f===last||(f===sec&&OPP[f]===last));
    s.push(f+MODS[Math.floor(Math.random()*3)]); sec=last; last=f;
  }
  return s.join(' ');
}
function genScramble(){
  const s=genScrambleStr(); document.getElementById('scramble-text').textContent=s; return s;
}

// Stage-specific scramblers
function genCrossScramble(){
  // Only scramble white edges: randomly move D-layer edges using D,F2,B2,R2,L2 type moves
  const edgeMoves=['F2','B2','R2','L2','U','U2',"U'"];
  let moves=[];
  for(let i=0;i<8;i++) moves.push(edgeMoves[Math.floor(Math.random()*edgeMoves.length)]);
  return moves.join(' ');
}
function genF2LScramble(){
  // Scramble corner-edge pairs, keep cross solved
  const f2lMoves=['R','L',"R'","L'","R2","L2",'U',"U'","U2",'F',"F'","B","B'"];
  let s=[],last='';
  for(let i=0;i<10;i++){let m;do{m=f2lMoves[Math.floor(Math.random()*f2lMoves.length)];}while(m[0]===last[0]);s.push(m);last=m;}
  return s.join(' ');
}
function genOLLScramble(){
  // Pick a random OLL case algorithm (inverse = scramble)
  const ollCases=[
    "R U R' U' R' F R F'","F R U R' U' F'","f R U R' U' f'","R U R' U R U2 R'",
    "R U2 R' U' R U' R'","r U R' U R U2 r'","r U2 R' U' R U' r'",
    "R U2 R2 U' R2 U' R2 U2 R","R' U' R U' R' U R U' R' U2 R",
    "R U R' U' R U' R' U2 R U' R'","F R U R' U' R U R' U' F'",
    "r U R' U' r' R U R' U'","R U R' U' M' U R U' r'","r' R2 U R' U R U2 R' U M'"
  ];
  return ollCases[Math.floor(Math.random()*ollCases.length)];
}
function genPLLScramble(){
  const pllCases=[
    "R U R' U' R' F R2 U' R' U' R U R' F'",
    "R U R' F' R U R' U' R' F R2 U' R'",
    "R U' R U R U R U' R' U' R2",
    "R2 U R U R' U' R' U' R' U R'",
    "M2 U M2 U2 M2 U M2",
    "M2 U M2 U M' U2 M2 U2 M'",
    "R' F R' B2 R F' R' B2 R2",
    "R B' R F2 R' B R F2 R2",
    "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    "R U R' U' R' F R2 U' R' U' R U R' F' U2"
  ];
  return pllCases[Math.floor(Math.random()*pllCases.length)];
}

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory(){
  const list=document.getElementById('history-list');
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
// cubeState[face][index] = hex color string
// faces: U,D,F,B,R,L  indices: 0-8 row-major
let cubeState = null;

function initCubeState(){
  cubeState={};
  for(const [f,c] of Object.entries(FACE_COLORS)) cubeState[f]=Array(9).fill(c);
}

function cloneState(s){ const c={}; for(const f of Object.keys(s)) c[f]=[...s[f]]; return c; }

// Apply a single move to cubeState
// Full move set: R R' R2 L L' L2 U U' U2 D D' D2 F F' F2 B B' B2 M M' M2
function applyMove(state, move){
  const s=cloneState(state);
  const base=move.replace("'","").replace("2","");
  const prime=move.includes("'");
  const double=move.includes("2");
  const times=double?2:(prime?3:1);
  for(let t=0;t<times;t++) applyMoveCW(s,base);
  return s;
}

function applyMoveCW(s,base){
  // Helper: rotate a face 90° CW
  const rotateFaceCW=(f)=>{
    const o=[...s[f]];
    s[f][0]=o[6];s[f][1]=o[3];s[f][2]=o[0];
    s[f][3]=o[7];s[f][4]=o[4];s[f][5]=o[1];
    s[f][6]=o[8];s[f][7]=o[5];s[f][8]=o[2];
  };
  const cyc4=(a0,a1,a2,a3,b0,b1,b2,b3,c0,c1,c2,c3,d0,d1,d2,d3)=>{
    // cycle a→b→c→d→a (CW means a gets d's value)
    const tmp=[s[a0][a1],s[a2][a3]||s[a0][a1]];
    // do 4-way cycle for single stickers
  };

  // Proper cycle for each move
  if(base==='U'){
    rotateFaceCW('U');
    const tmp=[s.F[0],s.F[1],s.F[2]];
    s.F[0]=s.R[0];s.F[1]=s.R[1];s.F[2]=s.R[2];
    s.R[0]=s.B[0];s.R[1]=s.B[1];s.R[2]=s.B[2];
    s.B[0]=s.L[0];s.B[1]=s.L[1];s.B[2]=s.L[2];
    s.L[0]=tmp[0];s.L[1]=tmp[1];s.L[2]=tmp[2];
  } else if(base==='D'){
    rotateFaceCW('D');
    const tmp=[s.F[6],s.F[7],s.F[8]];
    s.F[6]=s.L[6];s.F[7]=s.L[7];s.F[8]=s.L[8];
    s.L[6]=s.B[6];s.L[7]=s.B[7];s.L[8]=s.B[8];
    s.B[6]=s.R[6];s.B[7]=s.R[7];s.B[8]=s.R[8];
    s.R[6]=tmp[0];s.R[7]=tmp[1];s.R[8]=tmp[2];
  } else if(base==='R'){
    rotateFaceCW('R');
    const tmp=[s.U[2],s.U[5],s.U[8]];
    s.U[2]=s.F[2];s.U[5]=s.F[5];s.U[8]=s.F[8];
    s.F[2]=s.D[2];s.F[5]=s.D[5];s.F[8]=s.D[8];
    s.D[2]=s.B[6];s.D[5]=s.B[3];s.D[8]=s.B[0];
    s.B[6]=tmp[0];s.B[3]=tmp[1];s.B[0]=tmp[2];
  } else if(base==='L'){
    rotateFaceCW('L');
    const tmp=[s.U[0],s.U[3],s.U[6]];
    s.U[0]=s.B[8];s.U[3]=s.B[5];s.U[6]=s.B[2];
    s.B[8]=s.D[0];s.B[5]=s.D[3];s.B[2]=s.D[6];
    s.D[0]=s.F[0];s.D[3]=s.F[3];s.D[6]=s.F[6];
    s.F[0]=tmp[0];s.F[3]=tmp[1];s.F[6]=tmp[2];
  } else if(base==='F'){
    rotateFaceCW('F');
    const tmp=[s.U[6],s.U[7],s.U[8]];
    s.U[6]=s.L[8];s.U[7]=s.L[5];s.U[8]=s.L[2];
    s.L[2]=s.D[0];s.L[5]=s.D[1];s.L[8]=s.D[2];
    s.D[0]=s.R[6];s.D[1]=s.R[3];s.D[2]=s.R[0];
    s.R[0]=tmp[2];s.R[3]=tmp[1];s.R[6]=tmp[0];
  } else if(base==='B'){
    rotateFaceCW('B');
    const tmp=[s.U[0],s.U[1],s.U[2]];
    s.U[0]=s.R[2];s.U[1]=s.R[5];s.U[2]=s.R[8];
    s.R[2]=s.D[8];s.R[5]=s.D[7];s.R[8]=s.D[6];
    s.D[6]=s.L[0];s.D[7]=s.L[3];s.D[8]=s.L[6];
    s.L[0]=tmp[2];s.L[3]=tmp[1];s.L[6]=tmp[0];
  } else if(base==='M'){
    // M slice: same as L but middle column (indices 1,4,7 for left-right faces)
    const tmp=[s.U[1],s.U[4],s.U[7]];
    s.U[1]=s.B[7];s.U[4]=s.B[4];s.U[7]=s.B[1];
    s.B[7]=s.D[1];s.B[4]=s.D[4];s.B[1]=s.D[7];
    s.D[1]=s.F[1];s.D[4]=s.F[4];s.D[7]=s.F[7];
    s.F[1]=tmp[0];s.F[4]=tmp[1];s.F[7]=tmp[2];
  }
}

function applyMoves(state, movesStr){
  if(!movesStr.trim()) return state;
  let s=cloneState(state);
  const moves=movesStr.trim().split(/\s+/);
  for(const m of moves) if(m) s=applyMove(s,m);
  return s;
}

function invertMoves(movesStr){
  if(!movesStr.trim()) return '';
  return movesStr.trim().split(/\s+/).reverse().map(m=>{
    if(m.includes("'")) return m.replace("'","");
    if(m.includes("2")) return m;
    return m+"'";
  }).join(' ');
}

// ═══════════════════════════════════════════════════════
//  PRACTICE STATE
// ═══════════════════════════════════════════════════════
let pStage='cross';
let scrambleGenerated=false; // first press
let scrambleApplied=false;   // second press
let currentScrambleStr='';
let currentSolution='';
let selectedColor='#ffffff';
let isAnimating=false;
let pSceneInit=false;

// Three.js
let scene,camera,renderer,cubeGroup;
let rotX=0.4,rotY=-0.6;
let isDragging=false,prevMouse={x:0,y:0},dragMoved=false;

function initPScene(){
  if(pSceneInit) return; pSceneInit=true;
  const container=document.getElementById('cube-wrap');
  const canvas=document.getElementById('practice-canvas');
  const w=container.clientWidth,h=container.clientHeight;
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x080808);
  camera=new THREE.PerspectiveCamera(45,w/h,0.1,100);
  camera.position.set(4,3.5,5); camera.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene.add(new THREE.AmbientLight(0xffffff,0.7));
  const dl=new THREE.DirectionalLight(0xffffff,0.8); dl.position.set(5,8,5); scene.add(dl);
  cubeGroup=new THREE.Group(); scene.add(cubeGroup);
  initCubeState(); applyStageDefaults(pStage); buildMesh();
  cubeGroup.rotation.x=rotX; cubeGroup.rotation.y=rotY;
  setupDrag(); setupCanvasTap();
  requestAnimationFrame(function loop(){requestAnimationFrame(loop);renderer.render(scene,camera);});
  window.addEventListener('resize',()=>{
    const w2=container.clientWidth,h2=container.clientHeight;
    camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
  });
  setupPalette(); renderNet();
}

function buildMesh(){
  if(!cubeGroup) return;
  while(cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
  const gap=0.05;
  const faceMap=[
    {face:'R',axis:'x',val:1},{face:'L',axis:'x',val:-1},
    {face:'U',axis:'y',val:1},{face:'D',axis:'y',val:-1},
    {face:'F',axis:'z',val:1},{face:'B',axis:'z',val:-1}
  ];
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
    const geo=new THREE.BoxGeometry(1-gap,1-gap,1-gap);
    const mats=faceMap.map(fm=>{
      const cv=fm.axis==='x'?x:fm.axis==='y'?y:z;
      if(cv!==fm.val) return new THREE.MeshLambertMaterial({color:0x0d0d0d});
      const visible=isStickerVisible(pStage,fm.face,x,y,z);
      const col=visible?parseInt(getStickerColor(fm.face,x,y,z).replace('#',''),16):0x1a1a1a;
      return new THREE.MeshLambertMaterial({color:col});
    });
    const mesh=new THREE.Mesh(geo,mats);
    mesh.position.set(x,y,z);
    mesh.userData={x,y,z,faceMap};
    cubeGroup.add(mesh);
  }
}

function getStickerColor(face,x,y,z){
  let row,col;
  if(face==='U'){row=1-z;col=x+1;}
  else if(face==='D'){row=z+1;col=x+1;}
  else if(face==='F'){row=1-y;col=x+1;}
  else if(face==='B'){row=1-y;col=1-x;}
  else if(face==='R'){row=1-y;col=1-z;}
  else{row=1-y;col=z+1;}
  const idx=row*3+col;
  if(idx<0||idx>8) return '#111111';
  return cubeState[face][idx]||'#111111';
}

function getStickerIndex(face,x,y,z){
  let row,col;
  if(face==='U'){row=1-z;col=x+1;}
  else if(face==='D'){row=z+1;col=x+1;}
  else if(face==='F'){row=1-y;col=x+1;}
  else if(face==='B'){row=1-y;col=1-x;}
  else if(face==='R'){row=1-y;col=1-z;}
  else{row=1-y;col=z+1;}
  return row*3+col;
}

function isStickerVisible(stage,face,x,y,z){
  if(stage==='cross'){
    if(face==='D') return true;
    // Only edge pieces (not corners) at y=-1
    if(y===-1&&face==='F'&&x===0) return true;
    if(y===-1&&face==='B'&&x===0) return true;
    if(y===-1&&face==='R'&&z===0) return true;
    if(y===-1&&face==='L'&&z===0) return true;
    // Side centers
    if(face==='F'&&x===0&&y===0) return true;
    if(face==='B'&&x===0&&y===0) return true;
    if(face==='R'&&z===0&&y===0) return true;
    if(face==='L'&&z===0&&y===0) return true;
    if(face==='U'&&x===0&&z===0) return true;
    return false;
  }
  if(stage==='f2l'){return y<=0||(y===1&&x===0&&z===0);}
  if(stage==='oll'){
    if(face==='U') return true;
    if(y===1) return true;
    if(face==='F'&&x===0&&y===0) return true;
    if(face==='B'&&x===0&&y===0) return true;
    if(face==='R'&&z===0&&y===0) return true;
    if(face==='L'&&z===0&&y===0) return true;
    return false;
  }
  if(stage==='pll'){
    if(y===1) return true;
    if(face==='F'&&x===0&&y===0) return true;
    if(face==='B'&&x===0&&y===0) return true;
    if(face==='R'&&z===0&&y===0) return true;
    if(face==='L'&&z===0&&y===0) return true;
    return false;
  }
  return true;
}

function applyStageDefaults(stage){
  initCubeState();
  if(stage==='pll') cubeState['U']=Array(9).fill(FACE_COLORS.U);
}

// ═══════════════════════════════════════════════════════
//  DRAG (world-space axes — no inversion)
// ═══════════════════════════════════════════════════════
function setupDrag(){
  const canvas=document.getElementById('practice-canvas');
  canvas.addEventListener('touchstart',e=>{isDragging=true;dragMoved=false;prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(!isDragging)return; dragMoved=true;
    const dx=e.touches[0].clientX-prevMouse.x,dy=e.touches[0].clientY-prevMouse.y;
    // Rotate around WORLD axes to prevent inversion
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*0.01);
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*0.01);
    cubeGroup.quaternion.premultiply(qX).premultiply(qY);
    prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  canvas.addEventListener('touchend',()=>{isDragging=false;});
  canvas.addEventListener('mousedown',e=>{isDragging=true;dragMoved=false;prevMouse={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('mousemove',e=>{
    if(!isDragging)return; dragMoved=true;
    const dx=e.clientX-prevMouse.x,dy=e.clientY-prevMouse.y;
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*0.01);
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*0.01);
    cubeGroup.quaternion.premultiply(qX).premultiply(qY);
    prevMouse={x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('mouseup',()=>{isDragging=false;});
  // Set initial rotation
  const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotY);
  const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),rotX);
  cubeGroup.quaternion.multiply(qX).multiply(qY);
}

// ═══════════════════════════════════════════════════════
//  TAP TO PAINT
// ═══════════════════════════════════════════════════════
function setupCanvasTap(){
  const canvas=document.getElementById('practice-canvas');
  const raycaster=new THREE.Raycaster();

  function handleTap(clientX,clientY){
    if(dragMoved||isAnimating) return;
    const rect=canvas.getBoundingClientRect();
    const mouse=new THREE.Vector2(
      ((clientX-rect.left)/rect.width)*2-1,
      -((clientY-rect.top)/rect.height)*2+1
    );
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(cubeGroup.children);
    if(!hits.length) return;
    const hit=hits[0];
    const fi=hit.face.materialIndex; // 0=R,1=L,2=U,3=D,4=F,5=B
    const faceNames=['R','L','U','D','F','B'];
    const faceName=faceNames[fi];
    const {x,y,z}=hit.object.userData;
    // Check if this sticker is paintable in current stage
    if(!isStickerVisible(pStage,faceName,x,y,z)) return;
    // Check color restriction
    if(!isColorAllowed(pStage,faceName,selectedColor)) return;
    const idx=getStickerIndex(faceName,x,y,z);
    // Toggle: if already painted with selected color, remove; else paint
    const current=cubeState[faceName][idx];
    const defaultColor=FACE_COLORS[faceName];
    if(current===selectedColor && selectedColor!==defaultColor){
      cubeState[faceName][idx]=defaultColor;
    } else {
      cubeState[faceName][idx]=selectedColor;
    }
    buildMesh(); renderNet(); checkMismatch();
  }

  canvas.addEventListener('touchend',e=>{
    if(!dragMoved) handleTap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
  });
  canvas.addEventListener('click',e=>{ if(!dragMoved) handleTap(e.clientX,e.clientY); });
}

function isColorAllowed(stage,face,color){
  if(stage==='cross') return color==='#ffffff';
  if(stage==='oll') return color==='#ffd700';
  return true;
}

// ═══════════════════════════════════════════════════════
//  COLOR PALETTE
// ═══════════════════════════════════════════════════════
const STAGE_COLORS={
  cross:[{c:'#ffffff',l:'White'}],
  f2l:[{c:'#ffffff',l:'W'},{c:'#00c853',l:'G'},{c:'#ff6d00',l:'O'},{c:'#2979ff',l:'B'},{c:'#f44336',l:'R'},{c:'#ffd700',l:'Y'}],
  oll:[{c:'#ffd700',l:'Yellow'}],
  pll:[{c:'#ffd700',l:'Y'},{c:'#00c853',l:'G'},{c:'#ff6d00',l:'O'},{c:'#2979ff',l:'B'},{c:'#f44336',l:'R'},{c:'#ffffff',l:'W'}]
};
const STAGE_RESTRICT={cross:'White only',f2l:'All colors',oll:'Yellow only',pll:'All colors'};

function setupPalette(){
  const colors=STAGE_COLORS[pStage];
  selectedColor=colors[0].c;
  document.getElementById('paint-restrict').textContent='— '+STAGE_RESTRICT[pStage];
  document.getElementById('cpalette').innerHTML=
    colors.map(c=>`<div class="cswatch${c.c===selectedColor?' sel':''}" style="background:${c.c}" onclick="selColor('${c.c}')" title="${c.l}"></div>`).join('');
}
function selColor(c){
  selectedColor=c;
  document.querySelectorAll('.cswatch').forEach(s=>{
    // Compare by computed style
    const bg=s.style.background||s.style.backgroundColor;
    s.classList.toggle('sel',s.getAttribute('onclick')===`selColor('${c}')`);
  });
}

// ═══════════════════════════════════════════════════════
//  2D NET RENDER
// ═══════════════════════════════════════════════════════
// Layout:    U
//          L F R B
//            D
const NET_LAYOUT=[
  {face:'U',row:0,col:1},
  {face:'L',row:1,col:0},{face:'F',row:1,col:1},{face:'R',row:1,col:2},{face:'B',row:1,col:3},
  {face:'D',row:2,col:1}
];

function renderNet(){
  const net=document.getElementById('cube-net');
  const cellSize=16, gap=2, faceSize=cellSize*3+gap*2;
  const cols=4,rows=3;
  const totalW=cols*(faceSize+gap)-gap, totalH=rows*(faceSize+gap)-gap;
  let html=`<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`;
  // Background
  html+=`<rect width="${totalW}" height="${totalH}" fill="transparent"/>`;
  for(const {face,row,col} of NET_LAYOUT){
    const ox=col*(faceSize+gap), oy=row*(faceSize+gap);
    for(let i=0;i<9;i++){
      const r=Math.floor(i/3),c=i%3;
      const x=ox+c*(cellSize+gap), y=oy+r*(cellSize+gap);
      const color=cubeState?cubeState[face][i]:(FACE_COLORS[face]);
      const isVisible=cubeState&&isStickerVisible(pStage,face,
        c-1, // approximate x
        face==='U'?1:face==='D'?-1:1-r,
        face==='F'||face==='B'?0:1-c
      );
      const fill=isVisible?color:'#1a1a1a';
      html+=`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" rx="1"/>`;
    }
    // Face label
    html+=`<text x="${ox+faceSize/2}" y="${oy-3}" fill="#444" font-size="8" text-anchor="middle" font-family="Rajdhani">${face}</text>`;
  }
  html+='</svg>';
  net.innerHTML=html;
}

// ═══════════════════════════════════════════════════════
//  MISMATCH DETECTION
// ═══════════════════════════════════════════════════════
function checkMismatch(){
  if(!cubeState){document.getElementById('mismatch-warn').classList.remove('show');return;}
  const warn=document.getElementById('mismatch-warn');
  // Count each color
  const counts={};
  const allColors=Object.values(FACE_COLORS);
  for(const f of ['U','D','F','B','R','L']){
    for(const c of cubeState[f]){
      counts[c]=(counts[c]||0)+1;
    }
  }
  // Each color should appear exactly 9 times
  let bad=false;
  for(const c of allColors){
    if((counts[c]||0)>9){bad=true;break;}
  }
  warn.classList.toggle('show',bad);
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE BUTTON LOGIC
// ═══════════════════════════════════════════════════════
function handleScrambleBtn(){
  if(isAnimating) return;
  const btn=document.getElementById('scramble-btn');
  const input=document.getElementById('pscramble-input');

  if(!scrambleGenerated){
    // First tap: generate moves
    let s='';
    if(pStage==='cross') s=genCrossScramble();
    else if(pStage==='f2l') s=genF2LScramble();
    else if(pStage==='oll') s=genOLLScramble();
    else s=genPLLScramble();
    currentScrambleStr=s;
    input.value=s;
    scrambleGenerated=true;
    btn.textContent='Apply';
    showToast('Tap Apply to scramble');
  } else {
    // Second tap: animate scramble
    scrambleGenerated=false;
    scrambleApplied=true;
    btn.textContent='Scramble';
    applyStageDefaults(pStage);
    // Apply scramble to state
    cubeState=applyMoves(cubeState,currentScrambleStr);
    // Animate
    animateMoves(currentScrambleStr,()=>{
      buildMesh(); renderNet(); checkMismatch();
      currentSolution=invertMoves(currentScrambleStr);
      showSolutionMoves(currentSolution);
    });
  }
}

function resetPCube(){
  if(isAnimating) return;
  scrambleGenerated=false; scrambleApplied=false;
  document.getElementById('pscramble-input').value='';
  document.getElementById('scramble-btn').textContent='Scramble';
  document.getElementById('solution-panel').classList.remove('show');
  document.getElementById('mismatch-warn').classList.remove('show');
  currentScrambleStr=''; currentSolution='';
  applyStageDefaults(pStage);
  buildMesh(); renderNet();
}

function setPStage(stage){
  pStage=stage;
  document.querySelectorAll('.ptab').forEach((t,i)=>t.classList.toggle('active',['cross','f2l','oll','pll'][i]===stage));
  document.getElementById('stage-title').textContent=STAGE_INFO[stage].title;
  document.getElementById('stage-desc').textContent=STAGE_INFO[stage].desc;
  resetPCube();
  if(pSceneInit){ setupPalette(); }
}

// ═══════════════════════════════════════════════════════
//  SOLUTION
// ═══════════════════════════════════════════════════════
function handleSolutionBtn(){
  if(isAnimating) return;
  if(!currentSolution){
    // Generate a solution from current state
    const sol=computeSolution();
    if(!sol){showToast('Scramble first!');return;}
    currentSolution=sol;
  }
  showSolutionMoves(currentSolution);
  animateMoves(currentSolution,()=>{
    // Reset to default after solving
    setTimeout(()=>{
      applyStageDefaults(pStage); buildMesh(); renderNet();
      currentSolution=''; currentScrambleStr='';
      document.getElementById('solution-panel').classList.remove('show');
    },800);
  });
}

function computeSolution(){
  // The solution is the inverse of the scramble
  if(currentScrambleStr) return invertMoves(currentScrambleStr);
  return null;
}

function showSolutionMoves(movesStr){
  const panel=document.getElementById('solution-panel');
  const disp=document.getElementById('sol-moves-display');
  panel.classList.add('show');
  const moves=movesStr.trim().split(/\s+/);
  disp.innerHTML=moves.map((m,i)=>`<span class="sol-move-item" id="smove-${i}">${m}</span>`).join(' ');
}

// ═══════════════════════════════════════════════════════
//  MOVE ANIMATION ENGINE
// ═══════════════════════════════════════════════════════
function animateMoves(movesStr,onDone){
  if(isAnimating) return;
  isAnimating=true;
  const moves=movesStr.trim().split(/\s+/).filter(m=>m);
  let idx=0;

  function doNext(){
    if(idx>=moves.length){
      isAnimating=false;
      document.getElementById('move-overlay').classList.remove('show');
      document.getElementById('move-overlay').textContent='';
      // Highlight all done
      document.querySelectorAll('.sol-move-item').forEach(el=>el.classList.add('done'));
      if(onDone) onDone();
      return;
    }
    const move=moves[idx];
    // Highlight current move
    document.querySelectorAll('.sol-move-item').forEach((el,i)=>{
      el.classList.remove('current');
      el.classList.toggle('done',i<idx);
      if(i===idx) el.classList.add('current');
    });
    // Show move overlay
    const overlay=document.getElementById('move-overlay');
    overlay.textContent=move; overlay.classList.add('show');

    animateSingleMove(move,()=>{
      idx++;
      setTimeout(doNext,80);
    });
  }
  doNext();
}

function animateSingleMove(move,onDone){
  const base=move.replace("'","").replace("2","");
  const prime=move.includes("'");
  const double=move.includes("2");
  const times=double?2:1;
  let t=0;

  function doOnce(cb){
    // Find cubies that belong to this layer
    const axis=getAxis(base);
    const val=getVal(base);
    const angle=(prime?1:-1)*Math.PI/2;
    const duration=180;
    const start=Date.now();
    const moving=[];
    for(const c of cubeGroup.children){
      const pos=c.position;
      const cv=axis==='x'?pos.x:axis==='y'?pos.y:pos.z;
      if(Math.round(cv)===val) moving.push({mesh:c,origPos:c.position.clone(),origQ:c.quaternion.clone()});
    }
    const axisVec=axis==='x'?new THREE.Vector3(1,0,0):axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
    const pivot=new THREE.Object3D(); scene.add(pivot);
    for(const {mesh} of moving){cubeGroup.remove(mesh);pivot.add(mesh);}

    function step(){
      const elapsed=Date.now()-start;
      const progress=Math.min(elapsed/duration,1);
      const eased=progress<0.5?2*progress*progress:(1-Math.pow(-2*progress+2,2)/2);
      pivot.rotation[axis]=angle*eased;
      if(progress<1){requestAnimationFrame(step);}
      else{
        pivot.rotation[axis]=angle;
        for(const {mesh} of moving){
          mesh.updateMatrixWorld();
          const world=new THREE.Vector3(); mesh.getWorldPosition(world);
          pivot.remove(mesh); cubeGroup.add(mesh);
          mesh.position.copy(world.sub(cubeGroup.position));
          mesh.position.x=Math.round(mesh.position.x);
          mesh.position.y=Math.round(mesh.position.y);
          mesh.position.z=Math.round(mesh.position.z);
          const q=new THREE.Quaternion(); mesh.getWorldQuaternion(q);
          const pq=new THREE.Quaternion(); cubeGroup.getWorldQuaternion(pq);
          mesh.quaternion.copy(pq.invert().multiply(q));
        }
        scene.remove(pivot);
        cb();
      }
    }
    requestAnimationFrame(step);
  }

  function run(){
    if(t>=times){
      // Now update logical state
      cubeState=applyMove(cubeState,move);
      onDone();
      return;
    }
    t++;
    doOnce(run);
  }
  run();
}

function getAxis(base){
  if(base==='R'||base==='L'||base==='M') return 'x';
  if(base==='U'||base==='D') return 'y';
  return 'z';
}
function getVal(base){
  if(base==='R') return 1;
  if(base==='L'||base==='M') return -1;
  if(base==='U') return 1;
  if(base==='D') return -1;
  if(base==='F') return 1;
  if(base==='B') return -1;
  return 0;
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function saveS(k,v){settings[k]=v;localStorage.setItem('cubeai_settings',JSON.stringify(settings));}
function toggleS(k){settings[k]=!settings[k];document.getElementById('tog-'+k).classList.toggle('on',settings[k]);localStorage.setItem('cubeai_settings',JSON.stringify(settings));}
function loadSettings(){
  document.getElementById('tog-inspection').classList.toggle('on',settings.inspection);
  document.getElementById('tog-autoscramble').classList.toggle('on',settings.autoscramble);
  document.getElementById('sel-hold').value=settings.holdDuration;
  document.getElementById('sel-slen').value=settings.scrambleLength;
}

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
let toastT;
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1800);}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
genScramble(); updateStats(); loadSettings();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});