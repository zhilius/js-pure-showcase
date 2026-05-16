(function () {
  'use strict';

  var DM = {
    _items: [], _obs: null, _hid: false,
    reg: function (el, start, stop) {
      this._items.push({ el: el, start: start, stop: stop });
      if (!this._obs) {
        var self = this;
        this._obs = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            for (var j = 0; j < self._items.length; j++) {
              var it = self._items[j];
              if (it.el !== e.target) continue;
              if (self._hid) continue;
              if (e.isIntersecting) it.start(); else it.stop();
              break;
            }
          }
        }, { threshold: 0 });
      }
      this._obs.observe(el);
    },
    init: function () {
      var self = this;
      document.addEventListener('visibilitychange', function () {
        self._hid = document.hidden;
        if (self._hid) { for (var i = 0; i < self._items.length; i++) self._items[i].stop(); }
        else { for (var i = 0; i < self._items.length; i++) { var r = self._items[i], bb = r.el.getBoundingClientRect(); if (bb.top < window.innerHeight) r.start(); } }
      });
      window.addEventListener('pagehide', function () { for (var i = 0; i < self._items.length; i++) self._items[i].stop(); });
      window.addEventListener('pageshow', function () {
        self._hid = false;
        for (var i = 0; i < self._items.length; i++) { var r = self._items[i], bb = r.el.getBoundingClientRect(); if (bb.top < window.innerHeight) r.start(); }
      });
    }
  };
  DM.init();

  var PURPLE = '#534AB7', TEAL = '#1D9E75', CORAL = '#D85A30',
      PINK = '#D4537E', AMBER = '#BA7517', BLUE = '#378ADD';
  var COLORS = [PURPLE, TEAL, CORAL, PINK, AMBER, BLUE];

  function initCanvas(id, w, h) {
    var cv = document.getElementById(id);
    if (!cv) return null;
    var dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.aspectRatio = w + '/' + h;
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { cv: cv, ctx: ctx, w: w, h: h, dpr: dpr };
  }

  function getPos(e, cv) {
    var r = cv.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  /* PARTICLES */
  (function () {
    var c = initCanvas('cParticles', 300, 160);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var mouse = { x: 150, y: 80 };
    var particles = [];
    for (var i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * 300, y: Math.random() * 160,
        vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
        r: Math.random() * 3 + 1, c: COLORS[i % COLORS.length]
      });
    }
    function onMove(e) { e.preventDefault(); mouse = getPos(e, cv); }
    function onLeave() { mouse = { x: -999, y: -999 }; }
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseleave', onLeave);
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onLeave);
    var aid = null;
    function draw() {
      ctx.clearRect(0, 0, 300, 160);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var dx = mouse.x - p.x, dy = mouse.y - p.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60 && dist > 0) {
          var force = (60 - dist) / 60;
          p.vx -= (dx / dist) * force * 0.8;
          p.vy -= (dy / dist) * force * 0.8;
        }
        p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx; p.y += p.vy;
        if (p.x < p.r) { p.x = p.r; p.vx *= -1.5; }
        if (p.x > 300 - p.r) { p.x = 300 - p.r; p.vx *= -1.5; }
        if (p.y < p.r) { p.y = p.r; p.vy *= -1.5; }
        if (p.y > 160 - p.r) { p.y = 160 - p.r; p.vy *= -1.5; }
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx2 = q.x - p.x, dy2 = q.y - p.y;
          if (dx2 * dx2 + dy2 * dy2 < 3600) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = p.c + '44'; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c; ctx.fill();
      }
      aid = requestAnimationFrame(draw);
    }
    function start() { if (!aid) aid = requestAnimationFrame(draw); }
    function stop() { if (aid) { cancelAnimationFrame(aid); aid = null; } }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    start();
  })();

  /* AUDIO */
  (function () {
    var c = initCanvas('cAudio', 300, 160);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var stream = null, mediaRecorder = null, chunks = [];
    var audioBlob = null, audioUrl = null;
    var audioCtx = null, analyser = null, dataArr = null, animId = null;
    var playAC = null, playAnalyser = null, playDataArr = null, playAnimId = null;
    var startTime = null, timerInterval = null;
    var recording = false;
    var btnRecord = document.getElementById('btnRecord');
    var btnStop = document.getElementById('btnStop');
    var btnPlay = document.getElementById('btnPlay');
    var btnDownload = document.getElementById('btnDownload');
    var recStatus = document.getElementById('recStatus');

    var idleAid = null;
    function drawIdle() {
      ctx.clearRect(0, 0, 300, 160);
      var bars = 60, bw = 300 / bars;
      for (var i = 0; i < bars; i++) {
        var h = Math.sin(Date.now() / 800 + i * 0.3) * 20 + 22;
        ctx.fillStyle = PURPLE + '88';
        ctx.fillRect(i * bw, 80 - h, bw - 1, h * 2);
      }
      idleAid = requestAnimationFrame(drawIdle);
    }

    function stopVis() {
      cancelAnimationFrame(animId);
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      analyser = null; dataArr = null;
    }

    function startVis(s) {
      stopVis();
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(s);
      analyser = audioCtx.createAnalyser(); analyser.fftSize = 128;
      src.connect(analyser);
      dataArr = new Uint8Array(analyser.frequencyBinCount);
      function loop() {
        analyser.getByteFrequencyData(dataArr);
        ctx.clearRect(0, 0, 300, 160);
        var len = dataArr.length, bw2 = 300 / len;
        for (var i = 0; i < len; i++) {
          var h = (dataArr[i] / 255) * 140, hue = i * (240 / len);
          ctx.fillStyle = 'hsl(' + (hue + 220) + ',70%,55%)';
          ctx.fillRect(i * bw2, 160 - h, bw2 - 1, h);
        }
        animId = requestAnimationFrame(loop);
      }
      loop();
    }

    function cleanupStream() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    }

    function stopPlayVis() {
      if (playAnimId) { cancelAnimationFrame(playAnimId); playAnimId = null; }
      if (playAC) { playAC.close(); playAC = null; }
      playAnalyser = null; playDataArr = null;
    }

    function startPlayVis(el) {
      stopPlayVis();
      stopVis();
      if (!idleAid && cardVisible) drawIdle();
      playAC = new (window.AudioContext || window.webkitAudioContext)();
      var src = playAC.createMediaElementSource(el);
      playAnalyser = playAC.createAnalyser(); playAnalyser.fftSize = 128;
      src.connect(playAnalyser); playAnalyser.connect(playAC.destination);
      playDataArr = new Uint8Array(playAnalyser.frequencyBinCount);
      function loop() {
        playAnalyser.getByteFrequencyData(playDataArr);
        ctx.clearRect(0, 0, 300, 160);
        var len = playDataArr.length, bw = 300 / len;
        for (var i = 0; i < len; i++) {
          var h = (playDataArr[i] / 255) * 140, hue = i * (240 / len);
          ctx.fillStyle = 'hsl(' + (hue + 220) + ',70%,55%)';
          ctx.fillRect(i * bw, 160 - h, bw - 1, h);
        }
        playAnimId = requestAnimationFrame(loop);
      }
      loop();
    }

    btnRecord.addEventListener('click', async function () {
      try {
        cleanupStream();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startVis(stream);
        chunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = function () {
          audioBlob = new Blob(chunks, { type: 'audio/webm' });
          audioUrl = URL.createObjectURL(audioBlob);
          btnPlay.disabled = false;
          btnDownload.href = audioUrl;
          btnDownload.hidden = false;
          cleanupStream();
          stopVis();
          if (!idleAid && cardVisible) drawIdle();
          if (timerInterval) clearInterval(timerInterval);
          btnRecord.disabled = false; btnStop.disabled = true;
          recStatus.textContent = 'Ready — ' + Math.floor((Date.now() - startTime) / 1000) + 's';
          startTime = null; recording = false;
        };
        mediaRecorder.start();
        recording = true;
        startTime = Date.now();
        timerInterval = setInterval(function () {
          var elapsed = Math.floor((Date.now() - startTime) / 1000);
          var m = String(Math.floor(elapsed / 60)).padStart(2, '0');
          var s = String(elapsed % 60).padStart(2, '0');
          recStatus.textContent = m + ':' + s;
        }, 100);
        btnRecord.disabled = true; btnStop.disabled = false;
      } catch (e) { recStatus.textContent = 'Mic not available'; }
    });

    btnStop.addEventListener('click', function () {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        btnStop.disabled = true;
      }
    });

    btnPlay.addEventListener('click', function () {
      if (!audioUrl) return;
      var el = new Audio(audioUrl);
      startPlayVis(el);
      el.play();
      el.addEventListener('timeupdate', function () {
        var cur = Math.floor(el.currentTime), dur = Math.floor(el.duration);
        var cm = String(Math.floor(cur / 60)).padStart(2, '0'), cs = String(cur % 60).padStart(2, '0');
        var dm = String(Math.floor(dur / 60)).padStart(2, '0'), ds = String(dur % 60).padStart(2, '0');
        recStatus.textContent = cm + ':' + cs + ' / ' + dm + ':' + ds;
      });
      el.addEventListener('ended', function () { stopPlayVis(); if (!idleAid && cardVisible) drawIdle(); recStatus.textContent = 'Done — ' + Math.floor(el.duration) + 's'; });
    });

    var cardVisible = true;
    function start() { cardVisible = true; if (!audioCtx && !playAC) drawIdle(); }
    function stop() { cardVisible = false; cancelAnimationFrame(idleAid); idleAid = null; cancelAnimationFrame(animId); animId = null; cancelAnimationFrame(playAnimId); playAnimId = null; }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    window.addEventListener('pagehide', function () {
      cleanupStream(); stopVis(); stopPlayVis(); if (timerInterval) clearInterval(timerInterval);
    });
    drawIdle();
  })();

  /* SORT */
  (function () {
    var c = initCanvas('cSort', 620, 120);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var N = 60, W = 620, H = 120;
    var arr = [], comparing = [], sorted = [], running = false, currentAlgo = 'bubble';
    var sortAC = null;
    function sortSound(val) {
      try {
        if (!sortAC) sortAC = new (window.AudioContext || window.webkitAudioContext)();
        var o = sortAC.createOscillator(), g = sortAC.createGain();
        o.connect(g); g.connect(sortAC.destination);
        o.frequency.value = 200 + (val / N) * 700;
        o.type = 'sine';
        var t = sortAC.currentTime;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.start(t); o.stop(t + 0.05);
      } catch (e) {}
    }
    function initArr() { arr = Array.from({ length: N }, function (_, i) { return i + 1; }); sorted = []; comparing = []; }
    function shuffle() { if (running) return; for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } sorted = []; comparing = []; draw(); document.getElementById('sortStatus').textContent = 'Shuffled'; }
    function draw() {
      ctx.clearRect(0, 0, W, H); var w = W / N;
      for (var i = 0; i < N; i++) {
        var h = (arr[i] / N) * 100;
        ctx.fillStyle = sorted.indexOf(i) > -1 ? TEAL : comparing.indexOf(i) > -1 ? CORAL : PURPLE + 'cc';
        ctx.fillRect(i * w, H - h, w - 1, h);
      }
    }
    function getSpeed() { return 21 - +document.getElementById('sortSpeed').value; }
    function sleep() { return new Promise(function (r) { setTimeout(r, getSpeed()); }); }
    async function sortComplete() {
      if (!running) { draw(); document.getElementById('sortStatus').textContent = 'Stopped'; return; }
      comparing = [];
      sorted = arr.map(function (_, i) { return i; });
      var w = W / N;
      for (var i = 0; i < N; i++) {
        if (!running) break;
        draw();
        sortSound(arr[i]);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(i * w, 0, w, H);
        await new Promise(function (r) { setTimeout(r, 10); });
      }
      draw();
      if (running) document.getElementById('sortStatus').textContent = 'Completed';
      running = false;
    }
    async function bubbleSort() {
      running = true; document.getElementById('sortStatus').textContent = 'Bubble sort...';
      for (var i = 0; i < arr.length; i++) {
        for (var j = 0; j < arr.length - i - 1; j++) {
          if (!running) return;
          comparing = [j, j + 1]; draw();
          sortSound(arr[j] > arr[j + 1] ? arr[j + 1] : arr[j]);
          await sleep();
          if (arr[j] > arr[j + 1]) { var t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t; }
        }
        sorted.push(arr.length - 1 - i);
      }
      await sortComplete();
    }
    async function quickSort() {
      running = true; document.getElementById('sortStatus').textContent = 'Quick sort...';
      async function partition(lo, hi) {
        var pivot = arr[hi], i = lo - 1;
        for (var j = lo; j < hi; j++) {
          if (!running) return -1;
          comparing = [j, hi]; draw();
          sortSound(arr[j]);
          await sleep();
          if (arr[j] <= pivot) { i++; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
        }
        var t = arr[i + 1]; arr[i + 1] = arr[hi]; arr[hi] = t;
        sorted.push(i + 1); return i + 1;
      }
      async function sort(lo, hi) {
        if (lo >= hi || !running) return;
        var pi = await partition(lo, hi);
        if (pi === -1) return;
        await sort(lo, pi - 1); await sort(pi + 1, hi);
      }
      await sort(0, arr.length - 1);
      await sortComplete();
    }
    async function selectionSort() {
      running = true; document.getElementById('sortStatus').textContent = 'Selection sort...';
      for (var i = 0; i < N - 1; i++) {
        var minIdx = i;
        for (var j = i + 1; j < N; j++) {
          if (!running) return;
          comparing = [j, minIdx]; draw();
          sortSound(arr[j]);
          await sleep();
          if (arr[j] < arr[minIdx]) minIdx = j;
        }
        if (minIdx !== i) { var t = arr[i]; arr[i] = arr[minIdx]; arr[minIdx] = t; }
        sorted.push(i);
      }
      sorted.push(N - 1);
      await sortComplete();
    }
    async function insertionSort() {
      running = true; document.getElementById('sortStatus').textContent = 'Insertion sort...';
      sorted.push(0);
      for (var i = 1; i < N; i++) {
        var key = arr[i], j = i - 1;
        while (j >= 0 && arr[j] > key) {
          if (!running) return;
          comparing = [j, j + 1]; draw();
          sortSound(arr[j]);
          await sleep();
          arr[j + 1] = arr[j]; j--;
        }
        arr[j + 1] = key;
        sorted.push(i);
      }
      await sortComplete();
    }
    async function mergeSort() {
      running = true; document.getElementById('sortStatus').textContent = 'Merge sort...';
      async function merge(lo, mid, hi) {
        var temp = [], i = lo, j = mid + 1;
        while (i <= mid && j <= hi) {
          comparing = [i, j]; draw();
          sortSound(arr[i] < arr[j] ? arr[i] : arr[j]);
          await sleep();
          if (!running) return;
          if (arr[i] <= arr[j]) { temp.push(arr[i]); i++; }
          else { temp.push(arr[j]); j++; }
        }
        while (i <= mid) temp.push(arr[i++]);
        while (j <= hi) temp.push(arr[j++]);
        for (var k = 0; k < temp.length; k++) {
          arr[lo + k] = temp[k];
          comparing = [lo + k]; draw();
          await sleep();
          if (!running) return;
        }
      }
      async function sort(lo, hi) {
        if (lo >= hi || !running) return;
        var mid = Math.floor((lo + hi) / 2);
        await sort(lo, mid);
        await sort(mid + 1, hi);
        await merge(lo, mid, hi);
      }
      await sort(0, N - 1);
      await sortComplete();
    }
    initArr(); shuffle();
    document.getElementById('btnSort').addEventListener('click', function () {
      if (running) return;
      var algos = { bubble: bubbleSort, quick: quickSort, selection: selectionSort, insertion: insertionSort, merge: mergeSort };
      algos[currentAlgo]();
    });
    document.getElementById('btnSortStop').addEventListener('click', function () {
      if (!running) return;
      running = false;
      document.getElementById('sortStatus').textContent = 'Stopping...';
    });
    document.getElementById('btnShuffle').addEventListener('click', shuffle);
    var algoBtns = document.querySelectorAll('.algo-btn');
    for (var i = 0; i < algoBtns.length; i++) {
      algoBtns[i].addEventListener('click', function () {
        if (running) return;
        for (var j = 0; j < algoBtns.length; j++) algoBtns[j].classList.remove('active');
        this.classList.add('active');
        currentAlgo = this.getAttribute('data-algo');
      });
    }
  })();

  /* PHYSICS */
  (function () {
    var c = initCanvas('cPhysics', 300, 180);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var balls = [], grav = 0.4;
    var physAC = null;
    function bounceSound(b) {
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed < 1) return;
      try {
        if (!physAC) physAC = new (window.AudioContext || window.webkitAudioContext)();
        var o = physAC.createOscillator(), g = physAC.createGain();
        o.connect(g); g.connect(physAC.destination);
        o.frequency.value = 800 - b.r * 30;
        o.type = 'triangle';
        var t = physAC.currentTime;
        var vol = Math.min(0.12, speed * 0.015);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o.start(t); o.stop(t + 0.08);
      } catch (e) {}
    }
    function addBall() { balls.push({ x: Math.random() * 280 + 10, y: 10, vx: (Math.random() - 0.5) * 4, vy: 0, r: Math.random() * 10 + 6, c: COLORS[balls.length % COLORS.length], e: 0.7 + Math.random() * 0.2, lastBounce: 0 }); }
    document.getElementById('btnBall').addEventListener('click', addBall);
    document.getElementById('btnClear').addEventListener('click', function () { balls.length = 0; });
    var gravSlider = document.getElementById('gravSlider');
    if (gravSlider) gravSlider.addEventListener('input', function (e) { grav = +e.target.value; });
    var aid = null;
    function loop() {
      ctx.clearRect(0, 0, 300, 180);
      var now = Date.now();
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i]; b.vy += grav; b.x += b.vx; b.y += b.vy;
        if (b.x - b.r < 0) { b.x = b.r; b.vx *= -b.e; if (now - b.lastBounce > 80) { bounceSound(b); b.lastBounce = now; } }
        if (b.x + b.r > 300) { b.x = 300 - b.r; b.vx *= -b.e; if (now - b.lastBounce > 80) { bounceSound(b); b.lastBounce = now; } }
        if (b.y + b.r > 180) { b.y = 180 - b.r; b.vy *= -b.e; b.vx *= 0.98; if (now - b.lastBounce > 80) { bounceSound(b); b.lastBounce = now; } if (Math.abs(b.vy) < 0.5) b.vy = 0; }
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fillStyle = b.c; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2); ctx.fillStyle = '#ffffff44'; ctx.fill();
      }
      aid = requestAnimationFrame(loop);
    }
    function start() { if (!aid) aid = requestAnimationFrame(loop); }
    function stop() { if (aid) { cancelAnimationFrame(aid); aid = null; } }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    start();
  })();

  /* MANDELBROT */
  (function () {
    var cv = document.getElementById('cMandel');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var view = { x: -2.5, y: -1.2, w: 3.5, h: 2.1 }, initView = { x: -2.5, y: -1.2, w: 3.5, h: 2.1 };
    var isDragging = false, dragStartX = 0, dragStartY = 0, dragStartView = null;
    var isRendering = false, needsRedraw = false;

    function drawMandel() {
      needsRedraw = true;
      if (isRendering) return;
      isRendering = true;
      needsRedraw = false;
      var W = 300, H = 180, img = ctx.createImageData(W, H);
      var row = 0;
      function renderChunk() {
        var startT = performance.now();
        while (row < H && performance.now() - startT < 10) {
          for (var px = 0; px < W; px++) {
            var cr = view.x + (px / W) * view.w, ci = view.y + (row / H) * view.h;
            var zr = 0, zi = 0, n = 0;
            while (n < 80 && zr * zr + zi * zi < 4) { var t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t; n++; }
            var idx = (row * W + px) * 4;
            if (n >= 80) { img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = 0; }
            else { var t = n / 80; img.data[idx] = Math.round(40 + 215 * Math.sqrt(t)); img.data[idx + 1] = Math.round(20 + 200 * Math.pow(t, 0.4)); img.data[idx + 2] = Math.round(183 * (1 - t * t)); }
            img.data[idx + 3] = 255;
          }
          row++;
        }
        if (row < H) {
          if (needsRedraw) { isRendering = false; drawMandel(); return; }
          requestAnimationFrame(renderChunk);
        } else {
          ctx.putImageData(img, 0, 0);
          isRendering = false;
          if (needsRedraw) drawMandel();
        }
      }
      renderChunk();
    }

    function zoomAt(cx, cy, factor) { view.w *= factor; view.h *= factor; view.x = cx - view.w / 2; view.y = cy - view.h / 2; if (view.w > initView.w) { view = { x: initView.x, y: initView.y, w: initView.w, h: initView.h }; } drawMandel(); }
    function getPos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) / 300, y: (t.clientY - r.top) / 180 }; }
    function onDown(e) { if (e.button === 2) return; e.preventDefault(); var p = getPos(e); isDragging = true; dragStartX = p.x; dragStartY = p.y; dragStartView = { x: view.x, y: view.y, w: view.w, h: view.h }; }
    function onMove(e) { e.preventDefault(); if (!isDragging) return; var p = getPos(e); view.x = dragStartView.x - (p.x - dragStartX) * dragStartView.w; view.y = dragStartView.y - (p.y - dragStartY) * dragStartView.h; drawMandel(); }
    function onUp(e) { if (!isDragging) return; var p = getPos(e); var dx = p.x - dragStartX, dy = p.y - dragStartY; isDragging = false; if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) { var cx = dragStartView.x + dragStartX * dragStartView.w, cy = dragStartView.y + dragStartY * dragStartView.h; zoomAt(cx, cy, 0.35); } }
    function onWheel(e) { e.preventDefault(); var p = getPos(e); var cx = view.x + p.x * view.w, cy = view.y + p.y * view.h; zoomAt(cx, cy, e.deltaY > 0 ? 1.6 : 0.6); }
    cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseup', onUp);
    cv.addEventListener('mouseleave', function () { isDragging = false; });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { e.preventDefault(); var p = getPos(e); isDragging = true; dragStartX = p.x; dragStartY = p.y; dragStartView = { x: view.x, y: view.y, w: view.w, h: view.h }; } }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); if (!isDragging || e.touches.length !== 1) return; var p = getPos(e); view.x = dragStartView.x - (p.x - dragStartX) * dragStartView.w; view.y = dragStartView.y - (p.y - dragStartY) * dragStartView.h; drawMandel(); }, { passive: false });
    cv.addEventListener('touchend', function (e) { if (!isDragging) return; var p = getPos({ clientX: (dragStartX * 300), clientY: (dragStartY * 180) }); isDragging = false; });
    document.getElementById('btnReset').addEventListener('click', function () { view = { x: -2.5, y: -1.2, w: 3.5, h: 2.1 }; drawMandel(); });
    function startM() { if (needsRedraw) drawMandel(); }
    function stopM() { isRendering = false; needsRedraw = false; }
    DM.reg(cv.closest('.card') || cv, startM, stopM);
    drawMandel();
  })();

  /* DRAW */
  (function () {
    var c = initCanvas('cDraw', 300, 180);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var tool = 'pen', drawing = false, startP = null;
    var undoStack = [], undoMax = 20;
    var drawAC = null, lastDrawSound = 0;
    var lastX = -1, lastY = -1;

    var indicator = document.createElement('div');
    indicator.style.cssText = 'position:fixed;pointer-events:none;border-radius:50%;border:2px solid rgba(255,255,255,0.5);transform:translate(-50%,-50%);z-index:9999;display:none;transition:none';
    document.body.appendChild(indicator);

    var iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;display:none;width:24px;height:24px;transform:translate(8px,-50%)';
    var iconCv = document.createElement('canvas');
    iconCv.width = 24; iconCv.height = 24;
    iconCv.style.cssText = 'width:24px;height:24px;filter:drop-shadow(0 0 3px rgba(0,0,0,0.8))';
    iconDiv.appendChild(iconCv);
    document.body.appendChild(iconDiv);
    var ictx = iconCv.getContext('2d');

    function drawToolIcon(t) {
      ictx.clearRect(0, 0, 24, 24);
      ictx.strokeStyle = '#fff'; ictx.fillStyle = '#fff'; ictx.lineWidth = 1.5; ictx.lineCap = 'round';
      if (t === 'pen') {
        ictx.beginPath(); ictx.moveTo(22, 2); ictx.lineTo(4, 20); ictx.lineTo(2, 22); ictx.closePath(); ictx.fillStyle = '#fff'; ictx.fill(); ictx.strokeStyle = '#aaa'; ictx.stroke();
        ictx.beginPath(); ictx.moveTo(16, 8); ictx.lineTo(8, 16); ictx.strokeStyle = '#333'; ictx.lineWidth = 1; ictx.stroke();
      } else if (t === 'eraser') {
        ictx.fillStyle = '#ff6666'; ictx.fillRect(2, 2, 20, 20); ictx.strokeStyle = '#fff'; ictx.strokeRect(2, 2, 20, 20);
        ictx.fillStyle = '#fff'; ictx.fillRect(8, 18, 8, 4);
      } else if (t === 'spray') {
        ictx.fillStyle = '#fff';
        for (var i = 0; i < 18; i++) { ictx.fillRect(Math.random() * 22 + 1, Math.random() * 22 + 1, 1.5, 1.5); }
      } else if (t === 'rect') {
        ictx.strokeStyle = '#fff'; ictx.strokeRect(3, 3, 18, 18);
      } else if (t === 'circle') {
        ictx.beginPath(); ictx.arc(12, 12, 9, 0, Math.PI * 2); ictx.stroke();
      } else if (t === 'line') {
        ictx.beginPath(); ictx.moveTo(2, 22); ictx.lineTo(22, 2); ictx.stroke();
      }
    }

    function drawSound(action) {
      if (Date.now() - lastDrawSound < 50) return;
      lastDrawSound = Date.now();
      try {
        if (!drawAC) drawAC = new (window.AudioContext || window.webkitAudioContext)();
        var o = drawAC.createOscillator(), g = drawAC.createGain();
        o.connect(g); g.connect(drawAC.destination);
        var t = drawAC.currentTime;
        if (action === 'pen') {
          o.type = 'sine'; o.frequency.setValueAtTime(300 + Math.random() * 400, t);
          g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
          o.start(t); o.stop(t + 0.02);
        } else if (action === 'eraser') {
          o.type = 'square'; o.frequency.setValueAtTime(120 + Math.random() * 60, t);
          g.gain.setValueAtTime(0.012, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          o.start(t); o.stop(t + 0.05);
        } else if (action === 'spray') {
          o.type = 'sawtooth'; o.frequency.setValueAtTime(1500 + Math.random() * 1000, t);
          g.gain.setValueAtTime(0.008, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
          o.start(t); o.stop(t + 0.015);
        } else if (action === 'rect') {
          o.type = 'sine'; o.frequency.setValueAtTime(220, t);
          g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          o.start(t); o.stop(t + 0.08);
        } else if (action === 'circle') {
          o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.linearRampToValueAtTime(660, t + 0.1);
          g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          o.start(t); o.stop(t + 0.12);
        } else if (action === 'line') {
          o.type = 'triangle'; o.frequency.setValueAtTime(250, t); o.frequency.linearRampToValueAtTime(800, t + 0.08);
          g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          o.start(t); o.stop(t + 0.1);
        }
      } catch (e) {}
    }

    function updateIndicator(e) {
      var r = cv.getBoundingClientRect();
      var x = e.clientX, y = e.clientY;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        indicator.style.display = 'block';
        iconDiv.style.display = 'block';
        var size = +document.getElementById('drawSize').value;
        if (tool === 'eraser') {
          var es = size * 3;
          indicator.style.width = es + 'px'; indicator.style.height = es + 'px';
          indicator.style.borderColor = 'rgba(255,80,80,0.7)';
          indicator.style.background = 'rgba(255,80,80,0.08)';
        } else if (tool === 'pen') {
          indicator.style.width = size + 'px'; indicator.style.height = size + 'px';
          indicator.style.borderColor = document.getElementById('drawColor').value + 'aa';
          indicator.style.background = 'transparent';
        } else {
          indicator.style.width = size + 'px'; indicator.style.height = size + 'px';
          indicator.style.borderColor = 'rgba(255,255,255,0.3)';
          indicator.style.borderStyle = tool === 'spray' ? 'dotted' : 'solid';
          indicator.style.background = 'transparent';
        }
        indicator.style.left = x + 'px'; indicator.style.top = y + 'px';
        drawToolIcon(tool);
        iconDiv.style.left = x + 'px'; iconDiv.style.top = y + 'px';
      } else {
        indicator.style.display = 'none';
        iconDiv.style.display = 'none';
      }
      lastX = x; lastY = y;
    }

    function saveState() { undoStack.push(ctx.getImageData(0, 0, 300, 180)); if (undoStack.length > undoMax) undoStack.shift(); }
    function undo() { if (undoStack.length) { ctx.putImageData(undoStack.pop(), 0, 0); } }
    function getPos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; }
    function setupCtx() {
      var col = document.getElementById('drawColor').value;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = +document.getElementById('drawSize').value;
      ctx.globalAlpha = +document.getElementById('drawOpacity').value;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    function onDown(e) {
      e.preventDefault(); drawing = true; startP = getPos(e);
      if (tool === 'pen' || tool === 'eraser') { saveState(); ctx.beginPath(); ctx.moveTo(startP.x, startP.y); drawSound(tool); }
      if (tool === 'spray') { saveState(); drawSound('spray'); }
    }
    function onMove(e) {
      e.preventDefault(); updateIndicator(e);
      if (!drawing) return;
      var p = getPos(e); setupCtx();
      if (tool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        drawSound('pen');
      } else if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = +document.getElementById('drawSize').value * 3;
        ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.globalCompositeOperation = 'source-over';
        drawSound('eraser');
      } else if (tool === 'spray') {
        var r = +document.getElementById('drawSize').value * 2;
        for (var k = 0; k < 15; k++) {
          var ox = (Math.random() - 0.5) * r, oy = (Math.random() - 0.5) * r;
          ctx.fillRect(p.x + ox, p.y + oy, 1.5, 1.5);
        }
        drawSound('spray');
      } else {
        ctx.clearRect(0, 0, 300, 180);
        if (undoStack.length) ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
        ctx.beginPath();
        if (tool === 'rect') {
          var fill = document.getElementById('drawFill').checked;
          if (fill) ctx.fillRect(startP.x, startP.y, p.x - startP.x, p.y - startP.y);
          ctx.strokeRect(startP.x, startP.y, p.x - startP.x, p.y - startP.y);
        } else if (tool === 'circle') {
          var rx = Math.abs(p.x - startP.x) / 2, ry = Math.abs(p.y - startP.y) / 2;
          var cx = (startP.x + p.x) / 2, cy = (startP.y + p.y) / 2;
          var fill = document.getElementById('drawFill').checked;
          ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
          if (fill) ctx.fill(); ctx.stroke();
        } else if (tool === 'line') {
          ctx.moveTo(startP.x, startP.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
      }
    }
    function onUp(e) {
      if (!drawing) return;
      var p = getPos(e);
      if (['rect', 'circle', 'line'].indexOf(tool) >= 0) { saveState(); onMove(e); drawSound(tool); }
      drawing = false; ctx.beginPath(); startP = null;
    }
    cv.addEventListener('mousemove', updateIndicator);
    cv.addEventListener('mouseleave', function () { indicator.style.display = 'none'; iconDiv.style.display = 'none'; });
    cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mouseup', onUp);
    cv.addEventListener('mouseleave', function (e) { onUp(e); });
    cv.addEventListener('touchstart', onDown, { passive: false });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onUp);

    var toolBtns = document.querySelectorAll('.tool-btn');
    for (var i = 0; i < toolBtns.length; i++) {
      toolBtns[i].addEventListener('click', function () {
        for (var j = 0; j < toolBtns.length; j++) toolBtns[j].classList.remove('active');
        this.classList.add('active');
        tool = this.getAttribute('data-tool');
        updateIndicator({ clientX: lastX, clientY: lastY });
      });
    }
    document.getElementById('btnDrawUndo').addEventListener('click', undo);
    document.getElementById('btnDrawClear').addEventListener('click', function () { saveState(); ctx.clearRect(0, 0, 300, 180); });
  })();

  /* CLOCK */
  (function () {
    var c = initCanvas('cClock', 300, 180);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var CX = 150, CY = 90, R = 72;
    var digital = document.getElementById('digitalTime');
    var tzSelect = document.getElementById('tzSelect');
    function tzTime() {
      var tz = tzSelect.value;
      var str = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var parts = str.split(':');
      return { h: +parts[0] % 12, m: +parts[1], s: +parts[2] + new Date().getMilliseconds() / 1000 };
    }
    var aid = null;
    function draw() {
      var t = tzTime();
      digital.textContent = new Date().toLocaleString('en-US', { timeZone: tzSelect.value, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + tzSelect.value.split('/').pop();
      ctx.clearRect(0, 0, 300, 180);
      ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a24'; ctx.strokeStyle = '#2a2a3e'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
      for (var i = 0; i < 12; i++) {
        var a = (i * Math.PI * 2) / 12 - Math.PI / 2, inner = i === 0 ? R - 12 : R - 6;
        ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * inner, CY + Math.sin(a) * inner);
        ctx.lineTo(CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2));
        ctx.strokeStyle = i % 3 === 0 ? '#e4e4ec' : '#9090aa'; ctx.lineWidth = i % 3 === 0 ? 2 : 1.5; ctx.stroke();
      }
      ctx.save(); ctx.translate(CX, CY);
      var hAngle = (t.h + t.m / 60) * (Math.PI * 2 / 12) - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hAngle) * 40, Math.sin(hAngle) * 40);
      ctx.strokeStyle = '#534AB7'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
      var mAngle = (t.m + t.s / 60) * (Math.PI * 2 / 60) - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mAngle) * 55, Math.sin(mAngle) * 55);
      ctx.strokeStyle = '#9090aa'; ctx.lineWidth = 2.5; ctx.stroke();
      var sAngle = t.s * (Math.PI * 2 / 60) - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sAngle) * 62, Math.sin(sAngle) * 62);
      ctx.strokeStyle = '#D85A30'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fillStyle = '#534AB7'; ctx.fill();
      ctx.restore();
      aid = requestAnimationFrame(draw);
    }
    function start() { if (!aid) aid = requestAnimationFrame(draw); }
    function stop() { if (aid) { cancelAnimationFrame(aid); aid = null; } }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    start();
  })();

  /* MATRIX */
  (function () {
    var c = initCanvas('cMatrix', 300, 180);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var COLS = Math.floor(300 / 14);
    var drops = [];
    for (var i = 0; i < COLS; i++) drops[i] = Math.floor(Math.random() * -40);
    var chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEF';
    var aid = null;
    function draw() {
      ctx.fillStyle = 'rgba(15,15,19,0.06)';
      ctx.fillRect(0, 0, 300, 180);
      for (var i = 0; i < COLS; i++) {
        var char = chars[Math.floor(Math.random() * chars.length)];
        var x = i * 14, y = drops[i] * 14;
        ctx.font = '12px monospace';
        ctx.fillStyle = '#0f0';
        ctx.fillText(char, x, y);
        if (y > 180 && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      aid = requestAnimationFrame(draw);
    }
    function start() { if (!aid) aid = requestAnimationFrame(draw); }
    function stop() { if (aid) { cancelAnimationFrame(aid); aid = null; } }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    start();
  })();

  /* CALCULATOR */
  (function () {
    var current = '', previous = '', operation = null, resetNext = false;
    var display = document.getElementById('calcDisplay');
    function updateDisplay() { display.textContent = current || '0'; }
    function pressNumber(num) {
      if (resetNext) { current = ''; resetNext = false; }
      if (current.length >= 12) return;
      current += num; updateDisplay();
    }
    function pressOperator(op) {
      if (current === '' && previous === '') return;
      if (previous !== '' && !resetNext) calculate();
      operation = op; previous = current; resetNext = true;
    }
    function calculate() {
      var prev = parseFloat(previous), curr = parseFloat(current);
      if (isNaN(prev) || isNaN(curr)) return;
      var result;
      switch (operation) {
        case '+': result = prev + curr; break;
        case '-': result = prev - curr; break;
        case '*': result = prev * curr; break;
        case '/': result = curr === 0 ? Infinity : prev / curr; break;
        default: return;
      }
      current = !isFinite(result) ? 'Error' : String(parseFloat(result.toFixed(10)));
      operation = null; previous = ''; updateDisplay();
    }
    function clearAll() { current = ''; previous = ''; operation = null; resetNext = false; updateDisplay(); }
    document.querySelectorAll('.calc-num').forEach(function (btn) { btn.addEventListener('click', function () { pressNumber(this.textContent); }); });
    document.querySelectorAll('.calc-op').forEach(function (btn) { btn.addEventListener('click', function () { pressOperator(this.textContent); }); });
    document.getElementById('calcEq').addEventListener('click', function () { if (operation && current !== '') calculate(); });
    document.getElementById('calcClear').addEventListener('click', clearAll);
  })();

  /* SNAKE */
  (function () {
    var c = initCanvas('cSnake', 300, 240);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var CELL = 12, COLS = Math.floor(300 / CELL), ROWS = Math.floor(240 / CELL);
    var snake, dir, nextDir, food, score, running = false, gameOver = false, timer = null;
    var scoreEl = document.getElementById('snakeScore');
    var snakeAC = null;
    function snakeSound(freq, dur) {
      try {
        if (!snakeAC) snakeAC = new (window.AudioContext || window.webkitAudioContext)();
        var o = snakeAC.createOscillator(), g = snakeAC.createGain();
        o.connect(g); g.connect(snakeAC.destination);
        o.frequency.value = freq; o.type = 'square';
        var t = snakeAC.currentTime;
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      } catch (e) {}
    }

    function reset() {
      snake = [{ x: 5, y: 7 }]; dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
      score = 0; gameOver = false; running = false; if (timer) { clearTimeout(timer); timer = null; }
      spawnFood(); updateScore();
    }
    function spawnFood() {
      do { food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
      while (snake.some(function (s) { return s.x === food.x && s.y === food.y; }));
    }
    function updateScore() { scoreEl.textContent = 'Score: ' + score; }
    function drawSnake() {
      ctx.clearRect(0, 0, 300, 240);
      if (!snake) return;
      for (var i = 0; i < snake.length; i++) {
        var s = snake[i];
        ctx.fillStyle = i === 0 ? '#534AB7' : '#1D9E75';
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      }
      ctx.fillStyle = '#D85A30';
      ctx.beginPath(); ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, 300, 240);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Game Over', 150, 110);
        ctx.font = '14px sans-serif'; ctx.fillStyle = '#b0b0c8'; ctx.fillText('Press Start', 150, 145);
      }
    }
    function gameLoop() {
      if (!running) return;
      dir = { x: nextDir.x, y: nextDir.y };
      var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(function (s) { return s.x === head.x && s.y === head.y; })) {
        snakeSound(200, 0.3); gameOver = true; running = false; drawSnake(); scoreEl.textContent = 'Game Over - ' + score; return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; snakeSound(880, 0.1); updateScore(); spawnFood(); }
      else { snake.pop(); }
      drawSnake();
      timer = setTimeout(gameLoop, 120);
    }

    document.addEventListener('keydown', function (e) {
      if (!running) return;
      switch (e.key) { case 'ArrowUp': if (dir.y !== 1) nextDir = { x: 0, y: -1 }; break; case 'ArrowDown': if (dir.y !== -1) nextDir = { x: 0, y: 1 }; break; case 'ArrowLeft': if (dir.x !== 1) nextDir = { x: -1, y: 0 }; break; case 'ArrowRight': if (dir.x !== -1) nextDir = { x: 1, y: 0 }; break; default: return; }
      e.preventDefault();
    });

    document.getElementById('btnSnakeStart').addEventListener('click', function () {
      reset(); running = true; if (timer) clearTimeout(timer); gameLoop();
    });

    reset(); drawSnake();
  })();

  /* GAME OF LIFE */
  (function () {
    var c = initCanvas('cLife', 620, 140);
    if (!c) return;
    var cv = c.cv, ctx = c.ctx;
    var CELL = 7, COLS = Math.floor(620 / CELL), ROWS = Math.floor(140 / CELL);
    var grid = Array.from({ length: ROWS }, function () { return new Uint8Array(COLS); });
    var running = false, animId = null, lastTime = 0, painting = false;

    function randomize() { grid = Array.from({ length: ROWS }, function () { return Uint8Array.from({ length: COLS }, function () { return Math.random() < 0.3 ? 1 : 0; }); }); }
    function clearGrid() { grid = Array.from({ length: ROWS }, function () { return new Uint8Array(COLS); }); }
    function nextGen() {
      var ng = Array.from({ length: ROWS }, function () { return new Uint8Array(COLS); });
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var n = 0;
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              var nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) n += grid[nr][nc];
            }
          }
          ng[r][c] = (grid[r][c] ? n === 2 || n === 3 : n === 3) ? 1 : 0;
        }
      }
      grid = ng;
    }
    function drawLife() {
      ctx.clearRect(0, 0, 620, 140);
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (grid[r][c]) { ctx.fillStyle = PURPLE; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); }
        }
      }
    }
    function loop(ts) { if (ts - lastTime > 120) { nextGen(); drawLife(); lastTime = ts; } if (running) animId = requestAnimationFrame(loop); }
    function getCell(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { row: Math.floor((t.clientY - r.top) / CELL), col: Math.floor((t.clientX - r.left) / CELL) }; }
    function paintCell(e) { if (running) return; var cell = getCell(e); if (cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS) { grid[cell.row][cell.col] = 1; drawLife(); } }
    function toggleCell(e) { if (running) return; var cell = getCell(e); if (cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS) { grid[cell.row][cell.col] = grid[cell.row][cell.col] ? 0 : 1; drawLife(); } }
    cv.addEventListener('click', toggleCell);
    cv.addEventListener('mousedown', function (e) { painting = true; paintCell(e); });
    cv.addEventListener('mousemove', function (e) { if (painting) paintCell(e); });
    cv.addEventListener('mouseup', function () { painting = false; });
    cv.addEventListener('mouseleave', function () { painting = false; });
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); toggleCell(e); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); paintCell(e); }, { passive: false });
    var btnPlay = document.getElementById('btnLifePlay');
    function startSim() { running = true; btnPlay.textContent = 'Pause'; btnPlay.setAttribute('aria-pressed', 'true'); animId = requestAnimationFrame(loop); }
    function stopSim() { running = false; btnPlay.textContent = 'Start'; btnPlay.setAttribute('aria-pressed', 'false'); }
    btnPlay.addEventListener('click', function () { if (running) { stopSim(); } else { startSim(); } });
    document.getElementById('btnLifeRand').addEventListener('click', function () { if (running) stopSim(); randomize(); drawLife(); });
    document.getElementById('btnLifeClear').addEventListener('click', function () { if (running) stopSim(); clearGrid(); drawLife(); });
    function start() { if (running && !animId) animId = requestAnimationFrame(loop); }
    function stop() { if (animId) { cancelAnimationFrame(animId); animId = null; } }
    var card = cv.closest('.card') || cv;
    DM.reg(card, start, stop);
    randomize(); drawLife();
  })();

})();
