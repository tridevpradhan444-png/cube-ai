// ═══════════════════════════════════════════════════════
//  DATA & SETTINGS
// ═══════════════════════════════════════════════════════
let solves = JSON.parse(localStorage.getItem('cubeai_solves')||'[]');
let settings = Object.assign({inspection:false,autoscramble:true,holdDuration:500,scrambleLength:20},
  JSON.parse(localStorage.getItem('cubeai_settings')||'{}'));

const FACE_COLORS = {U:'#ffd700',D:'#ffffff',F:'#00c853',B:'#2979ff',R:'#ff6d00',L:'#f44336'};
const STAGE_INFO = {
  cross:{title:'CROSS',desc:'Only the 4 white edges are scrambled. Paint white on D face, side color on edge sides.'},
  f2l:{title:'F2L — FIRST TWO LAYERS',desc:'Cross locked solved. Scramble or paint the 4 corner-edge pairs.'},
  oll:{title:'OLL — ORIENT LAST LAYER',desc:'F2L locked. All OLL cases possible on top face.'},
  pll:{title:'PLL — PERMUTE LAST LAYER',desc:'F2L locked, yellow top locked. All 21 PLL cases possible.'}
};

// Animation speed ms per move — default Normal = 600ms
let animSpeed = 600;

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
  holdTimeout=setTimeout(()=>{
    if(isHolding){isArmed=true;document.getElementById('timer-display').classList.remove('holding');document.getElementById('timer-display').classList.add('ready');}
  },settings.holdDuration);
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
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&document.getElementById('screen-timer').classList.contains('active')){
    e.preventDefault();
    if(timerRunning){stopTimer();return;}
    if(!isHolding)onHoldStart(e);
  }
});
document.addEventListener('keyup',e=>{ if(e.code==='Space')onHoldEnd(e); });

function startInsp(){
  inspTime=15; const d=document.getElementById('inspection-display');
  d.style.display='block'; d.textContent=15;
  inspInterval=setInterval(()=>{
    inspTime--; d.textContent=inspTime>0?inspTime:'GO';
    if(inspTime<=0){clearInterval(inspInterval);d.style.display='none';startTimer();}
  },1000);
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
  const s=genScrambleStr();
  document.getElementById('scramble-text').textContent=s;
  return s;
}
function genCrossScramble(){
  const moves=['F2','B2','R2','L2','U',"U'","U2",'D',"D'","D2"];
  let s=[],last='';
  for(let i=0;i<10;i++){
    let m; do{m=moves[Math.floor(Math.random()*moves.length)];}while(m[0]===last[0]);
    s.push(m); last=m;
  }
  return s.join(' ');
}
function genF2LScramble(){
  const moves=['R',"R'","R2",'L',"L'","L2",'U',"U'","U2",'F',"F'","B","B'"];
  let s=[],last='';
  for(let i=0;i<12;i++){
    let m; do{m=moves[Math.floor(Math.random()*moves.length)];}while(m[0]===last[0]);
    s.push(m); last=m;
  }
  return s.join(' ');
}
function genOLLScramble(){
  const cases=["R U R' U' R' F R F'","F R U R' U' F'","f R U R' U' f'",
    "R U R' U R U2 R'","R U2 R' U' R U' R'","r U R' U R U2 r'",
    "R U2 R2 U' R2 U' R2 U2 R","R' U' R U' R' U R U' R' U2 R"];
  return cases[Math.floor(Math.random()*cases.length)];
}
function genPLLScramble(){
  const cases=["R U R' U' R' F R2 U' R' U' R U R' F'",
    "R U R' F' R U R' U' R' F R2 U' R'",
    "R U' R U R U R U' R' U' R2",
    "R2 U R U R' U' R' U' R' U R'",
    "M2 U M2 U2 M2 U M2","M2 U M2 U M' U2 M2 U2 M'",
    "R' F R' B2 R F' R' B2 R2"];
  return cases[Math.floor(Math.random()*cases.length)];
}

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory(){
  const list=document.getElementById('history-list');
  if(!solves.length){
    list.innerHTML='<div class="history-empty"><div style="font-size:48px;opacity:0.3;">⏱</div><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;">No solves yet</div></div>';
    return;
  }
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
function cloneState(s){ const c={}; for(const f of Object.keys(s)) c[f]=[...s[f]]; return c; }

function rotateFaceCW(s,f){
  const o=[...s[f]];
  s[f][0]=o[6];s[f][1]=o[3];s[f][2]=o[0];
  s[f][3]=o[7];s[f][4]=o[4];s[f][5]=o[1];
  s[f][6]=o[8];s[f][7]=o[5];s[f][8]=o[2];
}

function applyMoveCW(s,base){
  if(base==='U'){
    rotateFaceCW(s,'U');
    const t=[s.F[0],s.F[1],s.F[2]];
    s.F[0]=s.R[0];s.F[1]=s.R[1];s.F[2]=s.R[2];
    s.R[0]=s.B[0];s.R[1]=s.B[1];s.R[2]=s.B[2];
    s.B[0]=s.L[0];s.B[1]=s.L[1];s.B[2]=s.L[2];
    s.L[0]=t[0];s.L[1]=t[1];s.L[2]=t[2];
  } else if(base==='D'){
    rotateFaceCW(s,'D');
    const t=[s.F[6],s.F[7],s.F[8]];
    s.F[6]=s.L[6];s.F[7]=s.L[7];s.F[8]=s.L[8];
    s.L[6]=s.B[6];s.L[7]=s.B[7];s.L[8]=s.B[8];
    s.B[6]=s.R[6];s.B[7]=s.R[7];s.B[8]=s.R[8];
    s.R[6]=t[0];s.R[7]=t[1];s.R[8]=t[2];
  } else if(base==='R'){
    rotateFaceCW(s,'R');
    const t=[s.U[2],s.U[5],s.U[8]];
    s.U[2]=s.F[2];s.U[5]=s.F[5];s.U[8]=s.F[8];
    s.F[2]=s.D[2];s.F[5]=s.D[5];s.F[8]=s.D[8];
    s.D[2]=s.B[6];s.D[5]=s.B[3];s.D[8]=s.B[0];
    s.B[6]=t[0];s.B[3]=t[1];s.B[0]=t[2];
  } else if(base==='L'){
    rotateFaceCW(s,'L');
    const t=[s.U[0],s.U[3],s.U[6]];
    s.U[0]=s.B[8];s.U[3]=s.B[5];s.U[6]=s.B[2];
    s.B[8]=s.D[0];s.B[5]=s.D[3];s.B[2]=s.D[6];
    s.D[0]=s.F[0];s.D[3]=s.F[3];s.D[6]=s.F[6];
    s.F[0]=t[0];s.F[3]=t[1];s.F[6]=t[2];
  } else if(base==='F'){
    rotateFaceCW(s,'F');
    const t=[s.U[6],s.U[7],s.U[8]];
    s.U[6]=s.L[8];s.U[7]=s.L[5];s.U[8]=s.L[2];
    s.L[2]=s.D[0];s.L[5]=s.D[1];s.L[8]=s.D[2];
    s.D[0]=s.R[6];s.D[1]=s.R[3];s.D[2]=s.R[0];
    s.R[0]=t[2];s.R[3]=t[1];s.R[6]=t[0];
  } else if(base==='B'){
    rotateFaceCW(s,'B');
    const t=[s.U[0],s.U[1],s.U[2]];
    s.U[0]=s.R[2];s.U[1]=s.R[5];s.U[2]=s.R[8];
    s.R[2]=s.D[8];s.R[5]=s.D[7];s.R[8]=s.D[6];
    s.D[6]=s.L[0];s.D[7]=s.L[3];s.D[8]=s.L[6];
    s.L[0]=t[2];s.L[3]=t[1];s.L[6]=t[0];
  } else if(base==='M'){
    const t=[s.U[1],s.U[4],s.U[7]];
    s.U[1]=s.B[7];s.U[4]=s.B[4];s.U[7]=s.B[1];
    s.B[7]=s.D[1];s.B[4]=s.D[4];s.B[1]=s.D[7];
    s.D[1]=s.F[1];s.D[4]=s.F[4];s.D[7]=s.F[7];
    s.F[1]=t[0];s.F[4]=t[1];s.F[7]=t[2];
  }
}

function applyMove(state,move){
  const s=cloneState(state);
  const base=move.replace(/['\d]/g,'');
  const prime=move.includes("'");
  const double=move.includes("2");
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
function invertMoves(movesStr){
  if(!movesStr||!movesStr.trim()) return '';
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
let scrambleGenerated=false;
let currentScrambleStr='';
let currentSolution='';
let selectedColor='#ffffff';
let isAnimating=false;
let pSceneInit=false;
let scene,camera,renderer,cubeGroup;
let isDragging=false,prevMouse={x:0,y:0},dragMoved=false;
let touchStartPos={x:0,y:0};
const DRAG_SPEED=0.007;

function initPScene(){
  if(pSceneInit) return; pSceneInit=true;
  const container=document.getElementById('cube-wrap');
  const canvas=document.getElementById('practice-canvas');
  const w=container.clientWidth,h=container.clientHeight;
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x080808);
  camera=new THREE.PerspectiveCamera(42,w/h,0.1,100);
  camera.position.set(4.5,4,5.5); camera.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  scene.add(new THREE.AmbientLight(0xffffff,0.65));
  const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(6,10,6); scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,0.25); dl2.position.set(-4,-2,-4); scene.add(dl2);
  cubeGroup=new THREE.Group(); scene.add(cubeGroup);
  initCubeState(); applyStageDefaults(pStage); buildMesh();
  resetCubeAngle();
  setupDrag(); setupCanvasTap();
  requestAnimationFrame(function loop(){requestAnimationFrame(loop);renderer.render(scene,camera);});
  window.addEventListener('resize',()=>{
    const w2=container.clientWidth,h2=container.clientHeight;
    camera.aspect=w2/h2; camera.updateProjectionMatrix(); renderer.setSize(w2,h2);
  });
  setupPalette(); renderNet();
}

function resetCubeAngle(){
  if(!cubeGroup) return;
  const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-0.6);
  const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),0.4);
  cubeGroup.quaternion.copy(qY).multiply(qX);
}

function rotateCube90(){
  if(isAnimating||!cubeGroup) return;
  // Smoothly rotate 90° around Y axis
  const startQ=cubeGroup.quaternion.clone();
  const deltaQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
  const endQ=startQ.clone().multiply(deltaQ);
  const duration=400,start=Date.now();
  function step(){
    const p=Math.min((Date.now()-start)/duration,1);
    const e=p<0.5?2*p*p:(1-Math.pow(-2*p+2,2)/2);
    cubeGroup.quaternion.slerpQuaternions(startQ,endQ,e);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════
//  MESH BUILDING
// ═══════════════════════════════════════════════════════
const FACE_MAP=[
  {face:'R',axis:'x',val:1},{face:'L',axis:'x',val:-1},
  {face:'U',axis:'y',val:1},{face:'D',axis:'y',val:-1},
  {face:'F',axis:'z',val:1},{face:'B',axis:'z',val:-1}
];

function buildMesh(){
  if(!cubeGroup) return;
  while(cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);
  const gap=0.06;
  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
    const geo=new THREE.BoxGeometry(1-gap,1-gap,1-gap);
    const mats=FACE_MAP.map(fm=>{
      const cv=fm.axis==='x'?x:fm.axis==='y'?y:z;
      if(cv!==fm.val) return new THREE.MeshLambertMaterial({color:0x0a0a0a});
      const visible=isStickerVisible(pStage,fm.face,x,y,z);
      const col=visible?parseInt(getStickerColor(fm.face,x,y,z).replace('#',''),16):0x1c1c1c;
      return new THREE.MeshLambertMaterial({color:col});
    });
    const mesh=new THREE.Mesh(geo,mats);
    mesh.position.set(x,y,z); mesh.userData={x,y,z};
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
  const idx=Math.max(0,Math.min(8,row*3+col));
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
  return Math.max(0,Math.min(8,row*3+col));
}

function isCornerPiece(x,y,z){ return Math.abs(x)===1&&Math.abs(y)===1&&Math.abs(z)===1; }
function isEdgePiece(x,y,z){ return (Math.abs(x)+Math.abs(y)+Math.abs(z))===2; }
function isCenterPiece(x,y,z){ return (Math.abs(x)+Math.abs(y)+Math.abs(z))===1; }

function isStickerVisible(stage,face,x,y,z){
  if(stage==='cross'){
    // ONLY show: D face edges (not corners), all 6 centers
    if(isCenterPiece(x,y,z)) return true;
    // D face: only edge pieces (no corners)
    if(face==='D' && y===-1 && isEdgePiece(x,y,z)) return true;
    // Side stickers of cross edges at y=-1
    if(y===-1 && isEdgePiece(x,y,z)){
      if(face==='F'&&x===0) return true;
      if(face==='B'&&x===0) return true;
      if(face==='R'&&z===0) return true;
      if(face==='L'&&z===0) return true;
    }
    return false;
  }
  if(stage==='f2l'){
    if(y<1) return true;
    if(isCenterPiece(x,y,z)) return true;
    return false;
  }
  if(stage==='oll'){
    if(face==='U') return true;
    if(y===1) return true;
    if(isCenterPiece(x,y,z)) return true;
    return false;
  }
  if(stage==='pll'){
    if(y===1) return true;
    if(isCenterPiece(x,y,z)) return true;
    return false;
  }
  return true;
}

function isPaintable(stage,face,x,y,z){
  if(stage==='cross'){
    // Only 4 edge pieces: D face sticker + side sticker
    if(!isEdgePiece(x,y,z)) return false;
    if(y!==-1) return false;
    if(face==='D') return true;
    if(face==='F'&&x===0) return true;
    if(face==='B'&&x===0) return true;
    if(face==='R'&&z===0) return true;
    if(face==='L'&&z===0) return true;
    return false;
  }
  if(stage==='f2l'){
    if(isCenterPiece(x,y,z)) return false;
    if(y<1) return true;
    return false;
  }
  if(stage==='oll'){
    return face==='U';
  }
  if(stage==='pll'){
    return y===1;
  }
  return true;
}

function isColorAllowedForStage(stage,face,color){
  if(stage==='cross'){
    if(face==='D') return color==='#ffffff';
    return color!=='#ffffff'; // side of edge = any non-white
  }
  if(stage==='oll') return color==='#ffd700';
  return true;
}

function applyStageDefaults(stage){
  initCubeState();
  if(stage==='pll') cubeState['U']=Array(9).fill(FACE_COLORS.U);
}

// ═══════════════════════════════════════════════════════
//  DRAG — world space, no inversion
// ═══════════════════════════════════════════════════════
function setupDrag(){
  const canvas=document.getElementById('practice-canvas');
  canvas.addEventListener('touchstart',e=>{
    isDragging=true; dragMoved=false;
    touchStartPos={x:e.touches[0].clientX,y:e.touches[0].clientY};
    prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  canvas.addEventListener('touchmove',e=>{
    if(!isDragging||isAnimating) return;
    const dx=e.touches[0].clientX-prevMouse.x,dy=e.touches[0].clientY-prevMouse.y;
    const dist=Math.sqrt(Math.pow(e.touches[0].clientX-touchStartPos.x,2)+Math.pow(e.touches[0].clientY-touchStartPos.y,2));
    if(dist>8) dragMoved=true;
    if(!dragMoved) return;
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*DRAG_SPEED);
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*DRAG_SPEED);
    cubeGroup.quaternion.premultiply(qY).premultiply(qX);
    prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  canvas.addEventListener('touchend',e=>{
    const dist=Math.sqrt(Math.pow(e.changedTouches[0].clientX-touchStartPos.x,2)+Math.pow(e.changedTouches[0].clientY-touchStartPos.y,2));
    if(dist<8) handleTap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
    isDragging=false; dragMoved=false;
  });
  canvas.addEventListener('mousedown',e=>{isDragging=true;dragMoved=false;prevMouse={x:e.clientX,y:e.clientY};touchStartPos={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('mousemove',e=>{
    if(!isDragging||isAnimating) return;
    dragMoved=true;
    const dx=e.clientX-prevMouse.x,dy=e.clientY-prevMouse.y;
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*DRAG_SPEED);
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*DRAG_SPEED);
    cubeGroup.quaternion.premultiply(qY).premultiply(qX);
    prevMouse={x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('mouseup',e=>{
    const dist=Math.sqrt(Math.pow(e.clientX-touchStartPos.x,2)+Math.pow(e.clientY-touchStartPos.y,2));
    if(dist<5) handleTap(e.clientX,e.clientY);
    isDragging=false; dragMoved=false;
  });
}

// ═══════════════════════════════════════════════════════
//  TAP TO PAINT — separate from drag
// ═══════════════════════════════════════════════════════
function setupCanvasTap(){
  // Handled inside setupDrag touchend/mouseup now
}

function handleTap(clientX,clientY){
  if(isAnimating) return;
  const canvas=document.getElementById('practice-canvas');
  const raycaster=new THREE.Raycaster();
  const rect=canvas.getBoundingClientRect();
  const mouse=new THREE.Vector2(
    ((clientX-rect.left)/rect.width)*2-1,
    -((clientY-rect.top)/rect.height)*2+1
  );
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(cubeGroup.children);
  if(!hits.length) return;
  const hit=hits[0];
  const fi=hit.face.materialIndex;
  const faceNames=['R','L','U','D','F','B'];
  const faceName=faceNames[fi];
  const {x,y,z}=hit.object.userData;
  if(!isPaintable(pStage,faceName,x,y,z)){
    showToast('Not paintable here');
    return;
  }
  if(!isColorAllowedForStage(pStage,faceName,selectedColor)){
    showToast('Wrong color for this face');
    return;
  }
  const idx=getStickerIndex(faceName,x,y,z);
  const current=cubeState[faceName][idx];
  // Toggle
  if(current===selectedColor){
    cubeState[faceName][idx]=FACE_COLORS[faceName];
  } else {
    cubeState[faceName][idx]=selectedColor;
  }
  buildMesh(); renderNet(); checkMismatch();
  // Painting = manual scramble
  currentScrambleStr='';
  currentSolution='';
  document.getElementById('solution-panel').classList.remove('show');
}

// ═══════════════════════════════════════════════════════
//  COLOR PALETTE
// ═══════════════════════════════════════════════════════
const STAGE_COLORS={
  cross:[{c:'#ffffff',l:'White (D)'},{c:'#00c853',l:'Green'},{c:'#ff6d00',l:'Orange'},{c:'#2979ff',l:'Blue'},{c:'#f44336',l:'Red'}],
  f2l:[{c:'#ffffff',l:'W'},{c:'#ffd700',l:'Y'},{c:'#00c853',l:'G'},{c:'#ff6d00',l:'O'},{c:'#2979ff',l:'B'},{c:'#f44336',l:'R'}],
  oll:[{c:'#ffd700',l:'Yellow'}],
  pll:[{c:'#ffd700',l:'Y'},{c:'#00c853',l:'G'},{c:'#ff6d00',l:'O'},{c:'#2979ff',l:'B'},{c:'#f44336',l:'R'},{c:'#ffffff',l:'W'}]
};

function setupPalette(){
  const colors=STAGE_COLORS[pStage];
  selectedColor=colors[0].c;
  const hint={cross:'D face = white · Edge side = any color',f2l:'All colors',oll:'Yellow only',pll:'All colors'};
  document.getElementById('paint-restrict').textContent='— '+hint[pStage];
  document.getElementById('cpalette').innerHTML=
    colors.map(c=>`<div class="cswatch${c.c===selectedColor?' sel':''}" style="background:${c.c}" onclick="selColor('${c.c}')" title="${c.l}"></div>`).join('');
}
function selColor(c){
  selectedColor=c;
  document.querySelectorAll('.cswatch').forEach(s=>{
    s.classList.toggle('sel',s.getAttribute('onclick')===`selColor('${c}')`);
  });
}

// ═══════════════════════════════════════════════════════
//  2D NET — Fixed mapping
// ═══════════════════════════════════════════════════════
function renderNet(){
  const net=document.getElementById('cube-net');
  if(!net||!cubeState) return;
  const cs=16,gap=2,fs=cs*3+gap*2;
  const tw=4*(fs+gap)-gap, th=3*(fs+gap)-gap;
  // Layout: U at row0col1, L/F/R/B at row1, D at row2col1
  const layout=[
    {face:'U',ro:0,co:1},{face:'L',ro:1,co:0},{face:'F',ro:1,co:1},
    {face:'R',ro:1,co:2},{face:'B',ro:1,co:3},{face:'D',ro:2,co:1}
  ];
  let html=`<svg width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">`;
  for(const {face,ro,co} of layout){
    const ox=co*(fs+gap), oy=ro*(fs+gap);
    for(let i=0;i<9;i++){
      const r=Math.floor(i/3),c=i%3;
      const sx=ox+c*(cs+gap), sy=oy+r*(cs+gap);
      const color=cubeState[face][i]||FACE_COLORS[face];
      // Simple visibility: use face default color if not visible in stage
      const show=isStickerVisibleByIndex(pStage,face,i);
      html+=`<rect x="${sx}" y="${sy}" width="${cs}" height="${cs}" fill="${show?color:'#1a1a1a'}" rx="1" stroke="#080808" stroke-width="0.5"/>`;
    }
    html+=`<text x="${ox+fs/2}" y="${oy-2}" fill="#444" font-size="8" text-anchor="middle" font-family="Rajdhani,sans-serif">${face}</text>`;
  }
  html+='</svg>';
  net.innerHTML=html;
}

// Simplified net visibility by face + sticker index
function isStickerVisibleByIndex(stage,face,idx){
  const isEdgeIdx=[1,3,5,7]; // center cross edge positions
  const isCenterIdx=4;
  if(stage==='cross'){
    if(isCenterIdx===idx) return true; // center
    if(face==='D' && isEdgeIdx.includes(idx)) return true;
    if(['F','B','R','L'].includes(face) && idx>=6) return true; // bottom row of side faces (edge stickers)
    return false;
  }
  if(stage==='f2l'){
    if(face==='U') return idx===4; // only U center
    return true;
  }
  if(stage==='oll'){
    if(face==='U') return true;
    if(['F','B','R','L'].includes(face) && idx<=2) return true; // top row
    return idx===4; // centers
  }
  if(stage==='pll'){
    if(face==='U') return true;
    if(['F','B','R','L'].includes(face) && idx<=2) return true;
    return idx===4;
  }
  return true;
}

// ═══════════════════════════════════════════════════════
//  MISMATCH DETECTION
// ═══════════════════════════════════════════════════════
function checkMismatch(){
  if(!cubeState){document.getElementById('mismatch-warn').classList.remove('show');return;}
  const counts={};
  for(const f of ['U','D','F','B','R','L']){
    for(const c of cubeState[f]){
      if(c) counts[c]=(counts[c]||0)+1;
    }
  }
  let bad=false;
  for(const n of Object.values(counts)){
    if(n>9){bad=true;break;}
  }
  document.getElementById('mismatch-warn').classList.toggle('show',bad);
}

// ═══════════════════════════════════════════════════════
//  SCRAMBLE BUTTON
// ═══════════════════════════════════════════════════════
function handleScrambleBtn(){
  if(isAnimating) return;
  const btn=document.getElementById('scramble-btn');
  const input=document.getElementById('pscramble-input');
  if(!scrambleGenerated){
    let s='';
    if(pStage==='cross') s=genCrossScramble();
    else if(pStage==='f2l') s=genF2LScramble();
    else if(pStage==='oll') s=genOLLScramble();
    else s=genPLLScramble();
    currentScrambleStr=s; input.value=s;
    scrambleGenerated=true; btn.textContent='Apply';
    showToast('Tap Apply to animate');
  } else {
    scrambleGenerated=false; btn.textContent='Scramble';
    applyStageDefaults(pStage);
    // Apply to logical state
    cubeState=applyMoves(cubeState,currentScrambleStr);
    // Animate visually
    animateMoves(currentScrambleStr,()=>{
      buildMesh(); renderNet(); checkMismatch();
      currentSolution=invertMoves(currentScrambleStr);
    });
  }
}

function resetPCube(){
  if(isAnimating) return;
  scrambleGenerated=false;
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
  if(pSceneInit) setupPalette();
}

// ═══════════════════════════════════════════════════════
//  SOLUTION
// ═══════════════════════════════════════════════════════
function handleSolutionBtn(){
  if(isAnimating) return;
  const sol=currentSolution||invertMoves(currentScrambleStr);
  if(!sol||!sol.trim()){showToast('Scramble first!');return;}
  showSolutionMoves(sol);
  const targetState=applyMoves(cubeState,sol);
  animateMoves(sol,()=>{
    cubeState=cloneState(targetState);
    buildMesh(); renderNet();
    currentSolution=''; currentScrambleStr='';
    setTimeout(()=>document.getElementById('solution-panel').classList.remove('show'),1200);
  });
}

function showSolutionMoves(movesStr){
  const panel=document.getElementById('solution-panel');
  const disp=document.getElementById('sol-moves-display');
  panel.classList.add('show');
  const moves=movesStr.trim().split(/\s+/);
  disp.innerHTML=moves.map((m,i)=>`<span class="sol-move-item" id="smove-${i}">${m}</span>`).join(' ');
}

// ═══════════════════════════════════════════════════════
//  ANIMATION ENGINE — current orientation
// ═══════════════════════════════════════════════════════
function animateMoves(movesStr,onDone){
  if(isAnimating){if(onDone)onDone();return;}
  isAnimating=true;
  const moves=movesStr.trim().split(/\s+/).filter(m=>m);
  let idx=0;
  function doNext(){
    if(idx>=moves.length){
      isAnimating=false;
      document.getElementById('move-overlay').classList.remove('show');
      document.querySelectorAll('.sol-move-item').forEach(el=>el.classList.add('done'));
      if(onDone) onDone();
      return;
    }
    const move=moves[idx];
    document.querySelectorAll('.sol-move-item').forEach((el,i)=>{
      el.classList.remove('current'); el.classList.toggle('done',i<idx);
      if(i===idx) el.classList.add('current');
    });
    const ov=document.getElementById('move-overlay');
    ov.textContent=move; ov.classList.add('show');
    animateSingleMove(move,()=>{ idx++; setTimeout(doNext,30); });
  }
  doNext();
}

function animateSingleMove(move,onDone){
  const base=move.replace(/['\d]/g,'');
  const prime=move.includes("'");
  const double=move.includes("2");
  const times=double?2:1;
  let t=0;
  function doOnce(cb){
    // Axis in cube LOCAL space
    const localAxis=getMoveAxis(base);
    const layerVal=getMoveLayerVal(base);
    const cwAngle=prime?Math.PI/2:-Math.PI/2;
    // Transform local axis to world space
    const worldAxis=localAxis.clone().applyQuaternion(cubeGroup.quaternion).normalize();
    // Find cubies in this layer by their LOCAL position dot with local axis
    const moving=[];
    for(const c of cubeGroup.children){
      const dot=c.position.dot(localAxis);
      if(Math.abs(Math.round(dot)-layerVal)<0.15) moving.push(c);
    }
    if(!moving.length){cb();return;}
    const pivot=new THREE.Object3D(); scene.add(pivot);
    // Save world transforms
    const worldData=moving.map(m=>{
      cubeGroup.updateMatrixWorld(true);
      const wp=new THREE.Vector3(); m.getWorldPosition(wp);
      const wq=new THREE.Quaternion(); m.getWorldQuaternion(wq);
      cubeGroup.remove(m);
      m.position.copy(wp); m.quaternion.copy(wq);
      pivot.add(m);
      return {wp,wq};
    });
    const duration=animSpeed,start=Date.now();
    function step(){
      const elapsed=Date.now()-start;
      const progress=Math.min(elapsed/duration,1);
      const eased=progress<0.5?2*progress*progress:(1-Math.pow(-2*progress+2,2)/2);
      pivot.quaternion.setFromAxisAngle(worldAxis,cwAngle*eased);
      if(progress<1){requestAnimationFrame(step);}
      else{
        pivot.quaternion.setFromAxisAngle(worldAxis,cwAngle);
        pivot.updateMatrixWorld(true);
        for(const m of moving){
          m.updateMatrixWorld(true);
          const wp=new THREE.Vector3(); m.getWorldPosition(wp);
          const wq=new THREE.Quaternion(); m.getWorldQuaternion(wq);
          pivot.remove(m); cubeGroup.add(m);
          cubeGroup.worldToLocal(wp); m.position.copy(wp);
          m.position.x=Math.round(m.position.x);
          m.position.y=Math.round(m.position.y);
          m.position.z=Math.round(m.position.z);
          const cq=new THREE.Quaternion(); cubeGroup.getWorldQuaternion(cq);
          m.quaternion.copy(cq.invert().multiply(wq));
        }
        scene.remove(pivot);
        cb();
      }
    }
    requestAnimationFrame(step);
  }
  function run(){ if(t>=times){onDone();return;} t++; doOnce(run); }
  run();
}

function getMoveAxis(base){
  if(base==='R'||base==='L'||base==='M') return new THREE.Vector3(1,0,0);
  if(base==='U'||base==='D') return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}
function getMoveLayerVal(base){
  if(base==='R') return 1; if(base==='L'||base==='M') return -1;
  if(base==='U') return 1; if(base==='D') return -1;
  if(base==='F') return 1; if(base==='B') return -1;
  return 0;
}

// ═══════════════════════════════════════════════════════
//  SPEED CONTROL
// ═══════════════════════════════════════════════════════
function setSpeed(speed){
  if(speed==='slow') animSpeed=900;
  else if(speed==='normal') animSpeed=600;
  else if(speed==='fast') animSpeed=300;
  document.querySelectorAll('.speed-btn').forEach(b=>{
    b.classList.toggle('active-speed',b.dataset.speed===speed);
  });
  showToast(speed.charAt(0).toUpperCase()+speed.slice(1));
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
function saveS(k,v){settings[k]=v;localStorage.setItem('cubeai_settings',JSON.stringify(settings));}
function toggleS(k){
  settings[k]=!settings[k];
  document.getElementById('tog-'+k).classList.toggle('on',settings[k]);
  localStorage.setItem('cubeai_settings',JSON.stringify(settings));
}
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
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>t.classList.remove('show'),1800);
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
genScramble(); updateStats(); loadSettings();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
JSEOF
