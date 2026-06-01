/**
 * Virtual Cube Module — Fixed
 *
 * Key fixes:
 * 1. Correct move directions (R = right layer rotates UP on front face)
 * 2. Cube state tracked logically (separate from Three.js visuals)
 * 3. Layer selection uses LOCAL cubie positions, not world positions
 * 4. isCubeSolved checks logical state, not geometry
 * 5. Undo handles R2 → R2 correctly
 * 6. Reset rebuilds cube to solved state
 * 7. Mouse support added alongside touch
 * 8. Scramble runs sequentially via queue, not broken async
 * 9. Controls always visible (no hide-after-solve)
 */

class VirtualCube {
    constructor() {
        this.container = document.getElementById('vc-canvas-container');
        this.canvas = document.getElementById('vc-canvas');

        // Logical cube state — separate from visual, always accurate
        // 6 faces × 9 stickers. Order: [U,D,F,B,R,L] = indices 0-5
        // Face sticker order: row-major, top-left to bottom-right
        this.state = this._solvedState();

        // Move history for undo/redo
        this.history = [];
        this.redoStack = [];

        // Animation queue — one move animates at a time
        this.moveQueue = [];
        this.isAnimating = false;

        // Drag state
        this.isDragging = false;
        this.dragMoved = false;
        this.prevPointer = { x: 0, y: 0 };
        this.pointerStart = { x: 0, y: 0 };

        // Button hold/tap state
        this.holdTimer = null;
        this.activeBtn = null;
        this.btnStartY = 0;
        this.lastTapTime = 0;
        this.lastTapMove = '';
        this.currentPopupSelection = 'normal'; // 'normal' | 'prime'

        // Timer
        this.timerInterval = null;
        this.timerStart = 0;
        this.isTiming = false;
        this.hasMovedSinceScramble = false;

        // Inspection
        this.inspectionTimer = null;
        this.inspectionTimeLeft = 15;

        // Settings (synced from app settings)
        this.settings = {
            advanced: false,
            vibration: false,
            sound: true,
            blindfold: false,
            inspection: false,
            theme: 'standard'
        };

        this.audioCtx = null;

        this.themes = {
            standard: { U: 0xffd700, D: 0xffffff, F: 0x00c853, B: 0x2979ff, R: 0xff6d00, L: 0xf44336 },
            neon:     { U: 0xffff00, D: 0xffffff, F: 0x00ff88, B: 0x0088ff, R: 0xff4400, L: 0xff00aa },
            pastel:   { U: 0xfffacd, D: 0xffffff, F: 0xb5ead7, B: 0xc7ceea, R: 0xffb7b2, L: 0xff9aa2 }
        };

        this.initThree();
        this.buildCubies();
        this.syncVisualsToState();
        this.initControls();
        this.startRenderLoop();
    }

    // ─── LOGICAL STATE ───────────────────────────────────────────────────────

    _solvedState() {
        // Each face is 9 stickers. Values are face letters: U Y D W F G B Bl R O L R(ed)
        return {
            U: Array(9).fill('U'),
            D: Array(9).fill('D'),
            F: Array(9).fill('F'),
            B: Array(9).fill('B'),
            R: Array(9).fill('R'),
            L: Array(9).fill('L'),
        };
    }

    _cloneState(s) {
        return { U: [...s.U], D: [...s.D], F: [...s.F], B: [...s.B], R: [...s.R], L: [...s.L] };
    }

    _rotateFaceCW(s, f) {
        const o = [...s[f]];
        s[f][0]=o[6]; s[f][1]=o[3]; s[f][2]=o[0];
        s[f][3]=o[7]; s[f][4]=o[4]; s[f][5]=o[1];
        s[f][6]=o[8]; s[f][7]=o[5]; s[f][8]=o[2];
    }

    _applyMoveCW(s, base) {
        // Standard WCA: clockwise when looking at that face from outside
        if (base === 'U') {
            this._rotateFaceCW(s, 'U');
            const t = [s.F[0],s.F[1],s.F[2]];
            s.F[0]=s.R[0]; s.F[1]=s.R[1]; s.F[2]=s.R[2];
            s.R[0]=s.B[0]; s.R[1]=s.B[1]; s.R[2]=s.B[2];
            s.B[0]=s.L[0]; s.B[1]=s.L[1]; s.B[2]=s.L[2];
            s.L[0]=t[0];   s.L[1]=t[1];   s.L[2]=t[2];
        } else if (base === 'D') {
            this._rotateFaceCW(s, 'D');
            const t = [s.F[6],s.F[7],s.F[8]];
            s.F[6]=s.L[6]; s.F[7]=s.L[7]; s.F[8]=s.L[8];
            s.L[6]=s.B[6]; s.L[7]=s.B[7]; s.L[8]=s.B[8];
            s.B[6]=s.R[6]; s.B[7]=s.R[7]; s.B[8]=s.R[8];
            s.R[6]=t[0];   s.R[7]=t[1];   s.R[8]=t[2];
        } else if (base === 'R') {
            this._rotateFaceCW(s, 'R');
            const t = [s.U[2],s.U[5],s.U[8]];
            s.U[2]=s.F[2]; s.U[5]=s.F[5]; s.U[8]=s.F[8];
            s.F[2]=s.D[2]; s.F[5]=s.D[5]; s.F[8]=s.D[8];
            s.D[2]=s.B[6]; s.D[5]=s.B[3]; s.D[8]=s.B[0];
            s.B[6]=t[0];   s.B[3]=t[1];   s.B[0]=t[2];
        } else if (base === 'L') {
            this._rotateFaceCW(s, 'L');
            const t = [s.U[0],s.U[3],s.U[6]];
            s.U[0]=s.B[8]; s.U[3]=s.B[5]; s.U[6]=s.B[2];
            s.B[8]=s.D[0]; s.B[5]=s.D[3]; s.B[2]=s.D[6];
            s.D[0]=s.F[0]; s.D[3]=s.F[3]; s.D[6]=s.F[6];
            s.F[0]=t[0];   s.F[3]=t[1];   s.F[6]=t[2];
        } else if (base === 'F') {
            this._rotateFaceCW(s, 'F');
            const t = [s.U[6],s.U[7],s.U[8]];
            s.U[6]=s.L[8]; s.U[7]=s.L[5]; s.U[8]=s.L[2];
            s.L[2]=s.D[0]; s.L[5]=s.D[1]; s.L[8]=s.D[2];
            s.D[0]=s.R[6]; s.D[1]=s.R[3]; s.D[2]=s.R[0];
            s.R[0]=t[2];   s.R[3]=t[1];   s.R[6]=t[0];
        } else if (base === 'B') {
            this._rotateFaceCW(s, 'B');
            const t = [s.U[0],s.U[1],s.U[2]];
            s.U[0]=s.R[2]; s.U[1]=s.R[5]; s.U[2]=s.R[8];
            s.R[2]=s.D[8]; s.R[5]=s.D[7]; s.R[8]=s.D[6];
            s.D[6]=s.L[0]; s.D[7]=s.L[3]; s.D[8]=s.L[6];
            s.L[0]=t[2];   s.L[3]=t[1];   s.L[6]=t[0];
        } else if (base === 'M') {
            // M follows L direction
            const t = [s.U[1],s.U[4],s.U[7]];
            s.U[1]=s.B[7]; s.U[4]=s.B[4]; s.U[7]=s.B[1];
            s.B[7]=s.D[1]; s.B[4]=s.D[4]; s.B[1]=s.D[7];
            s.D[1]=s.F[1]; s.D[4]=s.F[4]; s.D[7]=s.F[7];
            s.F[1]=t[0];   s.F[4]=t[1];   s.F[7]=t[2];
        } else if (base === 'E') {
            // E follows D direction
            const t = [s.F[3],s.F[4],s.F[5]];
            s.F[3]=s.L[3]; s.F[4]=s.L[4]; s.F[5]=s.L[5];
            s.L[3]=s.B[3]; s.L[4]=s.B[4]; s.L[5]=s.B[5];
            s.B[3]=s.R[3]; s.B[4]=s.R[4]; s.B[5]=s.R[5];
            s.R[3]=t[0];   s.R[4]=t[1];   s.R[5]=t[2];
        } else if (base === 'S') {
            // S follows F direction
            const t = [s.U[3],s.U[4],s.U[5]];
            s.U[3]=s.L[7]; s.U[4]=s.L[4]; s.U[5]=s.L[1];
            s.L[7]=s.D[5]; s.L[4]=s.D[4]; s.L[1]=s.D[3];
            s.D[5]=s.R[3]; s.D[4]=s.R[4]; s.D[3]=s.R[5];
            s.R[3]=t[3];   s.R[4]=t[4];   s.R[5]=t[5];
        }
        // X Y Z: whole-cube rotations — state doesn't change face stickers
        // (we don't track orientation of the cube itself in state)
    }

    _applyMove(state, moveStr) {
        const s = this._cloneState(state);
        const base = moveStr.replace(/['\d]/g, '');
        const prime = moveStr.includes("'");
        const double = moveStr.includes('2');
        const times = double ? 2 : (prime ? 3 : 1);
        for (let i = 0; i < times; i++) this._applyMoveCW(s, base);
        return s;
    }

    _isSolved(s) {
        for (const face of ['U','D','F','B','R','L']) {
            if (!s[face].every(c => c === s[face][0])) return false;
        }
        return true;
    }

    _inverseMove(move) {
        if (move.includes('2')) return move; // R2 inverse = R2
        if (move.includes("'")) return move.replace("'", '');
        return move + "'";
    }

    // ─── THREE.JS SETUP ──────────────────────────────────────────────────────

    initThree() {
        this.scene = new THREE.Scene();

        const w = this.container.clientWidth, h = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
        this.camera.position.set(0, 3.5, 7);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8);
        dl.position.set(5, 10, 8);
        this.scene.add(dl);
        const dl2 = new THREE.DirectionalLight(0xffffff, 0.2);
        dl2.position.set(-5, -3, -5);
        this.scene.add(dl2);

        // Root group: drag rotates this
        this.rootGroup = new THREE.Group();
        this.scene.add(this.rootGroup);

        // Cube group: face animations happen inside this
        this.cubeGroup = new THREE.Group();
        this.rootGroup.add(this.cubeGroup);

        // Default viewing angle
        this.rootGroup.quaternion.setFromEuler(new THREE.Euler(0.4, 0.5, 0));

        window.addEventListener('resize', () => {
            const w2 = this.container.clientWidth, h2 = this.container.clientHeight;
            this.camera.aspect = w2 / h2;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w2, h2);
        });
    }

    // ─── CUBIE MESH ──────────────────────────────────────────────────────────

    buildCubies() {
        // Remove old cubies
        while (this.cubeGroup.children.length) this.cubeGroup.remove(this.cubeGroup.children[0]);
        this.cubies = [];

        const gap = 0.05;
        const size = 1 - gap;

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const geo = new THREE.BoxGeometry(size, size, size);
                    // Material order in Three.js BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
                    // = R, L, U, D, F, B
                    const mats = [
                        new THREE.MeshLambertMaterial({ color: x === 1  ? this._faceHex('R') : 0x0a0a0a }),
                        new THREE.MeshLambertMaterial({ color: x === -1 ? this._faceHex('L') : 0x0a0a0a }),
                        new THREE.MeshLambertMaterial({ color: y === 1  ? this._faceHex('U') : 0x0a0a0a }),
                        new THREE.MeshLambertMaterial({ color: y === -1 ? this._faceHex('D') : 0x0a0a0a }),
                        new THREE.MeshLambertMaterial({ color: z === 1  ? this._faceHex('F') : 0x0a0a0a }),
                        new THREE.MeshLambertMaterial({ color: z === -1 ? this._faceHex('B') : 0x0a0a0a }),
                    ];
                    const mesh = new THREE.Mesh(geo, mats);
                    mesh.position.set(x, y, z);
                    // Store home position for layer detection
                    mesh.userData = { hx: x, hy: y, hz: z };
                    this.cubeGroup.add(mesh);
                    this.cubies.push(mesh);
                }
            }
        }
    }

    _faceHex(face) {
        const theme = this.themes[this.settings.theme] || this.themes.standard;
        if (this.settings.blindfold) return 0x222222;
        return theme[face] || 0x333333;
    }

    // ─── SYNC VISUALS TO LOGICAL STATE ──────────────────────────────────────
    // Maps face letter → [materialIndex, sign] for each axis position

    syncVisualsToState() {
        // For each cubie, determine which face stickers it shows and color them
        // materialIndex: 0=R(+x), 1=L(-x), 2=U(+y), 3=D(-y), 4=F(+z), 5=B(-z)

        for (const cubie of this.cubies) {
            const { hx, hy, hz } = cubie.userData;

            // R face (+x=1): materialIndex 0, sticker index from state.R
            if (hx === 1)  cubie.material[0].color.setHex(this._stickerHex('R', hx, hy, hz));
            if (hx === -1) cubie.material[1].color.setHex(this._stickerHex('L', hx, hy, hz));
            if (hy === 1)  cubie.material[2].color.setHex(this._stickerHex('U', hx, hy, hz));
            if (hy === -1) cubie.material[3].color.setHex(this._stickerHex('D', hx, hy, hz));
            if (hz === 1)  cubie.material[4].color.setHex(this._stickerHex('F', hx, hy, hz));
            if (hz === -1) cubie.material[5].color.setHex(this._stickerHex('B', hx, hy, hz));
        }
    }

    _stickerHex(face, x, y, z) {
        if (this.settings.blindfold) return 0x222222;
        const theme = this.themes[this.settings.theme] || this.themes.standard;
        const stateVal = this.state[face][this._stickerIdx(face, x, y, z)];
        return theme[stateVal] || 0x333333;
    }

    _stickerIdx(face, x, y, z) {
        // Returns 0-8 index into the face array
        // Row-major, top-left to bottom-right when looking at face from outside
        let row, col;
        if (face === 'U') { row = 1 - z; col = x + 1; }
        else if (face === 'D') { row = z + 1; col = x + 1; }
        else if (face === 'F') { row = 1 - y; col = x + 1; }
        else if (face === 'B') { row = 1 - y; col = 1 - x; }
        else if (face === 'R') { row = 1 - y; col = 1 - z; }
        else                   { row = 1 - y; col = z + 1; }
        return Math.max(0, Math.min(8, row * 3 + col));
    }

    // ─── MOVE APPLICATION ────────────────────────────────────────────────────

    applyMove(moveStr, isUndo = false) {
        if (!isUndo) {
            // Start timer on first real move after scramble
            if (!this.isTiming && this.hasMovedSinceScramble === false) {
                this.hasMovedSinceScramble = true;
                this._startTimer();
            }
            this.history.push(moveStr);
            this.redoStack = [];
        }

        this._vibrate(15);
        if (!isUndo) this._playMoveSound();

        // Update logical state immediately
        const isRotation = ['X', 'Y', 'Z'].includes(moveStr[0].toUpperCase());
        if (!isRotation) {
            this.state = this._applyMove(this.state, moveStr);
        }

        // Queue visual animation
        this.moveQueue.push(moveStr);
        this._processQueue();

        this._updateHistoryDisplay();
    }

    _processQueue() {
        if (this.isAnimating || this.moveQueue.length === 0) return;
        const move = this.moveQueue.shift();
        this.isAnimating = true;
        this._animateMove(move, () => {
            this.isAnimating = false;
            // After animation, sync colors from logical state
            this.syncVisualsToState();

            // Check solved
            if (this.isTiming && this._isSolved(this.state)) {
                this._stopTimer();
                const el = document.getElementById('vc-timer-display');
                if (el) showToast('Solved! ' + el.textContent);
            }

            this._processQueue();
        });
    }

    // ─── VISUAL ANIMATION ────────────────────────────────────────────────────

    _animateMove(moveStr, onDone) {
        const base = moveStr.replace(/['\d]/g, '').toUpperCase();
        const prime = moveStr.includes("'");
        const double = moveStr.includes('2');

        // Axis and layer for each move
        const MOVE_DEF = {
            R: { axis: new THREE.Vector3(1,0,0), layer: c => Math.round(c.position.x) === 1 },
            L: { axis: new THREE.Vector3(-1,0,0), layer: c => Math.round(c.position.x) === -1 },
            U: { axis: new THREE.Vector3(0,1,0), layer: c => Math.round(c.position.y) === 1 },
            D: { axis: new THREE.Vector3(0,-1,0), layer: c => Math.round(c.position.y) === -1 },
            F: { axis: new THREE.Vector3(0,0,1), layer: c => Math.round(c.position.z) === 1 },
            B: { axis: new THREE.Vector3(0,0,-1), layer: c => Math.round(c.position.z) === -1 },
            M: { axis: new THREE.Vector3(-1,0,0), layer: c => Math.round(c.position.x) === 0 },
            E: { axis: new THREE.Vector3(0,-1,0), layer: c => Math.round(c.position.y) === 0 },
            S: { axis: new THREE.Vector3(0,0,1), layer: c => Math.round(c.position.z) === 0 },
            X: { axis: new THREE.Vector3(1,0,0), layer: () => true },
            Y: { axis: new THREE.Vector3(0,1,0), layer: () => true },
            Z: { axis: new THREE.Vector3(0,0,1), layer: () => true },
        };

        const def = MOVE_DEF[base];
        if (!def) { onDone(); return; }

        // CW angle = positive rotation around positive axis = -PI/2 in Three.js right-hand convention
        // WCA clockwise: R = right layer rotates so front face goes up
        // Three.js: positive rotation around +X axis goes from +Z toward +Y (front goes up) ✓
        // So: CW move = angle = -PI/2, prime = +PI/2
        let angle = prime ? Math.PI / 2 : -Math.PI / 2;
        if (double) angle = Math.PI;

        const movingCubies = this.cubies.filter(def.layer);

        // Create a temporary pivot group
        const pivot = new THREE.Group();
        this.cubeGroup.add(pivot);
        movingCubies.forEach(c => {
            // Detach from cubeGroup, attach to pivot preserving world position
            const worldPos = c.position.clone();
            const worldQuat = c.quaternion.clone();
            pivot.add(c);
            c.position.copy(worldPos);
            c.quaternion.copy(worldQuat);
        });

        const duration = 220; // ms per move
        const startTime = performance.now();
        const startQ = new THREE.Quaternion();
        const endQ = new THREE.Quaternion().setFromAxisAngle(def.axis, angle);

        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            pivot.quaternion.slerpQuaternions(startQ, endQ, eased);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                // Snap exactly
                pivot.quaternion.copy(endQ);
                pivot.updateMatrixWorld(true);

                // Detach cubies from pivot back to cubeGroup, snap positions
                movingCubies.forEach(c => {
                    c.applyMatrix4(pivot.matrix);
                    this.cubeGroup.add(c);
                    c.position.set(
                        Math.round(c.position.x),
                        Math.round(c.position.y),
                        Math.round(c.position.z)
                    );
                    // Snap quaternion to nearest 90°
                    this._snapQuaternion(c.quaternion);
                });

                this.cubeGroup.remove(pivot);
                onDone();
            }
        };
        requestAnimationFrame(tick);
    }

    _snapQuaternion(q) {
        // Snap to nearest multiple of 90° rotation
        const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
        e.x = Math.round(e.x / (Math.PI / 2)) * (Math.PI / 2);
        e.y = Math.round(e.y / (Math.PI / 2)) * (Math.PI / 2);
        e.z = Math.round(e.z / (Math.PI / 2)) * (Math.PI / 2);
        q.setFromEuler(e);
    }

    // ─── SCRAMBLE ────────────────────────────────────────────────────────────

    scramble() {
        // Reset first
        this._hardReset();

        const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
        const mods = ['', "'", '2'];
        const oppFace = { U:'D', D:'U', L:'R', R:'L', F:'B', B:'F' };
        let last = '', secondLast = '';
        const moves = [];

        for (let i = 0; i < 20; i++) {
            let f;
            do { f = faces[Math.floor(Math.random() * 6)]; }
            while (f === last || (oppFace[f] === last && f === secondLast));
            const mod = mods[Math.floor(Math.random() * 3)];
            moves.push(f + mod);
            secondLast = last; last = f;
        }

        // Apply to logical state all at once (instant)
        for (const mv of moves) {
            this.state = this._applyMove(this.state, mv);
        }

        // Queue all visual animations (fast)
        const FAST_DUR = 40;
        this._animateFastScramble(moves, FAST_DUR, () => {
            this.syncVisualsToState();
        });

        this.currentScramble = moves.join(' ');
        const el = document.getElementById('vc-scramble-text');
        if (el) { el.textContent = this.currentScramble; el.classList.remove('visible'); }

        this.history = [];
        this.redoStack = [];
        this.hasMovedSinceScramble = false;
        this._updateHistoryDisplay();

        document.getElementById('vc-timer-display').textContent = '0.00';
        document.getElementById('vc-timer-display').style.color = 'var(--w)';

        if (this.settings.inspection) this._startInspection();
    }

    _animateFastScramble(moves, duration, onAllDone) {
        let i = 0;
        const next = () => {
            if (i >= moves.length) { onAllDone(); return; }
            const move = moves[i++];
            this._animateFastMove(move, duration, next);
        };
        next();
    }

    _animateFastMove(moveStr, duration, onDone) {
        const base = moveStr.replace(/['\d]/g, '').toUpperCase();
        const prime = moveStr.includes("'");
        const double = moveStr.includes('2');

        const MOVE_DEF = {
            R: { axis: new THREE.Vector3(1,0,0), layer: c => Math.round(c.position.x) === 1 },
            L: { axis: new THREE.Vector3(-1,0,0), layer: c => Math.round(c.position.x) === -1 },
            U: { axis: new THREE.Vector3(0,1,0), layer: c => Math.round(c.position.y) === 1 },
            D: { axis: new THREE.Vector3(0,-1,0), layer: c => Math.round(c.position.y) === -1 },
            F: { axis: new THREE.Vector3(0,0,1), layer: c => Math.round(c.position.z) === 1 },
            B: { axis: new THREE.Vector3(0,0,-1), layer: c => Math.round(c.position.z) === -1 },
            M: { axis: new THREE.Vector3(-1,0,0), layer: c => Math.round(c.position.x) === 0 },
            E: { axis: new THREE.Vector3(0,-1,0), layer: c => Math.round(c.position.y) === 0 },
            S: { axis: new THREE.Vector3(0,0,1), layer: c => Math.round(c.position.z) === 0 },
        };

        const def = MOVE_DEF[base];
        if (!def) { onDone(); return; }

        let angle = prime ? Math.PI / 2 : -Math.PI / 2;
        if (double) angle = Math.PI;

        const movingCubies = this.cubies.filter(def.layer);
        const pivot = new THREE.Group();
        this.cubeGroup.add(pivot);
        movingCubies.forEach(c => { const p = c.position.clone(); const q = c.quaternion.clone(); pivot.add(c); c.position.copy(p); c.quaternion.copy(q); });

        const startTime = performance.now();
        const startQ = new THREE.Quaternion();
        const endQ = new THREE.Quaternion().setFromAxisAngle(def.axis, angle);

        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            pivot.quaternion.slerpQuaternions(startQ, endQ, progress);
            if (progress < 1) { requestAnimationFrame(tick); return; }

            pivot.quaternion.copy(endQ);
            pivot.updateMatrixWorld(true);
            movingCubies.forEach(c => {
                c.applyMatrix4(pivot.matrix);
                this.cubeGroup.add(c);
                c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
                this._snapQuaternion(c.quaternion);
            });
            this.cubeGroup.remove(pivot);
            onDone();
        };
        requestAnimationFrame(tick);
    }

    // ─── UNDO / REDO ────────────────────────────────────────────────────────

    undo() {
        if (this.history.length === 0) { showToast('Nothing to undo'); return; }
        const move = this.history.pop();
        this.redoStack.push(move);
        const inv = this._inverseMove(move);
        // Update logical state
        this.state = this._applyMove(this.state, inv);
        // Queue visual
        this.moveQueue.push(inv);
        this._processQueue();
        this._updateHistoryDisplay();
    }

    redo() {
        if (this.redoStack.length === 0) { showToast('Nothing to redo'); return; }
        const move = this.redoStack.pop();
        this.history.push(move);
        this.state = this._applyMove(this.state, move);
        this.moveQueue.push(move);
        this._processQueue();
        this._updateHistoryDisplay();
    }

    // ─── RESET ──────────────────────────────────────────────────────────────

    _hardReset() {
        // Kill timer
        this._stopTimer();
        clearInterval(this.inspectionTimer);

        // Reset logical state
        this.state = this._solvedState();
        this.history = [];
        this.redoStack = [];
        this.moveQueue = [];
        this.isAnimating = false;
        this.hasMovedSinceScramble = false;

        // Rebuild cubies from scratch (clean positions & rotations)
        this.buildCubies();
        this.syncVisualsToState();
        this._updateHistoryDisplay();
    }

    reset() {
        this._hardReset();
        // Also reset viewing angle
        this.rootGroup.quaternion.setFromEuler(new THREE.Euler(0.4, 0.5, 0));
        document.getElementById('vc-timer-display').textContent = '0.00';
        document.getElementById('vc-timer-display').style.color = 'var(--w)';
    }

    // ─── TIMER ──────────────────────────────────────────────────────────────

    _startTimer() {
        if (this.isTiming) return;
        this.isTiming = true;
        this.timerStart = Date.now();
        this.timerInterval = setInterval(() => {
            const el = document.getElementById('vc-timer-display');
            if (el) el.textContent = this._fmtTime(Date.now() - this.timerStart);
        }, 10);
    }

    _stopTimer() {
        clearInterval(this.timerInterval);
        this.isTiming = false;
    }

    _fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        return `${s}.${cs.toString().padStart(2, '0')}`;
    }

    _startInspection() {
        clearInterval(this.inspectionTimer);
        this.inspectionTimeLeft = 15;
        const el = document.getElementById('vc-timer-display');
        if (el) { el.style.color = '#ffaa44'; el.textContent = '15'; }

        this.inspectionTimer = setInterval(() => {
            this.inspectionTimeLeft--;
            if (el) el.textContent = this.inspectionTimeLeft;
            if (this.inspectionTimeLeft <= 0) {
                clearInterval(this.inspectionTimer);
                if (el) { el.style.color = 'var(--w)'; el.textContent = '0.00'; }
                this._startTimer();
            }
        }, 1000);
    }

    // ─── CONTROLS ────────────────────────────────────────────────────────────

    initControls() {
        // Touch/mouse on buttons
        document.querySelectorAll('.vc-btn').forEach(btn => {
            btn.addEventListener('touchstart', e => this._onBtnDown(e, btn, e.touches[0].clientY), { passive: false });
            btn.addEventListener('touchmove', e => this._onBtnMove(e.touches[0].clientY), { passive: true });
            btn.addEventListener('touchend', e => this._onBtnUp(btn), { passive: true });
            btn.addEventListener('mousedown', e => { e.stopPropagation(); this._onBtnDown(e, btn, e.clientY); });
            btn.addEventListener('mouseup', e => { e.stopPropagation(); this._onBtnUp(btn); });
        });

        const popup = document.getElementById('vc-popup');
        if (popup) {
            const opts = popup.querySelectorAll('.vc-option');
            const onPick = (sel) => (e) => {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                const base = popup.dataset.baseMove;
                if (!base) return;
                this._setPopupSelection(sel);
                this.applyMove(sel === 'prime' ? base + "'" : base);
                this._hidePopup();
                this.activeBtn = null;
            };
            if (opts[0]) {
                opts[0].addEventListener('touchstart', onPick('normal'), { passive: false });
                opts[0].addEventListener('mousedown', onPick('normal'));
            }
            if (opts[1]) {
                opts[1].addEventListener('touchstart', onPick('prime'), { passive: false });
                opts[1].addEventListener('mousedown', onPick('prime'));
            }
        }

        // Drag on canvas — touch
        this.container.addEventListener('touchstart', e => {
            if (e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
            this.isDragging = true;
            this.dragMoved = false;
            this.pointerStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.prevPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });

        this.container.addEventListener('touchmove', e => {
            if (!this.isDragging) return;
            this._onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        this.container.addEventListener('touchend', () => { this.isDragging = false; });

        // Drag on canvas — mouse
        this.container.addEventListener('mousedown', e => {
            if (e.target.closest('.vc-btn,.vc-icon-btn,.vc-popup')) return;
            this.isDragging = true;
            this.dragMoved = false;
            this.pointerStart = { x: e.clientX, y: e.clientY };
            this.prevPointer = { x: e.clientX, y: e.clientY };
        });
        this.container.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            this._onDragMove(e.clientX, e.clientY);
        });
        this.container.addEventListener('mouseup', () => { this.isDragging = false; });
        this.container.addEventListener('mouseleave', () => { this.isDragging = false; });
    }

    _onDragMove(cx, cy) {
        const dx = cx - this.prevPointer.x;
        const dy = cy - this.prevPointer.y;
        this.prevPointer = { x: cx, y: cy };
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.dragMoved = true;

        const speed = 0.007;
        const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), dx * speed);
        const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), dy * speed);
        this.rootGroup.quaternion.premultiply(qY).premultiply(qX);
    }

    _onBtnDown(e, btn, clientY) {
        if (e.cancelable) e.preventDefault();
        const move = btn.dataset.move;
        this.activeBtn = btn;
        this.btnStartY = clientY;
        this._vibrate(10);
        this._showPopup(move, btn);
    }

    _onBtnMove(clientY) {
        if (!this.activeBtn) return;
        const diff = this.btnStartY - clientY;
        if (Math.abs(diff) > 25) {
            this._setPopupSelection(diff > 0 ? 'normal' : 'prime');
        }
    }

    _onBtnUp(btn) {
        clearTimeout(this.holdTimer);
        if (!this.activeBtn) return;

        const move = btn.dataset.move;
        const popup = document.getElementById('vc-popup');

        if (popup.classList.contains('show')) {
            const base = popup.dataset.baseMove;
            const finalMove = this.currentPopupSelection === 'prime' ? base + "'" : base;
            this.applyMove(finalMove);
            this._hidePopup();
        } else {
            this.applyMove(move);
        }
        this.activeBtn = null;
    }

    _showPopup(move, btn) {
        const popup = document.getElementById('vc-popup');
        if (!popup) return;
        popup.dataset.baseMove = move;
        const opts = popup.querySelectorAll('.vc-option');
        opts[0].textContent = move;
        opts[1].textContent = move + "'";
        if (btn) {
            const br = btn.getBoundingClientRect();
            const cr = this.container.getBoundingClientRect();
            const cx = br.left + br.width / 2 - cr.left;
            const cy = br.top + br.height / 2 - cr.top;
            popup.style.left = cx + 'px';
            popup.style.top = cy + 'px';
        }
        popup.classList.add('show');
        this._setPopupSelection('normal');
    }

    _hidePopup() { document.getElementById('vc-popup').classList.remove('show'); }

    _setPopupSelection(sel) {
        this.currentPopupSelection = sel;
        const opts = document.querySelectorAll('.vc-option');
        opts[0].classList.toggle('selected', sel === 'normal');
        opts[1].classList.toggle('selected', sel === 'prime');
    }

    // ─── HISTORY DISPLAY ─────────────────────────────────────────────────────

    _updateHistoryDisplay() {
        const el = document.getElementById('vc-history');
        if (!el) return;
        if (this.history.length === 0) { el.textContent = 'No moves yet'; return; }
        el.innerHTML = this.history.map((m, i) =>
            `<span class="vc-history-move ${i === this.history.length - 1 ? 'latest' : ''}">${m}</span>`
        ).join(' ');
        el.scrollLeft = el.scrollWidth;
    }

    // ─── SETTINGS ────────────────────────────────────────────────────────────

    updateSettings(key, value) {
        this.settings[key] = value;
        if (key === 'blindfold' || key === 'theme') {
            this.buildCubies();
            this.syncVisualsToState();
        }
        if (key === 'advanced') {
            const sc = document.getElementById('vc-slice-controls');
            if (sc) sc.style.display = value ? 'flex' : 'none';
        }
    }

    toggleScramble() {
        const el = document.getElementById('vc-scramble-text');
        if (el) el.classList.toggle('visible');
    }

    // ─── UTILS ───────────────────────────────────────────────────────────────

    _vibrate(ms) { if (this.settings.vibration && navigator.vibrate) navigator.vibrate(ms); }

    _playMoveSound() {
        if (!this.settings.sound) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            if (!this.audioCtx) this.audioCtx = new Ctx();
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => { });
            const now = this.audioCtx.currentTime;
            const o = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(170 + Math.random() * 40, now);
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.12, now + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
            o.connect(g);
            g.connect(this.audioCtx.destination);
            o.start(now);
            o.stop(now + 0.07);
        } catch (_) { }
    }

    startRenderLoop() {
        const tick = () => {
            requestAnimationFrame(tick);
            this.renderer.render(this.scene, this.camera);
        };
        tick();
    }
}

// ─── UI HANDLERS ─────────────────────────────────────────────────────────────

function vcUndo()     { if (window.vCube) window.vCube.undo(); }
function vcRedo()     { if (window.vCube) window.vCube.redo(); }
function vcScramble() { if (window.vCube) window.vCube.scramble(); }
function vcReset()    { if (window.vCube) window.vCube.reset(); }

function initVirtualCube() {
    if (!window.vCube) {
        window.vCube = new VirtualCube();
        for (const k of ['advanced', 'vibration', 'sound', 'blindfold', 'inspection']) {
            const el = document.getElementById('tog-vc-' + k);
            if (el) window.vCube.updateSettings(k, el.classList.contains('on'));
        }
        const sel = document.getElementById('sel-vc-theme');
        if (sel) window.vCube.updateSettings('theme', sel.value);
    }
}

function hookVirtualCubeToShowScreen() {
    if (typeof window.showScreen !== 'function') {
        setTimeout(hookVirtualCubeToShowScreen, 0);
        return;
    }
    if (window.showScreen._vcHooked) return;
    const orig = window.showScreen;
    const wrapped = function(id) {
        orig(id);
        if (id === 'virtual-cube') initVirtualCube();
    };
    wrapped._vcHooked = true;
    window.showScreen = wrapped;
}
hookVirtualCubeToShowScreen();

function toggleVCSetting(key) {
    const btn = document.getElementById('tog-vc-' + key);
    if (!btn) return;
    const isOn = btn.classList.toggle('on');
    if (window.vCube) window.vCube.updateSettings(key, isOn);
}

function updateVCTheme(theme) {
    if (window.vCube) window.vCube.updateSettings('theme', theme);
}
