(function () {
  'use strict';

  const PURPLE = '#534AB7', TEAL = '#1D9E75', CORAL = '#D85A30',
        PINK = '#D4537E', AMBER = '#BA7517', BLUE = '#378ADD';

  /* ===================== PARTÍCULAS INTERACTIVAS ===================== */
  (function () {
    const cv = document.getElementById('cParticles');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let mouse = { x: 150, y: 80 };
    const COLORS = [PURPLE, TEAL, CORAL, PINK, AMBER, BLUE];
    const particles = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * 300, y: Math.random() * 160,
        vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
        r: Math.random() * 3 + 1, c: COLORS[i % COLORS.length]
      });
    }

    function updateMouse(e) {
      const r = cv.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    cv.addEventListener('mousemove', updateMouse);
    cv.addEventListener('mouseleave', () => { mouse = { x: -999, y: -999 }; });

    function drawParticles() {
      ctx.clearRect(0, 0, 300, 160);
      for (const p of particles) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          const force = (60 - dist) / 60;
          p.vx -= (dx / dist) * force * 0.8;
          p.vy -= (dy / dist) * force * 0.8;
        }
        p.vx *= 0.96; p.vy *= 0.96;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 300) p.vx *= -1;
        if (p.y < 0 || p.y > 160) p.vy *= -1;

        for (const q of particles) {
          if (q === p) continue;
          const dx2 = q.x - p.x, dy2 = q.y - p.y, d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d < 60) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.c + '44';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();
      }
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
  })();

  /* ===================== VISUALIZADOR DE AUDIO ===================== */
  (function () {
    const cv = document.getElementById('cAudio');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let analyser = null, dataArr = null, animId = null, audioCtx = null;
    let micActive = false;

    function drawIdle() {
      ctx.clearRect(0, 0, 300, 160);
      const bars = 60;
      for (let i = 0; i < bars; i++) {
        const h = Math.sin(Date.now() / 800 + i * 0.3) * 20 + 22;
        ctx.fillStyle = PURPLE + '88';
        ctx.fillRect(i * (300 / bars), 80 - h, 300 / bars - 1, h * 2);
      }
      animId = requestAnimationFrame(drawIdle);
    }
    drawIdle();

    document.getElementById('btnAudio').addEventListener('click', async function () {
      if (micActive) return;
      cancelAnimationFrame(animId);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        src.connect(analyser);
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        this.textContent = 'Micrófono activo';
        this.setAttribute('aria-pressed', 'true');
        micActive = true;

        function loop() {
          analyser.getByteFrequencyData(dataArr);
          ctx.clearRect(0, 0, 300, 160);
          for (let i = 0; i < dataArr.length; i++) {
            const h = (dataArr[i] / 255) * 140;
            const hue = i * (240 / dataArr.length);
            ctx.fillStyle = `hsl(${hue + 220}, 70%, 55%)`;
            ctx.fillRect(i * (300 / dataArr.length), 160 - h, 300 / dataArr.length - 1, h);
          }
          animId = requestAnimationFrame(loop);
        }
        loop();
      } catch {
        this.textContent = 'Sin permiso';
      }
    });

    document.getElementById('btnSynth').addEventListener('click', function () {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [261.63, 329.63, 392, 523.25];
        for (let i = 0; i < notes.length; i++) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = notes[i];
          g.gain.setValueAtTime(0.3, ac.currentTime + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.18 + 0.4);
          o.connect(g);
          g.connect(ac.destination);
          o.start(ac.currentTime + i * 0.18);
          o.stop(ac.currentTime + i * 0.18 + 0.5);
        }
      } catch {
        /* silent fallback */
      }
    });
  })();

  /* ===================== BUBBLE SORT ===================== */
  (function () {
    const cv = document.getElementById('cSort');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const N = 60;
    let arr = [], comparing = [], sorted = [], running = false;

    function initArr() {
      arr = Array.from({ length: N }, (_, i) => i + 1);
      sorted = []; comparing = [];
    }

    function shuffle() {
      if (running) return;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      sorted = []; comparing = [];
      draw();
      document.getElementById('sortStatus').textContent = 'Mezclado';
    }

    function draw() {
      ctx.clearRect(0, 0, 620, 120);
      const w = 620 / N;
      for (let i = 0; i < N; i++) {
        const h = (arr[i] / N) * 100;
        ctx.fillStyle = sorted.includes(i) ? TEAL : comparing.includes(i) ? CORAL : PURPLE + 'cc';
        ctx.fillRect(i * w, 120 - h, w - 1, h);
      }
    }

    async function bubbleSort() {
      running = true;
      document.getElementById('sortStatus').textContent = 'Ordenando…';
      const delay = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length - i - 1; j++) {
          comparing = [j, j + 1];
          draw();
          await delay(21 - +document.getElementById('sortSpeed').value);
          if (arr[j] > arr[j + 1]) {
            [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          }
        }
        sorted.push(arr.length - 1 - i);
      }
      comparing = [];
      sorted = arr.map((_, i) => i);
      draw();
      document.getElementById('sortStatus').textContent = 'Completado';
      running = false;
    }

    initArr();
    shuffle();
    document.getElementById('btnSort').addEventListener('click', () => { if (!running) bubbleSort(); });
    document.getElementById('btnShuffle').addEventListener('click', shuffle);
  })();

  /* ===================== FÍSICA ===================== */
  (function () {
    const cv = document.getElementById('cPhysics');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const balls = [];
    const COLS = [PURPLE, TEAL, CORAL, PINK, AMBER, BLUE];
    let grav = 0.4;

    function addBall() {
      balls.push({
        x: Math.random() * 280 + 10, y: 10,
        vx: (Math.random() - 0.5) * 4, vy: 0,
        r: Math.random() * 10 + 6, c: COLS[balls.length % COLS.length],
        e: 0.7 + Math.random() * 0.2
      });
    }

    for (let i = 0; i < 5; i++) addBall();

    document.getElementById('btnBall').addEventListener('click', addBall);
    document.getElementById('btnClear').addEventListener('click', () => { balls.length = 0; });

    const gravSlider = document.getElementById('gravSlider');
    if (gravSlider) {
      gravSlider.addEventListener('input', e => { grav = +e.target.value; });
    }

    function physicsLoop() {
      ctx.clearRect(0, 0, 300, 180);
      for (const b of balls) {
        b.vy += grav;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -b.e; }
        if (b.x + b.r > 300) { b.x = 300 - b.r; b.vx *= -b.e; }
        if (b.y + b.r > 180) {
          b.y = 180 - b.r;
          b.vy *= -b.e;
          b.vx *= 0.98;
          if (Math.abs(b.vy) < 0.5) b.vy = 0;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.c;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff44';
        ctx.fill();
      }
      requestAnimationFrame(physicsLoop);
    }
    physicsLoop();
  })();

  /* ===================== MANDELBROT ===================== */
  (function () {
    const cv = document.getElementById('cMandel');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let view = { x: -2.5, y: -1.2, w: 3.5, h: 2.1 };

    function drawMandel() {
      const W = 300, H = 180, img = ctx.createImageData(W, H);
      for (let px = 0; px < W; px++) {
        for (let py = 0; py < H; py++) {
          let cr = view.x + (px / W) * view.w;
          let ci = view.y + (py / H) * view.h;
          let zr = 0, zi = 0, n = 0;
          while (n < 80 && zr * zr + zi * zi < 4) {
            const t = zr * zr - zi * zi + cr;
            zi = 2 * zr * zi + ci;
            zr = t;
            n++;
          }
          const idx = (py * W + px) * 4;
          if (n === 80) {
            img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = 0;
          } else {
            const t = n / 80;
            img.data[idx] = Math.round(83 * t + t * (1 - t) * 215);
            img.data[idx + 1] = Math.round(74 * t * (1 - t) * 2 * 200);
            img.data[idx + 2] = Math.round(183 * (1 - t) + t * 30);
          }
          img.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    cv.addEventListener('click', function (e) {
      const r = this.getBoundingClientRect();
      const px = (e.clientX - r.left) / 300, py = (e.clientY - r.top) / 180;
      const cx = view.x + px * view.w, cy = view.y + py * view.h;
      view.w *= 0.35; view.h *= 0.35;
      view.x = cx - view.w / 2; view.y = cy - view.h / 2;
      drawMandel();
    });

    document.getElementById('btnReset').addEventListener('click', function () {
      view = { x: -2.5, y: -1.2, w: 3.5, h: 2.1 };
      drawMandel();
    });

    drawMandel();
  })();

  /* ===================== GAME OF LIFE ===================== */
  (function () {
    const cv = document.getElementById('cLife');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const CELL = 7, COLS = Math.floor(620 / CELL), ROWS = Math.floor(140 / CELL);
    let grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    let running = true, animId = null, lastTime = 0;

    function randomize() {
      grid = Array.from({ length: ROWS }, () =>
        Uint8Array.from({ length: COLS }, () => Math.random() < 0.3 ? 1 : 0)
      );
    }

    function clear() {
      grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    }

    function nextGen() {
      const ng = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              n += grid[(r + dr + ROWS) % ROWS][(c + dc + COLS) % COLS];
            }
          }
          ng[r][c] = (grid[r][c] ? n === 2 || n === 3 : n === 3) ? 1 : 0;
        }
      }
      grid = ng;
    }

    function drawLife() {
      ctx.clearRect(0, 0, 620, 140);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]) {
            ctx.fillStyle = PURPLE;
            ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 1, CELL - 1);
          }
        }
      }
    }

    function lifeLoop(ts) {
      if (ts - lastTime > 120) {
        nextGen();
        drawLife();
        lastTime = ts;
      }
      if (running) animId = requestAnimationFrame(lifeLoop);
    }

    cv.addEventListener('click', function (e) {
      const r = this.getBoundingClientRect();
      const col = Math.floor((e.clientX - r.left) / CELL);
      const row = Math.floor((e.clientY - r.top) / CELL);
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        grid[row][col] = grid[row][col] ? 0 : 1;
        drawLife();
      }
    });

    const btnPlay = document.getElementById('btnLifePlay');
    btnPlay.addEventListener('click', function () {
      running = !running;
      this.textContent = running ? 'Pausar' : 'Reanudar';
      this.setAttribute('aria-pressed', String(!running));
      if (running) requestAnimationFrame(lifeLoop);
    });

    document.getElementById('btnLifeRand').addEventListener('click', function () {
      randomize();
      drawLife();
    });

    document.getElementById('btnLifeClear').addEventListener('click', function () {
      clear();
      drawLife();
    });

    randomize();
    drawLife();
    requestAnimationFrame(lifeLoop);
  })();
})();
