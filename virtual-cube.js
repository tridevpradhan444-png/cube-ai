/**
 * Virtual Cube Module
 * Fixed: proper init on screen show, no showScreen override conflict,
 * correct canvas container sizing, improved button handling
 */

class VirtualCube {
  constructor() {
    this.container = document.getElementById('vc-canvas-container');
    this.canvas = document.getElementById('vc-canvas');
    if(!this.container || !this.canvas){ console.error('VirtualCube: canvas container not found'); return; }

    // State
    this.isMoving = false;
    this.moveQueue = [];
    this.history = [];
    this.redoStack = [];
    this.heldButtons = new Set();
    this.lastTapTime = 0;
    this.lastTapMove = '';
    this.holdTimer = null;
    this.activeBtn = null;
    this.startY = 0;
    this.currentSelection = 'normal';
    this.currentScramble = '';

    // Timer
    this.timerInterval = null;
    this.startTime = 0;
    this.isTiming = false;
    this.isSolved = true;
    this.inspectionTimer = null;
    this.inspectionTimeLeft = 15;

    // Settings
    this.settings = {
      advanced: false,
      vibration: false,
      blindfold: false,
      inspection: false,
      theme: 'standard',
      sound: true
    };

    this.themes = {
      standard: [0xf44336, 0xff6d00, 0xffffff, 0xffd700, 0x00c853, 0x2979ff],
      neon:     [0xff00ff, 0x00ffff, 0xffffff, 0xffff00, 0x00ff00, 0x0000ff],
      pastel:   [0xffb3ba, 0xffdfba, 0xffffba, 0xbaffc9, 0xbae1ff, 0xa2a2d0]
    };

    // Camera drag
    this.isDragging = false;
    this.previousMousePosition = { x:0, y:0 };

    this.initThree();
    this.initCube();
    this.initControls();
    this.animate();
  }

  initThree() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || (window.innerHeight - 56);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);

    this.camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(10, 10, 10);
    this.scene.add(light);

    window.addEventListener('resize', () => {
      const nw = this.container.clientWidth;
      const nh = this.container.clientHeight;
      if(nw>0 && nh>0){
        this.camera.aspect = nw/nh;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw, nh);
      }
    });
  }

  initCube() {
    if(this.cubeGroup) this.scene.remove(this.cubeGroup);
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);
    this.cubies = [];

    let faceColors = this.themes[this.settings.theme] || this.themes.standard;
    if(this.settings.blindfold){
      faceColors = [0x222222,0x222222,0x222222,0x222222,0x222222,0x222222];
    }

    const geometry = new THREE.BoxGeometry(0.93, 0.93, 0.93);
    // Sticker overlay geometry (slightly larger)
    const stickerGeo = new THREE.BoxGeometry(0.88, 0.88, 0.88);

    for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++){
      // Black body
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const body = new THREE.Mesh(geometry, bodyMat);
      body.position.set(x, y, z);

      // Colored stickers
      const mats = faceColors.map(color => new THREE.MeshLambertMaterial({ color }));
      const cubie = new THREE.Mesh(stickerGeo, mats);
      cubie.position.set(x, y, z);
      cubie.userData = { origX:x, origY:y, origZ:z };

      this.cubies.push(cubie);
      this.cubeGroup.add(body);
      this.cubeGroup.add(cubie);
    }
  }

  updateSettings(key, value) {
    this.settings[key] = value;
    if(key==='blindfold'||key==='theme') this.initCube();
    if(key==='advanced'){
      const el = document.getElementById('vc-slice-controls');
      if(el) el.style.display = value ? 'flex' : 'none';
    }
  }

  initControls() {
    // Face buttons
    document.querySelectorAll('.vc-btn').forEach(btn => {
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleBtnStart(e, btn); }, { passive: false });
      btn.addEventListener('touchmove',  (e) => { e.preventDefault(); this.handleBtnMove(e); },        { passive: false });
      btn.addEventListener('touchend',   (e) => { e.preventDefault(); this.handleBtnEnd(e, btn); },    { passive: false });
      // Mouse support
      btn.addEventListener('mousedown', (e) => this.handleBtnStart(e, btn));
      btn.addEventListener('mouseup',   (e) => this.handleBtnEnd(e, btn));
    });

    // Swipe to rotate camera
    this.container.addEventListener('touchstart', (e) => {
      if(e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if(!this.isDragging) return;
      const dx = e.touches[0].pageX - this.previousMousePosition.x;
      const dy = e.touches[0].pageY - this.previousMousePosition.y;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        this.toRadians(dy * 0.5), this.toRadians(dx * 0.5), 0, 'YXZ'
      ));
      this.cubeGroup.quaternion.multiplyQuaternions(q, this.cubeGroup.quaternion);
      this.previousMousePosition = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }, { passive: true });

    this.container.addEventListener('touchend', () => { this.isDragging = false; });

    // Mouse drag
    this.container.addEventListener('mousedown', (e) => {
      if(e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.pageX, y: e.pageY };
    });
    this.container.addEventListener('mousemove', (e) => {
      if(!this.isDragging) return;
      const dx = e.pageX - this.previousMousePosition.x;
      const dy = e.pageY - this.previousMousePosition.y;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        this.toRadians(dy * 0.5), this.toRadians(dx * 0.5), 0, 'YXZ'
      ));
      this.cubeGroup.quaternion.multiplyQuaternions(q, this.cubeGroup.quaternion);
      this.previousMousePosition = { x: e.pageX, y: e.pageY };
    });
    this.container.addEventListener('mouseup', () => { this.isDragging = false; });
  }

  handleBtnStart(e, btn) {
    const move = btn.dataset.move;
    this.heldButtons.add(move);
    this.activeBtn = btn;
    this.startY = (e.touches ? e.touches[0].clientY : e.clientY);
    this.vibrate(10);

    this.holdTimer = setTimeout(() => {
      if(this.heldButtons.has(move) && !['X','Y','Z'].includes(move)){
        this.showPopup(move);
      }
    }, 350);
  }

  handleBtnMove(e) {
    if(!this.activeBtn) return;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diff = this.startY - currentY;
    if(Math.abs(diff) > 30) this.updateSelection(diff > 0 ? 'up' : 'down');
  }

  handleBtnEnd(e, btn) {
    clearTimeout(this.holdTimer);
    const move = btn.dataset.move;
    const popup = document.getElementById('vc-popup');

    if(popup && popup.classList.contains('show')){
      this.executeSelectedMove();
      this.hidePopup();
    } else {
      const currentTime = Date.now();
      const isDouble = currentTime - this.lastTapTime < 280 && this.lastTapMove === move;
      if(isDouble){
        // Double tap = 180 degree (double move)
        this.applyMove(move + '2');
        this.lastTapTime = 0;
      } else {
        this.applyMove(move);
        this.lastTapTime = currentTime;
        this.lastTapMove = move;
      }
    }
    this.heldButtons.delete(move);
    this.activeBtn = null;
  }

  applyMove(move, isUndo=false) {
    if(this.isMoving){
      this.moveQueue.push({ move, isUndo });
      return;
    }
    if(!isUndo && !this.isTiming && !['X','Y','Z'].includes(move[0])){
      this.startTimer();
    }
    this.vibrate(15);
    if(this.settings.sound) this.playClickSound();
    this.rotateFace(move, isUndo, animSpeed || 250);
    if(!isUndo){
      this.history.push(move);
      this.redoStack = [];
      this.updateHistoryDisplay();
      this.isSolved = false;
    }
  }

  playClickSound(){
    try{
      const ctx = new(window.AudioContext||window.webkitAudioContext)();
      const buf = ctx.createBuffer(1,ctx.sampleRate*0.05,ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)*0.3;
      const src = ctx.createBufferSource();
      src.buffer=buf; src.connect(ctx.destination); src.start();
    }catch(e){}
  }

  startTimer(){
    if(this.settings.inspection && this.inspectionTimeLeft > 0) return;
    this.isTiming = true;
    this.startTime = Date.now();
    this.timerInterval = setInterval(()=>{
      const elapsed = Date.now()-this.startTime;
      const el = document.getElementById('vc-timer-display');
      if(el) el.textContent = this.formatTime(elapsed);
    },50);
  }

  stopTimer(){
    clearInterval(this.timerInterval);
    this.isTiming = false;
  }

  formatTime(ms){
    const s = Math.floor(ms/1000);
    const cs = Math.floor((ms%1000)/10);
    return `${s}.${cs.toString().padStart(2,'0')}`;
  }

  undo(){
    if(!this.history.length) return;
    const move = this.history.pop();
    this.redoStack.push(move);
    const inv = move.includes("'") ? move.replace("'","") : move.endsWith("2") ? move : move+"'";
    this.applyMove(inv, true);
    this.updateHistoryDisplay();
  }

  redo(){
    if(!this.redoStack.length) return;
    const move = this.redoStack.pop();
    this.applyMove(move);
  }

  async scramble(){
    this.stopTimer();
    this.isSolved = false;
    const td = document.getElementById('vc-timer-display');
    if(td){ td.textContent='0.00'; td.style.color='var(--w)'; }

    const moves = ['U','D','L','R','F','B'];
    const mods = ["","'","2"];
    let last='', scrambleMoves=[];
    for(let i=0;i<20;i++){
      let f; do{ f=moves[Math.floor(Math.random()*6)]; }while(f===last);
      scrambleMoves.push(f+mods[Math.floor(Math.random()*3)]);
      last=f;
    }

    this.currentScramble = scrambleMoves.join(' ');
    const el = document.getElementById('vc-scramble-text');
    if(el){ el.textContent=this.currentScramble; el.classList.remove('visible'); el.style.display='block'; }

    // Fast scramble
    for(const move of scrambleMoves){
      await this.rotateFaceAsync(move, 60);
    }

    this.history=[];
    this.updateHistoryDisplay();

    if(this.settings.inspection) this.startInspection();
  }

  rotateFaceAsync(move, duration){
    return new Promise(resolve => {
      this.rotateFace(move, false, duration, resolve);
    });
  }

  reset(){
    // Reset cube orientation only
    this.cubeGroup.quaternion.set(0,0,0,1);
    showToast('Orientation reset');
  }

  rotateFace(move, isUndo=false, duration=250, callback=null){
    this.isMoving = true;
    const face = move[0];
    const isPrime = move.includes("'");
    const isDouble = move.includes('2');

    let angle = isPrime ? Math.PI/2 : -Math.PI/2;
    if(isDouble) angle = Math.PI;

    let axis = new THREE.Vector3();
    let predicate = () => false;

    switch(face){
      case 'R': axis.set(1,0,0);  predicate = p => p.x > 0.5;              break;
      case 'L': axis.set(1,0,0);  predicate = p => p.x < -0.5;             break;
      case 'U': axis.set(0,1,0);  predicate = p => p.y > 0.5;              break;
      case 'D': axis.set(0,1,0);  predicate = p => p.y < -0.5;             break;
      case 'F': axis.set(0,0,1);  predicate = p => p.z > 0.5;              break;
      case 'B': axis.set(0,0,1);  predicate = p => p.z < -0.5;             break;
      case 'M': axis.set(1,0,0);  predicate = p => Math.abs(p.x) < 0.5;   break;
      case 'E': axis.set(0,1,0);  predicate = p => Math.abs(p.y) < 0.5;   break;
      case 'S': axis.set(0,0,1);  predicate = p => Math.abs(p.z) < 0.5;   break;
      case 'X': axis.set(1,0,0);  predicate = () => true;                   break;
      case 'Y': axis.set(0,1,0);  predicate = () => true;                   break;
      case 'Z': axis.set(0,0,1);  predicate = () => true;                   break;
      default: this.isMoving=false; if(callback) callback(); return;
    }

    // Invert direction for L/D/B/M faces
    if(['L','D','B','M'].includes(face)) angle = -angle;

    const group = new THREE.Group();
    this.scene.add(group);

    const movingCubies = this.cubies.filter(c => {
      const wp = c.position.clone().applyMatrix4(this.cubeGroup.matrixWorld);
      return predicate(wp);
    });
    movingCubies.forEach(c => group.add(c));

    // Also move body cubies
    const allMesh = [...this.cubeGroup.children];
    const movingBodies = allMesh.filter(m => !this.cubies.includes(m)).filter(m => {
      const wp = m.position.clone().applyMatrix4(this.cubeGroup.matrixWorld);
      return predicate(wp);
    });
    movingBodies.forEach(m => group.add(m));

    const rotAxis = ['R','L','X','M'].includes(face)?'x':['U','D','Y','E'].includes(face)?'y':'z';
    const start = performance.now();

    const tick = (time) => {
      const progress = Math.min((time-start)/duration, 1);
      const eased = progress<0.5 ? 2*progress*progress : 1-Math.pow(-2*progress+2,2)/2;
      group.rotation[rotAxis] = angle * eased;

      if(progress < 1){
        requestAnimationFrame(tick);
      } else {
        group.rotation[rotAxis] = angle;
        group.updateMatrixWorld(true);

        [...movingCubies, ...movingBodies].forEach(c => {
          c.applyMatrix4(group.matrixWorld);
          this.cubeGroup.add(c);
          c.position.set(
            Math.round(c.position.x),
            Math.round(c.position.y),
            Math.round(c.position.z)
          );
        });

        this.scene.remove(group);
        this.isMoving = false;

        if(this.isTiming && this.isStateSolved()){
          this.stopTimer();
          this.isSolved = true;
          const td = document.getElementById('vc-timer-display');
          if(td) td.style.color = '#00c853';
          if(typeof showToast==='function') showToast('Solved! ' + (td?td.textContent:''));
        }

        if(callback) callback();
        if(this.moveQueue.length > 0){
          const next = this.moveQueue.shift();
          this.rotateFace(next.move, next.isUndo, duration);
        }
      }
    };
    requestAnimationFrame(tick);
  }

  isStateSolved(){
    // Check if all cubies are at near-integer positions with clean rotations
    for(const cubie of this.cubies){
      const r = cubie.rotation;
      const snap = v => {
        const mod = ((v % (Math.PI/2)) + Math.PI*2) % (Math.PI/2);
        return mod < 0.1 || mod > Math.PI/2 - 0.1;
      };
      if(!snap(r.x)||!snap(r.y)||!snap(r.z)) return false;
    }
    return this.history.length > 0;
  }

  updateHistoryDisplay(){
    const el = document.getElementById('vc-history');
    if(!el) return;
    if(!this.history.length){ el.textContent='No moves yet'; return; }
    el.innerHTML = this.history.map((m,i)=>
      `<span class="vc-history-move${i===this.history.length-1?' latest':''}">${m}</span>`
    ).join(' ');
    el.scrollLeft = el.scrollWidth;
  }

  showPopup(move){
    const popup = document.getElementById('vc-popup');
    if(!popup) return;
    popup.dataset.baseMove = move;
    const opts = popup.querySelectorAll('.vc-option');
    if(opts[0]) opts[0].textContent = move;
    if(opts[1]) opts[1].textContent = move+"'";
    popup.classList.add('show');
    this.updateSelection('up');
  }

  hidePopup(){
    const p = document.getElementById('vc-popup');
    if(p) p.classList.remove('show');
  }

  updateSelection(dir){
    const opts = document.querySelectorAll('.vc-option');
    opts.forEach(o => o.classList.remove('selected'));
    if(dir==='up'){ if(opts[0]) opts[0].classList.add('selected'); this.currentSelection='normal'; }
    else           { if(opts[1]) opts[1].classList.add('selected'); this.currentSelection='prime'; }
  }

  executeSelectedMove(){
    const base = document.getElementById('vc-popup')?.dataset.baseMove || '';
    this.applyMove(this.currentSelection==='prime' ? base+"'" : base);
  }

  toggleScramble(){
    const el = document.getElementById('vc-scramble-text');
    if(el) el.classList.toggle('visible');
  }

  startInspection(){
    if(this.inspectionTimer) clearInterval(this.inspectionTimer);
    this.inspectionTimeLeft = 15;
    const td = document.getElementById('vc-timer-display');
    if(td){ td.style.color='#ffaa44'; td.textContent=this.inspectionTimeLeft; }

    this.inspectionTimer = setInterval(()=>{
      this.inspectionTimeLeft--;
      if(td) td.textContent = this.inspectionTimeLeft;
      if(this.inspectionTimeLeft<=0){
        clearInterval(this.inspectionTimer);
        if(td){ td.style.color='#ff4444'; }
        this.playAlertSound();
        setTimeout(()=>{
          if(td){ td.style.color='var(--w)'; td.textContent='0.00'; }
          this.startTimer();
        }, 900);
      }
    },1000);
  }

  playAlertSound(){
    try{
      const ctx = new(window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type='sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
      osc.start(); osc.stop(ctx.currentTime+0.4);
    }catch(e){}
  }

  vibrate(ms){ if(this.settings.vibration && navigator.vibrate) navigator.vibrate(ms); }
  toRadians(deg){ return deg*(Math.PI/180); }
  animate(){ requestAnimationFrame(()=>this.animate()); this.renderer.render(this.scene, this.camera); }
}

// ─── Global handlers ────────────────────────────────────
function vcUndo()     { window.vCube?.undo(); }
function vcRedo()     { window.vCube?.redo(); }
function vcScramble() { window.vCube?.scramble(); }
function vcReset()    { window.vCube?.reset(); }

function initVirtualCube(){
  if(window.vCube) return; // already initialized
  // Small delay to allow the screen to be visible and have proper dimensions
  setTimeout(()=>{
    try{
      window.vCube = new VirtualCube();
    }catch(e){
      console.error('VirtualCube init error:', e);
    }
  }, 80);
}

function toggleVCSetting(key){
  const btn = document.getElementById('tog-vc-'+key);
  if(!btn) return;
  const isOn = btn.classList.toggle('on');
  if(window.vCube) window.vCube.updateSettings(key, isOn);
}

function updateVCTheme(theme){
  if(window.vCube) window.vCube.updateSettings('theme', theme);
}

// animSpeed is defined in script.js — virtual cube reads it too
// Use a local fallback
Object.defineProperty(window, 'animSpeed', {
  get(){ return window._animSpeed || 250; },
  set(v){ window._animSpeed = v; },
  configurable: true
});
