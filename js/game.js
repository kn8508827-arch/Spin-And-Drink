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
const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");

const wheel = document.getElementById("wheel");
const ctx = wheel.getContext("2d");
const spinButton = document.getElementById("spin");
const luckyMoneyBtn = document.getElementById("luckyMoney");
const resultTitle = document.getElementById("resultTitle");
const resultDesc = document.getElementById("resultDesc");
const actionArea = document.getElementById("actionArea");
const resultBackdrop = document.getElementById("resultBackdrop");
const resultCard = document.getElementById("resultCard");
const cardTitle = document.getElementById("cardTitle");
const cardDesc = document.getElementById("cardDesc");
const closeResult = document.getElementById("closeResult");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const settingsDialog = document.getElementById("settingsDialog");
const settingsStatus = document.getElementById("settingsStatus");

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
    const start = rotation + index * arc - Math.PI / 2;
    const middle = start + arc / 2;
    ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, start, start + arc); ctx.closePath();
    ctx.fillStyle = option.color; ctx.fill();
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

  ctx.beginPath(); ctx.arc(center, center, radius * 0.28, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.96)"; ctx.fill();
  ctx.beginPath(); ctx.arc(center, center, radius * 0.92, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,220,130,.98)"; ctx.lineWidth = 18; ctx.stroke();
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
  const response = await fetch(url, { method: options.method || "POST", headers, body: JSON.stringify(body || {}) });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) { const error = new Error(data.error || "សំណើមិនបានជោគជ័យ។"); error.status = response.status; error.data = data; throw error; }
  return data;
}

async function refreshState(silent = false) {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("មិនអាចភ្ជាប់ទៅម៉ាស៊ីនហ្គេមបានទេ។");
    const data = await response.json(); state = data.state; renderAll();
  } catch (error) {
    if (!silent) { setResult("មិនអាចភ្ជាប់ម៉ាស៊ីនហ្គេមបានទេ", error.message); spinButton.disabled = true; }
  }
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
  if (!state) return;
  const busy = spinning || actionPending || !state.turnPlayerId || state.pendingAdvance;
  spinButton.disabled = busy || wheelOptions.length === 0;
  luckyMoneyBtn.disabled = busy || Number(state.poolRiel || 0) === 0 || !wheelOptions.some(option => option.id === "money");
  document.getElementById("openSettings").disabled = spinning || actionPending;
}
function renderAll() {
  if (!state) return;
  renderPlayers(); renderMoney(); renderControls();
  if (!spinning) drawWheel(visibleOptions());
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
function dismissResult() { resultBackdrop.hidden = true; document.body.classList.remove("dialog-open"); }
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
    const advance = document.createElement("button"); advance.type = "button"; advance.className = "btn-add"; advance.textContent = "បន្តវេន";
    advance.addEventListener("click", async () => {
      if (actionPending) return; actionPending = true; renderControls(); advance.disabled = true;
      try { const data = await requestJson("/api/turn/advance", {}); state = data.state; renderAll(); actionArea.replaceChildren(); }
      catch (error) { setResult("មិនអាចបន្តវេនបានទេ", error.message); }
      finally { actionPending = false; renderControls(); }
    });
    actionArea.append(advance);
  }
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
  masterGain.gain.setTargetAtTime(Math.pow(settings.volume / 100, 1.35), now, 0.04);
  effectsGain.gain.setTargetAtTime(settings.soundEffects ? 1 : 0, now, 0.025);
  musicGain.gain.setTargetAtTime(settings.backgroundMusic ? 0.22 : 0, now, 0.18);
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
  if (!audioContext || !settings.soundEffects || settings.volume <= 0) return;
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
  if (!settings.soundEffects && !settings.backgroundMusic) return;
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
  if (settings.animationStyle === "smooth") return 1 - Math.pow(1 - t, 4);
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
  const duration = durationForSpin(); const begin = performance.now(); spinning = true; renderControls(); lastTick = -1;
  return new Promise(resolve => {
    function frame(now) {
      const t = Math.min(1, (now - begin) / duration); const eased = t === 1 ? 1 : easedProgress(t);
      rotation = start + extra * eased; drawWheel(spinOptions);
      const pointerAngle = normalize(-rotation); const segment = Math.floor(pointerAngle / arc);
      if (segment !== lastTick) { lastTick = segment; playTick(Math.min(1500, 380 + Math.abs(extra * (1 - eased) / (duration / 1000)) * 95)); }
      if (t < 1) requestAnimationFrame(frame);
      else { rotation = normalize(start + extra); drawWheel(spinOptions); spinning = false; if (previousTickOscillator && audioContext) { try { previousTickOscillator.stop(audioContext.currentTime); } catch (_) {} } previousTickOscillator = null; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}
async function spin() {
  if (spinning || actionPending || !state || !state.turnPlayerId || !wheelOptions.length) return;
  spinButton.disabled = true; spinButton.textContent = "✨ កំពុងរៀបចំ...";
  await startSpinAudio();
  try {
    const wheelOptionIds = wheelOptions.map(option => option.id);
    const payload = await requestJson("/api/spin", { playerId: state.turnPlayerId, wheelOptionIds });
    await animateTo(payload.outcome.outcomeId, payload.availableOutcomeIds);
    state = payload.state; renderAll(); showOutcome(payload);
  } catch (error) {
    if (error.data && error.data.state) state = error.data.state;
    renderAll(); setResult("មិនអាចបង្វិលបានទេ", error.message);
  } finally { spinButton.textContent = "🎯 បង្វិលកង់"; renderControls(); }
}

function resizeStarfield() {
  const canvas = document.getElementById("starfield"); if (!canvas) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  canvas.width = Math.max(1, Math.round(window.innerWidth * ratio)); canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
  canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
  const count = window.innerWidth < 600 ? 1200 : 2000;
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    size: (Math.random() * 1.45 + 0.35) * ratio, phase: Math.random() * Math.PI * 2,
    opacity: Math.random() * 0.45 + 0.18, rate: Math.random() * 0.0016 + 0.00025,
    gold: Math.random() < 0.16
  }));
  const galaxyContext = canvas.getContext("2d", { alpha: true });
  if (galaxyContext) galaxyContext.setTransform(1, 0, 0, 1, 0, 0);
  drawStars(0, true);
}
function drawStars(time, still = false) {
  const canvas = document.getElementById("starfield"); const galaxyContext = canvas && canvas.getContext("2d", { alpha: true });
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
  if (time - lastGalaxyDraw >= 50) {
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
  if (!settings.galaxyParticles || document.hidden) {
    galaxyRunning = false; if (galaxyFrame) cancelAnimationFrame(galaxyFrame); galaxyFrame = 0;
    if (canvas) { const galaxyContext = canvas.getContext("2d"); galaxyContext.clearRect(0, 0, canvas.width, canvas.height); }
    return;
  }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { drawStars(0, true); return; }
  if (!galaxyRunning) { galaxyRunning = true; lastGalaxyDraw = 0; galaxyFrame = requestAnimationFrame(galaxyTick); }
}

document.getElementById("playerForm").addEventListener("submit", async event => {
  event.preventDefault(); const input = document.getElementById("playerName"); const name = input.value.trim(); if (!name) return;
  try { await requestJson("/api/players", { name }); input.value = ""; await refreshState(); }
  catch (error) { setResult("មិនអាចបន្ថែមបាន", error.message); }
});
document.getElementById("spin").addEventListener("click", spin);
document.getElementById("luckyMoney").addEventListener("click", spin);
document.getElementById("openSettings").addEventListener("click", openSettings);
document.getElementById("closeSettings").addEventListener("click", closeSettings);
document.getElementById("playersShortcut").addEventListener("click", () => { document.getElementById("playersSection").scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("playerName").focus(); });
document.getElementById("closeResult").addEventListener("click", dismissResult);
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
document.addEventListener("visibilitychange", () => { if (document.hidden) { galaxyRunning = false; if (galaxyFrame) cancelAnimationFrame(galaxyFrame); galaxyFrame = 0; } else updateGalaxyLoop(); });
window.addEventListener("resize", resizeStarfield, { passive: true });

persistSettings(); setSettingsInputs(); resizeStarfield(); updateGalaxyLoop(); drawWheel(visibleOptions()); updateOptionEditor(); refreshState();
window.setInterval(() => { if (!spinning && !actionPending) refreshState(true); }, 5000);
