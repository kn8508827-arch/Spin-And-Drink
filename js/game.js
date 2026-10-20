"use strict";

const DEFAULT_OPTIONS = [
  { id: "unfaithful", emoji: "🥃", title: "អត់ស្មោះ", desc: "ពិន័យ៖ ផឹក ២ កែវ។", color: "#176bb2" },
  { id: "faithful", emoji: "🛡️", title: "ស្មោះ", desc: "រួចខ្លួនមួយវេន — មិនចាំបាច់ផឹកទេ។", color: "#e6ad2e" },
  { id: "command", emoji: "👉", title: "បញ្ជាមិត្តម្នាក់", desc: "ជ្រើសមិត្តម្នាក់ឱ្យធ្វើកិច្ចការ។", color: "#66a8ff" },
  { id: "drink", emoji: "🍷", title: "ផឹក 1 កែវ", desc: "ផឹក 1 កែវ។", color: "#42a5f5" },
  { id: "truth", emoji: "❓", title: "ជីវិត" , desc: "ឆ្លើយសំណួរ/ធ្វើការបង្ហាញ។", color: "#ff7b72" },
  { id: "luck", emoji: "🍀", title: "សំណាង ៤ ដង", desc: "ទទួលបានសន្លឹកសំណាង ៤ ដង។", color: "#188b75" },
  { id: "sing", emoji: "🎤", title: "ច្រៀងមួយបទ", desc: "ច្រៀងមួយបទ។", color: "#e28a3b" },
  { id: "dance", emoji: "💃", title: "រាំ ៥ វិនាទី", desc: "រាំ ៥ វិនាទី។", color: "#cb5d78" },
  { id: "dance-two-minutes", emoji: "💃", title: "រាំ 2 នាទី", desc: "អ្នកត្រូវរាំ 2 នាទី! 💃🕺", color: "#765db2" },
  { id: "again", emoji: "🎁", title: "បង្វិលម្ដងទៀត", desc: "អ្នកអាចបង្វិលកង់ម្ដងទៀត។", color: "#536d9b" },
  { id: "money", emoji: "💰", title: "សំណាងបានលុយ", desc: "ឈ្នះប្រាក់រង្វាន់។", color: "#d89c16" }
];

const REMOVED_OPTION_IDS = new Set(["water", "truth", "friend"]);
const DEFAULT_SETTINGS = {
  spinSpeed: "normal",
  spinDuration: "8",
  animationStyle: "cinematic",
  soundEffects: true,
  backgroundMusic: false,
  soundMuted: false,
  volume: 50,
  galaxyParticles: true,
  wheelGlow: true
};
const STORAGE_OPTIONS = "spinDrinkWheelOptionsV2";
const STORAGE_SETTINGS = "spinDrinkSettingsV2";
const MAX_WHEEL_OPTIONS = 24;

function safeRead(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
}
function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}
function cloneDefaults() { return DEFAULT_OPTIONS.map(option => ({ ...option })); }
function isColor(value) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value); }
function normalizeOptionList(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_WHEEL_OPTIONS) return cloneDefaults();
  const used = new Set();
  const normalized = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id : "";
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 40) : "";
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) || REMOVED_OPTION_IDS.has(id) || used.has(id) || !title) continue;
    used.add(id);
    const defaultOption = DEFAULT_OPTIONS.find(option => option.id === id);
    normalized.push({
      id,
      emoji: typeof item.emoji === "string" ? Array.from(item.emoji.trim()).slice(0, 8).join("") : "✨",
      title,
      desc: typeof item.desc === "string" ? item.desc.slice(0, 160) : title,
      color: isColor(item.color) ? item.color : (defaultOption ? defaultOption.color : "#9b70e8")
    });
  }
  return normalized.length ? normalized : cloneDefaults();
}
function readOptions() { return normalizeOptionList(safeRead(STORAGE_OPTIONS)); }
function readSettings() {
  const value = safeRead(STORAGE_SETTINGS);
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const validSpeeds = new Set(["verySlow", "slow", "normal", "fast", "veryFast"]);
  const validDurations = new Set(["3", "5", "8", "10", "15"]);
  const validStyles = new Set(["smooth", "bouncy", "cinematic", "energetic"]);
  return {
    spinSpeed: validSpeeds.has(value.spinSpeed) ? value.spinSpeed : DEFAULT_SETTINGS.spinSpeed,
    spinDuration: validDurations.has(String(value.spinDuration)) ? String(value.spinDuration) : DEFAULT_SETTINGS.spinDuration,
    animationStyle: validStyles.has(value.animationStyle) ? value.animationStyle : DEFAULT_SETTINGS.animationStyle,
    soundEffects: typeof value.soundEffects === "boolean" ? value.soundEffects : DEFAULT_SETTINGS.soundEffects,
    backgroundMusic: typeof value.backgroundMusic === "boolean" ? value.backgroundMusic : DEFAULT_SETTINGS.backgroundMusic,
    soundMuted: typeof value.soundMuted === "boolean" ? value.soundMuted : DEFAULT_SETTINGS.soundMuted,
    volume: Number.isFinite(Number(value.volume)) ? Math.max(0, Math.min(100, Number(value.volume))) : DEFAULT_SETTINGS.volume,
    galaxyParticles: typeof value.galaxyParticles === "boolean" ? value.galaxyParticles : DEFAULT_SETTINGS.galaxyParticles,
    wheelGlow: typeof value.wheelGlow === "boolean" ? value.wheelGlow : DEFAULT_SETTINGS.wheelGlow
  };
}

let wheelOptions = readOptions();
let settings = readSettings();
let state = null;
let rotation = 0;
let spinning = false;
let actionPending = false;
let gameStarted = false;
let gamePaused = false;
let startPending = false;
let bottleAnimation = null;
let bottleFrame = 0;
let stateRefreshPromise = null;
let lastTick = -1;
let galaxyFrame = 0;
let galaxyRunning = false;
let lastGalaxyDraw = 0;
let stars = [];
let shootingStar = null;
let nextShootingStarAt = 0;
let audioContext = null;
let masterGain = null;
let effectsGain = null;
let musicGain = null;
let musicOscillators = [];
let previousTickOscillator = null;
const labelLayoutCache = new Map();
let measureCanvas = null;
let measureContext = null;

let wheel = null;
let ctx = null;
let spinButton = null;
let luckyMoneyBtn = null;
let resultTitle = null;
let resultDesc = null;
let actionArea = null;
let resultBackdrop = null;
let resultCard = null;
let cardTitle = null;
let cardDesc = null;
let closeResult = null;
let settingsBackdrop = null;
let settingsDialog = null;
let settingsStatus = null;
let bottleSpinner = null;
let startButton = null;
let pauseButton = null;
let restartButton = null;
let soundToggle = null;
let starfieldContext = null;

function visibleOptions() {
  return wheelOptions.filter(option => option.id !== "money" || Number(state && state.poolRiel || 0) > 0);
}
function drawWheel(items = visibleOptions()) {
  const count = items.length;
  const center = wheel.width / 2;
  const radius = wheel.width * 0.47;
  ctx.clearRect(0, 0, wheel.width, wheel.height);
  if (!count) return;
  const arc = Math.PI * 2 / count;
  const rim = ctx.createRadialGradient(center, center, radius * 0.83, center, center, radius * 1.03);
  rim.addColorStop(0, "rgba(255,240,200,0)");
  rim.addColorStop(0.9, "rgba(255,220,130,0.08)");
  rim.addColorStop(1, "rgba(255,220,130,0.34)");
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(center, center, radius * 1.03, 0, Math.PI * 2); ctx.fill();

  wheel.setAttribute("aria-label", "កង់សំណាង៖ " + items.map(option => option.title).join(" · "));
  items.forEach((option, index) => {
    const start = index * arc - Math.PI / 2;
    const middle = start + arc / 2;
    ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, start, start + arc); ctx.closePath();
    ctx.fillStyle = option.color; ctx.fill();
    ctx.save();
    ctx.clip();
    const gloss = ctx.createRadialGradient(center * 0.66, center * 0.58, radius * 0.04, center, center, radius * 1.15);
    gloss.addColorStop(0, "rgba(255,255,255,.2)");
    gloss.addColorStop(0.62, "rgba(255,255,255,.025)");
    gloss.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, wheel.width, wheel.height);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, start, start + arc); ctx.closePath();
    ctx.strokeStyle = "rgba(255,239,195,.55)"; ctx.lineWidth = 4; ctx.stroke();
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(middle);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.75)";
    ctx.shadowBlur = 8;
    const densityScale = Math.max(0.68, Math.min(1, 9 / count));
    const emojiSize = Math.round(64 * densityScale);
    ctx.font = `${emojiSize}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
    ctx.fillText(option.emoji || "✨", radius * 0.84, 0);

    const labelRadius = radius * 0.58;
    const width = Math.max(42, 2 * labelRadius * Math.sin(arc / 2) * 0.86);
    const cacheKey = `${option.title}\u0000${count}\u0000${Math.round(width)}`;
    let labelLayout = labelLayoutCache.get(cacheKey);
    if (!labelLayout) {
      const fontSize = fitFontSize(option.title, width, count);
      labelLayout = { fontSize, lines: wrapLabel(option.title, width, fontSize) };
      labelLayoutCache.set(cacheKey, labelLayout);
    }
    const { fontSize, lines } = labelLayout;
    const lineHeight = fontSize * 1.18;
    ctx.font = `900 ${fontSize}px "Noto Sans Khmer","Khmer OS System",system-ui,sans-serif`;

    ctx.save();
    ctx.lineWidth = Math.max(6, fontSize * 0.32);
    ctx.strokeStyle = "rgba(2,6,18,0.95)";
    ctx.shadowBlur = Math.max(6, fontSize * 0.32);
    ctx.translate(Math.max(1, fontSize * 0.04), Math.max(1, fontSize * 0.06));
    lines.forEach((line, lineIndex) => {
      const y = (lineIndex - (lines.length - 1) / 2) * lineHeight;
      ctx.strokeText(line, labelRadius, y, width);
    });
    ctx.restore();

    ctx.lineWidth = Math.max(4, fontSize * 0.24);
    ctx.strokeStyle = "rgba(4,13,29,.85)";
    ctx.shadowBlur = Math.max(4, fontSize * 0.28);
    ctx.fillStyle = "#fff9e8";

    lines.forEach((line, lineIndex) => {
      const y = (lineIndex - (lines.length - 1) / 2) * lineHeight;
      ctx.strokeText(line, labelRadius, y, width);
      ctx.fillText(line, labelRadius, y, width);
    });
    ctx.restore();
  });

  const hub = ctx.createRadialGradient(center * .82, center * .76, radius * .02, center, center, radius * .3);
  hub.addColorStop(0, "#fff8db"); hub.addColorStop(.45, "#d9b66b"); hub.addColorStop(1, "#68431f");
  ctx.beginPath(); ctx.arc(center, center, radius * 0.29, 0, Math.PI * 2); ctx.fillStyle = hub; ctx.fill();
  ctx.beginPath(); ctx.arc(center, center, radius * 0.92, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,220,130,.98)"; ctx.lineWidth = 18; ctx.stroke();
  ctx.beginPath(); ctx.arc(center, center, radius * 0.97, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,249,221,.6)"; ctx.lineWidth = 5; ctx.stroke();
  updateBottlePose();
}

function graphemeList(text) {
  try { return Array.from(new Intl.Segmenter("km", { granularity: "grapheme" }).segment(text), item => item.segment); }
  catch (_) { return text.match(/\P{M}\p{M}*/gu) || Array.from(text); }
}
function fitFontSize(text, width, count) {
  const maxSize = Math.round(Math.max(22, 44 * Math.max(0.64, Math.min(1, 9 / count))));
  const minSize = Math.max(14, Math.round(maxSize * 0.55));
  for (let size = maxSize; size >= minSize; size--) {
    measureContext.font = `800 ${size}px "Noto Sans Khmer","Khmer OS System",system-ui,sans-serif`;
    const lines = wrapLabel(text, width, size);
    const fits = lines.every(line => measureContext.measureText(line).width <= width * 0.96);
    if (fits) return size;
  }
  return minSize;
}
function wrapLabel(text, width, fontSize) {
  measureContext.font = `800 ${fontSize}px "Noto Sans Khmer","Khmer OS System",system-ui,sans-serif`;
  const lines = [];
  let line = "";
  for (const cluster of graphemeList(text)) {
    const candidate = line + cluster;
    if (line && measureContext.measureText(candidate).width > width * 0.96) {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
      line = cluster.trimStart();
    } else {
      line = candidate;
    }
  }
  const finalLine = line.trim();
  if (finalLine) lines.push(finalLine);
  return lines.length ? lines : [text.trim() || text];
}

function persistOptions() { safeWrite(STORAGE_OPTIONS, wheelOptions); }
function persistSettings() {
  safeWrite(STORAGE_SETTINGS, settings);
  document.body.classList.toggle("particles-disabled", !settings.galaxyParticles);
  document.body.classList.toggle("wheel-glow-disabled", !settings.wheelGlow);
  updateSoundControl();
  updateGalaxyLoop();
  updateAudioLevels();
}
function getPasses(playerId) {
  try { const passes = JSON.parse(localStorage.getItem("spinDrinkPasses") || "{}"); return Math.max(0, Number(passes[playerId]) || 0); }
  catch (_) { return 0; }
}
function setResult(title, description) { resultTitle.textContent = title; resultDesc.textContent = description; }
async function requestJson(url, body, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const response = await fetchWithTimeout(url, {
    method: options.method || "POST",
    headers,
    ...(options.method === "GET" ? { cache: "no-store" } : { body: JSON.stringify(body || {}) })
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) { const error = new Error(data.error || "សំណើមិនបានជោគជ័យ។"); error.status = response.status; error.data = data; throw error; }
  return data;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId = 0;
  let didTimeout = false;
  const fetchOptions = controller ? { ...options, signal: controller.signal } : options;
  const request = fetch(url, fetchOptions);
  if (typeof window.setTimeout !== "function") return request;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      didTimeout = true;
      if (controller) controller.abort();
      reject(new Error("ការភ្ជាប់យឺតពេក។ សូមពិនិត្យបណ្ដាញ ហើយព្យាយាមម្ដងទៀត។"));
    }, 12000);
  });
  try { return await Promise.race([request, timeout]); }
  catch (error) {
    if (didTimeout || error.name === "AbortError") throw new Error("ការភ្ជាប់យឺតពេក។ សូមពិនិត្យបណ្ដាញ ហើយព្យាយាមម្ដងទៀត។");
    throw error;
  } finally {
    if (timeoutId && typeof window.clearTimeout === "function") window.clearTimeout(timeoutId);
  }
}

async function refreshState(silent = false) {
  if (stateRefreshPromise) return stateRefreshPromise;
  stateRefreshPromise = (async () => {
    try {
      const data = await requestJson("/api/state", null, { method: "GET" });
      state = data.state; renderAll(); return true;
    } catch (error) {
      if (!silent) { setResult("មិនអាចភ្ជាប់ម៉ាស៊ីនហ្គេមបានទេ", error.message); if (spinButton) spinButton.disabled = true; }
      return false;
    }
  })();
  try { return await stateRefreshPromise; }
  finally { stateRefreshPromise = null; }
}
function renderPlayers() {
  if (!state) return;
  const playerList = document.getElementById("playerList");
  playerList.replaceChildren();
  if (!state.players.length) {
    const empty = document.createElement("p"); empty.className = "empty-players"; empty.textContent = "មិនទាន់មានអ្នកលេងទេ។ បញ្ចូលឈ្មោះដើម្បីចាប់ផ្ដើម។";
    playerList.appendChild(empty);
    return;
  }
  for (const player of state.players) {
    const chip = document.createElement("span"); chip.className = "player-chip" + (player.id === state.turnPlayerId ? " current" : "");
    const name = document.createElement("strong"); name.textContent = player.name;
    const turn = document.createElement("small"); turn.textContent = player.id === state.turnPlayerId ? "វេនបច្ចុប្បន្ន" : "លេងឥតគិតថ្លៃ";
    chip.append(name, turn); playerList.append(chip);
  }
}
function renderMoney() {
  if (!state) return;
  document.getElementById("poolAmount").textContent = Number(state.poolRiel || 0).toLocaleString("en-US") + "៛";
  document.getElementById("playerCount").textContent = String(state.players.length);
}
function renderControls() {
  const busy = !state || spinning || actionPending || !state.turnPlayerId || state.pendingAdvance;
  spinButton.disabled = busy || !gameStarted || gamePaused || wheelOptions.length === 0;
  luckyMoneyBtn.disabled = busy || !gameStarted || gamePaused || !state || Number(state.poolRiel || 0) === 0 || !wheelOptions.some(option => option.id === "money");
  document.getElementById("openSettings").disabled = spinning || actionPending;
  if (startButton) {
    startButton.disabled = startPending || (gameStarted && !gamePaused);
    startButton.textContent = startPending ? "⏳ កំពុងភ្ជាប់..." : gamePaused ? "▶ បន្ត" : gameStarted ? "✓ កំពុងលេង" : "▶ ចាប់ផ្ដើម";
  }
  if (pauseButton) {
    pauseButton.disabled = !gameStarted || gamePaused;
    pauseButton.textContent = gamePaused ? "Ⅱ បានផ្អាក" : "Ⅱ ផ្អាក";
  }
  if (restartButton) restartButton.disabled = !state || spinning || actionPending || startPending || state.pendingAdvance;
  if (spinButton) {
    spinButton.textContent = actionPending ? "⏳ កំពុងភ្ជាប់..." : spinning && gamePaused ? "Ⅱ បានផ្អាក" : spinning ? "✨ កំពុងបង្វិល..." : "🎯 បង្វិលកង់";
  }
  document.body.classList.toggle("game-paused", gamePaused);
}
function renderAll() {
  if (!state) return;
  renderPlayers(); renderMoney(); renderControls();
  if (!spinning) drawWheel(visibleOptions());
  renderPendingAdvance();
}

function updateBottlePose() {
  if (!bottleSpinner) return;
  const angle = 270 - rotation * 180 / Math.PI;
  bottleSpinner.style.transform = `rotate(${angle}deg)`;
}

function updateSoundControl() {
  if (!soundToggle) return;
  soundToggle.setAttribute("aria-pressed", settings.soundMuted ? "false" : "true");
  soundToggle.textContent = settings.soundMuted ? "🔇 បិទសំឡេង" : "🔊 សំឡេង";
}

async function startGame() {
  if (gameStarted && gamePaused) {
    gamePaused = false;
    if (bottleAnimation) bottleAnimation.lastFrame = performance.now();
    updateAudioLevels(); queueBottleFrame(); updateGalaxyLoop(); renderControls();
    setResult("បានបន្តលេង", state && state.turnPlayerName ? `វេនរបស់ ${state.turnPlayerName}` : "បន្ថែមឈ្មោះអ្នកលេងដើម្បីចាប់ផ្ដើម។");
    return;
  }
  if (gameStarted || startPending) return;
  startPending = true; renderControls();
  try {
    if (!state) await refreshState();
    if (!state) return;
    gameStarted = true; gamePaused = false;
    updateGalaxyLoop();
    if (bottleAnimation) bottleAnimation.lastFrame = performance.now();
    queueBottleFrame();
    if (!state.players.length) {
      setResult("បន្ថែមអ្នកលេងដើម្បីចាប់ផ្ដើម", "បញ្ចូលឈ្មោះអ្នកលេងនៅខាងលើ រួចចុចបង្វិលកង់។");
      document.getElementById("playerName").focus();
    } else {
      setResult("ត្រៀមរួចរាល់!", state.turnPlayerName ? `វេនរបស់ ${state.turnPlayerName}` : "ចុចបង្វិលកង់ដើម្បីលេង។");
    }
  } finally { startPending = false; renderControls(); }
}

function pauseGame() {
  if (!gameStarted || gamePaused) return;
  gamePaused = true;
  if (bottleFrame) cancelAnimationFrame(bottleFrame);
  bottleFrame = 0;
  if (musicGain && audioContext) musicGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.06);
  updateGalaxyLoop(); renderControls();
  setResult("ហ្គេមបានផ្អាក", "ចុចបន្តដើម្បីបន្តចលនាដប និងការលេង។");
}

async function restartGame() {
  if (!state || spinning || actionPending || startPending) return;
  gameStarted = false; gamePaused = false;
  if (bottleFrame) cancelAnimationFrame(bottleFrame);
  bottleFrame = 0; bottleAnimation = null; rotation = 0;
  updateBottlePose(); actionArea.replaceChildren(); dismissResult();
  setResult("ត្រៀមខ្លួនហើយឬ?", "ចុចចាប់ផ្ដើម រួចបង្វិលកង់ដើម្បីលេង។ អ្នកលេង និងច្បាប់នៅដដែល។");
  updateGalaxyLoop(); renderControls();
  await refreshState();
}

async function toggleSound() {
  settings.soundMuted = !settings.soundMuted;
  if (!settings.soundMuted && (settings.soundEffects || settings.backgroundMusic)) await ensureAudio();
  persistSettings(); setSettingsInputs();
}

function optionId(value) {
  const safe = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `custom-${safe}`;
}
function setSettingsStatus(message) { settingsStatus.textContent = message; }
function updateOptionEditor() {
  const editor = document.getElementById("wheelItemsEditor");
  editor.replaceChildren();
  wheelOptions.forEach((option, index) => {
    const row = document.createElement("fieldset"); row.className = "wheel-option-row"; row.dataset.optionId = option.id;
    const legend = document.createElement("legend"); legend.textContent = `ធាតុ ${index + 1}`; row.append(legend);
    const labelField = document.createElement("label"); labelField.className = "option-name-field"; labelField.textContent = "ឈ្មោះ";
    const titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.maxLength = 40; titleInput.value = option.title; titleInput.setAttribute("aria-label", `ឈ្មោះធាតុ ${index + 1}`);
    const emojiField = document.createElement("label"); emojiField.className = "option-emoji-field"; emojiField.textContent = "Emoji";
    const emojiInput = document.createElement("input"); emojiInput.type = "text"; emojiInput.maxLength = 8; emojiInput.value = option.emoji; emojiInput.setAttribute("aria-label", `Emoji ធាតុ ${index + 1}`);
    const colorField = document.createElement("label"); colorField.className = "option-color-field"; colorField.textContent = "ពណ៌";
    const colorInput = document.createElement("input"); colorInput.type = "color"; colorInput.value = option.color; colorInput.setAttribute("aria-label", `ពណ៌ធាតុ ${index + 1}`);
    const controls = document.createElement("div"); controls.className = "option-row-actions";
    const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.title = "រំកិលឡើង"; up.setAttribute("aria-label", `រំកិលធាតុ ${index + 1}ឡើង`);
    const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.title = "រំកិលចុះ"; down.setAttribute("aria-label", `រំកិលធាតុ ${index + 1}ចុះ`);
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "ដកចេញ"; remove.className = "option-remove"; remove.setAttribute("aria-label", `ដកធាតុ ${index + 1}ចេញ`);
    controls.append(up, down, remove); row.append(labelField, emojiField, colorField, controls); editor.append(row);

    titleInput.addEventListener("input", () => {
      const current = wheelOptions.find(item => item.id === option.id); if (!current) return;
      current.title = titleInput.value.trim() || "…";
      if (current.id.startsWith("custom-") || current.id === "dance-two-minutes") current.desc = current.id === "dance-two-minutes" ? `អ្នកត្រូវ ${current.title}! 💃🕺` : current.title;
      persistOptions(); drawWheel(visibleOptions()); setSettingsStatus("កង់ត្រូវបានកែប្រែភ្លាមៗ។");
    });
    emojiInput.addEventListener("input", () => { const current = wheelOptions.find(item => item.id === option.id); if (!current) return; current.emoji = Array.from(emojiInput.value.trim()).slice(0, 8).join("") || "✨"; persistOptions(); drawWheel(visibleOptions()); });
    colorInput.addEventListener("input", () => { const current = wheelOptions.find(item => item.id === option.id); if (!current) return; current.color = colorInput.value; persistOptions(); drawWheel(visibleOptions()); });
    up.addEventListener("click", () => reorderOption(index, -1));
    down.addEventListener("click", () => reorderOption(index, 1));
    remove.addEventListener("click", () => { if (wheelOptions.length <= 1) return; wheelOptions.splice(index, 1); rotation = 0; persistOptions(); updateOptionEditor(); drawWheel(visibleOptions()); setSettingsStatus("បានដកធាតុចេញ។"); });
  });
}
function reorderOption(index, step) {
  const next = index + step; if (next < 0 || next >= wheelOptions.length) return;
  [wheelOptions[index], wheelOptions[next]] = [wheelOptions[next], wheelOptions[index]];
  rotation = 0; persistOptions(); updateOptionEditor(); drawWheel(visibleOptions()); setSettingsStatus("បានប្ដូរលំដាប់ធាតុ។");
}
function addOption(event) {
  event.preventDefault();
  if (wheelOptions.length >= MAX_WHEEL_OPTIONS) { setSettingsStatus(`កង់អាចមានធាតុច្រើនបំផុត ${MAX_WHEEL_OPTIONS}។`); return; }
  const titleInput = document.getElementById("newOptionName");
  const title = titleInput.value.trim(); if (!title) return;
  const emoji = Array.from(document.getElementById("newOptionEmoji").value.trim() || "✨").slice(0, 8).join("");
  const color = document.getElementById("newOptionColor").value;
  wheelOptions.push({ id: optionId(title), emoji, title: title.slice(0, 40), desc: title.slice(0, 40), color });
  titleInput.value = ""; rotation = 0; persistOptions(); updateOptionEditor(); drawWheel(visibleOptions()); setSettingsStatus("បានបន្ថែមធាតុថ្មី។"); titleInput.focus();
}

function setSettingsInputs() {
  document.getElementById("spinSpeed").value = settings.spinSpeed;
  document.getElementById("spinDuration").value = settings.spinDuration;
  document.getElementById("animationStyle").value = settings.animationStyle;
  document.getElementById("soundEffects").checked = settings.soundEffects;
  document.getElementById("backgroundMusic").checked = settings.backgroundMusic;
  document.getElementById("galaxyParticles").checked = settings.galaxyParticles;
  document.getElementById("wheelGlow").checked = settings.wheelGlow;
  document.getElementById("masterVolume").value = String(settings.volume);
  document.getElementById("volumeValue").value = `${Math.round(settings.volume)}%`;
  updateSoundControl();
}
function openSettings() { updateOptionEditor(); setSettingsInputs(); settingsBackdrop.hidden = false; document.body.classList.add("dialog-open"); document.getElementById("closeSettings").focus(); }
function closeSettings() { settingsBackdrop.hidden = true; document.body.classList.remove("dialog-open"); document.getElementById("openSettings").focus(); }
function saveWheelOptions() { persistOptions(); setSettingsStatus("បានរក្សាទុកការកែប្រែ។"); }
function restoreWheelOptions() { wheelOptions = cloneDefaults(); rotation = 0; persistOptions(); updateOptionEditor(); drawWheel(visibleOptions()); setSettingsStatus("បានស្ដារធាតុកង់ដើម។"); }
function resetEverything() { wheelOptions = cloneDefaults(); settings = { ...DEFAULT_SETTINGS }; persistOptions(); persistSettings(); setSettingsInputs(); updateOptionEditor(); rotation = 0; drawWheel(visibleOptions()); setSettingsStatus("បានស្ដារការកំណត់ទាំងអស់។"); }

function openResult(title, description) {
  cardTitle.textContent = title; cardDesc.textContent = description || "";
  resultBackdrop.hidden = false; document.body.classList.add("dialog-open"); closeResult.focus();
}
function dismissResult() {
  resultBackdrop.hidden = true; document.body.classList.remove("dialog-open");
  if (state && !spinning) { rotation = 0; drawWheel(visibleOptions()); }
}
function showOutcome(payload) {
  const option = wheelOptions.find(item => item.id === payload.outcome.outcomeId);
  if (!option) return;
  const outcome = payload.outcome;
  actionArea.replaceChildren();
  if (option.id === "money") {
    const amount = Number(outcome.payoutRiel || 0).toLocaleString("en-US") + "៛";
    const summary = `${outcome.playerName} ឈ្នះ ${amount}`;
    setResult(`💰 ${summary}`, option.desc || "ប្រាក់រង្វាន់"); openResult(option.title, summary);
  } else if (option.id === "dance-two-minutes") {
    const message = option.title === "រាំ 2 នាទី" ? "អ្នកត្រូវរាំ 2 នាទី! 💃🕺" : `អ្នកត្រូវ ${option.title}! 💃🕺`;
    setResult(message, "កុំចាប់ផ្ដើមកំណត់ម៉ោងដោយស្វ័យប្រវត្តិ។"); openResult(message, "មិនមានការរំកិលដោយស្វ័យប្រវត្តិ");
  } else {
    const message = `${option.emoji} ${option.title} — ${outcome.playerName}`;
    setResult(message, option.desc); openResult(option.title, `${message}\n${option.desc}`);
  }
  if (option.id === "command") {
    actionArea.append(createAdvanceButton());
  }
}

function createAdvanceButton() {
  const advance = document.createElement("button");
  advance.type = "button"; advance.className = "btn-add"; advance.textContent = "បន្តវេន";
  advance.addEventListener("click", async () => {
    if (actionPending) return;
    actionPending = true; renderControls(); advance.disabled = true;
    let advanced = false;
    try {
      const data = await requestJson("/api/turn/advance", {});
      state = data.state; advanced = true; renderAll(); actionArea.replaceChildren();
    } catch (error) { setResult("មិនអាចបន្តវេនបានទេ", error.message); }
    finally { actionPending = false; if (!advanced) advance.disabled = false; renderControls(); }
  });
  return advance;
}

function renderPendingAdvance() {
  if (!state || !state.pendingAdvance || actionArea.children.length) return;
  const lastSpin = state.latestSpin;
  const option = lastSpin && wheelOptions.find(item => item.id === lastSpin.outcomeId);
  setResult("បញ្ចប់សកម្មភាពមុនបន្ត", option ? `${lastSpin.playerName}៖ ${option.title}` : "សូមបញ្ចប់សកម្មភាពរបស់អ្នកលេងបច្ចុប្បន្ន។");
  actionArea.append(createAdvanceButton());
}

function audioAvailable() { return typeof window.AudioContext === "function" || typeof window.webkitAudioContext === "function"; }
async function ensureAudio() {
  if (!audioAvailable()) return false;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      audioContext = new AudioContextClass(); masterGain = audioContext.createGain(); effectsGain = audioContext.createGain(); musicGain = audioContext.createGain();
      effectsGain.connect(masterGain); musicGain.connect(masterGain); masterGain.connect(audioContext.destination);
    } catch (_) { audioContext = null; return false; }
  }
  if (audioContext.state === "suspended") { try { await audioContext.resume(); } catch (_) { return false; } }
  updateAudioLevels();
  return true;
}
function updateAudioLevels() {
  if (!audioContext || !masterGain) return;
  const now = audioContext.currentTime;
  masterGain.gain.setTargetAtTime(settings.soundMuted ? 0 : Math.pow(settings.volume / 100, 1.35), now, 0.04);
  effectsGain.gain.setTargetAtTime(settings.soundEffects && !settings.soundMuted ? 1 : 0, now, 0.025);
  musicGain.gain.setTargetAtTime(settings.backgroundMusic && !settings.soundMuted && !gamePaused ? 0.22 : 0, now, 0.18);
  if (settings.backgroundMusic && !musicOscillators.length) startMusic();
  if (!settings.backgroundMusic && musicOscillators.length) stopMusic();
}
function startMusic() {
  if (!audioContext || musicOscillators.length) return;
  for (const [frequency, amplitude] of [[55, 0.08], [82.41, 0.035], [164.81, 0.012]]) {
    const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.value = amplitude;
    oscillator.connect(gain); gain.connect(musicGain); oscillator.start(); musicOscillators.push(oscillator);
  }
}
function stopMusic() { for (const oscillator of musicOscillators) { try { oscillator.stop(); oscillator.disconnect(); } catch (_) {} } musicOscillators = []; }
function tone(frequency, duration, type = "sine", peak = 0.12, endFrequency = frequency, delay = 0) {
  if (!audioContext || !settings.soundEffects || settings.soundMuted || settings.volume <= 0) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator(); const envelope = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(Math.max(35, frequency), start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration);
  envelope.gain.setValueAtTime(0.0001, start); envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), start + Math.min(0.025, duration / 3));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope); envelope.connect(effectsGain); oscillator.start(start); oscillator.stop(start + duration + 0.03);
  return oscillator;
}
async function startSpinAudio() {
  if (settings.soundMuted || (!settings.soundEffects && !settings.backgroundMusic)) return;
  if (!await ensureAudio()) return;
  if (settings.soundEffects) tone(520, 0.48, "sawtooth", 0.13, 78);
}
function playTick(frequency = 700) {
  if (previousTickOscillator && audioContext) { try { previousTickOscillator.stop(audioContext.currentTime); } catch (_) {} }
  previousTickOscillator = tone(frequency, 0.045, "triangle", 0.09, frequency * 0.72);
}
function playWinSound() { [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, 0.24, "sine", 0.16, frequency * 1.02, index * 0.1)); }

function durationForSpin() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Math.min(900, Number(settings.spinDuration) * 1000);
  return Number(settings.spinDuration) * 1000;
}
function turnsForSpeed() { return ({ verySlow: 2, slow: 4, normal: 6, fast: 9, veryFast: 12 })[settings.spinSpeed] || 6; }
function easedProgress(t) {
  if (settings.animationStyle === "smooth") return t * t * t * (t * (t * 6 - 15) + 10);
  if (settings.animationStyle === "energetic") return 1 - Math.pow(1 - t, 5);
  if (settings.animationStyle === "bouncy") {
    const c1 = 1.70158; const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function animateTo(outcomeId, availableIds) {
  const byId = new Map(wheelOptions.map(option => [option.id, option]));
  const spinOptions = availableIds.map(id => byId.get(id)).filter(Boolean);
  const winner = spinOptions.findIndex(option => option.id === outcomeId);
  if (winner < 0 || !spinOptions.length) throw new Error("Invalid outcome");
  const arc = Math.PI * 2 / spinOptions.length; drawWheel(spinOptions);
  const start = rotation; const target = (Math.PI * 2) - (winner * arc + arc / 2);
  const normalize = angle => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const current = normalize(start); let delta = normalize(target) - current; if (delta < 0) delta += Math.PI * 2;
  const extra = delta + turnsForSpeed() * Math.PI * 2;
  const duration = durationForSpin(); spinning = true; renderControls(); lastTick = -1;
  return new Promise(resolve => {
    bottleAnimation = { start, extra, duration, elapsed: 0, lastFrame: performance.now(), arc, resolve };
    queueBottleFrame();
  });
}

function queueBottleFrame() {
  if (bottleFrame || !bottleAnimation || gamePaused || document.hidden) return;
  bottleFrame = requestAnimationFrame(animateBottleFrame);
}

function animateBottleFrame(now) {
  bottleFrame = 0;
  const animation = bottleAnimation;
  if (!animation || gamePaused || document.hidden) return;
  animation.elapsed += Math.max(0, now - animation.lastFrame);
  animation.lastFrame = now;
  const t = Math.min(1, animation.elapsed / animation.duration);
  const eased = t === 1 ? 1 : easedProgress(t);
  rotation = animation.start + animation.extra * eased;
  updateBottlePose();
  const pointerAngle = ((-rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const segment = Math.floor(pointerAngle / animation.arc);
  if (segment !== lastTick) {
    lastTick = segment;
    playTick(Math.min(1500, 380 + Math.abs(animation.extra * (1 - eased) / (animation.duration / 1000)) * 95));
  }
  if (t < 1) {
    queueBottleFrame();
    return;
  }
  rotation = ((animation.start + animation.extra) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  updateBottlePose();
  bottleAnimation = null;
  spinning = false;
  if (previousTickOscillator && audioContext) { try { previousTickOscillator.stop(audioContext.currentTime); } catch (_) {} }
  previousTickOscillator = null;
  renderControls();
  animation.resolve();
}

async function spin() {
  if (spinning || actionPending || gamePaused || !state || !state.turnPlayerId || !wheelOptions.length) return;
  actionPending = true; renderControls();
  try {
    await startSpinAudio();
    const wheelOptionIds = wheelOptions.map(option => option.id);
    const payload = await requestJson("/api/spin", { playerId: state.turnPlayerId, wheelOptionIds });
    actionPending = false; renderControls();
    await animateTo(payload.outcome.outcomeId, payload.availableOutcomeIds);
    state = payload.state; renderPlayers(); renderMoney(); renderControls(); showOutcome(payload);
  } catch (error) {
    if (error.data && error.data.state) state = error.data.state;
    renderAll(); setResult("មិនអាចបង្វិលបានទេ", error.message);
  } finally { actionPending = false; renderControls(); }
}

function resizeStarfield() {
  const canvas = document.getElementById("starfield"); if (!canvas) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.1);
  canvas.width = Math.max(1, Math.round(window.innerWidth * ratio)); canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
  canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
  const count = window.innerWidth < 600 ? 300 : 620;
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    size: (Math.random() * 1.45 + 0.35) * ratio, phase: Math.random() * Math.PI * 2,
    opacity: Math.random() * 0.45 + 0.18, rate: Math.random() * 0.0016 + 0.00025,
    gold: Math.random() < 0.16
  }));
  starfieldContext = canvas.getContext("2d", { alpha: true });
  if (starfieldContext) starfieldContext.setTransform(1, 0, 0, 1, 0, 0);
  drawStars(0, true);
}
function drawStars(time, still = false) {
  const canvas = document.getElementById("starfield"); const galaxyContext = starfieldContext;
  if (!galaxyContext || !settings.galaxyParticles) return;
  galaxyContext.clearRect(0, 0, canvas.width, canvas.height);
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const star of stars) {
    const alpha = reduced || still ? star.opacity : star.opacity * (0.68 + 0.32 * Math.sin(time * star.rate + star.phase));
    galaxyContext.fillStyle = star.gold ? `rgba(255,221,147,${alpha})` : `rgba(205,225,255,${alpha})`;
    galaxyContext.fillRect(star.x, star.y, star.size, star.size);
  }
  if (shootingStar && !reduced && time < shootingStar.ends) {
    const progress = Math.max(0, (time - shootingStar.starts) / (shootingStar.ends - shootingStar.starts));
    const x = shootingStar.x + progress * shootingStar.distance; const y = shootingStar.y + progress * shootingStar.distance * 0.36;
    const trail = galaxyContext.createLinearGradient(x, y, x - 90, y - 32);
    trail.addColorStop(0, "rgba(255,244,204,.95)"); trail.addColorStop(1, "rgba(255,244,204,0)");
    galaxyContext.strokeStyle = trail; galaxyContext.lineWidth = 2.2; galaxyContext.beginPath(); galaxyContext.moveTo(x, y); galaxyContext.lineTo(x - 90, y - 32); galaxyContext.stroke();
  } else if (shootingStar && time >= shootingStar.ends) shootingStar = null;
}
function galaxyTick(time) {
  galaxyFrame = 0;
  if (!galaxyRunning || !settings.galaxyParticles || document.hidden) return;
  if (time - lastGalaxyDraw >= 33) {
    lastGalaxyDraw = time;
    if (!shootingStar && time >= nextShootingStarAt && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      shootingStar = { x: Math.random() * window.innerWidth * 0.6, y: Math.random() * window.innerHeight * 0.45, distance: 250 + Math.random() * 250, starts: time, ends: time + 950 };
      nextShootingStarAt = time + 4200 + Math.random() * 5500;
    }
    drawStars(time);
  }
  galaxyFrame = requestAnimationFrame(galaxyTick);
}
function updateGalaxyLoop() {
  const canvas = document.getElementById("starfield");
  if (!settings.galaxyParticles || document.hidden || gamePaused || !gameStarted) {
    galaxyRunning = false; if (galaxyFrame) cancelAnimationFrame(galaxyFrame); galaxyFrame = 0;
    if (canvas) { const galaxyContext = canvas.getContext("2d"); galaxyContext.clearRect(0, 0, canvas.width, canvas.height); }
    return;
  }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { drawStars(0, true); return; }
  if (!galaxyRunning) { galaxyRunning = true; lastGalaxyDraw = 0; galaxyFrame = requestAnimationFrame(galaxyTick); }
}

let initialized = false;
function initGame() {
  if (initialized) return;

  const requiredElementIds = [
    "actionArea", "addOptionForm", "animationStyle", "backgroundMusic", "cardDesc", "cardTitle",
    "bottleSpin", "closeResult", "closeSettings", "galaxyParticles", "luckyMoney", "masterVolume", "newOptionColor",
    "newOptionEmoji", "newOptionName", "openSettings", "playerCount", "playerForm", "playerList",
    "pauseGame", "playerName", "playersSection", "playersShortcut", "poolAmount", "restartGame", "resetAllSettings", "restoreWheelDefaults",
    "resultBackdrop", "resultCard", "resultDesc", "resultTitle", "saveWheelOptions", "settingsBackdrop",
    "settingsDialog", "settingsStatus", "soundEffects", "soundToggle", "spin", "spinDuration", "spinSpeed", "startGame", "volumeValue",
    "wheel", "wheelGlow", "wheelItemsEditor"
  ];
  const missingElementIds = requiredElementIds.filter(id => !document.getElementById(id));
  if (!document.body || missingElementIds.length) {
    console.error("[Spin-And-Drink] Initialization skipped; required page elements are missing.", missingElementIds);
    return;
  }

  measureCanvas = document.createElement("canvas");
  measureContext = measureCanvas.getContext("2d");
  wheel = document.getElementById("wheel");
  ctx = wheel.getContext("2d");
  if (!measureContext || !ctx) {
    console.error("[Spin-And-Drink] Initialization skipped; a 2D canvas context is unavailable.");
    return;
  }

  spinButton = document.getElementById("spin");
  luckyMoneyBtn = document.getElementById("luckyMoney");
  resultTitle = document.getElementById("resultTitle");
  resultDesc = document.getElementById("resultDesc");
  actionArea = document.getElementById("actionArea");
  resultBackdrop = document.getElementById("resultBackdrop");
  resultCard = document.getElementById("resultCard");
  cardTitle = document.getElementById("cardTitle");
  cardDesc = document.getElementById("cardDesc");
  closeResult = document.getElementById("closeResult");
  settingsBackdrop = document.getElementById("settingsBackdrop");
  settingsDialog = document.getElementById("settingsDialog");
  settingsStatus = document.getElementById("settingsStatus");
  bottleSpinner = document.getElementById("bottleSpin");
  startButton = document.getElementById("startGame");
  pauseButton = document.getElementById("pauseGame");
  restartButton = document.getElementById("restartGame");
  soundToggle = document.getElementById("soundToggle");
  initialized = true;

  document.getElementById("playerForm").addEventListener("submit", async event => {
    event.preventDefault(); const input = document.getElementById("playerName"); const name = input.value.trim(); if (!name) return;
    try { await requestJson("/api/players", { name }); input.value = ""; await refreshState(); }
    catch (error) { setResult("មិនអាចបន្ថែមបាន", error.message); }
  });
  spinButton.addEventListener("click", spin);
  luckyMoneyBtn.addEventListener("click", spin);
  startButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", pauseGame);
  restartButton.addEventListener("click", restartGame);
  soundToggle.addEventListener("click", toggleSound);
  document.getElementById("openSettings").addEventListener("click", openSettings);
  document.getElementById("closeSettings").addEventListener("click", closeSettings);
  document.getElementById("playersShortcut").addEventListener("click", () => { document.getElementById("playersSection").scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("playerName").focus(); });
  closeResult.addEventListener("click", dismissResult);
  document.getElementById("addOptionForm").addEventListener("submit", addOption);
  document.getElementById("saveWheelOptions").addEventListener("click", saveWheelOptions);
  document.getElementById("restoreWheelDefaults").addEventListener("click", restoreWheelOptions);
  document.getElementById("resetAllSettings").addEventListener("click", resetEverything);
  settingsBackdrop.addEventListener("click", event => { if (event.target === settingsBackdrop) closeSettings(); });
  resultBackdrop.addEventListener("click", event => { if (event.target === resultBackdrop) dismissResult(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!settingsBackdrop.hidden) closeSettings(); else if (!resultBackdrop.hidden) dismissResult();
    }
  });
  for (const [id, key] of [["spinSpeed", "spinSpeed"], ["spinDuration", "spinDuration"], ["animationStyle", "animationStyle"]]) {
    document.getElementById(id).addEventListener("change", event => { settings[key] = event.target.value; persistSettings(); setSettingsStatus("បានរក្សាទុកការកំណត់។"); });
  }
  for (const [id, key] of [["soundEffects", "soundEffects"], ["backgroundMusic", "backgroundMusic"], ["galaxyParticles", "galaxyParticles"], ["wheelGlow", "wheelGlow"]]) {
    document.getElementById(id).addEventListener("change", async event => {
      settings[key] = event.target.checked;
      if (key === "backgroundMusic" && settings.backgroundMusic) await ensureAudio();
      persistSettings(); setSettingsStatus("បានរក្សាទុកការកំណត់។");
    });
  }
  document.getElementById("masterVolume").addEventListener("input", event => {
    settings.volume = Number(event.target.value); document.getElementById("volumeValue").value = `${settings.volume}%`;
    persistSettings();
  });
  for (const button of [spinButton, luckyMoneyBtn]) {
    button.addEventListener("pointerdown", () => button.classList.add("pressed"));
    button.addEventListener("pointerup", () => button.classList.remove("pressed"));
    button.addEventListener("pointercancel", () => button.classList.remove("pressed"));
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (bottleFrame) cancelAnimationFrame(bottleFrame);
      bottleFrame = 0;
      if (bottleAnimation) bottleAnimation.lastFrame = performance.now();
      galaxyRunning = false; if (galaxyFrame) cancelAnimationFrame(galaxyFrame); galaxyFrame = 0;
    } else {
      if (bottleAnimation) bottleAnimation.lastFrame = performance.now();
      queueBottleFrame(); updateGalaxyLoop();
    }
  });
  window.addEventListener("resize", resizeStarfield, { passive: true });

  persistSettings(); setSettingsInputs(); updateBottlePose(); resizeStarfield(); updateGalaxyLoop(); drawWheel(visibleOptions()); updateOptionEditor(); renderControls(); refreshState();
  window.setInterval(() => { if (!spinning && !actionPending) refreshState(true); }, 5000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initGame, { once: true });
else initGame();
