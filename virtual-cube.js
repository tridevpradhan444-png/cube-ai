// ═══════════════════════════════════════════════════════
//  VIRTUAL CUBE — Fixed version
//  Key fixes:
//  - Colors tracked by original slot (ox,oy,oz) not position
//  - No drag — cube fixed, only buttons move it
//  - Cube smaller (camera pulled back)
//  - All 6 face buttons + slices work
//  - X/Y/Z whole-cube rotation
//  - Double tap = smooth R2
//  - Notation records R2/U2 correctly
// ═══════════════════════════════════════════════════════

const VC_COLORS = {
  U:'#ffd700', D:'#ffffff', F:'#00c853',
  B:'#2979ff', R:'#ff6d00', L:'#f44336',
};

// ── CubeState: 6 faces × 9 stickers ─────────────────
class CubeState {
  constructor(){ this.reset(); }

  reset(){
    this.faces = {};
    for(const [f,c] of Object.entries(VC_COLORS))
      this.faces[f] = Array(9).fill(c);
  }

  clone(){
    const s = new CubeState();
    for(const f of Object.keys(this.faces)) s.faces[f]=[...this.faces[f]];
    return s;
  }

  rotateFaceCW(f){
    const o=[...this.faces[f]];
    this.faces[f]=[o[6],o[3],o[0],o[7],o[4],o[1],o[8],o[5],o[2]];
  }

  applyMove(move){
    const base=move.replace(/['\d]/g,'');
    const times=move.includes('2')?2:move.includes("'")?3:1;
    for(let i=0;i<times;i++) this._cw(base);
  }

  _cw(m){
    const f=this.faces;
    const cycle=(a0,i0,a1,i1,a2,i2,a3,i3)=>{
      const t=f[a0][i0];
      f[a0][i0]=f[a3][i3]; f[a3][i3]=f[a2][i2];
      f[a2][i2]=f[a1][i1]; f[a1][i1]=t;
    };
    if(m==='U'){
      this.rotateFaceCW('U');
      const t=[f.F[0],f.F[1],f.F[2]];
      [f.F[0],f.F[1],f.F[2]]=[f.R[0],f.R[1],f.R[2]];
      [f.R[0],f.R[1],f.R[2]]=[f.B[0],f.B[1],f.B[2]];
      [f.B[0],f.B[1],f.B[2]]=[f.L[0],f.L[1],f.L[2]];
      [f.L[0],f.L[1],f.L[2]]=t;
    } else if(m==='D'){
      this.rotateFaceCW('D');
      const t=[f.F[6],f.F[7],f.F[8]];
      [f.F[6],f.F[7],f.F[8]]=[f.L[6],f.L[7],f.L[8]];
      [f.L[6],f.L[7],f.L[8]]=[f.B[6],f.B[7],f.B[8]];
      [f.B[6],f.B[7],f.B[8]]=[f.R[6],f.R[7],f.R[8]];
      [f.R[6],f.R[7],f.R[8]]=t;
    } else if(m==='R'){
      this.rotateFaceCW('R');
      const t=[f.U[2],f.U[5],f.U[8]];
      [f.U[2],f.U[5],f.U[8]]=[f.F[2],f.F[5],f.F[8]];
      [f.F[2],f.F[5],f.F[8]]=[f.D[2],f.D[5],f.D[8]];
      [f.D[2],f.D[5],f.D[8]]=[f.B[6],f.B[3],f.B[0]];
      [f.B[6],f.B[3],f.B[0]]=t;
    } else if(m==='L'){
      this.rotateFaceCW('L');
      const t=[f.U[0],f.U[3],f.U[6]];
      [f.U[0],f.U[3],f.U[6]]=[f.B[8],f.B[5],f.B[2]];
      [f.B[8],f.B[5],f.B[2]]=[f.D[0],f.D[3],f.D[6]];
      [f.D[0],f.D[3],f.D[6]]=[f.F[0],f.F[3],f.F[6]];
      [f.F[0],f.F[3],f.F[6]]=t;
    } else if(m==='F'){
      this.rotateFaceCW('F');
      const t=[f.U[6],f.U[7],f.U[8]];
      [f.U[6],f.U[7],f.U[8]]=[f.L[8],f.L[5],f.L[2]];
      [f.L[2],f.L[5],f.L[8]]=[f.D[0],f.D[1],f.D[2]];
      [f.D[0],f.D[1],f.D[2]]=[f.R[6],f.R[3],f.R[0]];
      [f.R[0],f.R[3],f.R[6]]=t;
    } else if(m==='B'){
      this.rotateFaceCW('B');
      const t=[f.U[0],f.U[1],f.U[2]];
      [f.U[0],f.U[1],f.U[2]]=[f.R[2],f.R[5],f.R[8]];
      [f.R[2],f.R[5],f.R[8]]=[f.D[8],f.D[7],f.D[6]];
      [f.D[6],f.D[7],f.D[8]]=[f.L[0],f.L[3],f.L[6]];
      [f.L[0],f.L[3],f.L[6]]=t;
    } else if(m==='M'){
      // M follows L direction
      const t=[f.U[1],f.U[4],f.U[7]];
      [f.U[1],f.U[4],f.U[7]]=[f.B[7],f.B[4],f.B[1]];
      [f.B[7],f.B[4],f.B[1]]=[f.D[1],f.D[4],f.D[7]];
      [f.D[1],f.D[4],f.D[7]]=[f.F[1],f.F[4],f.F[7]];
      [f.F[1],f.F[4],f.F[7]]=t;
    } else if(m==='E'){
      // E follows D direction
      const t=[f.F[3],f.F[4],f.F[5]];
      [f.F[3],f.F[4],f.F[5]]=[f.L[3],f.L[4],f.L[5]];
      [f.L[3],f.L[4],f.L[5]]=[f.B[3],f.B[4],f.B[5]];
      [f.B[3],f.B[4],f.B[5]]=[f.R[3],f.R[4],f.R[5]];
      [f.R[3],f.R[4],f.R[5]]=t;
    } else if(m==='S'){
      // S follows F direction
      const t=[f.U[3],f.U[4],f.U[5]];
      [f.U[3],f.U[4],f.U[5]]=[f.L[7],f.L[4],f.L[1]];
      [f.L[1],f.L[4],f.L[7]]=[f.D[5],f.D[4],f.D[3]];
      [f.D[3],f.D[4],f.D[5]]=[f.R[1],f.R[4],f.R[7]];
      [f.R[1],f.R[4],f.R[7]]=t;
    } else if(m==='X'){
      // X = R + M' + L'
      this._cw('R');
      for(let i=0;i<3;i++) this._cw('M');
      for(let i=0;i<3;i++) this._cw('L');
    } else if(m==='Y'){
      // Y = U + E' + D'
      this._cw('U');
      for(let i=0;i<3;i++) this._cw('E');
      for(let i=0;i<3;i++) this._cw('D');
    } else if(m==='Z'){
      // Z = F + S + B'
      this._cw('F');
      this._cw('S');
      for(let i=0;i<3;i++) this._cw('B');
    }
  }

  isSolved(){
    return Object.values(this.faces).every(s=>s.every(c=>c===s[0]));
  }
}

// ── Cubie color map ───────────────────────────────────
// Maps original slot (ox,oy,oz) → which face materials to set
// Built once, used by updateColors
function buildColorMap(){
  const map = [];
  // Three.js BoxGeometry face order: +X=0(R), -X=1(L), +Y=2(U), -Y=3(D), +Z=4(F), -Z=5(B)
  // For each cubie, which sticker indices on each face
  const FACE_STICKER = {
    // U face (y=1): row=z+1(z-1→0,z0→1,z1→2), col=x+1
    U: (x,y,z) => y===1  ? { matIdx:2, sIdx:(z+1)*3+(x+1) } : null,
    D: (x,y,z) => y===-1 ? { matIdx:3, sIdx:(1-z)*3+(x+1) } : null,
    F: (x,y,z) => z===1  ? { matIdx:4, sIdx:(1-y)*3+(x+1) } : null,
    B: (x,y,z) => z===-1 ? { matIdx:5, sIdx:(1-y)*3+(1-x) } : null,
    R: (x,y,z) => x===1  ? { matIdx:0, sIdx:(1-y)*3+(1-z) } : null,
    L: (x,y,z) => x===-1 ? { matIdx:1, sIdx:(1-y)*3+(z+1) } : null,
  };

  for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
    const stickers = [];
    for(const [face, fn] of Object.entries(FACE_STICKER)){
      const r = fn(x,y,z);
      if(r) stickers.push({ face, matIdx:r.matIdx, sIdx:r.sIdx });
    }
    map.push({ ox:x, oy:y, oz:z, stickers });
  }
  return map;
}

const COLOR_MAP = buildColorMap();

// ── VirtualCube class ─────────────────────────────────
class VirtualCube {
  constructor(){
    this.container = document.getElementById('vc-canvas-container');
    this.canvas    = document.getElementById('vc-canvas');
    if(!this.container||!this.canvas){ console.error('VC: elements missing'); return; }

    this.cubeState  = new CubeState();
    this.history    = [];
    this.redoStack  = [];
    this.moveQueue  = [];
    this.isMoving   = false;

    this._lastTapMove = '';
    this._lastTapTime = 0;
    this._singleTimer = null;

    // Timer
    this.timerInterval = null;
    this.timerStart    = 0;
    this.isTiming      = false;

    // Fixed orientation — cube does NOT move by drag
    this.fixedTilt = -0.42; // radians, toward viewer

    this.settings = { advanced:false, vibration:false, blindfold:false };

    this._initThree();
    this._buildCube();
    this._applyFixedTilt();
    this._initButtons();
    this._renderLoop();
  }

  // ── Three.js ─────────────────────────────────────────
  _initThree(){
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight - 56;

    this.scene  = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);

    // Pull camera back so cube looks smaller
    this.camera = new THREE.PerspectiveCamera(38, w/h, 0.1, 100);
    this.camera.position.set(0, 0, 9);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(5, 8, 6); this.scene.add(dl);

    // rootGroup holds entire cube — fixed orientation
    this.rootGroup = new THREE.Group();
    this.cubeGroup = new THREE.Group();
    this.rootGroup.add(this.cubeGroup);
    this.scene.add(this.rootGroup);

    window.addEventListener('resize', ()=>{
      const nw=this.container.clientWidth, nh=this.container.clientHeight;
      if(nw>0&&nh>0){
        this.camera.aspect=nw/nh;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw,nh);
      }
    });
  }

  _applyFixedTilt(){
    // Tilt cube toward viewer + slight Y rotation to show 3 faces
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.fixedTilt);
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), 0.4);
    this.rootGroup.quaternion.copy(qY.multiply(qX));
  }

  // ── Build cubies ──────────────────────────────────────
  _buildCube(){
    while(this.cubeGroup.children.length) this.cubeGroup.remove(this.cubeGroup.children[0]);
    this.cubies = [];

    const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const FACE_MAP = ['R','L','U','D','F','B'];

    for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
      const mats = FACE_MAP.map((face, fi)=>{
        const isExt=(fi===0&&x===1)||(fi===1&&x===-1)||
                    (fi===2&&y===1)||(fi===3&&y===-1)||
                    (fi===4&&z===1)||(fi===5&&z===-1);
        return new THREE.MeshLambertMaterial({
          color: isExt ? parseInt(VC_COLORS[face].replace('#',''),16) : 0x0d0d0d
        });
      });
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x,y,z);
      mesh.userData = { ox:x, oy:y, oz:z };
      this.cubies.push(mesh);
      this.cubeGroup.add(mesh);
    }
  }

  // Update ALL cubie colors from cubeState
  // Uses original slot (ox,oy,oz) tracked in userData — never breaks during rotation
  _updateColors(){
    const faces = this.cubeState.faces;
    for(const entry of COLOR_MAP){
      const cubie = this.cubies.find(c=>
        c.userData.ox===entry.ox &&
        c.userData.oy===entry.oy &&
        c.userData.oz===entry.oz
      );
      if(!cubie) continue;
      for(const {face, matIdx, sIdx} of entry.stickers){
        const color = faces[face][sIdx];
        if(color) cubie.material[matIdx].color.setStyle(color);
      }
    }
  }

  // ── Button setup ──────────────────────────────────────
  _initButtons(){
    // Use event delegation on the container to catch all .vc-btn taps
    // This works even after DOM updates
    this.container.addEventListener('touchstart', e=>{
      const btn = e.target.closest('.vc-btn');
      if(btn){ e.preventDefault(); this._handleTap(btn.dataset.move); return; }
      const opt = e.target.closest('.vc-option');
      if(opt){ e.preventDefault(); this._selectOption(opt); }
    }, { passive:false });

    this.container.addEventListener('mousedown', e=>{
      const btn = e.target.closest('.vc-btn');
      if(btn){ e.preventDefault(); this._handleTap(btn.dataset.move); return; }
      const opt = e.target.closest('.vc-option');
      if(opt){ e.preventDefault(); this._selectOption(opt); }
    });

    // Icon buttons
    document.getElementById('vc-canvas-container')?.addEventListener('touchstart', e=>{
      const icon = e.target.closest('.vc-icon-btn');
      if(!icon) return;
      e.preventDefault();
      const action = icon.getAttribute('onclick');
      if(action) eval(action); // safe — these are our own onclick strings
    }, { passive:false });
  }

  _handleTap(move){
    if(!move) return;
    this._flashBtn(move);

    const now = Date.now();
    if(move===this._lastTapMove && now-this._lastTapTime < 320){
      clearTimeout(this._singleTimer);
      this._lastTapTime=0; this._lastTapMove='';
      this.applyMove(move+'2');
      return;
    }
    this._lastTapMove=move;
    this._lastTapTime=now;
    this._singleTimer = setTimeout(()=>{
      if(this._lastTapMove===move){
        this.applyMove(move);
        this._lastTapMove='';
      }
    }, 160);
  }

  _flashBtn(move){
    const btn = this.container.querySelector(`.vc-btn[data-move="${move}"]`);
    if(btn){ btn.classList.add('active'); setTimeout(()=>btn.classList.remove('active'),180); }
  }

  _selectOption(opt){
    const popup = document.getElementById('vc-popup');
    if(popup) popup.classList.remove('show');
    const move = opt.textContent.trim();
    if(move) this.applyMove(move);
  }

  // ── Apply move ────────────────────────────────────────
  applyMove(move, isUndo=false){
    if(this.isMoving){ this.moveQueue.push({move,isUndo}); return; }

    if(!isUndo && !this.isTiming && !['X','Y','Z'].includes(move[0])){
      this._startTimer();
    }

    if(this.settings.vibration && navigator.vibrate) navigator.vibrate(12);

    // Update logical state
    this.cubeState.applyMove(move);

    if(!isUndo){
      this.history.push(move);
      this.redoStack=[];
      this._updateHistory();
    }

    // Animate
    this._animate3D(move, ()=>{
      // After animation: sync colors from logical state
      // Re-snap cubie userData to new logical positions
      this._resnapCubies();
      this._updateColors();

      if(this.isTiming && !isUndo && this.cubeState.isSolved()){
        this._stopTimer();
        const td=document.getElementById('vc-timer-display');
        if(td) td.style.color='#00c853';
        if(typeof showToast==='function') showToast('Solved! '+(td?td.textContent:''));
      }

      if(this.moveQueue.length>0){
        const next=this.moveQueue.shift();
        this.applyMove(next.move, next.isUndo);
      }
    });
  }

  // After animation snaps cubies to integer positions,
  // we need to update userData.ox/oy/oz to track new logical positions
  _resnapCubies(){
    this.cubies.forEach(c=>{
      c.userData.ox = Math.round(c.position.x);
      c.userData.oy = Math.round(c.position.y);
      c.userData.oz = Math.round(c.position.z);
    });
  }

  // ── 3D animation ──────────────────────────────────────
  _animate3D(move, onDone){
    this.isMoving=true;
    const base  = move.replace(/['\d]/g,'');
    const prime = move.includes("'");
    const double= move.includes('2');
    const duration = (typeof animSpeed!=='undefined'?animSpeed:300);

    // X/Y/Z — rotate rootGroup (whole cube)
    if(['X','Y','Z'].includes(base)){
      const axis = base==='X'?new THREE.Vector3(1,0,0)
                 : base==='Y'?new THREE.Vector3(0,1,0)
                 :              new THREE.Vector3(0,0,1);
      const angle = prime?Math.PI/2 : double?Math.PI : -Math.PI/2;
      const startQ = this.rootGroup.quaternion.clone();
      const endQ   = new THREE.Quaternion().setFromAxisAngle(axis,angle).multiply(startQ);
      const start  = Date.now();
      const step=()=>{
        const p=Math.min((Date.now()-start)/duration,1);
        const e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
        this.rootGroup.quaternion.slerpQuaternions(startQ,endQ,e);
        if(p<1) requestAnimationFrame(step);
        else{ this.isMoving=false; onDone&&onDone(); }
      };
      requestAnimationFrame(step);
      return;
    }

    // Face/slice move — find cubies in this layer
    const axis     = this._getAxis(base);
    const layerVal = this._getLayer(base);
    const angle    = (prime?1:-1) * (double?Math.PI:Math.PI/2);

    const moving = this.cubeGroup.children.filter(c=>{
      const dot = c.position.dot(axis);
      return Math.abs(Math.round(dot)-layerVal)<0.5;
    });

    if(!moving.length){ this.isMoving=false; onDone&&onDone(); return; }

    const saved = moving.map(c=>({
      mesh:c,
      pos:c.position.clone(),
      quat:c.quaternion.clone()
    }));
    const rotQ  = new THREE.Quaternion().setFromAxisAngle(axis,angle);
    const start = Date.now();

    const step=()=>{
      const elapsed = Date.now()-start;
      const p = Math.min(elapsed/duration,1);
      const e = p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      const q = new THREE.Quaternion().slerp(rotQ,e);
      saved.forEach(({mesh,pos,quat})=>{
        mesh.position.copy(pos.clone().applyQuaternion(q));
        mesh.quaternion.copy(q.clone().multiply(quat));
      });
      if(p<1){
        requestAnimationFrame(step);
      } else {
        // Snap to grid
        saved.forEach(({mesh,pos,quat})=>{
          const fp=pos.clone().applyQuaternion(rotQ);
          mesh.position.set(Math.round(fp.x),Math.round(fp.y),Math.round(fp.z));
          mesh.quaternion.copy(rotQ.clone().multiply(quat));
        });
        this.isMoving=false;
        onDone&&onDone();
      }
    };
    requestAnimationFrame(step);
  }

  _getAxis(base){
    if(['R','L','M'].includes(base)) return new THREE.Vector3(1,0,0);
    if(['U','D','E'].includes(base)) return new THREE.Vector3(0,1,0);
    return new THREE.Vector3(0,0,1); // F,B,S
  }

  _getLayer(base){
    if(base==='R') return 1;
    if(base==='L'||base==='M') return -1;
    if(base==='U') return 1;
    if(base==='D'||base==='E') return -1;
    if(base==='F'||base==='S') return 1;
    if(base==='B') return -1;
    return 0;
  }

  // ── Undo/Redo ─────────────────────────────────────────
  undo(){
    if(!this.history.length) return;
    const move=this.history.pop();
    this.redoStack.push(move);
    const inv=move.includes('2')?move:move.includes("'")?move.replace("'",""):move+"'";
    // Rebuild state from scratch
    this.cubeState.reset();
    for(const m of this.history) this.cubeState.applyMove(m);
    this._buildCube();
    this._updateColors();
    this._updateHistory();
  }

  redo(){
    if(!this.redoStack.length) return;
    const move=this.redoStack.pop();
    this.applyMove(move);
  }

  // ── Scramble ──────────────────────────────────────────
  scramble(){
    this._stopTimer();
    const td=document.getElementById('vc-timer-display');
    if(td){ td.textContent='0.00'; td.style.color='var(--w)'; }

    const moves=['U','D','L','R','F','B'], mods=["","'","2"];
    let last='', seq=[];
    for(let i=0;i<20;i++){
      let f; do{ f=moves[Math.floor(Math.random()*6)]; }while(f===last);
      seq.push(f+mods[Math.floor(Math.random()*3)]); last=f;
    }
    this.cubeState.reset();
    for(const m of seq) this.cubeState.applyMove(m);
    this._buildCube();
    this._updateColors();
    this.history=[]; this.redoStack=[];
    this._updateHistory();
    if(typeof showToast==='function') showToast('Scrambled!');
  }

  reset(){
    this._stopTimer();
    this.cubeState.reset();
    this._buildCube();
    this._updateColors();
    this._applyFixedTilt();
    this.history=[]; this.redoStack=[]; this.moveQueue=[]; this.isMoving=false;
    this._updateHistory();
    const td=document.getElementById('vc-timer-display');
    if(td){ td.textContent='0.00'; td.style.color='var(--w)'; }
    if(typeof showToast==='function') showToast('Reset');
  }

  // ── Timer ─────────────────────────────────────────────
  _startTimer(){
    this.isTiming=true;
    this.timerStart=Date.now();
    this.timerInterval=setInterval(()=>{
      const ms=Date.now()-this.timerStart;
      const s=Math.floor(ms/1000), cs=Math.floor((ms%1000)/10);
      const td=document.getElementById('vc-timer-display');
      if(td) td.textContent=`${s}.${String(cs).padStart(2,'0')}`;
    },50);
  }

  _stopTimer(){
    clearInterval(this.timerInterval);
    this.isTiming=false;
  }

  // ── History display ───────────────────────────────────
  _updateHistory(){
    const el=document.getElementById('vc-history');
    if(!el) return;
    if(!this.history.length){ el.textContent='No moves yet'; return; }
    el.innerHTML=this.history
      .map((m,i)=>`<span class="vc-history-move${i===this.history.length-1?' latest':''}">${m}</span>`)
      .join(' ');
    el.scrollLeft=el.scrollWidth;
  }

  // ── Settings ──────────────────────────────────────────
  updateSettings(key,value){
    this.settings[key]=value;
    if(key==='blindfold'){ this._buildCube(); if(!value) this._updateColors(); }
    if(key==='advanced'){
      const el=document.getElementById('vc-slice-controls');
      if(el) el.style.display=value?'flex':'none';
    }
  }

  // ── Render ────────────────────────────────────────────
  _renderLoop(){
    const loop=()=>{ requestAnimationFrame(loop); this.renderer.render(this.scene,this.camera); };
    loop();
  }
}

// ── Global API ───────────────────────────────────────
function vcUndo()     { window.vCube?.undo(); }
function vcRedo()     { window.vCube?.redo(); }
function vcScramble() { window.vCube?.scramble(); }
function vcReset()    { window.vCube?.reset(); }

function initVirtualCube(){
  if(window.vCube) return;
  setTimeout(()=>{
    try{ window.vCube=new VirtualCube(); }
    catch(e){ console.error('VC init error:',e); }
  }, 80);
}

function toggleVCSetting(key){
  const btn=document.getElementById('tog-vc-'+key);
  if(!btn) return;
  window.vCube?.updateSettings(key, btn.classList.toggle('on'));
}

function updateVCTheme(t){ window.vCube?.updateSettings('theme',t); }

window.vcUndo=vcUndo; window.vcRedo=vcRedo;
window.vcScramble=vcScramble; window.vcReset=vcReset;
window.initVirtualCube=initVirtualCube;
window.toggleVCSetting=toggleVCSetting;
window.updateVCTheme=updateVCTheme;
