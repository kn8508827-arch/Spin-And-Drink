"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createApp, OUTCOME_IDS } = require("../server");

const HOST_KEY = "test-host-key-with-more-than-thirty-two-characters";

function createTestApp(t, dataDir, selectIndex) {
  const app = createApp({ root: path.resolve(__dirname, ".."), dataDir, adminKey: HOST_KEY, selectIndex });
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  return app;
}

async function api(app, route, body, headers = {}, method = "POST") {
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const request = Readable.from(method === "GET" ? [] : [Buffer.from(JSON.stringify(body || {}))]);
  request.method = method;
  request.headers = { host: "localhost", ...(method === "GET" ? {} : { "content-type": "application/json" }), ...normalizedHeaders };
  const response = {
    status: 0,
    body: "",
    headersSent: false,
    destroyed: false,
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; this.headersSent = true; },
    end(data = "") { this.body = Buffer.isBuffer(data) ? data.toString("utf8") : String(data); }
  };
  await app.handleApi(request, response, route);
  return { status: response.status, data: JSON.parse(response.body || "{}"), headers: response.headers };
}

function adminHeaders(key = HOST_KEY) {
  return { "X-Admin-Key": key };
}

async function signIn(app) {
  const response = await api(app, "/api/admin/auth", {}, adminHeaders());
  assert.equal(response.status, 200);
  const setCookie = response.headers["Set-Cookie"];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  return { cookie: setCookie.split(";")[0] };
}

test("payment ledger is host-only, unique, and drives the server-selected jackpot", async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "spin-drink-ledger-"));
  const app = createTestApp(t, dataDir, length => length - 1);

  const initial = await api(app, "/api/state", null, {}, "GET");
  assert.equal(initial.status, 200);
  assert.equal(initial.data.state.adminEnabled, true);
  assert.equal(initial.data.state.poolRiel, 0);

  const playerA = await api(app, "/api/players", { name: "Dara" });
  const playerB = await api(app, "/api/players", { name: "Sophea" });
  const playerC = await api(app, "/api/players", { name: "Vanna" });
  assert.equal(playerA.status, 201);
  assert.equal(playerB.status, 201);
  assert.equal(playerC.status, 201);

  const blockedPayment = await api(app, "/api/admin/payments", { playerId: playerA.data.player.id, reference: "cash-a1" });
  assert.equal(blockedPayment.status, 401);
  const badLogin = await api(app, "/api/admin/auth", {}, adminHeaders("incorrect-host-key"));
  assert.equal(badLogin.status, 401);
  const host = await signIn(app);
  const blockedSpin = await api(app, "/api/spin", { playerId: playerA.data.player.id });
  assert.equal(blockedSpin.status, 409);

  const firstPayment = await api(app, "/api/admin/payments", { playerId: playerA.data.player.id, reference: "cash-a1" }, host);
  assert.equal(firstPayment.status, 200);
  assert.equal(firstPayment.data.state.poolRiel, 500);
  const retryPayment = await api(app, "/api/admin/payments", { playerId: playerA.data.player.id, reference: "CASH-A1" }, host);
  assert.equal(retryPayment.status, 200);
  assert.equal(retryPayment.data.state.poolRiel, 500);

  const reusedReference = await api(app, "/api/admin/payments", { playerId: playerB.data.player.id, reference: "cash-a1" }, host);
  assert.equal(reusedReference.status, 409);
  assert.equal(reusedReference.data.state.poolRiel, 500);

  const secondPayment = await api(app, "/api/admin/payments", { playerId: playerB.data.player.id, reference: "cash-b1" }, host);
  assert.equal(secondPayment.status, 200);
  assert.equal(secondPayment.data.state.poolRiel, 1000);
  assert.equal(secondPayment.data.state.paidCount, 2);

  const spin = await api(app, "/api/spin", { playerId: playerA.data.player.id, outcomeId: "faithful" });
  assert.equal(spin.status, 200);
  assert.equal(spin.data.outcome.outcomeId, "money");
  assert.equal(spin.data.outcome.payoutRiel, 1000);
  assert.equal(spin.data.state.payout.status, "pending");
  assert.equal(spin.data.state.payout.playerName, "Dara");
  assert.equal(spin.data.state.poolRiel, 0);
  assert.equal(spin.data.state.grossPaidRiel, 1000);
  const latePayment = await api(app, "/api/admin/payments", { playerId: playerC.data.player.id, reference: "cash-c1" }, host);
  assert.equal(latePayment.status, 409);
  assert.equal(latePayment.data.state.grossPaidRiel, 1000);

  const secondSpin = await api(app, "/api/spin", { playerId: playerB.data.player.id, outcomeId: "money" });
  assert.equal(secondSpin.status, 200);
  assert.equal(secondSpin.data.outcome.outcomeId, OUTCOME_IDS[OUTCOME_IDS.length - 2]);
  assert.equal(secondSpin.data.state.payout.amountRiel, 1000);
  assert.equal(secondSpin.data.availableOutcomeIds.includes("money"), false);

  const prematureRound = await api(app, "/api/admin/round", {}, host);
  assert.equal(prematureRound.status, 409);
  const settlement = await api(app, "/api/admin/settle", { reference: "transfer-001" }, host);
  assert.equal(settlement.status, 200);
  assert.equal(settlement.data.state.payout.status, "settled");
  const settlementRetry = await api(app, "/api/admin/settle", { reference: "TRANSFER-001" }, host);
  assert.equal(settlementRetry.status, 200);

  const nextRound = await api(app, "/api/admin/round", {}, host);
  assert.equal(nextRound.status, 200);
  assert.equal(nextRound.data.state.round, 2);
  assert.equal(nextRound.data.state.poolRiel, 0);
  assert.equal(nextRound.data.state.players.every(player => !player.paid), true);

  const logo = fs.readFileSync(path.resolve(__dirname, "../assets/team-logo.svg"), "utf8");
  assert.match(logo, /<svg/);
  assert.match(logo, /Team ស្មោះស្នេហ៍/);
});

test("state survives a fresh app instance and rejects cross-origin player edits", async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "spin-drink-persist-"));
  const app = createTestApp(t, dataDir, () => 0);
  const added = await api(app, "/api/players", { name: "Ratha" });
  assert.equal(added.status, 201);
  const crossOrigin = await api(app, "/api/players", { name: "Intruder" }, { Origin: "https://example.invalid" });
  assert.equal(crossOrigin.status, 403);

  const paid = await api(app, "/api/admin/payments", { playerId: added.data.player.id, reference: "receipt-r1" }, adminHeaders());
  assert.equal(paid.status, 401);
  const host = await signIn(app);
  const confirmed = await api(app, "/api/admin/payments", { playerId: added.data.player.id, reference: "receipt-r1" }, host);
  assert.equal(confirmed.status, 200);

  const reloadedApp = createApp({ root: path.resolve(__dirname, ".."), dataDir, adminKey: HOST_KEY, selectIndex: () => 0 });
  const restored = await api(reloadedApp, "/api/state", null, {}, "GET");
  assert.equal(restored.data.state.paidCount, 1);
  assert.equal(restored.data.state.poolRiel, 500);
  assert.equal(restored.data.state.players[0].name, "Ratha");
  const expiredSession = await api(reloadedApp, "/api/admin/round", {}, host);
  assert.equal(expiredSession.status, 401);
});

test("browser script parses and the wheel keeps the 8.2-second ease-out", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.doesNotThrow(() => new Function(match[1]));
  assert.match(match[1], /duration=reduceMotion\?1000:8200/);
  assert.match(match[1], /id:"money".*title:"សំណាងបានលុយ"/);
});
