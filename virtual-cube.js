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
    this.player.cameraLatitude  = -25;
    this.player.cameraLongitude = 0;
    this.player.style.pointerEvents = 'none';
    // Allow drag on container but snap back
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragLon    = 0;
    this._dragLat    = -25;
    this._initDrag();
  }

  _initDrag() {
    const c = this.container;
    c.addEventListener('touchstart', e=>{
      if(e.target.closest('.vc-btn,.vc-icon-btn')) return;
      this._isDragging = true;
      this._dragStartX = e.touches[0].clientX;
      this._dragStartY = e.touches[0].clientY;
    },{passive:true});

    c.addEventListener('touchmove', e=>{
      if(!this._isDragging) return;
      const dx = e.touches[0].clientX - this._dragStartX;
      const dy = e.touches[0].clientY - this._dragStartY;
      const newLon = this._dragLon + dx * 0.4;
      const newLat = Math.max(-45, Math.min(0, this._dragLat + dy * 0.25));
      try{
        this.player.cameraLongitude = newLon;
        this.player.cameraLatitude  = newLat;
      }catch(e){}
    },{passive:true});

    c.addEventListener('touchend', e=>{
      if(!this._isDragging) return;
      this._isDragging = false;
      // Snap back to default position with smooth transition
      this._snapToDefault();
    });

    // Mouse drag
    c.addEventListener('mousedown', e=>{
      if(e.target.closest('.vc-btn,.vc-icon-btn')) return;
      this._isDragging = true;
      this._dragStartX = e.clientX;
      this._dragStartY = e.clientY;
    });
    window.addEventListener('mousemove', e=>{
      if(!this._isDragging) return;
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      try{
        this.player.cameraLongitude = this._dragLon + dx * 0.4;
        this.player.cameraLatitude  = Math.max(-45,Math.min(0, this._dragLat + dy * 0.25));
      }catch(e){}
    });
    window.addEventListener('mouseup', e=>{
      if(!this._isDragging) return;
      this._isDragging = false;
      this._snapToDefault();
    });
  }

  _snapToDefault() {
    // Animate back to default lat/lon
    const startLon = this.player.cameraLongitude || 0;
    const startLat = this.player.cameraLatitude  || -25;
    const endLon   = this._dragLon; // snap to current base (changes with Y rotation)
    const endLat   = -25;
    const dur = 400, t0 = Date.now();
    const snap = () => {
      const p = Math.min((Date.now()-t0)/dur, 1);
      const e = 1 - Math.pow(1-p, 3); // ease out cubic
      try{
        this.player.cameraLongitude = startLon + (endLon - startLon) * e;
        this.player.cameraLatitude  = startLat + (endLat - startLat) * e;
      }catch(err){}
      if(p < 1) requestAnimationFrame(snap);
    };
    requestAnimationFrame(snap);
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

    this._holdBtn    = btn;
    this._holdMove   = move;
    this._startX     = pointer.clientX;
    this._startY     = pointer.clientY;
    this._selected   = 'normal';
    this._holding    = true;
    this._isHoldMode = true; // always show discs on press

    btn.classList.add('active');

    // Check double tap
    const now = Date.now();
    if (move === this._lastTapBtn && now - this._lastTap < 300) {
      this._lastTap = 0; this._lastTapBtn = '';
      this._holding = false; this._isHoldMode = false;
      this._hideDiscs();
      btn.classList.remove('active');
      this._execMove(move + '2');
      return;
    }
    this._lastTap = now;
    this._lastTapBtn = move;

    // Show discs immediately on every press
    this._showDiscs(btn, move);
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
    const move = this._holdMove;
    const btn  = this._holdBtn;
    if (!move) { this._holding=false; return; }

    btn && btn.classList.remove('active');
    this._holding    = false;
    this._isHoldMode = false;

    // Execute based on where finger released
    const toExec = this._resolveMove(move, this._selected || 'normal');
    this._hideDiscs();
    this._selected = null;
    this._holdMove = '';
    this._holdBtn  = null;
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

    const DISC_DIST = 68; // px — distance discs travel from center

    const MAP = {
      'R': { top:'R',  bottom:"R'", left:null, right:null },
      'L': { top:"L'", bottom:'L',  left:null, right:null },
      'M': { top:'M',  bottom:"M'", left:null, right:null },
      'X': { top:"X'", bottom:'X',  left:null, right:null },
      'U': { top:null, bottom:null,  left:"U'", right:'U'  },
      'F': { top:null, bottom:null,  left:"F'", right:'F'  },
      'D': { top:null, bottom:null,  left:"D'", right:'D'  },
      'B': { top:null, bottom:null,  left:"B'", right:'B'  },
      'Y': { top:null, bottom:null,  left:"Y'", right:'Y'  },
      'Z': { top:null, bottom:null,  left:"Z'", right:'Z'  },
      'E': { top:null, bottom:null,  left:"E'", right:'E'  },
    };
    const labels = MAP[move] || { top:move+"'", bottom:move, left:null, right:null };

    const topEl = document.getElementById('vc-disc-top');
    const botEl = document.getElementById('vc-disc-bottom');
    const lftEl = document.getElementById('vc-disc-left');
    const rgtEl = document.getElementById('vc-disc-right');
    const ctrEl = document.getElementById('vc-disc-center');

    // Set center label
    if (ctrEl) ctrEl.textContent = move;

    // Reset all discs to center first (no transition)
    [topEl,botEl,lftEl,rgtEl].forEach(el => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform  = 'translate(-50%,-50%)';
      el.classList.remove('vc-disc-active');
    });

    // Set labels and visibility
    if (topEl) { topEl.textContent = labels.top||''; topEl.style.display = labels.top ? 'flex':'none'; }
    if (botEl) { botEl.textContent = labels.bottom||''; botEl.style.display = labels.bottom ? 'flex':'none'; }
    if (lftEl) { lftEl.textContent = labels.left||''; lftEl.style.display = labels.left ? 'flex':'none'; }
    if (rgtEl) { rgtEl.textContent = labels.right||''; rgtEl.style.display = labels.right ? 'flex':'none'; }

    // Position popup centered on button
    const rect  = btn.getBoundingClientRect();
    const cRect = this.container.getBoundingClientRect();
    popup.style.left = (rect.left - cRect.left + rect.width  / 2) + 'px';
    popup.style.top  = (rect.top  - cRect.top  + rect.height / 2) + 'px';
    popup.classList.add('show');

    // Animate discs outward (re-enable transition after reset)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const T = `translate(-50%,-50%)`;
        if (topEl && labels.top)    { topEl.style.transition=''; topEl.style.transform=`${T} translateY(-${DISC_DIST}px)`; }
        if (botEl && labels.bottom) { botEl.style.transition=''; botEl.style.transform=`${T} translateY(${DISC_DIST}px)`; }
        if (lftEl && labels.left)   { lftEl.style.transition=''; lftEl.style.transform=`${T} translateX(-${DISC_DIST}px)`; }
        if (rgtEl && labels.right)  { rgtEl.style.transition=''; rgtEl.style.transform=`${T} translateX(${DISC_DIST}px)`; }
      });
    });
  }

  _hideDiscs() {
    const popup = document.getElementById('vc-disc-popup');
    if (!popup) return;
    const T = `translate(-50%,-50%)`;
    ['vc-disc-top','vc-disc-bottom','vc-disc-left','vc-disc-right'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.transition = 'transform 0.18s ease-in, background 0.12s, color 0.12s';
      el.style.transform  = T;
      el.classList.remove('vc-disc-active');
    });
    setTimeout(() => popup.classList.remove('show'), 200);
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
    try { this.player.cameraLatitude=-25; this.player.cameraLongitude=0; } catch(e){}
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
