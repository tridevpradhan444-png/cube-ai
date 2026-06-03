// ═══════════════════════════════════════════════════════
//  VIRTUAL CUBE — Complete rewrite
//  - Proper sticker colors using internal state array
//  - Fixed R/L/F/B/U/D buttons
//  - Fixed X/Y/Z (whole cube rotation, no tilt change)
//  - Fixed double-tap → smooth R2
//  - Fixed default tilt toward user
//  - Fixed timer overflow
//  - Records R2/U2 etc correctly
//  - Semi-circle button animation
// ═══════════════════════════════════════════════════════

// Color constants
const VC_COLORS = {
  U: '#ffd700', // Yellow top
  D: '#ffffff', // White bottom
  F: '#00c853', // Green front
  B: '#2979ff', // Blue back
  R: '#ff6d00', // Orange right
  L: '#f44336', // Red left
  X: '#111111', // Hidden/interior
};

// ── Internal cube state ──────────────────────────────
// 6 faces × 9 stickers. Index layout per face:
// 0 1 2
// 3 4 5
// 6 7 8
class CubeState {
  constructor() { this.reset(); }

  reset() {
    this.faces = {};
    for (const [face, color] of Object.entries(VC_COLORS)) {
      if (face === 'X') continue;
      this.faces[face] = Array(9).fill(color);
    }
  }

  clone() {
    const c = new CubeState();
    for (const f of Object.keys(this.faces))
      c.faces[f] = [...this.faces[f]];
    return c;
  }

  // Rotate face stickers clockwise
  rotateFaceCW(f) {
    const o = [...this.faces[f]];
    this.faces[f] = [o[6],o[3],o[0], o[7],o[4],o[1], o[8],o[5],o[2]];
  }

  applyMove(move) {
    const base  = move.replace(/['\d]/g, '');
    const prime = move.includes("'");
    const double= move.includes('2');
    const times = double ? 2 : prime ? 3 : 1;
    for (let i = 0; i < times; i++) this._applyCW(base);
  }

  _applyCW(m) {
    const f = this.faces;
    if (m==='U') {
      this.rotateFaceCW('U');
      const t=[f.F[0],f.F[1],f.F[2]];
      [f.F[0],f.F[1],f.F[2]]=[f.R[0],f.R[1],f.R[2]];
      [f.R[0],f.R[1],f.R[2]]=[f.B[0],f.B[1],f.B[2]];
      [f.B[0],f.B[1],f.B[2]]=[f.L[0],f.L[1],f.L[2]];
      [f.L[0],f.L[1],f.L[2]]=t;
    } else if (m==='D') {
      this.rotateFaceCW('D');
      const t=[f.F[6],f.F[7],f.F[8]];
      [f.F[6],f.F[7],f.F[8]]=[f.L[6],f.L[7],f.L[8]];
      [f.L[6],f.L[7],f.L[8]]=[f.B[6],f.B[7],f.B[8]];
      [f.B[6],f.B[7],f.B[8]]=[f.R[6],f.R[7],f.R[8]];
      [f.R[6],f.R[7],f.R[8]]=t;
    } else if (m==='R') {
      this.rotateFaceCW('R');
      const t=[f.U[2],f.U[5],f.U[8]];
      [f.U[2],f.U[5],f.U[8]]=[f.F[2],f.F[5],f.F[8]];
      [f.F[2],f.F[5],f.F[8]]=[f.D[2],f.D[5],f.D[8]];
      [f.D[2],f.D[5],f.D[8]]=[f.B[6],f.B[3],f.B[0]];
      [f.B[6],f.B[3],f.B[0]]=t;
    } else if (m==='L') {
      this.rotateFaceCW('L');
      const t=[f.U[0],f.U[3],f.U[6]];
      [f.U[0],f.U[3],f.U[6]]=[f.B[8],f.B[5],f.B[2]];
      [f.B[8],f.B[5],f.B[2]]=[f.D[0],f.D[3],f.D[6]];
      [f.D[0],f.D[3],f.D[6]]=[f.F[0],f.F[3],f.F[6]];
      [f.F[0],f.F[3],f.F[6]]=t;
    } else if (m==='F') {
      this.rotateFaceCW('F');
      const t=[f.U[6],f.U[7],f.U[8]];
      [f.U[6],f.U[7],f.U[8]]=[f.L[8],f.L[5],f.L[2]];
      [f.L[2],f.L[5],f.L[8]]=[f.D[0],f.D[1],f.D[2]];
      [f.D[0],f.D[1],f.D[2]]=[f.R[6],f.R[3],f.R[0]];
      [f.R[0],f.R[3],f.R[6]]=t;
    } else if (m==='B') {
      this.rotateFaceCW('B');
      const t=[f.U[0],f.U[1],f.U[2]];
      [f.U[0],f.U[1],f.U[2]]=[f.R[2],f.R[5],f.R[8]];
      [f.R[2],f.R[5],f.R[8]]=[f.D[8],f.D[7],f.D[6]];
      [f.D[6],f.D[7],f.D[8]]=[f.L[0],f.L[3],f.L[6]];
      [f.L[0],f.L[3],f.L[6]]=t;
    } else if (m==='M') {
      const t=[f.U[1],f.U[4],f.U[7]];
      [f.U[1],f.U[4],f.U[7]]=[f.F[1],f.F[4],f.F[7]];
      [f.F[1],f.F[4],f.F[7]]=[f.D[1],f.D[4],f.D[7]];
      [f.D[1],f.D[4],f.D[7]]=[f.B[7],f.B[4],f.B[1]];
      [f.B[7],f.B[4],f.B[1]]=t;
    } else if (m==='E') {
      const t=[f.F[3],f.F[4],f.F[5]];
      [f.F[3],f.F[4],f.F[5]]=[f.R[3],f.R[4],f.R[5]];
      [f.R[3],f.R[4],f.R[5]]=[f.B[3],f.B[4],f.B[5]];
      [f.B[3],f.B[4],f.B[5]]=[f.L[3],f.L[4],f.L[5]];
      [f.L[3],f.L[4],f.L[5]]=t;
    } else if (m==='S') {
      const t=[f.U[3],f.U[4],f.U[5]];
      [f.U[3],f.U[4],f.U[5]]=[f.L[7],f.L[4],f.L[1]];
      [f.L[1],f.L[4],f.L[7]]=[f.D[5],f.D[4],f.D[3]];
      [f.D[3],f.D[4],f.D[5]]=[f.R[1],f.R[4],f.R[7]];
      [f.R[1],f.R[4],f.R[7]]=t;
    } else if (m==='X') {
      // Whole cube: R + M' + L'
      this._applyCW('R');
      // M' = M × 3
      for(let i=0;i<3;i++) this._applyCW('M');
      // L' = L × 3
      for(let i=0;i<3;i++) this._applyCW('L');
    } else if (m==='Y') {
      // Whole cube: U + E' + D'
      this._applyCW('U');
      for(let i=0;i<3;i++) this._applyCW('E');
      for(let i=0;i<3;i++) this._applyCW('D');
    } else if (m==='Z') {
      // Whole cube: F + S + B'
      this._applyCW('F');
      this._applyCW('S');
      for(let i=0;i<3;i++) this._applyCW('B');
    }
  }

  isSolved() {
    for (const [face, stickers] of Object.entries(this.faces)) {
      if (!stickers.every(s => s === stickers[0])) return false;
    }
    return true;
  }
}

// ── VirtualCube class ────────────────────────────────
class VirtualCube {
  constructor() {
    this.container = document.getElementById('vc-canvas-container');
    this.canvas    = document.getElementById('vc-canvas');
    if (!this.container || !this.canvas) { console.error('VC: missing elements'); return; }

    // Cube logic state
    this.cubeState = new CubeState();
    this.history   = [];
    this.redoStack = [];
    this.moveQueue = [];
    this.isMoving  = false;

    // Timer
    this.timerInterval = null;
    this.timerStart    = 0;
    this.isTiming      = false;

    // Drag
    this.isDragging = false;
    this.prevPos    = { x: 0, y: 0 };

    // Tilt quaternion — always preserved
    // Default: cube tilted ~25° toward viewer
    this.tiltAngle = -0.44; // X rotation in radians

    // Settings
    this.settings = { advanced: false, vibration: false, blindfold: false, inspection: false, theme: 'standard' };

    this.initThree();
    this.buildCube();
    this.setDefaultOrientation();
    this.initControls();
    this.startRenderLoop();
  }

  // ── Three.js setup ──────────────────────────────────
  initThree() {
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight - 56;

    this.scene    = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);
    this.camera   = new THREE.PerspectiveCamera(42, w/h, 0.1, 100);
    this.camera.position.set(0, 0, 7);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(4, 8, 6);
    this.scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.2);
    dl2.position.set(-4, -2, -4);
    this.scene.add(dl2);

    // rootGroup = orientation (drag rotates this)
    // cubeGroup = inside rootGroup, animation rotates pieces inside here
    this.rootGroup = new THREE.Group();
    this.cubeGroup = new THREE.Group();
    this.rootGroup.add(this.cubeGroup);
    this.scene.add(this.rootGroup);

    window.addEventListener('resize', () => {
      const nw = this.container.clientWidth;
      const nh = this.container.clientHeight;
      if (nw > 0 && nh > 0) {
        this.camera.aspect = nw / nh;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(nw, nh);
      }
    });
  }

  // Set default orientation: tilted toward viewer, white on bottom
  setDefaultOrientation() {
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.tiltAngle);
    this.rootGroup.quaternion.copy(qX);
  }

  // ── Build 3D cube meshes ─────────────────────────────
  buildCube() {
    // Clear existing
    while (this.cubeGroup.children.length) this.cubeGroup.remove(this.cubeGroup.children[0]);
    this.cubies = [];

    const gap = 0.05;
    const size = 1 - gap;
    const geo  = new THREE.BoxGeometry(size, size, size);

    // Face order for BoxGeometry materials: +X(R), -X(L), +Y(U), -Y(D), +Z(F), -Z(B)
    const FACE_MAP = ['R','L','U','D','F','B'];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const mats = FACE_MAP.map((face, fi) => {
            // Check if this face is exterior
            const isExt = (fi===0&&x===1)||(fi===1&&x===-1)||
                          (fi===2&&y===1)||(fi===3&&y===-1)||
                          (fi===4&&z===1)||(fi===5&&z===-1);
            const color = isExt ? parseInt(VC_COLORS[face].replace('#',''), 16) : 0x0d0d0d;
            return new THREE.MeshLambertMaterial({ color });
          });
          const mesh = new THREE.Mesh(geo, mats);
          mesh.position.set(x, y, z);
          mesh.userData = { ox:x, oy:y, oz:z };
          this.cubies.push(mesh);
          this.cubeGroup.add(mesh);
        }
      }
    }
  }

  // Update mesh colors from cubeState
  updateColors() {
    const f = this.cubeState.faces;
    // Face sticker index → cubie position mapping
    // For each face, map sticker index to (x,y,z) and which material slot
    const FACE_CUBIE_MAP = {
      U: [ // y=1 face, material index 2
        {p:[-1,1,-1],m:2},{p:[0,1,-1],m:2},{p:[1,1,-1],m:2},
        {p:[-1,1, 0],m:2},{p:[0,1, 0],m:2},{p:[1,1, 0],m:2},
        {p:[-1,1, 1],m:2},{p:[0,1, 1],m:2},{p:[1,1, 1],m:2},
      ],
      D: [ // y=-1 face, material index 3
        {p:[-1,-1, 1],m:3},{p:[0,-1, 1],m:3},{p:[1,-1, 1],m:3},
        {p:[-1,-1, 0],m:3},{p:[0,-1, 0],m:3},{p:[1,-1, 0],m:3},
        {p:[-1,-1,-1],m:3},{p:[0,-1,-1],m:3},{p:[1,-1,-1],m:3},
      ],
      F: [ // z=1 face, material index 4
        {p:[-1, 1,1],m:4},{p:[0, 1,1],m:4},{p:[1, 1,1],m:4},
        {p:[-1, 0,1],m:4},{p:[0, 0,1],m:4},{p:[1, 0,1],m:4},
        {p:[-1,-1,1],m:4},{p:[0,-1,1],m:4},{p:[1,-1,1],m:4},
      ],
      B: [ // z=-1 face, material index 5
        {p:[ 1, 1,-1],m:5},{p:[0, 1,-1],m:5},{p:[-1, 1,-1],m:5},
        {p:[ 1, 0,-1],m:5},{p:[0, 0,-1],m:5},{p:[-1, 0,-1],m:5},
        {p:[ 1,-1,-1],m:5},{p:[0,-1,-1],m:5},{p:[-1,-1,-1],m:5},
      ],
      R: [ // x=1 face, material index 0
        {p:[1, 1, 1],m:0},{p:[1, 1, 0],m:0},{p:[1, 1,-1],m:0},
        {p:[1, 0, 1],m:0},{p:[1, 0, 0],m:0},{p:[1, 0,-1],m:0},
        {p:[1,-1, 1],m:0},{p:[1,-1, 0],m:0},{p:[1,-1,-1],m:0},
      ],
      L: [ // x=-1 face, material index 1
        {p:[-1, 1,-1],m:1},{p:[-1, 1, 0],m:1},{p:[-1, 1, 1],m:1},
        {p:[-1, 0,-1],m:1},{p:[-1, 0, 0],m:1},{p:[-1, 0, 1],m:1},
        {p:[-1,-1,-1],m:1},{p:[-1,-1, 0],m:1},{p:[-1,-1, 1],m:1},
      ],
    };

    for (const [faceName, map] of Object.entries(FACE_CUBIE_MAP)) {
      const stickers = f[faceName];
      map.forEach(({p, m}, idx) => {
        const cubie = this.cubies.find(c =>
          Math.round(c.position.x)===p[0] &&
          Math.round(c.position.y)===p[1] &&
          Math.round(c.position.z)===p[2]
        );
        if (cubie && stickers[idx]) {
          cubie.material[m].color.setStyle(stickers[idx]);
        }
      });
    }
  }

  // ── Controls ─────────────────────────────────────────
  initControls() {
    // Drag to rotate (camera orbit via rootGroup)
    this.container.addEventListener('touchstart', e => {
      if (e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
      this.isDragging = true;
      this.prevPos = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }, { passive: true });

    this.container.addEventListener('touchmove', e => {
      if (!this.isDragging) return;
      const dx = e.touches[0].pageX - this.prevPos.x;
      const dy = e.touches[0].pageY - this.prevPos.y;
      this.dragRotate(dx, dy);
      this.prevPos = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    }, { passive: true });

    this.container.addEventListener('touchend', () => { this.isDragging = false; });

    this.container.addEventListener('mousedown', e => {
      if (e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
      this.isDragging = true;
      this.prevPos = { x: e.pageX, y: e.pageY };
    });
    this.container.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      this.dragRotate(e.pageX - this.prevPos.x, e.pageY - this.prevPos.y);
      this.prevPos = { x: e.pageX, y: e.pageY };
    });
    this.container.addEventListener('mouseup', () => { this.isDragging = false; });

    // Move buttons
    this._lastTapMove = '';
    this._lastTapTime = 0;

    document.querySelectorAll('.vc-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => { e.preventDefault(); this.handleBtnTap(btn); }, { passive: false });
      btn.addEventListener('mousedown',  e => { e.preventDefault(); this.handleBtnTap(btn); });
    });

    // Popup options
    document.querySelectorAll('.vc-option').forEach(opt => {
      opt.addEventListener('touchstart', e => { e.preventDefault(); this.selectPopupOption(opt); }, { passive: false });
      opt.addEventListener('mousedown',  () => this.selectPopupOption(opt));
    });
  }

  dragRotate(dx, dy) {
    const speed = 0.007;
    // Only rotate around world Y (left/right drag) to preserve tilt
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dx * speed);
    // Allow slight vertical drag too
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), dy * speed);
    this.rootGroup.quaternion.premultiply(qY).premultiply(qX);
  }

  handleBtnTap(btn) {
    const move = btn.dataset.move;
    if (!move) return;

    // X/Y/Z — whole cube rotation, preserve tilt
    if (['X','Y','Z'].includes(move)) {
      this.applyMove(move);
      return;
    }

    // Double tap within 280ms = double move (R2)
    const now = Date.now();
    if (move === this._lastTapMove && now - this._lastTapTime < 280) {
      // Cancel any pending single
      clearTimeout(this._singleTapTimer);
      this._lastTapTime = 0;
      this._lastTapMove = '';
      this.applyMove(move + '2');
      this.animateBtnRipple(btn);
      return;
    }

    this._lastTapMove = move;
    this._lastTapTime = now;

    // Delay single tap slightly to allow double tap detection
    this._singleTapTimer = setTimeout(() => {
      if (this._lastTapMove === move) {
        this.applyMove(move);
        this._lastTapMove = '';
      }
    }, 150);

    this.animateBtnRipple(btn);
  }

  // Semi-circle ripple animation on button tap
  animateBtnRipple(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 200);
  }

  selectPopupOption(opt) {
    const popup = document.getElementById('vc-popup');
    if (!popup) return;
    const move = opt.textContent.trim();
    this.applyMove(move);
    popup.classList.remove('show');
  }

  // ── Apply a move ─────────────────────────────────────
  applyMove(move, isUndo = false) {
    if (this.isMoving) {
      this.moveQueue.push({ move, isUndo });
      return;
    }

    // Start timer on first non-rotation move
    if (!isUndo && !this.isTiming && !['X','Y','Z'].includes(move[0])) {
      this.startTimer();
    }

    this.vibrate(12);

    // Update internal state
    if (!['X','Y','Z'].includes(move[0])) {
      this.cubeState.applyMove(move);
    }

    // Record history
    if (!isUndo) {
      this.history.push(move);
      this.redoStack = [];
      this.updateHistoryDisplay();
    }

    // Animate 3D
    this.animate3DMove(move, () => {
      this.updateColors();

      // Check solved
      if (this.isTiming && !isUndo && this.cubeState.isSolved()) {
        this.stopTimer();
        const td = document.getElementById('vc-timer-display');
        if (td) td.style.color = '#00c853';
        if (typeof showToast === 'function') showToast('Solved! ' + (td ? td.textContent : ''));
      }

      // Next queued move
      if (this.moveQueue.length > 0) {
        const next = this.moveQueue.shift();
        this.applyMove(next.move, next.isUndo);
      }
    });
  }

  // ── 3D animation ─────────────────────────────────────
  animate3DMove(move, onDone) {
    this.isMoving = true;
    const base   = move.replace(/['\d]/g, '');
    const prime  = move.includes("'");
    const double = move.includes('2');

    // For X/Y/Z — rotate entire rootGroup smoothly
    if (['X','Y','Z'].includes(base)) {
      const axis  = base==='X' ? new THREE.Vector3(1,0,0)
                  : base==='Y' ? new THREE.Vector3(0,1,0)
                  :               new THREE.Vector3(0,0,1);
      let angle = prime ? Math.PI/2 : double ? Math.PI : -Math.PI/2;

      const startQ = this.rootGroup.quaternion.clone();
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      const endQ   = deltaQ.clone().multiply(startQ);

      const dur = 350, start = Date.now();
      const step = () => {
        const p = Math.min((Date.now()-start)/dur, 1);
        const e = p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
        this.rootGroup.quaternion.slerpQuaternions(startQ, endQ, e);
        if (p < 1) { requestAnimationFrame(step); }
        else { this.isMoving = false; onDone && onDone(); }
      };
      requestAnimationFrame(step);
      return;
    }

    // Face/slice move — rotate relevant cubies
    const axis     = this._getMoveAxis(base);
    const layerVal = this._getMoveLayerVal(base);
    let   angle    = prime ? Math.PI/2 : double ? Math.PI : -Math.PI/2;

    const moving = this.cubeGroup.children.filter(c => {
      const dot = Math.round(c.position.dot(axis));
      return dot === layerVal;
    });

    if (!moving.length) { this.isMoving = false; onDone && onDone(); return; }

    const saved = moving.map(m => ({ mesh:m, pos:m.position.clone(), quat:m.quaternion.clone() }));
    const rotQ  = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const duration = typeof animSpeed !== 'undefined' ? animSpeed : 300;
    const start    = Date.now();

    const step = () => {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = progress<0.5 ? 2*progress*progress : 1-Math.pow(-2*progress+2,2)/2;
      const interpQ  = new THREE.Quaternion().slerp(rotQ, eased);

      saved.forEach(({ mesh, pos, quat }) => {
        mesh.position.copy(pos.clone().applyQuaternion(interpQ));
        mesh.quaternion.copy(interpQ.clone().multiply(quat));
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Snap to grid
        saved.forEach(({ mesh, pos, quat }) => {
          const fp = pos.clone().applyQuaternion(rotQ);
          mesh.position.set(Math.round(fp.x), Math.round(fp.y), Math.round(fp.z));
          mesh.quaternion.copy(rotQ.clone().multiply(quat));
        });
        this.isMoving = false;
        onDone && onDone();
      }
    };
    requestAnimationFrame(step);
  }

  _getMoveAxis(base) {
    if (['R','L','M','X'].includes(base)) return new THREE.Vector3(1,0,0);
    if (['U','D','E','Y'].includes(base)) return new THREE.Vector3(0,1,0);
    return new THREE.Vector3(0,0,1);
  }

  _getMoveLayerVal(base) {
    if (base==='R') return 1;
    if (base==='L'||base==='M') return -1;
    if (base==='U') return 1;
    if (base==='D'||base==='E') return -1;
    if (base==='F'||base==='S') return 1;
    if (base==='B') return -1;
    return 0;
  }

  // ── Undo / Redo ──────────────────────────────────────
  undo() {
    if (!this.history.length) return;
    const move = this.history.pop();
    this.redoStack.push(move);
    // Invert the move
    let inv;
    if (move.includes('2'))  inv = move; // 2 is its own inverse
    else if (move.includes("'")) inv = move.replace("'", "");
    else inv = move + "'";
    this.applyMove(inv, true);
    this.updateHistoryDisplay();
  }

  redo() {
    if (!this.redoStack.length) return;
    const move = this.redoStack.pop();
    this.applyMove(move);
  }

  // ── Scramble ─────────────────────────────────────────
  async scramble() {
    this.stopTimer();
    const td = document.getElementById('vc-timer-display');
    if (td) { td.textContent = '0.00'; td.style.color = 'var(--w)'; }

    const moves = ['U','D','L','R','F','B'];
    const mods  = ["","'","2"];
    let last = '', scrambleMoves = [];

    for (let i = 0; i < 20; i++) {
      let f;
      do { f = moves[Math.floor(Math.random() * 6)]; } while (f === last);
      scrambleMoves.push(f + mods[Math.floor(Math.random() * 3)]);
      last = f;
    }

    this.cubeState.reset();
    this.buildCube(); // reset positions
    this.history = [];
    this.updateHistoryDisplay();

    // Apply scramble to internal state
    for (const m of scrambleMoves) this.cubeState.applyMove(m);
    this.updateColors();

    const el = document.getElementById('vc-scramble-text');
    if (el) { el.textContent = scrambleMoves.join(' '); el.style.display = 'block'; }

    if (typeof showToast === 'function') showToast('Scrambled!');
  }

  reset() {
    this.cubeState.reset();
    this.buildCube();
    this.setDefaultOrientation();
    this.history = [];
    this.redoStack = [];
    this.updateHistoryDisplay();
    this.stopTimer();
    const td = document.getElementById('vc-timer-display');
    if (td) { td.textContent = '0.00'; td.style.color = 'var(--w)'; }
    if (typeof showToast === 'function') showToast('Reset');
  }

  // ── Timer ────────────────────────────────────────────
  startTimer() {
    this.isTiming  = true;
    this.timerStart = Date.now();
    this.timerInterval = setInterval(() => {
      const ms = Date.now() - this.timerStart;
      const s  = Math.floor(ms / 1000);
      const cs = Math.floor((ms % 1000) / 10);
      const td = document.getElementById('vc-timer-display');
      if (td) td.textContent = `${s}.${String(cs).padStart(2,'0')}`;
    }, 50);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.isTiming = false;
  }

  // ── History display ──────────────────────────────────
  updateHistoryDisplay() {
    const el = document.getElementById('vc-history');
    if (!el) return;
    if (!this.history.length) { el.textContent = 'No moves yet'; return; }
    el.innerHTML = this.history
      .map((m, i) => `<span class="vc-history-move${i===this.history.length-1?' latest':''}">${m}</span>`)
      .join(' ');
    el.scrollLeft = el.scrollWidth;
  }

  // ── Settings ─────────────────────────────────────────
  updateSettings(key, value) {
    this.settings[key] = value;
    if (key === 'blindfold') { this.buildCube(); if (!value) this.updateColors(); }
    if (key === 'advanced') {
      const el = document.getElementById('vc-slice-controls');
      if (el) el.style.display = value ? 'flex' : 'none';
    }
  }

  vibrate(ms) {
    if (this.settings.vibration && navigator.vibrate) navigator.vibrate(ms);
  }

  toggleScramble() {
    const el = document.getElementById('vc-scramble-text');
    if (el) el.classList.toggle('visible');
  }

  // ── Render loop ──────────────────────────────────────
  startRenderLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

// ── Global handlers ──────────────────────────────────
function vcUndo()     { window.vCube?.undo(); }
function vcRedo()     { window.vCube?.redo(); }
function vcScramble() { window.vCube?.scramble(); }
function vcReset()    { window.vCube?.reset(); }

function initVirtualCube() {
  if (window.vCube) return;
  setTimeout(() => {
    try { window.vCube = new VirtualCube(); }
    catch(e) { console.error('VirtualCube init error:', e); }
  }, 80);
}

function toggleVCSetting(key) {
  const btn = document.getElementById('tog-vc-' + key);
  if (!btn) return;
  const isOn = btn.classList.toggle('on');
  window.vCube?.updateSettings(key, isOn);
}

function updateVCTheme(theme) {
  window.vCube?.updateSettings('theme', theme);
}

// Expose globals for script.js compatibility
window.vcUndo     = vcUndo;
window.vcRedo     = vcRedo;
window.vcScramble = vcScramble;
window.vcReset    = vcReset;
window.initVirtualCube   = initVirtualCube;
window.toggleVCSetting   = toggleVCSetting;
window.updateVCTheme     = updateVCTheme;
