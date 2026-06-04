// ═══════════════════════════════════════════════════════
//  VIRTUAL CUBE — twisty-player based
//  - cubing.js handles all cube logic + rendering
//  - Custom split-plate button UI
//  - X/Y/Z visual only (moves always relative to original)
//  - Toast auto-dismisses
// ═══════════════════════════════════════════════════════

class VirtualCubeController {
  constructor() {
    this.player   = document.querySelector('#vc-twisty-player');
    this.history  = [];
    this.redoStack= [];
    this.isTiming = false;
    this.timerStart = 0;
    this.timerInterval = null;
    this.settings = { vibration: false, inspection: false, advanced: false };

    // Visual-only rotation tracking (for X/Y/Z)
    this._visualRotX = -22; // degrees tilt toward user
    this._visualRotY = 0;

    if (!this.player) { console.error('twisty-player not found'); return; }
    this._initButtons();
    this._applyVisualTilt();
  }

  _applyVisualTilt() {
    if (!this.player) return;
    // Set camera orbit via twisty-player's orbitCoordinates
    try {
      this.player.cameraLatitude  = this._visualRotX;
      this.player.cameraLongitude = this._visualRotY;
    } catch(e) {
      // fallback CSS transform
      this.player.style.transform =
        `rotateX(${this._visualRotX}deg) rotateY(${this._visualRotY}deg)`;
    }
  }

  _initButtons() {
    // Use event delegation on the whole vc container
    const container = document.getElementById('vc-canvas-container');
    if (!container) return;

    // Touch: hold = show popup, release on plate = execute
    container.addEventListener('touchstart', e => {
      const btn = e.target.closest('.vc-btn[data-move]');
      if (!btn) return;
      e.preventDefault();
      this._startHold(btn, e.touches[0]);
    }, { passive: false });

    container.addEventListener('touchmove', e => {
      if (!this._holding) return;
      e.preventDefault();
      this._updateDrag(e.touches[0]);
    }, { passive: false });

    container.addEventListener('touchend', e => {
      if (!this._holding) return;
      e.preventDefault();
      this._endHold(e.changedTouches[0]);
    }, { passive: false });

    // Mouse support
    container.addEventListener('mousedown', e => {
      const btn = e.target.closest('.vc-btn[data-move]');
      if (!btn) return;
      this._startHold(btn, e);
    });
    window.addEventListener('mousemove', e => {
      if (!this._holding) return;
      this._updateDrag(e);
    });
    window.addEventListener('mouseup', e => {
      if (!this._holding) return;
      this._endHold(e);
    });

    // Icon buttons
    container.addEventListener('touchstart', e => {
      const icon = e.target.closest('.vc-icon-btn');
      if (!icon) return;
      e.preventDefault();
      const fn = icon.getAttribute('onclick');
      if (fn) { try { eval(fn); } catch(err){} }
    }, { passive: false });
  }

  _startHold(btn, pointer) {
    const move = btn.dataset.move;
    if (!move) return;

    this._holdBtn  = btn;
    this._holdMove = move;
    this._holding  = false; // not yet confirmed as hold
    this._startY   = pointer.clientY;
    this._startX   = pointer.clientX;
    this._selected = null;

    // Short delay — if still holding after 180ms, show popup
    this._holdTimer = setTimeout(() => {
      this._holding = true;
      this._showPopup(btn, move);
    }, 180);
  }

  _updateDrag(pointer) {
    if (!this._holding) return;
    const dy = pointer.clientY - this._startY;
    const threshold = 20;

    const plates = document.querySelectorAll('.vc-plate');
    plates.forEach(p => p.classList.remove('vc-plate-active'));

    if (dy < -threshold) {
      // Dragged up → top plate
      this._selected = 'top';
      const top = document.querySelector('.vc-plate-top');
      if (top) top.classList.add('vc-plate-active');
    } else if (dy > threshold) {
      // Dragged down → bottom plate
      this._selected = 'bottom';
      const bot = document.querySelector('.vc-plate-bottom');
      if (bot) bot.classList.add('vc-plate-active');
    } else {
      this._selected = null;
    }
  }

  _endHold(pointer) {
    clearTimeout(this._holdTimer);

    if (!this._holding) {
      // Was a quick tap — just execute normal move
      this._hidePopup();
      this.do(this._holdMove);
      this._holding = false;
      this._holdBtn = null;
      return;
    }

    // Was a hold — execute selected plate move or normal if center
    const move = this._holdMove;
    let toExecute = move; // default = normal

    if (this._selected === 'top') {
      toExecute = this._getTopMove(move);
    } else if (this._selected === 'bottom') {
      toExecute = this._getBottomMove(move);
    }

    this._hidePopup();
    this.do(toExecute);
    this._holding  = false;
    this._holdBtn  = null;
    this._selected = null;
  }

  // Split-plate orientation per button (matching reference image)
  _getTopMove(base) {
    const map = { U:"U", D:"D'", F:"F", B:"B'", R:"R", L:"L'", M:"M", E:"E'", S:"S" };
    return map[base] || base;
  }
  _getBottomMove(base) {
    const map = { U:"U'", D:"D", F:"F'", B:"B", R:"R'", L:"L", M:"M'", E:"E", S:"S'" };
    return map[base] || base + "'";
  }

  _showPopup(btn, move) {
    const popup = document.getElementById('vc-split-popup');
    if (!popup) return;

    const topMove    = this._getTopMove(move);
    const bottomMove = this._getBottomMove(move);

    popup.querySelector('.vc-plate-top').textContent    = topMove;
    popup.querySelector('.vc-plate-bottom').textContent = bottomMove;

    // Position popup over the button
    const rect = btn.getBoundingClientRect();
    const containerRect = document.getElementById('vc-canvas-container').getBoundingClientRect();
    popup.style.left = (rect.left - containerRect.left + rect.width/2) + 'px';
    popup.style.top  = (rect.top  - containerRect.top  + rect.height/2) + 'px';
    popup.classList.add('show');

    // Animate plates out
    popup.querySelector('.vc-plate-top').style.transform    = 'translateY(-52px)';
    popup.querySelector('.vc-plate-bottom').style.transform = 'translateY(52px)';
  }

  _hidePopup() {
    const popup = document.getElementById('vc-split-popup');
    if (!popup) return;
    const top = popup.querySelector('.vc-plate-top');
    const bot = popup.querySelector('.vc-plate-bottom');
    if (top) top.style.transform = 'translateY(0)';
    if (bot) bot.style.transform = 'translateY(0)';
    // Sink back in then hide
    setTimeout(() => popup.classList.remove('show'), 200);
  }

  // ── Execute a move ──────────────────────────────────
  async do(move, isUndo = false) {
    if (!this.player) return;

    // X/Y/Z = visual rotation only, don't record in history
    if (['X',"X'","X2",'Y',"Y'","Y2",'Z',"Z'","Z2"].includes(move)) {
      const base  = move.replace(/['\d]/g,'');
      const prime = move.includes("'");
      const double= move.includes('2');
      const angle = double ? 180 : 90;
      const dir   = prime ? 1 : -1;

      if (base === 'Y') this._visualRotY += dir * angle;
      if (base === 'X') this._visualRotX += dir * angle;
      this._applyVisualTilt();
      return;
    }

    // Start timer on first real move
    if (!isUndo && !this.isTiming) this._startTimer();

    if (this.settings.vibration && navigator.vibrate) navigator.vibrate(12);

    try {
      await this.player.experimentalAddMove(move);
    } catch(e) {
      console.warn('Move failed:', move, e);
    }

    if (!isUndo) {
      this.history.push(move);
      this.redoStack = [];
      this._updateHistory();
    }

    // Check solved
    if (this.isTiming && !isUndo) {
      try {
        const state = await this.player.experimentalModel.currentPattern.get();
        if (state.experimentalIsSolved?.()) {
          this._stopTimer();
          const td = document.getElementById('vc-timer-display');
          showToast('Solved! ' + (td ? td.textContent : ''));
        }
      } catch(e) {}
    }
  }

  undo() {
    if (!this.history.length) return;
    const mv = this.history.pop();
    this.redoStack.push(mv);
    const inv = mv.includes('2') ? mv
              : mv.includes("'") ? mv.replace("'","")
              : mv + "'";
    this.do(inv, true);
    this._updateHistory();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.do(this.redoStack.pop());
  }

  async scramble() {
    if (!this.player) return;
    this._stopTimer();

    try {
      const { randomScrambleForEvent } = await import('https://cdn.cubing.net/js/cubing/scramble');
      const scramble = await randomScrambleForEvent('333');
      const str = scramble.toString();

      this.player.alg = '';
      await this.player.experimentalAddMove(''); // reset
      this.player.alg = str;

      this.history = [];
      this.redoStack = [];
      this._updateHistory();

      const td = document.getElementById('vc-timer-display');
      if (td) { td.textContent = '0.00'; td.style.color = 'var(--w)'; }
      showToast('Scrambled!');
    } catch(e) {
      console.error('Scramble error:', e);
      // Fallback manual scramble
      const moves = ['U','D','L','R','F','B'];
      const mods  = ["","'","2"];
      let last = '', seq = [];
      for (let i = 0; i < 20; i++) {
        let f; do { f = moves[Math.floor(Math.random()*6)]; } while (f === last);
        seq.push(f + mods[Math.floor(Math.random()*3)]);
        last = f;
      }
      this.player.alg = seq.join(' ');
      this.history = [];
      this._updateHistory();
      showToast('Scrambled!');
    }
  }

  reset() {
    if (!this.player) return;
    this._stopTimer();
    this.player.alg = '';
    this.history = [];
    this.redoStack = [];
    this._visualRotX = -22;
    this._visualRotY = 0;
    this._applyVisualTilt();
    this._updateHistory();
    const td = document.getElementById('vc-timer-display');
    if (td) { td.textContent = '0.00'; td.style.color = 'var(--w)'; }
  }

  _startTimer() {
    this.isTiming   = true;
    this.timerStart = Date.now();
    this.timerInterval = setInterval(() => {
      const ms = Date.now() - this.timerStart;
      const s  = Math.floor(ms/1000);
      const cs = Math.floor((ms%1000)/10);
      const td = document.getElementById('vc-timer-display');
      if (td) td.textContent = `${s}.${String(cs).padStart(2,'0')}`;
    }, 50);
  }

  _stopTimer() {
    clearInterval(this.timerInterval);
    this.isTiming = false;
  }

  _updateHistory() {
    const el = document.getElementById('vc-history');
    if (!el) return;
    if (!this.history.length) { el.textContent = 'No moves yet'; return; }
    el.innerHTML = this.history.map((m, i) =>
      `<span class="vc-history-move${i===this.history.length-1?' latest':''}">${m}</span>`
    ).join(' ');
    el.scrollLeft = el.scrollWidth;
  }

  updateSettings(k, v) {
    this.settings[k] = v;
    if (k === 'advanced') {
      const el = document.getElementById('vc-slice-controls');
      if (el) el.style.display = v ? 'flex' : 'none';
    }
  }
}

// ── Init ─────────────────────────────────────────────
function initVirtualCube() {
  if (window.vCube) return;
  // Wait for twisty-player to be defined
  const tryInit = () => {
    if (customElements.get('twisty-player')) {
      window.vCube = new VirtualCubeController();
    } else {
      setTimeout(tryInit, 100);
    }
  };
  tryInit();
}

function vcUndo()     { window.vCube?.undo(); }
function vcRedo()     { window.vCube?.redo(); }
function vcScramble() { window.vCube?.scramble(); }
function vcReset()    { window.vCube?.reset(); }

function toggleVCSetting(k) {
  const b = document.getElementById('tog-vc-' + k);
  if (!b) return;
  window.vCube?.updateSettings(k, b.classList.toggle('on'));
}
function updateVCTheme(t) { window.vCube?.updateSettings('theme', t); }

window.initVirtualCube = initVirtualCube;
window.vcUndo = vcUndo; window.vcRedo = vcRedo;
window.vcScramble = vcScramble; window.vcReset = vcReset;
window.toggleVCSetting = toggleVCSetting;
window.updateVCTheme = updateVCTheme;
