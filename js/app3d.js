"use strict";
/* Cooler Drink 3D — three.js wheel, chill lo-fi music, simple one-tap play. */
(() => {
const W = window.WheelLogic;
const $ = id => document.getElementById(id);
const tg = window.Telegram && window.Telegram.WebApp;
try { tg && tg.ready(); tg && tg.expand(); tg && tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (_) {}
const store = {
  get(k, d) { try { const v = localStorage.getItem("spin3d:" + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem("spin3d:" + k, JSON.stringify(v)); } catch (_) {} },
};

let options = W.normalize(store.get("options", null));
let duration = store.get("duration", 5);
let musicOn = store.get("music", true), soundOn = store.get("sound", true);
let server = { players: [], poolRiel: 0, turnPlayerId: null, turnPlayerName: null, pendingAdvance: false };
let online = true, spinning = false;

function toast(text) { const t = $("toast"); t.textContent = text; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }
const haptic = k => { try { if (tg && tg.HapticFeedback) { k === "win" ? tg.HapticFeedback.notificationOccurred("success") : tg.HapticFeedback.impactOccurred(k === "tick" ? "light" : "medium"); } else if (navigator.vibrate && k !== "tick") navigator.vibrate(k === "win" ? [60, 40, 120] : 15); } catch (_) {} };

// ================= audio: chill lo-fi + effects =================
const Audio = (() => {
  let ctx, master, music, fx, noise, timer = 0, step = 0, nextT = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
  const BASS = [41, 40, 38, 36];
  const MELODY = [72, null, 69, null, 67, 69, null, 64, null, null, 67, null, 64, null, 62, null];
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ctx.destination);
      const warm = ctx.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 3800; warm.connect(master); // lo-fi warmth
      music = ctx.createGain(); music.gain.value = musicOn ? 0.5 : 0; music.connect(warm);
      fx = ctx.createGain(); fx.gain.value = soundOn ? 0.9 : 0; fx.connect(master);
      const d = ctx.createDelay(); d.delayTime.value = 0.36; const fb = ctx.createGain(); fb.gain.value = 0.3; const wet = ctx.createGain(); wet.gain.value = 0.2;
      music.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(warm);
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise = b; return true;
    } catch (_) { ctx = null; return false; }
  }
  function osc(bus, t, f, dur, type, vol, o = {}) {
    const s = ctx.createOscillator(), g = ctx.createGain(); s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = o.vib; l.connect(lg).connect(s.frequency); l.start(t); l.stop(t + dur); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.05);
  }
  function nz(bus, t, dur, vol, freq, type = "bandpass", q = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loopStart = Math.random(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function keys(t, notes, dur) { // soft electric-piano chord
    for (const n of notes) { osc(music, t, midi(n), dur, "sine", 0.05, { a: 0.02, vib: 1.5 }); osc(music, t, midi(n + 12), dur * 0.5, "triangle", 0.012, { a: 0.01 }); }
  }
  function schedule() {
    const bpm = 80, s16 = 60 / bpm / 4;
    while (nextT < ctx.currentTime + 0.2) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, swing = s % 2 ? s16 * 0.18 : 0, t = nextT + swing;
      if (s === 0 || s === 10) osc(music, t, 95, 0.3, "sine", 0.55, { to: 45 });               // soft kick
      if (s === 4 || s === 12) { nz(music, t, 0.18, 0.18, 1400, "bandpass", 0.8); osc(music, t, 190, 0.1, "triangle", 0.06); } // snare
      if (s % 2 === 0) nz(music, t, 0.03, 0.05 + (s % 4 ? 0 : 0.02), 8000, "highpass");          // hats
      if (s === 0) keys(t, CHORDS[bar], s16 * 15);
      if (s === 0 || s === 7) osc(music, t, midi(BASS[bar]), s16 * 6, "sine", 0.22, { a: 0.02 });
      const m = MELODY[s]; if (m && (bar % 2 === 1)) osc(music, t, midi(m), s16 * 2.5, "triangle", 0.04, { a: 0.01, vib: 3 });
      if (Math.random() < 0.18) nz(music, t, 0.01, 0.03, 3000, "highpass");                      // vinyl crackle
      nextT += s16; step++;
    }
  }
  const play = fn => { if (soundOn && init()) fn(ctx.currentTime); };
  return {
    start() { if (!init()) return; if (!timer) { nextT = ctx.currentTime + 0.08; timer = setInterval(schedule, 50); } },
    music(on) { if (music) music.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2); },
    sound(on) { if (fx) fx.gain.value = on ? 0.9 : 0; },
    duck(on) { if (music && musicOn) music.gain.setTargetAtTime(on ? 0.22 : 0.5, ctx.currentTime, 0.3); },
    tick: (i) => play(t => { osc(fx, t, 1200 + (i % 3) * 120, 0.04, "square", 0.05); nz(fx, t, 0.03, 0.12, 2500, "bandpass", 3); }),
    whoosh: () => play(t => { nz(fx, t, 0.9, 0.25, 600, "bandpass", 0.7); osc(fx, t, 180, 0.9, "sawtooth", 0.05, { to: 700 }); }),
    tap: () => play(t => osc(fx, t, 660, 0.08, "triangle", 0.15, { to: 990 })),
    win: () => play(t => {
      [72, 76, 79, 84, 88].forEach((n, i) => osc(fx, t + i * 0.08, midi(n), 0.5, "triangle", 0.16));
      [60, 64, 67, 72].forEach(n => osc(fx, t + 0.42, midi(n), 1.4, "sine", 0.08, { a: 0.05, vib: 2 }));
      for (let i = 0; i < 14; i++) nz(fx, t + 0.4 + Math.random() * 0.9, 0.05, 0.1, 3000 + Math.random() * 4000, "bandpass", 4); // claps/sparkles
    }),
  };
})();

// ================= 3D =================
function loadScript(urls) {
  return urls.reduce((p, url) => p.catch(() => new Promise((ok, bad) => {
    const s = document.createElement("script"); s.src = url; s.onload = () => (window.THREE ? ok() : bad()); s.onerror = bad; document.head.appendChild(s);
  })), Promise.reject());
}

let T, renderer, scene, camera, wheel, faceMat, pointer, botHead, bulbs = [], beams = [], dust, glowTex, rotation = 0, pointerKick = 0, laughUntil = 0;
const R = 3.1;

function makeGlow() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "#ffffff"); r.addColorStop(0.3, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function sprite(color, size, opacity = 1) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}

/** Wheel face texture: slices clockwise from the top, emoji near the rim + big 3D Khmer title. */
function faceTexture(items) {
  const size = 2048, k = 2, c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  const cx = size / 2, rad = size / 2 - 12, n = items.length, slice = Math.PI * 2 / n, half = Math.sin(Math.min(slice / 2, Math.PI / 3));
  items.forEach((it, i) => {
    const a0 = -Math.PI / 2 + i * slice, a1 = a0 + slice;
    const grad = g.createRadialGradient(cx, cx, rad * 0.15, cx, cx, rad);
    grad.addColorStop(0, shade(it.color, 0.35)); grad.addColorStop(0.75, it.color); grad.addColorStop(1, shade(it.color, -0.35));
    g.beginPath(); g.moveTo(cx, cx); g.arc(cx, cx, rad, a0, a1); g.closePath(); g.fillStyle = grad; g.fill();
    g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 5 * k; g.stroke();
    g.save(); g.translate(cx, cx); g.rotate(a0 + slice / 2 + Math.PI / 2);
    g.textAlign = "center"; g.textBaseline = "middle";
    // emoji near the rim
    const ef = Math.min(128 * k, 2 * rad * 0.86 * half * 0.55);
    g.font = `${ef}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.fillText(it.emoji, 0, -rad * 0.84);
    // big 3D Khmer title, fitted to the slice width (2 lines when that makes it bigger)
    const r = rad * 0.58, room = 2 * r * half * 0.9, cap = 104 * k, words = String(it.title).split(/\s+/).filter(Boolean);
    const fitOne = t => { g.font = `700 100px "Kantumruy Pro", sans-serif`; return Math.min(cap, 100 * room / Math.max(1, g.measureText(t).width)); };
    let lines = [it.title], fs = fitOne(it.title);
    if (words.length > 1 && fs < cap * 0.8) {
      let best = null;
      for (let j = 1; j < words.length; j++) {
        const L = [words.slice(0, j).join(" "), words.slice(j).join(" ")], f = Math.min(fitOne(L[0]), fitOne(L[1]), cap * 0.85);
        if (!best || f > best.f) best = { L, f };
      }
      if (best && best.f > fs * 1.15) { lines = best.L; fs = best.f; }
    }
    fs = Math.max(30 * k, fs);
    g.font = `700 ${Math.round(fs)}px "Kantumruy Pro", sans-serif`;
    const lh = fs * 1.32, y0 = -r - (lines.length - 1) * lh / 2, depth = Math.max(4, Math.round(fs * 0.07));
    lines.forEach((t, li) => {
      const y = y0 + li * lh;
      g.shadowColor = "rgba(0,0,0,0)"; g.fillStyle = shade(it.color, -0.62);
      for (let d = depth; d >= 1; d--) g.fillText(t, d * 0.45, y + d);              // extruded 3D side
      g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 10 * k; g.shadowOffsetY = depth * 0.6;
      g.lineJoin = "round"; g.lineWidth = fs * 0.13; g.strokeStyle = shade(it.color, -0.7); g.strokeText(t, 0, y);
      g.shadowColor = "rgba(0,0,0,0)";
      const tg2 = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2); tg2.addColorStop(0, "#ffffff"); tg2.addColorStop(0.55, "#ffffff"); tg2.addColorStop(1, "#ffe9a8");
      g.fillStyle = tg2; g.fillText(t, 0, y);
    });
    g.restore();
  });
  const ring = g.createRadialGradient(cx, cx, rad * 0.9, cx, cx, rad); ring.addColorStop(0, "rgba(0,0,0,0)"); ring.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = ring; g.beginPath(); g.arc(cx, cx, rad, 0, 7); g.fill();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 16; return t;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function buildScene() {
  renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  $("stage3d").appendChild(renderer.domElement);
  scene = new T.Scene(); scene.background = new T.Color(0x070818); scene.fog = new T.Fog(0x070818, 14, 40);
  camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
  glowTex = makeGlow();
  scene.add(new T.HemisphereLight(0xbfd8ff, 0x1a0b3d, 0.9));
  const key = new T.DirectionalLight(0xffffff, 2); key.position.set(3, 6, 8); scene.add(key);
  const pink = new T.PointLight(0xff4fd8, 60, 20); pink.position.set(-5, 2, 4); scene.add(pink);
  const cyan = new T.PointLight(0x38e1ff, 60, 20); cyan.position.set(5, -1, 4); scene.add(cyan);

  // stage floor with neon rings
  const floor = new T.Mesh(new T.CircleGeometry(14, 64), new T.MeshStandardMaterial({ color: 0x0b0d26, metalness: 0.9, roughness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.2; scene.add(floor);
  for (const [r, c] of [[4.2, 0x38e1ff], [5.6, 0xff4fd8], [7.4, 0xffd23f]]) {
    const ring = new T.Mesh(new T.TorusGeometry(r, 0.035, 8, 120), new T.MeshBasicMaterial({ color: c })); ring.rotation.x = -Math.PI / 2; ring.position.y = -4.18; scene.add(ring);
  }
  // pedestal
  const stand = new T.Mesh(new T.CylinderGeometry(0.35, 1.3, 3.2, 32), new T.MeshStandardMaterial({ color: 0x20244f, metalness: 0.9, roughness: 0.25, emissive: 0x0a0c30 }));
  stand.position.set(0, -2.6, -0.6); scene.add(stand);

  // wheel
  wheel = new T.Group(); wheel.rotation.x = -0.18; scene.add(wheel);
  const spinner = new T.Group(); wheel.add(spinner); wheel.userData.spinner = spinner;
  faceMat = new T.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.18 });
  const face = new T.Mesh(new T.CircleGeometry(R, 96), faceMat); face.position.z = 0.16; spinner.add(face);
  const body = new T.Mesh(new T.CylinderGeometry(R + 0.05, R + 0.05, 0.3, 96, 1, true), new T.MeshStandardMaterial({ color: 0x2a1a00, metalness: 1, roughness: 0.3 }));
  body.rotation.x = Math.PI / 2; spinner.add(body);
  const back = new T.Mesh(new T.CircleGeometry(R + 0.05, 64), new T.MeshStandardMaterial({ color: 0x14163a, metalness: 0.8, roughness: 0.4 })); back.position.z = -0.15; back.rotation.y = Math.PI; spinner.add(back);
  const gold = new T.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.22, emissive: 0x3a2200 });
  const rim = new T.Mesh(new T.TorusGeometry(R + 0.12, 0.17, 24, 160), gold); rim.position.z = 0.12; wheel.add(rim);
  for (let i = 0; i < 28; i++) { // marquee bulbs around the rim
    const a = i / 28 * Math.PI * 2, b = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), new T.MeshBasicMaterial({ color: 0xfff1b0 }));
    b.position.set(Math.sin(a) * (R + 0.12), Math.cos(a) * (R + 0.12), 0.3); wheel.add(b);
    const s = sprite(0xffd23f, 0.55, 0.8); s.position.copy(b.position); wheel.add(s); bulbs.push({ b, s });
  }
  // hub: gold ring + dark glass disk spin with the wheel; Cooler Bot's head stays upright and reacts
  const hubRing = new T.Mesh(new T.CylinderGeometry(0.88, 0.95, 0.3, 64), gold); hubRing.rotation.x = Math.PI / 2; hubRing.position.z = 0.3; spinner.add(hubRing);
  const disk = new T.Mesh(new T.CircleGeometry(0.78, 64), new T.MeshStandardMaterial({ color: 0x0b2a8a, metalness: 0.6, roughness: 0.3, emissive: 0x0a2a90, emissiveIntensity: 0.6 }));
  disk.position.z = 0.46; spinner.add(disk);
  const headTex = new T.TextureLoader().load("/assets/coolerbot-head.webp"); headTex.colorSpace = T.SRGBColorSpace; headTex.anisotropy = 8;
  botHead = new T.Mesh(new T.PlaneGeometry(1.75, 1.75), new T.MeshBasicMaterial({ map: headTex, transparent: true, depthWrite: false }));
  botHead.position.set(0, 0.06, 0.62); wheel.add(botHead);
  const headGlow = sprite(0x38e1ff, 2.6, 0.45); headGlow.position.set(0, 0.06, 0.5); wheel.add(headGlow); botHead.userData.glow = headGlow;
  // pointer (gem) at the top
  pointer = new T.Group();
  const gem = new T.Mesh(new T.ConeGeometry(0.32, 0.8, 4), new T.MeshStandardMaterial({ color: 0xff3d7f, metalness: 0.4, roughness: 0.1, emissive: 0xff1f6a, emissiveIntensity: 0.6 }));
  gem.rotation.z = Math.PI; gem.rotation.y = Math.PI / 4; pointer.add(gem);
  const cap = new T.Mesh(new T.SphereGeometry(0.22, 24, 16), gold); cap.position.y = 0.38; pointer.add(cap);
  const pg = sprite(0xff4fd8, 1.6, 0.7); pointer.add(pg);
  pointer.position.set(0, R + 0.45, 0.45); wheel.add(pointer);
  // wheel halo
  const halo = sprite(0x7c4dff, 11, 0.35); halo.position.z = -0.8; wheel.add(halo);

  // light beams
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(new T.ConeGeometry(1.4, 16, 24, 1, true), new T.MeshBasicMaterial({ color: i % 2 ? 0xff4fd8 : 0x38e1ff, transparent: true, opacity: 0.06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.position.set((i - 2.5) * 3.2, 6, -8); m.rotation.z = (i - 2.5) * 0.12; scene.add(m); beams.push(m);
  }
  // floating bokeh dust
  const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), palette = [[0.22, 0.88, 1], [1, 0.31, 0.85], [1, 0.82, 0.25]];
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 16 - 5; pos[i * 3 + 2] = -Math.random() * 20 + 2; const p = palette[i % 3]; col.set(p, i * 3); }
  const gg = new T.BufferGeometry(); gg.setAttribute("position", new T.BufferAttribute(pos, 3)); gg.setAttribute("color", new T.BufferAttribute(col, 3));
  dust = new T.Points(gg, new T.PointsMaterial({ size: 0.3, map: glowTex, vertexColors: true, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); scene.add(dust);

  refreshFace(); resize();
  window.addEventListener("resize", resize);
  renderer.domElement.addEventListener("pointerdown", onDragStart);
}

function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false);
  camera.aspect = w / h; const portrait = w / h < 0.8;
  camera.fov = portrait ? 50 : 42;
  const fitW = 3.62 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);   // wheel + bulbs ≈ 97% of the screen width
  camera.position.set(0, portrait ? 0.4 : 0.6, portrait ? Math.max(9, fitW) : 11.5); camera.lookAt(0, portrait ? 0.6 : 0.3, 0);
  camera.updateProjectionMatrix();
}
let currentItems = [];
function refreshFace() {
  currentItems = W.visible(options, server.poolRiel);
  if (faceMat) { if (faceMat.map) faceMat.map.dispose(); const t = faceTexture(currentItems); faceMat.map = t; faceMat.emissiveMap = t; faceMat.needsUpdate = true; }
}

// ================= spin =================
let anim = null, lastIndex = -1, idle = 0;
function animateTo(index, onDone) {
  const n = currentItems.length, turns = 4 + duration * 0.9;
  const from = rotation, to = W.targetAngle(rotation, index, n, turns, (Math.random() - 0.5));
  anim = { from, to, start: performance.now(), dur: duration * 1000, onDone };
  Audio.whoosh(); Audio.duck(true);
}
function stepAnim(now) {
  if (!anim) { idle += 0.0016; rotation += 0.0016; return; }
  const t = Math.min(1, (now - anim.start) / anim.dur);
  rotation = anim.from + (anim.to - anim.from) * W.ease(t);
  if (t >= 1) { rotation = anim.to; const done = anim.onDone; anim = null; Audio.duck(false); done && done(); }
}

async function api(path, body) {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = {}; try { data = await res.json(); } catch (_) {}
  if (!res.ok) { const e = new Error(data.error || "HTTP " + res.status); e.status = res.status; throw e; }
  return data;
}
async function refresh() {
  try { const d = await api("/api/state"); server = d.state; online = true; } catch (_) { online = false; }
  const before = currentItems.map(i => i.id).join();
  renderPlayers(); if (W.visible(options, server.poolRiel).map(i => i.id).join() !== before) refreshFace();
}

async function spin() {
  if (spinning) return;
  Audio.start(); spinning = true; $("spinBtn").disabled = true; haptic("spin");
  window.CoolerBot && window.CoolerBot.spin();
  const ids = currentItems.map(i => i.id);
  let outcomeId = null, who = null;
  if (online && server.players.length) {
    try {
      let d;
      try { d = await api("/api/spin", { playerId: server.turnPlayerId, wheelOptionIds: ids }); }
      catch (e) { if (e.status === 409) { await refresh(); if (server.pendingAdvance) await api("/api/turn/advance", {}); await refresh(); d = await api("/api/spin", { playerId: server.turnPlayerId, wheelOptionIds: currentItems.map(i => i.id) }); } else throw e; }
      outcomeId = d.outcome.outcomeId; who = d.outcome.playerName; server = d.state;
    } catch (e) { toast("⚠️ " + (e.message || "Network")); }
  }
  if (!outcomeId) outcomeId = W.pickLocal(ids.filter(id => id !== "money"));
  const index = Math.max(0, currentItems.findIndex(i => i.id === outcomeId));
  animateTo(index, () => showResult(currentItems[index], who));
}

// ================= result + confetti =================
let confetti = [];
function showResult(item, who) {
  Audio.win(); haptic("win");
  laughUntil = performance.now() + 2600;
  window.CoolerBot && window.CoolerBot.laugh(item);
  $("resultWho").textContent = who ? `🎯 ${who}` : "";
  $("resultEmoji").textContent = item.emoji; $("resultTitle").textContent = item.title; $("resultDesc").textContent = item.desc && item.desc !== item.title ? item.desc : "";
  document.querySelector(".result-card").style.setProperty("--rc", item.color);
  $("result").hidden = false; $("resultOk").focus();
  const c = $("confetti"); c.width = innerWidth; c.height = innerHeight;
  confetti = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 900, vy: -Math.random() * 900 - 200, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, s: 5 + Math.random() * 7, c: ["#38e1ff", "#ff4fd8", "#ffd23f", "#7c4dff", "#2ee6c5", item.color][Math.floor(Math.random() * 6)], life: 3 }));
}
function drawConfetti(dt) {
  if (!confetti.length) return; const c = $("confetti"), g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
  for (const p of confetti) { p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.globalAlpha = Math.max(0, Math.min(1, p.life)); g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
  confetti = confetti.filter(p => p.life > 0 && p.y < c.height + 40); if (!confetti.length) g.clearRect(0, 0, c.width, c.height);
}
$("resultOk").addEventListener("click", async () => {
  Audio.tap(); $("result").hidden = true; confetti = [];
  if (online && server.pendingAdvance) { try { const d = await api("/api/turn/advance", {}); server = d.state; } catch (_) {} }
  await refresh(); spinning = false; $("spinBtn").disabled = false;
});

// ================= players =================
function renderPlayers() {
  const list = $("players"); list.innerHTML = "";
  for (const p of server.players || []) {
    const chip = document.createElement("span"); chip.className = "pchip" + (p.id === server.turnPlayerId ? " now" : ""); chip.textContent = (p.id === server.turnPlayerId ? "🎯 " : "👤 ") + p.name; list.appendChild(chip);
  }
  const add = document.createElement("button"); add.type = "button"; add.className = "pchip add"; add.textContent = server.players && server.players.length ? "＋" : "＋ អ្នកលេង"; add.addEventListener("click", openAdd); list.appendChild(add);
  $("turn").innerHTML = server.players && server.players.length && server.turnPlayerName ? `វេន <b>${escapeHtml(server.turnPlayerName)}</b> 🎯` : "ចុច SPIN ដើម្បីលេង 🎉";
  $("pool").hidden = !(server.poolRiel > 0); $("pool").textContent = `💰 ${Number(server.poolRiel || 0).toLocaleString()}៛`;
  renderPlayerItems();
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function openAdd() { Audio.start(); Audio.tap(); $("addSheet").hidden = false; $("addName").value = ""; setTimeout(() => $("addName").focus(), 50); }
$("addCancel").addEventListener("click", () => { $("addSheet").hidden = true; });
$("addForm").addEventListener("submit", async e => {
  e.preventDefault(); const name = $("addName").value.trim(); if (!name) return;
  try { const d = await api("/api/players", { name }); server = d.state; renderPlayers(); toast(`👋 ${name}`); } catch (err) { toast("⚠️ " + err.message); }
  $("addSheet").hidden = true;
});

// ================= settings =================
function renderItems() {
  const box = $("items"); box.innerHTML = "";
  options.forEach((o, i) => {
    const row = document.createElement("div"); row.className = "item";
    row.innerHTML = `<input value="${escapeHtml(o.emoji)}" maxlength="4" aria-label="Emoji"><input value="${escapeHtml(o.title)}" maxlength="24" aria-label="ឈ្មោះ"><input type="color" value="${o.color}" aria-label="ពណ៌"><button class="del" type="button" aria-label="លុប">✕</button>`;
    const [em, ti, co, del] = row.children;
    const save = () => { options[i] = { ...options[i], emoji: em.value || "✨", title: ti.value.trim() || options[i].title, color: co.value }; options = W.normalize(options); store.set("options", options); refreshFace(); };
    em.addEventListener("change", save); ti.addEventListener("change", save); co.addEventListener("input", save);
    del.addEventListener("click", () => { if (options.length <= 2) { toast("ត្រូវមានយ៉ាងតិច ២"); return; } options.splice(i, 1); store.set("options", options); refreshFace(); renderItems(); });
    box.appendChild(row);
  });
  document.querySelectorAll("#durationSeg button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.d) === duration)));
}
function renderPlayerItems() {
  const box = $("playerItems"); if (!box) return; box.innerHTML = "";
  if (!(server.players || []).length) { box.innerHTML = '<div class="prow">មិនទាន់មាន — ចុច ＋ អ្នកលេង</div>'; return; }
  for (const p of server.players) {
    const row = document.createElement("div"); row.className = "prow"; row.innerHTML = `<span>👤 ${escapeHtml(p.name)}</span>`;
    const del = document.createElement("button"); del.className = "del icon"; del.type = "button"; del.textContent = "✕"; del.setAttribute("aria-label", "លុប " + p.name);
    del.addEventListener("click", async () => { try { const r = await fetch("/api/players/" + encodeURIComponent(p.id), { method: "DELETE" }); const d = await r.json(); if (r.ok) { server = d.state; renderPlayers(); } else toast("⚠️ " + (d.error || r.status)); } catch (_) {} });
    row.appendChild(del); box.appendChild(row);
  }
}
$("itemForm").addEventListener("submit", e => {
  e.preventDefault(); if (options.length >= W.MAX_OPTIONS) { toast("អតិបរមា 24"); return; }
  const title = $("itemTitle").value.trim(); if (!title) return;
  options.push({ id: "custom-" + Date.now().toString(36), emoji: $("itemEmoji").value || "✨", title, desc: title, color: $("itemColor").value });
  options = W.normalize(options); store.set("options", options); refreshFace(); renderItems(); $("itemTitle").value = "";
});
$("durationSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; duration = Number(b.dataset.d); store.set("duration", duration); renderItems(); });
$("resetWheel").addEventListener("click", () => { options = W.normalize(null); store.set("options", options); refreshFace(); renderItems(); toast("↺ កង់ដើម"); });
$("settingsBtn").addEventListener("click", () => { Audio.start(); Audio.tap(); renderItems(); renderPlayerItems(); $("settings").hidden = false; });
$("settingsClose").addEventListener("click", () => { $("settings").hidden = true; });
for (const id of ["settings", "addSheet"]) $(id).addEventListener("click", e => { if (e.target.id === id) $(id).hidden = true; });

function syncToggles() { $("musicBtn").setAttribute("aria-pressed", String(musicOn)); $("soundBtn").setAttribute("aria-pressed", String(soundOn)); $("soundBtn").textContent = soundOn ? "🔊" : "🔇"; }
$("musicBtn").addEventListener("click", () => { musicOn = !musicOn; store.set("music", musicOn); Audio.start(); Audio.music(musicOn); syncToggles(); });
$("soundBtn").addEventListener("click", () => { soundOn = !soundOn; store.set("sound", soundOn); Audio.start(); Audio.sound(soundOn); syncToggles(); });
$("spinBtn").addEventListener("click", spin);
document.addEventListener("keydown", e => { if ((e.code === "Space" || e.code === "Enter") && $("result").hidden && $("settings").hidden && $("addSheet").hidden) { e.preventDefault(); spin(); } });

// swipe the wheel to spin
let drag = null;
function onDragStart(e) { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; window.addEventListener("pointerup", onDragEnd, { once: true }); }
function onDragEnd(e) { if (!drag) return; const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y), dt = performance.now() - drag.t; drag = null; if (d > 40 && dt < 700 && $("result").hidden) spin(); }

// ================= loop =================
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stepAnim(now);
  const spinner = wheel.userData.spinner; spinner.rotation.z = -rotation;
  const idx = W.indexAt(rotation, currentItems.length || 1);
  if (idx !== lastIndex) { if (anim) { Audio.tick(idx); pointerKick = 1; haptic("tick"); } lastIndex = idx; }
  pointerKick = Math.max(0, pointerKick - dt * 6); pointer.rotation.z = pointerKick * 0.35;
  const sp = anim ? 1 : 0.25;
  bulbs.forEach((o, i) => { const on = ((Math.floor(now / (anim ? 70 : 240)) + i) % 3) === 0; o.s.material.opacity = on ? 0.95 : 0.25 * sp + 0.15; o.b.material.color.setHex(on ? 0xfff6c8 : 0xb88a2a); });
  beams.forEach((b, i) => { b.rotation.z = Math.sin(now / 1800 + i) * 0.35; b.material.opacity = 0.04 + (anim ? 0.05 : 0.02) * (1 + Math.sin(now / 300 + i)); });
  dust.rotation.y += dt * 0.02; dust.position.y = Math.sin(now / 3000) * 0.3;
  wheel.position.y = Math.sin(now / 1400) * 0.06;
  if (botHead) {
    const laughing = now < laughUntil, k2 = laughing ? 1 : 0;
    const bob = laughing ? Math.abs(Math.sin(now / 70)) * 0.12 : anim ? Math.sin(now / 90) * 0.04 : Math.sin(now / 900) * 0.03;
    botHead.position.y = 0.06 + bob;
    botHead.rotation.z = laughing ? Math.sin(now / 55) * 0.16 : anim ? Math.sin(now / 120) * 0.1 : Math.sin(now / 1600) * 0.05;
    botHead.rotation.y = anim ? Math.sin(now / 260) * 0.35 : Math.sin(now / 2100) * 0.18;
    const sc = 1 + k2 * 0.08 * Math.abs(Math.sin(now / 70)); botHead.scale.set(sc, sc, 1);
    botHead.userData.glow.material.opacity = anim || laughing ? 0.55 + 0.35 * Math.abs(Math.sin(now / 110)) : 0.35 + 0.1 * Math.sin(now / 700);
  }
  camera.position.x = Math.sin(now / 5000) * 0.35;
  camera.lookAt(0, 0.5, 0);
  drawConfetti(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

syncToggles();
loadScript(["/vendor/three.min.js?v=0.160.0"])
  .then(async () => {
    T = window.THREE; buildScene(); await refresh(); $("loading").remove(); requestAnimationFrame(frame);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshFace);
    setInterval(() => { if (!spinning) refresh(); }, 8000);
  })
  .catch(() => { $("loading").innerHTML = "<p style='padding:24px;text-align:center;letter-spacing:0'>⚠️ មិនអាចផ្ទុក 3D បានទេ<br>សូមពិនិត្យអ៊ីនធឺណិត ហើយបើកម្ដងទៀត</p>"; });
window.__spin = { spin, get rotation() { return rotation; }, items: () => currentItems, get spinning() { return spinning; } };
})();
