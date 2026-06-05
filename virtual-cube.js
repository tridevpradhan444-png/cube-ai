// ═══════════════════════════════════════════════════════
//  VIRTUAL CUBE — twisty-player + custom disc UI
// ═══════════════════════════════════════════════════════

// Face mapping: as user rotates with X/Y/Z,
// logical button → actual cube face changes
// We track cumulative Y rotations to remap R/L/F/B
class FaceMapper {
  constructor() { this.reset(); }
  reset() {
    // Current facing: which cube face is at each visual position
    this.faces = { U:'U', D:'D', F:'F', B:'B', R:'R', L:'L' };
  }
  // Apply a whole-cube rotation to remap faces
  applyRotation(move) {
    const f = { ...this.faces };
    const base = move.replace(/['\d]/g,'');
    const times = move.includes('2') ? 2 : move.includes("'") ? 3 : 1;
    for (let i = 0; i < times; i++) {
      const prev = { ...this.faces };
      if (base === 'Y') {
        this.faces.F = prev.R; this.faces.R = prev.B;
        this.faces.B = prev.L; this.faces.L = prev.F;
      } else if (base === 'X') {
        this.faces.U = prev.F; this.faces.F = prev.D;
        this.faces.D = prev.B; this.faces.B = prev.U;
      } else if (base === 'Z') {
        this.faces.U = prev.L; this.faces.L = prev.D;
        this.faces.D = prev.R; this.faces.R = prev.U;
      }
    }
  }
  // Get actual cube face for a visual button
  get(visual) { return this.faces[visual] || visual; }
}

class VirtualCubeController {
  constructor() {
    this.player    = document.querySelector('#vc-twisty-player');
    this.container = document.getElementById('vc-canvas-container');
    this.history   = [];
    this.redoStack = [];
    this.isTiming  = false;
    this.timerStart = 0;
    this.timerInterval = null;
    this.faceMapper = new FaceMapper();
    this.settings = { vibration: false, advanced: false };

    // Drag state
    this._holding    = false;
    this._holdBtn    = null;
    this._holdMove   = '';
    this._holdTimer  = null;
    this._startX     = 0;
    this._startY     = 0;
    this._selected   = null;
    this._lastTap    = 0;
    this._lastTapBtn = '';

    // Horizontal drag limits (±120°)
    this._dragLon    = 0;  // current longitude offset from drag
    this._maxLon     = 120;

    if (!this.player) { console.error('twisty-player not found'); return; }
    this._setupPlayer();
    this._initButtons();
  }

  _setupPlayer() {
    // Set initial camera position: yellow top, green front, white bottom tilted toward viewer
    this.player.cameraLatitude  = -22;
    this.player.cameraLongitude = 0;
    this.player.cameraLatitudeLimits  = { min: -45, max: 5 };
    // Prevent drag on twisty-player itself — we handle it
    this.player.style.pointerEvents = 'none';
  }

  _initButtons() {
    if (!this.container) return;

    // Unified touch handler
    this.container.addEventListener('touchstart', e => {
      const btn = e.target.closest('.vc-btn[data-move]');
      if (btn) { e.preventDefault(); this._onBtnDown(btn, e.touches[0]); return; }
      const icon = e.target.closest('.vc-icon-btn');
      if (icon) { e.preventDefault(); const fn=icon.getAttribute('onclick'); if(fn) eval(fn); return; }
    }, { passive: false });

    this.container.addEventListener('touchmove', e => {
      if (this._holding) { e.preventDefault(); this._onDrag(e.touches[0]); }
    }, { passive: false });

    this.container.addEventListener('touchend', e => {
      if (this._holding) { e.preventDefault(); this._onUp(e.changedTouches[0]); }
    }, { passive: false });

    // Mouse
    this.container.addEventListener('mousedown', e => {
      const btn = e.target.closest('.vc-btn[data-move]');
      if (btn) { e.preventDefault(); this._onBtnDown(btn, e); }
    });
    window.addEventListener('mousemove', e => {
      if (this._holding) this._onDrag(e);
    });
    window.addEventListener('mouseup', e => {
      if (this._holding) this._onUp(e);
    });
  }

  _onBtnDown(btn, pointer) {
    const move = btn.dataset.move;
    if (!move) return;

    this._holdBtn  = btn;
    this._holdMove = move;
    this._startX   = pointer.clientX;
    this._startY   = pointer.clientY;
    this._selected = 'normal';
    this._holding  = false; // not confirmed as hold yet
    this._isHoldMode = false;

    btn.classList.add('active');

    // Check double tap first
    const now = Date.now();
    if (move === this._lastTapBtn && now - this._lastTap < 300) {
      this._lastTap = 0; this._lastTapBtn = '';
      clearTimeout(this._holdTimer);
      btn.classList.remove('active');
      this._execMove(move + '2');
      return;
    }
    this._lastTap = now;
    this._lastTapBtn = move;

    // After 200ms of holding → show discs
    this._holdTimer = setTimeout(() => {
      this._isHoldMode = true;
      this._holding = true;
      this._showDiscs(btn, move);
    }, 200);
  }

  _onDrag(pointer) {
    if (!this._holding) return;
    const dx = pointer.clientX - this._startX;
    const dy = pointer.clientY - this._startY;
    const threshold = 18;

    const move = this._holdMove;
    const isVertical = ['R','L','M','X'].includes(move);

    // Update disc highlight
    const topDisc = document.querySelector('#vc-disc-top');
    const botDisc = document.querySelector('#vc-disc-bottom');
    const lftDisc = document.querySelector('#vc-disc-left');
    const rgtDisc = document.querySelector('#vc-disc-right');

    [topDisc, botDisc, lftDisc, rgtDisc].forEach(d => d && d.classList.remove('vc-disc-active'));
    this._selected = 'normal';

    if (isVertical) {
      if (dy < -threshold) {
        this._selected = 'top'; topDisc && topDisc.classList.add('vc-disc-active');
      } else if (dy > threshold) {
        this._selected = 'bottom'; botDisc && botDisc.classList.add('vc-disc-active');
      }
    } else {
      if (dx > threshold) {
        this._selected = 'right'; rgtDisc && rgtDisc.classList.add('vc-disc-active');
      } else if (dx < -threshold) {
        this._selected = 'left'; lftDisc && lftDisc.classList.add('vc-disc-active');
      }
    }
  }

  _onUp(pointer) {
    clearTimeout(this._holdTimer);
    const move = this._holdMove;
    const btn  = this._holdBtn;

    if (!move) { this._holding = false; return; }

    btn && btn.classList.remove('active');

    if (!this._isHoldMode) {
      // Quick tap — just execute normal move
      this._holding = false;
      this._isHoldMode = false;
      this._execMove(move);
      return;
    }

    // Hold mode — execute selected disc
    this._holding = false;
    this._isHoldMode = false;
    const toExec = this._resolveMove(move, this._selected || 'normal');
    this._hideDiscs();
    this._selected = null;
    this._execMove(toExec);
  }

  // Resolve which actual move to execute based on button + direction
  _resolveMove(btn, direction) {
    // Map btn → moves for each direction
    const MAP = {
      // Vertical buttons: top/bottom
      'R': { normal:'R',  top:'R',  bottom:"R'" },
      'L': { normal:'L',  top:"L'", bottom:'L'  },
      'M': { normal:'M',  top:'M',  bottom:"M'" },
      'X': { normal:'X',  top:"X'", bottom:'X'  },
      // Horizontal buttons: right/left
      'U': { normal:'U',  right:'U',  left:"U'" },
      'F': { normal:'F',  right:'F',  left:"F'" },
      'D': { normal:'D',  right:'D',  left:"D'" },
      'B': { normal:'B',  right:'B',  left:"B'" },
      'Y': { normal:'Y',  right:'Y',  left:"Y'" },
      'Z': { normal:'Z',  right:'Z',  left:"Z'" },
      'E': { normal:'E',  right:'E',  left:"E'" },
    };

    const entry = MAP[btn];
    if (!entry) return btn;

    let raw = entry[direction] || entry.normal;

    // Remap through FaceMapper for face moves (not rotations)
    const isRotation = ['X','Y','Z'].includes(btn);
    if (!isRotation) {
      const actualFace = this.faceMapper.get(btn);
      if (actualFace !== btn) {
        // Replace the face letter in the move
        raw = raw.replace(btn, actualFace);
      }
    }
    return raw;
  }

  // ── Show split discs ─────────────────────────────────
  _showDiscs(btn, move) {
    const popup = document.getElementById('vc-disc-popup');
    if (!popup) return;

    const isVertical = ['R','L','M','X'].includes(move);

    // Set labels
    const MAP = {
      'R': { top:'R',  bottom:"R'", left:'', right:'' },
      'L': { top:"L'", bottom:'L',  left:'', right:'' },
      'M': { top:'M',  bottom:"M'", left:'', right:'' },
      'X': { top:"X'", bottom:'X',  left:'', right:'' },
      'U': { top:'',   bottom:'',   right:'U',  left:"U'" },
      'F': { top:'',   bottom:'',   right:'F',  left:"F'" },
      'D': { top:'',   bottom:'',   right:'D',  left:"D'" },
      'B': { top:'',   bottom:'',   right:'B',  left:"B'" },
      'Y': { top:'',   bottom:'',   right:'Y',  left:"Y'" },
      'Z': { top:'',   bottom:'',   right:'Z',  left:"Z'" },
      'E': { top:'',   bottom:'',   right:'E',  left:"E'" },
    };
    const labels = MAP[move] || { top:move, bottom:move+"'", left:'', right:'' };

    const topEl = document.getElementById('vc-disc-top');
    const botEl = document.getElementById('vc-disc-bottom');
    const lftEl = document.getElementById('vc-disc-left');
    const rgtEl = document.getElementById('vc-disc-right');
    const btnEl = document.getElementById('vc-disc-center');

    if (topEl) topEl.textContent = labels.top;
    if (botEl) botEl.textContent = labels.bottom;
    if (lftEl) lftEl.textContent = labels.left;
    if (rgtEl) rgtEl.textContent = labels.right;
    if (btnEl) btnEl.textContent = move;

    // Show relevant discs
    if (topEl) topEl.style.display = labels.top ? 'flex' : 'none';
    if (botEl) botEl.style.display = labels.bottom ? 'flex' : 'none';
    if (lftEl) lftEl.style.display = labels.left ? 'flex' : 'none';
    if (rgtEl) rgtEl.style.display = labels.right ? 'flex' : 'none';

    // Position popup over button
    const rect = btn.getBoundingClientRect();
    const cRect = this.container.getBoundingClientRect();
    const cx = rect.left - cRect.left + rect.width / 2;
    const cy = rect.top  - cRect.top  + rect.height / 2;

    popup.style.left = cx + 'px';
    popup.style.top  = cy + 'px';
    popup.classList.add('show');

    // Animate discs out
    requestAnimationFrame(() => {
      if (topEl && labels.top)    topEl.style.transform = 'translateY(-60px)';
      if (botEl && labels.bottom) botEl.style.transform = 'translateY(60px)';
      if (lftEl && labels.left)   lftEl.style.transform = 'translateX(-60px)';
      if (rgtEl && labels.right)  rgtEl.style.transform = 'translateX(60px)';
    });
  }

  _hideDiscs() {
    const popup = document.getElementById('vc-disc-popup');
    if (!popup) return;

    ['vc-disc-top','vc-disc-bottom','vc-disc-left','vc-disc-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.transform = 'translate(0,0)'; el.classList.remove('vc-disc-active'); }
    });

    setTimeout(() => popup.classList.remove('show'), 220);
  }

  // ── Execute move ─────────────────────────────────────
  async _execMove(move, isUndo = false) {
    if (!this.player) return;

    const base = move.replace(/['\d]/g,'');

    // Whole-cube rotations: update face mapper + camera longitude
    if (['X','Y','Z'].includes(base)) {
      this.faceMapper.applyRotation(move);
      try { await this.player.experimentalAddMove(move); } catch(e) {}
      if (!isUndo) { this.history.push(move); this.redoStack = []; this._updateHistory(); }
      return;
    }

    // Start timer on first face move
    if (!isUndo && !this.isTiming) this._startTimer();
    if (this.settings.vibration && navigator.vibrate) navigator.vibrate(12);

    try { await this.player.experimentalAddMove(move); } catch(e) { console.warn('Move failed:', move); }

    if (!isUndo) {
      this.history.push(move); this.redoStack = [];
      this._updateHistory();
    }
  }

  undo() {
    if (!this.history.length) return;
    const mv = this.history.pop();
    this.redoStack.push(mv);
    const inv = mv.includes('2') ? mv : mv.includes("'") ? mv.replace("'",'') : mv+"'";
    this._execMove(inv, true);
    this._updateHistory();
  }

  redo() { if (this.redoStack.length) this._execMove(this.redoStack.pop()); }

  async scramble() {
    this._stopTimer();
    try {
      const { randomScrambleForEvent } = await import('https://cdn.cubing.net/js/cubing/scramble');
      const scr = await randomScrambleForEvent('333');
      const str = scr.toString();
      if (this.player.alg !== undefined) this.player.alg = str;
      this.history = []; this.redoStack = [];
      this.faceMapper.reset();
      this._updateHistory();
      this._resetTimer();
      showToast('Scrambled!');
    } catch(e) {
      const mvs=['U','D','L','R','F','B'], mods=["","'","2"];
      let last='', seq=[];
      for(let i=0;i<20;i++){
        let f; do{f=mvs[Math.floor(Math.random()*6)];}while(f===last);
        seq.push(f+mods[Math.floor(Math.random()*3)]); last=f;
      }
      try { this.player.alg = seq.join(' '); } catch(e2){}
      this.history=[]; this.redoStack=[]; this.faceMapper.reset();
      this._updateHistory(); this._resetTimer();
      showToast('Scrambled!');
    }
  }

  reset() {
    this._stopTimer();
    try { this.player.alg = ''; } catch(e){}
    this.history=[]; this.redoStack=[];
    this.faceMapper.reset();
    this._updateHistory();
    this._resetTimer();
    // Reset camera to default
    try { this.player.cameraLatitude=-22; this.player.cameraLongitude=0; } catch(e){}
  }

  _startTimer() {
    this.isTiming=true; this.timerStart=Date.now();
    this.timerInterval=setInterval(()=>{
      const ms=Date.now()-this.timerStart;
      const s=Math.floor(ms/1000), cs=Math.floor((ms%1000)/10);
      const td=document.getElementById('vc-timer-display');
      if(td) td.textContent=`${s}.${String(cs).padStart(2,'0')}`;
    },50);
  }
  _stopTimer(){ clearInterval(this.timerInterval); this.isTiming=false; }
  _resetTimer(){
    this._stopTimer();
    const td=document.getElementById('vc-timer-display');
    if(td){td.textContent='0.00';td.style.color='var(--w)';}
  }

  _updateHistory(){
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

// ── Init & global API ────────────────────────────────
function initVirtualCube(){
  if(window.vCube) return;
  const tryInit=()=>{
    if(customElements.get('twisty-player')){
      window.vCube=new VirtualCubeController();
    } else { setTimeout(tryInit,150); }
  };
  tryInit();
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
function showVCSettings(){
  showScreen('vc-settings');
}

window.initVirtualCube=initVirtualCube;
window.vcUndo=vcUndo; window.vcRedo=vcRedo;
window.vcScramble=vcScramble; window.vcReset=vcReset;
window.toggleVCSetting=toggleVCSetting;
window.updateVCTheme=updateVCTheme;
window.showVCSettings=showVCSettings;
