/* 聞き比べのデモ。Web Audio で作ったやわらかい和音を、一時停止・再開するたびに、
   フェードあり／なしで切り替えて聞ける。出力のレベルを棒グラフ（アイコンの 5 本の棒と同じ形）で流す。
   音声ファイルは使わず、通信もしない。 */
(() => {
  const root = document.getElementById("demo");
  if (!root) return;

  const text = JSON.parse(root.dataset.text);
  const canvas = root.querySelector("canvas");
  const g2d = canvas.getContext("2d");
  const note = root.querySelector("[data-note]");
  const playBtn = root.querySelector("[data-play]");
  const fadeBtns = root.querySelectorAll("[data-fade]");
  const lengthInput = root.querySelector("[data-length]");
  const lengthOut = root.querySelector("[data-length-out]");
  const status = root.querySelector("[data-status]");

  const LEVEL = 0.1;          // 控えめな音量（和音の合計のピーク目安）
  const BAR_MS = 40;          // 棒 1 本の時間
  const BARS = 150;
  const COLORS = { bar: "#1769e0", cut: "#d9363e", base: "#b9c8de" };

  let ac = null, master = null, analyser = null, buffer = null;
  let playing = false;
  let fadeOn = true;
  let fadeMs = Number(lengthInput.value);
  let ramp = { t0: 0, dur: 0, from: 0, to: 0 };   // いま進行中のゲインの変化
  const bars = new Array(BARS).fill(0);
  let flags = new Array(BARS).fill(false);          // 棒が「ブツッ」（急な変化）か
  let acc = 0, accMax = 0, lastPush = 0, raf = 0, lastLevel = 0;

  /* ---- 音づくり: 4 音の和音をゆっくり揺らす ---- */
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    buffer = new Float32Array(analyser.fftSize);
    master.connect(analyser);
    analyser.connect(ac.destination);

    const tremolo = ac.createGain();
    tremolo.gain.value = 0.82;
    tremolo.connect(master);
    const lfo = ac.createOscillator();
    const lfoDepth = ac.createGain();
    lfo.frequency.value = 0.35;
    lfoDepth.gain.value = 0.18;
    lfo.connect(lfoDepth).connect(tremolo.gain);
    lfo.start();

    [220, 277.18, 329.63, 440].forEach((freq, i) => {
      for (const type of ["sine", "triangle"]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = (i - 1.5) * 3;
        gain.gain.value = type === "sine" ? 0.17 : 0.05;
        osc.connect(gain).connect(tremolo);
        osc.start();
      }
    });
  }

  /* ---- ゲインの変化: 余弦カーブ（アプリと同じ形）。途中で切り替えても、いまの値から続ける ---- */
  function currentGain(now) {
    if (ramp.dur <= 0 || now >= ramp.t0 + ramp.dur) return ramp.to;
    if (now <= ramp.t0) return ramp.from;
    const x = (now - ramp.t0) / ramp.dur;
    return ramp.from + (ramp.to - ramp.from) * (0.5 - 0.5 * Math.cos(Math.PI * x));
  }

  function moveGain(to) {
    const now = ac.currentTime;
    const from = currentGain(now);
    master.gain.cancelScheduledValues(now);
    if (!fadeOn || fadeMs <= 0) {
      master.gain.setValueAtTime(to, now);       // フェードなし: 一瞬で切り替える（ブツッ）
      ramp = { t0: now, dur: 0, from: to, to };
      return;
    }
    const dur = fadeMs / 1000;
    const n = 64;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      curve[i] = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * x));
    }
    master.gain.setValueAtTime(from, now);
    master.gain.setValueCurveAtTime(curve, now, dur);
    ramp = { t0: now, dur, from, to };
  }

  /* ---- 棒グラフ ---- */
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  /* 再生する前に見せる図: 左はフェードなしの「ブツッ」（赤い崖）、右はフェードありのなめらかな山 */
  function idleShape() {
    const levels = new Array(BARS).fill(0);
    const marks = new Array(BARS).fill(false);
    const wobble = (i) => 0.86 + 0.14 * Math.sin(i * 0.55);
    const put = (start, n, f) => { for (let i = 0; i < n; i++) levels[start + i] = f(i, n) * LEVEL; };
    put(14, 40, (i) => wobble(i));                                           // 急に始まり、急に切れる
    marks[14] = true; marks[53] = true;
    put(82, 12, (i, n) => (0.5 - 0.5 * Math.cos(Math.PI * (i + 1) / n)));    // なめらかに上がる
    put(94, 28, (i) => wobble(i));
    put(122, 12, (i, n) => (0.5 + 0.5 * Math.cos(Math.PI * (i + 1) / n)));   // なめらかに下がる
    return { levels, marks };
  }

  function draw() {
    const { w, h } = size();
    g2d.clearRect(0, 0, w, h);
    const idle = !ac;
    const src = idle ? idleShape() : { levels: bars, marks: flags };
    g2d.globalAlpha = idle ? 0.45 : 1;
    drawBars(w, h, src.levels, src.marks);
    g2d.globalAlpha = 1;
  }

  function drawBars(w, h, levels, marks) {
    const slot = w / BARS;
    const bw = Math.max(2, slot * 0.62);
    const mid = h / 2;
    const maxHalf = h * 0.44;
    for (let i = 0; i < BARS; i++) {
      const level = Math.min(1, levels[i] / LEVEL);
      const half = Math.max(1.5, Math.pow(level, 0.85) * maxHalf);
      const x = i * slot + (slot - bw) / 2;
      g2d.fillStyle = level < 0.02 ? COLORS.base : marks[i] ? COLORS.cut : COLORS.bar;
      const r = Math.min(bw / 2, half);
      roundRect(x, mid - half, bw, half * 2, r);
    }
  }

  function roundRect(x, y, w, h, r) {
    g2d.beginPath();
    g2d.moveTo(x + r, y);
    g2d.arcTo(x + w, y, x + w, y + h, r);
    g2d.arcTo(x + w, y + h, x, y + h, r);
    g2d.arcTo(x, y + h, x, y, r);
    g2d.arcTo(x, y, x + w, y, r);
    g2d.closePath();
    g2d.fill();
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    analyser.getFloatTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) { const v = Math.abs(buffer[i]); if (v > peak) peak = v; }
    accMax = Math.max(accMax, peak);
    if (!lastPush) lastPush = ts;
    if (ts - lastPush >= BAR_MS) {
      const level = accMax;
      // 直前の棒から半分以上、一気に変わったら「ぶつ切り」とみなして赤くする
      const abrupt = Math.abs(level - lastLevel) > LEVEL * 0.45;
      bars.push(level); bars.shift();
      flags.push(abrupt); flags.shift();
      lastLevel = level;
      accMax = 0;
      lastPush = ts;
    }
    draw();
  }

  /* ---- 操作 ---- */
  async function toggle() {
    if (!ac) build();
    if (ac.state === "suspended") await ac.resume();
    if (!raf) raf = requestAnimationFrame(tick);
    note.hidden = true;
    playing = !playing;
    moveGain(playing ? LEVEL : 0);
    playBtn.textContent = playing ? text.pause : text.play;
    const kind = fadeOn ? text.withFade.replace("{ms}", fadeMs) : text.withoutFade;
    status.textContent = (playing ? text.resumed : text.paused).replace("{kind}", kind);
  }

  playBtn.addEventListener("click", toggle);
  fadeBtns.forEach((b) => b.addEventListener("click", () => {
    fadeOn = b.dataset.fade === "on";
    fadeBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    lengthInput.disabled = !fadeOn;
  }));
  lengthInput.addEventListener("input", () => {
    fadeMs = Number(lengthInput.value);
    lengthOut.textContent = fadeMs + " ms";
  });
  window.addEventListener("resize", draw);
  draw();
})();
