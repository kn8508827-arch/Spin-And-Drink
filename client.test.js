"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const CLIENT_SCRIPT = fs.readFileSync(path.resolve(__dirname, "js", "game.js"), "utf8");

function makeClassList() {
  const values = new Set();
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name); else values.delete(name);
      return enabled;
    }
  };
}

function makeCanvasContext(textLog) {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "", shadowBlur: 0,
    clearRect() {}, beginPath() {}, moveTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, clip() {}, drawImage() {}, fillRect() {}, setTransform() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: Array.from(String(text)).length * 11 }; },
    fillText(text) { textLog.push(String(text)); },
    strokeText() {}
  };
}

class FakeElement {
  constructor(id, textLog) {
    this.id = id || ""; this.children = []; this.listeners = new Map(); this.attributes = {};
    this.classList = makeClassList(); this.style = {}; this.dataset = {}; this.value = ""; this.checked = false;
    this.disabled = false; this.hidden = ["resultBackdrop", "settingsBackdrop"].includes(id); this.textContent = ""; this.className = ""; this.maxLength = 0;
    this.type = ""; this.title = ""; this.focused = false; this.textLog = textLog; this.width = 900; this.height = 900;
    this.context2d = makeCanvasContext(textLog);
  }
  addEventListener(name, callback) { const list = this.listeners.get(name) || []; list.push(callback); this.listeners.set(name, list); }
  dispatchEvent(event) { event.target = event.target || this; for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
  click() { if (!this.disabled) this.dispatchEvent({ type: "click", preventDefault() {} }); }
  append(...elements) { for (const element of elements) { if (element) { element.parentElement = this; this.children.push(element); } } }
  replaceChildren(...elements) { this.children = []; this.append(...elements); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  getContext(kind) { return kind === "2d" ? this.context2d : null; }
  focus() { this.focused = true; }
  scrollIntoView() {}
}

class MemoryStorage {
  constructor(seed) { this.values = new Map(seed || []); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function createHarness(storage = new MemoryStorage()) {
  const textLog = [];
  const elements = new Map();
  const frameQueue = [];
  const audioState = { started: 0, gains: [] };
  let now = 1000;
  let reducedMotion = true;
  let gameState = {
    round: 1,
    players: [{ id: "player-a", name: "Dara", paid: false }],
    paidCount: 0,
    poolRiel: 0,
    turnPlayerId: "player-a",
    turnPlayerName: "Dara",
    pendingAdvance: false,
    payout: null
  };
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id, textLog));
    return elements.get(id);
  };
  const document = {
    body: new FakeElement("body", textLog),
    hidden: false,
    getElementById: getElement,
    createElement(tag) { return new FakeElement(tag, textLog); },
    addEventListener() {}
  };
  const gain = () => {
    const item = { value: 0, setTargetAtTime(value) { this.value = value; audioState.gains.push(value); }, setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { this.value = value; } };
    return { gain: item, connect() {}, disconnect() {} };
  };
  class FakeAudioContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
    createGain() { return gain(); }
    createOscillator() {
      return {
        type: "sine", frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, start() { audioState.started++; }, stop() {}, disconnect() {}
      };
    }
    async resume() { this.state = "running"; }
  }
  const requestBodies = [];
  const fetch = async (url, options = {}) => {
    if (options.method === "POST" && url === "/api/spin") {
      const body = JSON.parse(options.body || "{}"); requestBodies.push(body);
      return { ok: true, async json() { return {
        outcome: { outcomeId: "dance-two-minutes", playerName: "Dara", payoutRiel: 0 },
        availableOutcomeIds: body.wheelOptionIds.filter(id => id !== "money"),
        state: { ...gameState, turnPlayerId: null }
      }; } };
    }
    return { ok: true, async json() { return { state: gameState }; } };
  };
  const window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: null,
    devicePixelRatio: 1,
    matchMedia() { return { matches: reducedMotion }; },
    setInterval() { return 1; },
    addEventListener() {}
  };
  const sandbox = {
    window, document, localStorage: storage, fetch, crypto: webcrypto,
    performance: { now: () => now },
    requestAnimationFrame(callback) { frameQueue.push(callback); return frameQueue.length; },
    cancelAnimationFrame() {},
    setInterval() { return 1; },
    requestBodies, textLog, audioState,
    __setNow(value) { now = value; },
    __getNow() { return now; },
    __setReducedMotion(value) { reducedMotion = Boolean(value); },
    __setGameState(value) { gameState = value; }
  };
  vm.runInNewContext(CLIENT_SCRIPT + `\nglobalThis.__hooks = { spin, animateTo, openSettings, closeSettings, addOption, restoreWheelOptions, resetEverything, refreshState, durationForSpin, turnsForSpeed, get options(){ return wheelOptions; }, get settings(){ return settings; }, get rotation(){ return rotation; }, get state(){ return state; }, get audio(){ return audioContext; }, get effectGain(){ return effectsGain && effectsGain.gain.value; }, get musicGainValue(){ return musicGain && musicGain.gain.value; } };`, sandbox, { filename: "js/game.js" });
  return { storage, elements, getElement, frameQueue, requestBodies, textLog, audioState, sandbox, hooks: sandbox.__hooks };
}

test("wheel edits and spin settings persist, audio controls apply, and the dance result stops on its selected segment", async () => {
  const storage = new MemoryStorage();
  const browser = createHarness(storage);
  for (let index = 0; index < 8; index++) await Promise.resolve();

  const defaults = browser.hooks.options;
  assert.equal(defaults.length, 9);
  assert.equal(defaults.some(option => ["water", "truth", "friend"].includes(option.id)), false);
  assert.equal(defaults.find(option => option.id === "dance-two-minutes").title, "រាំ 2 នាទី");

  browser.hooks.openSettings();
  let firstRow = browser.getElement("wheelItemsEditor").children[0];
  firstRow.children[1].children[0].value = "អត់ស្មោះថ្មី";
  firstRow.children[1].children[0].dispatchEvent({ type: "input" });
  firstRow.children[2].children[0].value = "🌟";
  firstRow.children[2].children[0].dispatchEvent({ type: "input" });
  firstRow.children[3].children[0].value = "#112233";
  firstRow.children[3].children[0].dispatchEvent({ type: "input" });
  firstRow.children[4].children[1].click();
  assert.equal(browser.hooks.options[0].id, "faithful");
  assert.equal(browser.hooks.options[1].title, "អត់ស្មោះថ្មី");
  const danceRow = browser.getElement("wheelItemsEditor").children.find(row => row.dataset.optionId === "dance");
  danceRow.children[4].children[2].click();
  assert.equal(browser.hooks.options.some(option => option.id === "dance"), false);

  browser.getElement("spinDuration").value = "15";
  browser.getElement("spinDuration").dispatchEvent({ type: "change" });
  browser.getElement("spinSpeed").value = "veryFast";
  browser.getElement("spinSpeed").dispatchEvent({ type: "change" });
  browser.getElement("soundEffects").checked = false;
  browser.getElement("soundEffects").dispatchEvent({ type: "change" });
  browser.getElement("backgroundMusic").checked = true;
  browser.getElement("backgroundMusic").dispatchEvent({ type: "change" });
  for (let index = 0; index < 8; index++) await Promise.resolve();
  browser.getElement("soundEffects").checked = true;
  browser.getElement("soundEffects").dispatchEvent({ type: "change" });
  assert.equal(browser.hooks.effectGain, 1);
  browser.getElement("soundEffects").checked = false;
  browser.getElement("soundEffects").dispatchEvent({ type: "change" });
  browser.getElement("backgroundMusic").checked = false;
  browser.getElement("backgroundMusic").dispatchEvent({ type: "change" });
  browser.getElement("backgroundMusic").checked = true;
  browser.getElement("backgroundMusic").dispatchEvent({ type: "change" });
  for (let index = 0; index < 8; index++) await Promise.resolve();
  browser.getElement("masterVolume").value = "25";
  browser.getElement("masterVolume").dispatchEvent({ type: "input" });
  browser.getElement("galaxyParticles").checked = false;
  browser.getElement("galaxyParticles").dispatchEvent({ type: "change" });
  browser.getElement("wheelGlow").checked = false;
  browser.getElement("wheelGlow").dispatchEvent({ type: "change" });
  await Promise.resolve();

  const savedSettings = JSON.parse(storage.getItem("spinDrinkSettingsV2"));
  assert.equal(savedSettings.spinDuration, "15");
  assert.equal(savedSettings.spinSpeed, "veryFast");
  assert.equal(savedSettings.soundEffects, false);
  assert.equal(savedSettings.backgroundMusic, true);
  assert.equal(savedSettings.volume, 25);
  assert.equal(savedSettings.galaxyParticles, false);
  assert.equal(savedSettings.wheelGlow, false);
  assert.equal(browser.sandbox.document.body.classList.contains("particles-disabled"), true);
  assert.equal(browser.hooks.effectGain, 0);
  assert.equal(browser.hooks.musicGainValue, 0.22);
  assert.ok(browser.audioState.started >= 3);
  assert.ok(browser.audioState.gains.some(value => Math.abs(value - Math.pow(0.25, 1.35)) < 0.001));

  browser.getElement("newOptionName").value = "Custom challenge";
  browser.getElement("newOptionEmoji").value = "🎉";
  browser.getElement("newOptionColor").value = "#aabbcc";
  browser.getElement("addOptionForm").dispatchEvent({ type: "submit", preventDefault() {} });
  assert.equal(browser.hooks.options.at(-1).title, "Custom challenge");
  const savedOptions = JSON.parse(storage.getItem("spinDrinkWheelOptionsV2"));
  assert.equal(savedOptions.at(-1).emoji, "🎉");
  assert.equal(savedOptions.at(-1).color, "#aabbcc");

  const restored = createHarness(storage);
  await restored.hooks.refreshState();
  assert.equal(restored.hooks.settings.spinDuration, "15");
  assert.equal(restored.hooks.settings.spinSpeed, "veryFast");
  assert.equal(restored.hooks.settings.backgroundMusic, true);
  assert.equal(restored.hooks.options.at(-1).title, "Custom challenge");
  assert.equal(restored.hooks.options[0].id, "faithful");
  assert.equal(restored.hooks.options[1].title, "អត់ស្មោះថ្មី");
  assert.equal(restored.hooks.options.some(option => option.id === "dance"), false);
  assert.equal(restored.hooks.state.turnPlayerId, "player-a");
  restored.sandbox.__setReducedMotion(false);
  assert.equal(restored.hooks.durationForSpin(), 15000);
  assert.equal(restored.hooks.turnsForSpeed(), 12);
  restored.sandbox.__setReducedMotion(true);
  assert.equal(restored.hooks.durationForSpin(), 900);

  restored.getElement("closeResult").click();
  const spinPromise = restored.hooks.spin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored.requestBodies.length, 1);
  assert.equal(restored.requestBodies[0].wheelOptionIds.includes("water"), false);
  assert.equal(restored.requestBodies[0].wheelOptionIds.includes("truth"), false);
  assert.equal(restored.requestBodies[0].wheelOptionIds.includes("friend"), false);
  assert.ok(restored.frameQueue.length > 0, JSON.stringify({ title: restored.getElement("resultTitle").textContent, description: restored.getElement("resultDesc").textContent, spinning: restored.getElement("spin").textContent }));
  await restored.hooks.spin();
  assert.equal(restored.requestBodies.length, 1);
  restored.sandbox.__setNow(restored.sandbox.__getNow() + 1000);
  restored.frameQueue.shift()(restored.sandbox.__getNow());
  await spinPromise;
  const visible = restored.hooks.options.filter(option => option.id !== "money");
  const arc = Math.PI * 2 / visible.length;
  const pointerAngle = ((-restored.hooks.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const stoppedSegment = Math.floor(pointerAngle / arc);
  assert.equal(visible[stoppedSegment].id, "dance-two-minutes");
  assert.equal(restored.getElement("cardTitle").textContent, "អ្នកត្រូវរាំ 2 នាទី! 💃🕺");
  assert.equal(restored.getElement("resultBackdrop").hidden, false);
  restored.hooks.restoreWheelOptions();
  assert.equal(restored.hooks.options.length, 9);
  restored.hooks.resetEverything();
  assert.equal(restored.hooks.settings.spinDuration, "8");
  assert.equal(restored.hooks.settings.backgroundMusic, false);
});

test("styles include a mobile layout and reduced-motion fallback", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "css", "premium-ui.css"), "utf8");
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /-webkit-mask-image/);
});
