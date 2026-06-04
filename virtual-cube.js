// ═══════════════════════════════════════════════════════
//  SHARED CUBE ENGINE
//  Color array = single source of truth
//  After every move: update array → rebuild ALL stickers
//  Animation = visual only, never affects color state
// ═══════════════════════════════════════════════════════

const CUBE_COLORS = {
  U:'#ffd700', D:'#ffffff', F:'#00c853',
  B:'#2979ff', R:'#ff6d00', L:'#f44336',
};

// ── CubeState ────────────────────────────────────────
// Sticker layout per face (viewed from outside):
// 0 1 2
// 3 4 5
// 6 7 8
class CubeState {
  constructor(){ this.reset(); }

  reset(){
    this.s = {};
    for(const [f,c] of Object.entries(CUBE_COLORS))
      this.s[f] = Array(9).fill(c);
  }

  clone(){
    const n = new CubeState();
    for(const f in this.s) n.s[f] = [...this.s[f]];
    return n;
  }

  // Apply any move string e.g. "R", "U'", "F2", "X", "M"
  move(mv){
    const base  = mv.replace(/['\d]/g,'');
    const times = mv.includes('2')?2 : mv.includes("'")?3 : 1;
    for(let i=0;i<times;i++) this._cw(base);
  }

  _rot(f){
    const o=[...this.s[f]];
    this.s[f]=[o[6],o[3],o[0],o[7],o[4],o[1],o[8],o[5],o[2]];
  }

  _cyc(f0,i0,f1,i1,f2,i2,f3,i3){
    const t=this.s[f0][i0];
    this.s[f0][i0]=this.s[f3][i3];
    this.s[f3][i3]=this.s[f2][i2];
    this.s[f2][i2]=this.s[f1][i1];
    this.s[f1][i1]=t;
  }

  _cw(m){
    const s=this.s;
    if(m==='U'){
      this._rot('U');
      const t=[s.F[0],s.F[1],s.F[2]];
      [s.F[0],s.F[1],s.F[2]]=[s.R[0],s.R[1],s.R[2]];
      [s.R[0],s.R[1],s.R[2]]=[s.B[0],s.B[1],s.B[2]];
      [s.B[0],s.B[1],s.B[2]]=[s.L[0],s.L[1],s.L[2]];
      [s.L[0],s.L[1],s.L[2]]=t;
    } else if(m==='D'){
      this._rot('D');
      const t=[s.F[6],s.F[7],s.F[8]];
      [s.F[6],s.F[7],s.F[8]]=[s.L[6],s.L[7],s.L[8]];
      [s.L[6],s.L[7],s.L[8]]=[s.B[6],s.B[7],s.B[8]];
      [s.B[6],s.B[7],s.B[8]]=[s.R[6],s.R[7],s.R[8]];
      [s.R[6],s.R[7],s.R[8]]=t;
    } else if(m==='R'){
      this._rot('R');
      const t=[s.U[2],s.U[5],s.U[8]];
      [s.U[2],s.U[5],s.U[8]]=[s.F[2],s.F[5],s.F[8]];
      [s.F[2],s.F[5],s.F[8]]=[s.D[2],s.D[5],s.D[8]];
      [s.D[2],s.D[5],s.D[8]]=[s.B[6],s.B[3],s.B[0]];
      [s.B[6],s.B[3],s.B[0]]=t;
    } else if(m==='L'){
      this._rot('L');
      const t=[s.U[0],s.U[3],s.U[6]];
      [s.U[0],s.U[3],s.U[6]]=[s.B[8],s.B[5],s.B[2]];
      [s.B[8],s.B[5],s.B[2]]=[s.D[0],s.D[3],s.D[6]];
      [s.D[0],s.D[3],s.D[6]]=[s.F[0],s.F[3],s.F[6]];
      [s.F[0],s.F[3],s.F[6]]=t;
    } else if(m==='F'){
      this._rot('F');
      const t=[s.U[6],s.U[7],s.U[8]];
      [s.U[6],s.U[7],s.U[8]]=[s.L[8],s.L[5],s.L[2]];
      [s.L[2],s.L[5],s.L[8]]=[s.D[0],s.D[1],s.D[2]];
      [s.D[0],s.D[1],s.D[2]]=[s.R[6],s.R[3],s.R[0]];
      [s.R[0],s.R[3],s.R[6]]=t;
    } else if(m==='B'){
      this._rot('B');
      const t=[s.U[0],s.U[1],s.U[2]];
      [s.U[0],s.U[1],s.U[2]]=[s.R[2],s.R[5],s.R[8]];
      [s.R[2],s.R[5],s.R[8]]=[s.D[8],s.D[7],s.D[6]];
      [s.D[6],s.D[7],s.D[8]]=[s.L[0],s.L[3],s.L[6]];
      [s.L[0],s.L[3],s.L[6]]=t;
    } else if(m==='M'){
      const t=[s.U[1],s.U[4],s.U[7]];
      [s.U[1],s.U[4],s.U[7]]=[s.B[7],s.B[4],s.B[1]];
      [s.B[7],s.B[4],s.B[1]]=[s.D[1],s.D[4],s.D[7]];
      [s.D[1],s.D[4],s.D[7]]=[s.F[1],s.F[4],s.F[7]];
      [s.F[1],s.F[4],s.F[7]]=t;
    } else if(m==='E'){
      const t=[s.F[3],s.F[4],s.F[5]];
      [s.F[3],s.F[4],s.F[5]]=[s.L[3],s.L[4],s.L[5]];
      [s.L[3],s.L[4],s.L[5]]=[s.B[3],s.B[4],s.B[5]];
      [s.B[3],s.B[4],s.B[5]]=[s.R[3],s.R[4],s.R[5]];
      [s.R[3],s.R[4],s.R[5]]=t;
    } else if(m==='S'){
      const t=[s.U[3],s.U[4],s.U[5]];
      [s.U[3],s.U[4],s.U[5]]=[s.L[7],s.L[4],s.L[1]];
      [s.L[1],s.L[4],s.L[7]]=[s.D[5],s.D[4],s.D[3]];
      [s.D[3],s.D[4],s.D[5]]=[s.R[1],s.R[4],s.R[7]];
      [s.R[1],s.R[4],s.R[7]]=t;
    } else if(m==='X'){
      this._cw('R'); for(let i=0;i<3;i++){this._cw('M');} for(let i=0;i<3;i++){this._cw('L');}
    } else if(m==='Y'){
      this._cw('U'); for(let i=0;i<3;i++){this._cw('E');} for(let i=0;i<3;i++){this._cw('D');}
    } else if(m==='Z'){
      this._cw('F'); this._cw('S'); for(let i=0;i<3;i++){this._cw('B');}
    }
  }

  isSolved(){
    return Object.values(this.s).every(f=>f.every(c=>c===f[0]));
  }

  applySequence(moves){
    moves.trim().split(/\s+/).filter(Boolean).forEach(m=>this.move(m));
  }
}

// ── Three.js Cube Renderer ───────────────────────────
// Redraws all stickers from color array on every update
// Animation is a temporary visual rotation — never touches color state
class CubeRenderer {
  constructor(canvas, opts={}){
    this.canvas   = canvas;
    this.opts     = Object.assign({ tiltX:-0.38, tiltY:0.0, fov:30, camZ:13 }, opts);
    this.state    = new CubeState();
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this.rootGroup= null; // camera orientation (fixed or draggable)
    this.cubeGroup= null; // holds all cubies
    this.cubies   = [];   // [{mesh, x, y, z}]  — positions never change
    this.isMoving = false;
    this.queue    = [];
    this._init();
  }

  _init(){
    const parent = this.canvas.parentElement;
    const w = (parent && parent.clientWidth > 0) ? parent.clientWidth : window.innerWidth;
    const h = (parent && parent.clientHeight > 0) ? parent.clientHeight : 280;

    this.scene    = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);
    this.camera   = new THREE.PerspectiveCamera(this.opts.fov, w/h, 0.1, 100);
    this.camera.position.set(0,0,this.opts.camZ);
    this.camera.lookAt(0,0,0);

    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true });
    this.renderer.setSize(w,h);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));

    this.scene.add(new THREE.AmbientLight(0xffffff,0.8));
    const dl=new THREE.DirectionalLight(0xffffff,0.6); dl.position.set(5,8,6); this.scene.add(dl);

    this.rootGroup = new THREE.Group();
    this.cubeGroup = new THREE.Group();
    this.rootGroup.add(this.cubeGroup);
    this.scene.add(this.rootGroup);

    this._applyTilt();
    this._buildCubies();
    this._redraw();
    this._loop();

    window.addEventListener('resize',()=>{
      const nw=this.canvas.parentElement.clientWidth;
      const nh=this.canvas.parentElement.clientHeight;
      if(nw>0&&nh>0){
        this.camera.aspect=nw/nh;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw,nh);
      }
    });
  }

  _applyTilt(){
    // Store yaw (Y rotation) separately so X/Y/Z moves don't break the tilt
    if(this._yaw === undefined) this._yaw = this.opts.tiltY;
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.opts.tiltX);
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this._yaw);
    this.rootGroup.quaternion.copy(qX.clone().premultiply(qY));
  }

  // Build 27 cubies — black body + colored sticker quads
  // Cubies NEVER move from their positions — only the sticker colors change
  _buildCubies(){
    while(this.cubeGroup.children.length) this.cubeGroup.remove(this.cubeGroup.children[0]);
    this.cubies = [];

    const bodyGeo  = new THREE.BoxGeometry(0.92,0.92,0.92);
    const bodyMat  = new THREE.MeshLambertMaterial({color:0x0d0d0d});
    const stickerGeo = new THREE.PlaneGeometry(0.82,0.82);

    // Face offsets and rotations for sticker quads
    const FACE_CONFIG = [
      { name:'U', pos:new THREE.Vector3(0, 0.461,0),  rot:new THREE.Euler(-Math.PI/2,0,0) },
      { name:'D', pos:new THREE.Vector3(0,-0.461,0),  rot:new THREE.Euler( Math.PI/2,0,0) },
      { name:'F', pos:new THREE.Vector3(0,0, 0.461),  rot:new THREE.Euler(0,0,0) },
      { name:'B', pos:new THREE.Vector3(0,0,-0.461),  rot:new THREE.Euler(0,Math.PI,0) },
      { name:'R', pos:new THREE.Vector3( 0.461,0,0),  rot:new THREE.Euler(0, Math.PI/2,0) },
      { name:'L', pos:new THREE.Vector3(-0.461,0,0),  rot:new THREE.Euler(0,-Math.PI/2,0) },
    ];

    for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
      const group = new THREE.Group();
      group.position.set(x,y,z);

      // Black body
      group.add(new THREE.Mesh(bodyGeo, bodyMat));

      // Sticker quads — only on exterior faces
      const stickers = {};
      for(const fc of FACE_CONFIG){
        const isExt = (fc.name==='U'&&y===1)||(fc.name==='D'&&y===-1)||
                      (fc.name==='F'&&z===1)||(fc.name==='B'&&z===-1)||
                      (fc.name==='R'&&x===1)||(fc.name==='L'&&x===-1);
        if(!isExt) continue;
        const mat  = new THREE.MeshBasicMaterial({color:0xffffff});
        const mesh = new THREE.Mesh(stickerGeo, mat);
        mesh.position.copy(fc.pos);
        mesh.rotation.copy(fc.rot);
        group.add(mesh);
        stickers[fc.name] = mat;
      }

      this.cubeGroup.add(group);
      this.cubies.push({ group, x, y, z, stickers });
    }
  }

  // Redraw all sticker colors from current state
  // Called after every move — fast, no geometry changes
  _redraw(filter){
    // Sticker index mapping: cubie (x,y,z) on face → state array index
    const idx = {
      U:(x,y,z)=> (1-z)*3+(x+1),  // row=1-z, col=x+1
      D:(x,y,z)=> (z+1)*3+(x+1),
      F:(x,y,z)=> (1-y)*3+(x+1),
      B:(x,y,z)=> (1-y)*3+(1-x),
      R:(x,y,z)=> (1-y)*3+(1-z),
      L:(x,y,z)=> (1-y)*3+(z+1),
    };

    for(const c of this.cubies){
      for(const [face, mat] of Object.entries(c.stickers)){
        // If filter provided (practice mode), dim non-relevant faces
        let color = this.state.s[face][idx[face](c.x,c.y,c.z)];
        if(filter){
          color = filter(face, c.x, c.y, c.z, color) || '#111111';
        }
        mat.color.setStyle(color);
      }
    }
  }

  // Animate a face/slice/whole move
  // Visual only — state is already updated before calling this
  animateMove(mv, duration, onDone){
    this.isMoving = true;
    const base  = mv.replace(/['\d]/g,'');
    const prime = mv.includes("'");
    const double= mv.includes('2');

    // Whole cube rotations — rotate rootGroup but preserve tilt
    if(['X','Y','Z'].includes(base)){
      // For Y rotation: update yaw and reapply tilt
      // For X/Z: just animate visually then snap back to tilt
      const axis  = base==='X'?new THREE.Vector3(1,0,0)
                  : base==='Y'?new THREE.Vector3(0,1,0)
                  :              new THREE.Vector3(0,0,1);
      const angle = double?Math.PI : prime?Math.PI/2 : -Math.PI/2;

      if(base==='Y'){
        // Track yaw so tilt is preserved
        if(this._yaw===undefined) this._yaw=this.opts.tiltY;
        this._yaw += angle;
      }

      const startQ = this.rootGroup.quaternion.clone();
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      const endQ   = deltaQ.clone().multiply(startQ);

      this._tweenQ(this.rootGroup, startQ, endQ, duration, ()=>{
        // After animation, reapply proper tilt to avoid drift
        this._applyTilt();
        this.isMoving=false; onDone&&onDone();
      });
      return;
    }

    // Face/slice — temporarily parent affected cubies to a pivot
    const axis     = this._axis(base);
    const layerVal = this._layer(base);
    const angle    = (prime?1:-1)*(double?Math.PI:Math.PI/2);

    // Find cubies in this layer by their logical position
    const layer = this.cubies.filter(c=>{
      const dot = axis.x*c.x + axis.y*c.y + axis.z*c.z;
      return Math.round(dot)===layerVal;
    });

    if(!layer.length){ this.isMoving=false; onDone&&onDone(); return; }

    // Pivot group
    const pivot = new THREE.Group();
    this.cubeGroup.add(pivot);
    layer.forEach(c=>{ pivot.add(c.group); });

    const rotQ  = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const startQ= new THREE.Quaternion();
    const endQ  = rotQ.clone();

    this._tweenQ(pivot, startQ, endQ, duration, ()=>{
      // Return cubies to cubeGroup and update their logical x,y,z
      layer.forEach(c=>{
        c.group.applyMatrix4(pivot.matrixWorld);
        this.cubeGroup.add(c.group);
        // Update logical position
        const p = new THREE.Vector3(c.x,c.y,c.z).applyQuaternion(rotQ);
        c.x=Math.round(p.x); c.y=Math.round(p.y); c.z=Math.round(p.z);
        c.group.position.set(c.x,c.y,c.z);
      });
      this.cubeGroup.remove(pivot);
      // Redraw colors from state — fixes any visual drift
      this._redraw(this._filter);
      this.isMoving=false;
      onDone&&onDone();
    });
  }

  _tweenQ(obj, startQ, endQ, dur, onDone){
    const t0=Date.now();
    const step=()=>{
      const p=Math.min((Date.now()-t0)/dur,1);
      const e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      obj.quaternion.slerpQuaternions(startQ,endQ,e);
      if(p<1) requestAnimationFrame(step);
      else onDone&&onDone();
    };
    requestAnimationFrame(step);
  }

  _axis(b){
    if(['R','L','M'].includes(b)) return new THREE.Vector3(1,0,0);
    if(['U','D','E'].includes(b)) return new THREE.Vector3(0,1,0);
    return new THREE.Vector3(0,0,1);
  }
  _layer(b){
    if(b==='R') return 1;  if(b==='L'||b==='M') return -1;
    if(b==='U') return 1;  if(b==='D'||b==='E') return -1;
    if(b==='F'||b==='S') return 1; if(b==='B') return -1;
    return 0;
  }

  _loop(){
    requestAnimationFrame(()=>this._loop());
    this.renderer.render(this.scene,this.camera);
  }

  setFilter(fn){ this._filter=fn; this._redraw(fn); }
  clearFilter(){ this._filter=null; this._redraw(); }
}

// ═══════════════════════════════════════════════════════
//  VIRTUAL CUBE — uses CubeRenderer
// ═══════════════════════════════════════════════════════
class VirtualCube {
  constructor(){
    this.container = document.getElementById('vc-canvas-container');
    this.canvas    = document.getElementById('vc-canvas');
    if(!this.container||!this.canvas) return;

    this.cr = new CubeRenderer(this.canvas, { tiltX:-0.38, tiltY:0.0, fov:30, camZ:13 });
    this.history   = [];
    this.redoStack = [];
    this.queue     = [];
    this.busy      = false;

    this._lastMove=''; this._lastTime=0; this._tapTimer=null;
    this.timerInterval=null; this.timerStart=0; this.isTiming=false;
    this.settings={advanced:false,vibration:false};

    this._initButtons();
  }

  _initButtons(){
    this.container.addEventListener('touchstart',e=>{
      const btn=e.target.closest('.vc-btn');
      if(btn){e.preventDefault();this._tap(btn.dataset.move);}
      const opt=e.target.closest('.vc-option');
      if(opt){e.preventDefault();this._pickOpt(opt);}
    },{passive:false});
    this.container.addEventListener('mousedown',e=>{
      const btn=e.target.closest('.vc-btn');
      if(btn){e.preventDefault();this._tap(btn.dataset.move);}
      const opt=e.target.closest('.vc-option');
      if(opt){e.preventDefault();this._pickOpt(opt);}
    });
  }

  _tap(mv){
    if(!mv) return;
    const btn=this.container.querySelector(`.vc-btn[data-move="${mv}"]`);
    if(btn){btn.classList.add('active');setTimeout(()=>btn.classList.remove('active'),200);}

    const now=Date.now();
    if(mv===this._lastMove&&now-this._lastTime<320){
      clearTimeout(this._tapTimer);
      this._lastMove=''; this._lastTime=0;
      this.do(mv+'2'); return;
    }
    this._lastMove=mv; this._lastTime=now;
    this._tapTimer=setTimeout(()=>{ if(this._lastMove===mv){this.do(mv);this._lastMove='';} },160);
  }

  _pickOpt(opt){
    document.getElementById('vc-popup')?.classList.remove('show');
    this.do(opt.textContent.trim());
  }

  do(mv, isUndo=false){
    if(this.busy){this.queue.push({mv,isUndo});return;}
    this.busy=true;

    if(!isUndo&&!this.isTiming&&!['X','Y','Z'].includes(mv[0])) this._startTimer();
    if(this.settings.vibration&&navigator.vibrate) navigator.vibrate(12);

    // Update state first
    this.cr.state.move(mv);

    if(!isUndo){this.history.push(mv);this.redoStack=[];this._updateHist();}

    // Animate visual (state already updated)
    this.cr.animateMove(mv,280,()=>{
      this.busy=false;
      if(this.isTiming&&!isUndo&&this.cr.state.isSolved()){
        this._stopTimer();
        const td=document.getElementById('vc-timer-display');
        if(td) td.style.color='#00c853';
        if(typeof showToast==='function') showToast('Solved! '+(td?td.textContent:''));
      }
      if(this.queue.length){const n=this.queue.shift();this.do(n.mv,n.isUndo);}
    });
  }

  undo(){
    if(!this.history.length) return;
    const mv=this.history.pop();
    this.redoStack.push(mv);
    // Rebuild state from scratch
    this.cr.state.reset();
    this.history.forEach(m=>this.cr.state.move(m));
    this.cr._redraw();
    this._updateHist();
  }

  redo(){ if(this.redoStack.length) this.do(this.redoStack.pop()); }

  scramble(){
    this._stopTimer();
    const mvs=['U','D','L','R','F','B'],mods=["","'","2"];
    let last='',seq=[];
    for(let i=0;i<20;i++){
      let f; do{f=mvs[Math.floor(Math.random()*6)];}while(f===last);
      seq.push(f+mods[Math.floor(Math.random()*3)]); last=f;
    }
    this.cr.state.reset();
    this.cr.state.applySequence(seq.join(' '));
    this.cr._buildCubies();
    this.cr._redraw();
    this.history=[]; this.redoStack=[];
    this._updateHist();
    const td=document.getElementById('vc-timer-display');
    if(td){td.textContent='0.00';td.style.color='var(--w)';}
    if(typeof showToast==='function') showToast('Scrambled!');
  }

  reset(){
    this._stopTimer();
    this.cr.state.reset();
    this.cr._buildCubies();
    this.cr._redraw();
    this.cr._applyTilt();
    this.history=[]; this.redoStack=[]; this.queue=[]; this.busy=false;
    this._updateHist();
    const td=document.getElementById('vc-timer-display');
    if(td){td.textContent='0.00';td.style.color='var(--w)';}

  }

  _startTimer(){
    this.isTiming=true; this.timerStart=Date.now();
    this.timerInterval=setInterval(()=>{
      const ms=Date.now()-this.timerStart;
      const s=Math.floor(ms/1000),cs=Math.floor((ms%1000)/10);
      const td=document.getElementById('vc-timer-display');
      if(td) td.textContent=`${s}.${String(cs).padStart(2,'0')}`;
    },50);
  }
  _stopTimer(){ clearInterval(this.timerInterval); this.isTiming=false; }

  _updateHist(){
    const el=document.getElementById('vc-history');
    if(!el) return;
    if(!this.history.length){el.textContent='No moves yet';return;}
    el.innerHTML=this.history.map((m,i)=>
      `<span class="vc-history-move${i===this.history.length-1?' latest':''}">${m}</span>`
    ).join(' ');
    el.scrollLeft=el.scrollWidth;
  }

  updateSettings(k,v){
    this.settings[k]=v;
    if(k==='advanced'){
      const el=document.getElementById('vc-slice-controls');
      if(el) el.style.display=v?'flex':'none';
    }
  }
}

// ── Exports ──────────────────────────────────────────
function initVirtualCube(){
  if(window.vCube) return;
  try{ window.vCube=new VirtualCube(); }
  catch(e){ console.error('VC:',e); }
}

function vcUndo()    { window.vCube?.undo(); }
function vcRedo()    { window.vCube?.redo(); }
function vcScramble(){ window.vCube?.scramble(); }
function vcReset()   { window.vCube?.reset(); }

function toggleVCSetting(k){
  const b=document.getElementById('tog-vc-'+k);
  if(!b) return;
  window.vCube?.updateSettings(k,b.classList.toggle('on'));
}
function updateVCTheme(t){ window.vCube?.updateSettings('theme',t); }

// Expose for ES module + HTML onclick
Object.assign(window,{initVirtualCube,vcUndo,vcRedo,vcScramble,vcReset,toggleVCSetting,updateVCTheme});

// Also expose CubeState and CubeRenderer for practice section
window.CubeState    = CubeState;
window.CubeRenderer = CubeRenderer;
window.CUBE_COLORS  = CUBE_COLORS;
