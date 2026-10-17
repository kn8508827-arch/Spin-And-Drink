"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ENTRY_FEE_RIEL = 500;
const OUTCOME_IDS = [
  "unfaithful", "faithful", "command", "luck", "water", "sing",
  "truth", "friend", "dance", "again", "money"
];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

function createInitialState() {
  return {
    version: 1,
    round: 1,
    players: [],
    payments: [],
    settlements: [],
    roundHistory: [],
    spins: [],
    turnIndex: 0,
    pendingAdvance: false,
    payout: null
  };
}

function createApp(config = {}) {
  const root = path.resolve(config.root || __dirname);
  const dataDir = path.resolve(config.dataDir || process.env.DATA_DIR || path.join(root, "data"));
  const stateFile = path.join(dataDir, "state.json");
  const adminKey = config.adminKey === undefined ? process.env.ADMIN_KEY || "" : config.adminKey;
  const selectIndex = config.selectIndex || (length => crypto.randomInt(length));
  const adminSessions = new Map();
  fs.mkdirSync(dataDir, { recursive: true });

  function loadState() {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (!state || state.version !== 1 || !Array.isArray(state.players) || !Array.isArray(state.payments) || !Array.isArray(state.settlements) || !Array.isArray(state.spins)) {
        throw new Error("The saved game data has an unsupported format.");
      }
      return state;
    } catch (error) {
      if (error.code === "ENOENT") {
        const state = createInitialState();
        persistState(state);
        return state;
      }
      throw new Error("Could not safely load saved game data: " + error.message);
    }
  }

  function persistState(nextState) {
    const tempFile = stateFile + "." + process.pid + "." + crypto.randomUUID() + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(nextState, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(tempFile, stateFile);
    } catch (error) {
      if (process.platform === "win32" && ["EPERM", "EEXIST", "ENOTEMPTY"].includes(error.code)) {
        try {
          fs.copyFileSync(tempFile, stateFile);
          fs.unlinkSync(tempFile);
          return;
        } catch (fallbackError) {
          try { fs.unlinkSync(tempFile); } catch (_) {}
          throw fallbackError;
        }
      }
      try { fs.unlinkSync(tempFile); } catch (_) {}
      throw error;
    }
  }

  let state = loadState();

  function publicState() {
    const paidPlayers = state.players.filter(player => player.paid);
    const currentPlayer = state.players.length ? state.players[state.turnIndex % state.players.length] : null;
    return {
      round: state.round,
      entryFeeRiel: ENTRY_FEE_RIEL,
      players: state.players.map(player => ({ id: player.id, name: player.name, paid: player.paid })),
      paidCount: paidPlayers.length,
      grossPaidRiel: paidPlayers.length * ENTRY_FEE_RIEL,
      poolRiel: state.payout ? 0 : paidPlayers.length * ENTRY_FEE_RIEL,
      turnPlayerId: currentPlayer ? currentPlayer.id : null,
      turnPlayerName: currentPlayer ? currentPlayer.name : null,
      pendingAdvance: state.pendingAdvance,
      payout: state.payout ? {
        playerId: state.payout.playerId,
        playerName: state.payout.playerName,
        amountRiel: state.payout.amountRiel,
        status: state.payout.status,
        claimedAt: state.payout.claimedAt,
        settledAt: state.payout.settledAt || null
      } : null,
      latestSpin: state.spins.length ? { ...state.spins[state.spins.length - 1] } : null,
      recentSpins: state.spins.slice(-20).map(spin => ({ ...spin })),
      roundHistory: state.roundHistory.slice(-10).map(item => ({ ...item })),
      adminEnabled: Buffer.byteLength(adminKey, "utf8") >= 32
    };
  }

  function send(res, status, body, extraHeaders = {}) {
    const data = Buffer.from(JSON.stringify(body));
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": data.length,
      ...extraHeaders
    });
    res.end(data);
  }

  function sendError(res, status, message) {
    send(res, status, { error: message, state: publicState() });
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (contentType !== "application/json") {
        reject(Object.assign(new Error("Content-Type must be application/json."), { statusCode: 415 }));
        return;
      }
      let size = 0;
      const chunks = [];
      req.on("data", chunk => {
        size += chunk.length;
        if (size > 16384) {
          reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            reject(Object.assign(new Error("Request body must be a JSON object."), { statusCode: 400 }));
            return;
          }
          resolve(parsed);
        } catch (_) {
          reject(Object.assign(new Error("Request body must contain valid JSON."), { statusCode: 400 }));
        }
      });
      req.on("error", reject);
    });
  }

  function hasSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    try {
      return new URL(origin).origin === new URL(forwardedProto + "://" + host).origin;
    } catch (_) {
      return false;
    }
  }

  function checkAdminKey(req, res) {
    if (Buffer.byteLength(adminKey, "utf8") < 32) {
      sendError(res, 503, "Set ADMIN_KEY to a secret with at least 32 characters before using host controls.");
      return false;
    }
    const supplied = req.headers["x-admin-key"];
    if (typeof supplied !== "string") {
      sendError(res, 401, "Host key is missing or incorrect.");
      return false;
    }
    const expectedBytes = Buffer.from(adminKey, "utf8");
    const suppliedBytes = Buffer.from(supplied, "utf8");
    if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
      sendError(res, 401, "Host key is missing or incorrect.");
      return false;
    }
    return true;
  }

  function checkAdminSession(req, res) {
    if (Buffer.byteLength(adminKey, "utf8") < 32) {
      sendError(res, 503, "Set ADMIN_KEY to a secret with at least 32 characters before using host controls.");
      return false;
    }
    const cookie = String(req.headers.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith("spin_admin="));
    const token = cookie ? cookie.slice("spin_admin=".length) : "";
    const expiresAt = adminSessions.get(token);
    if (token && expiresAt && expiresAt > Date.now()) return true;
    if (token) adminSessions.delete(token);
    sendError(res, 401, "Host session expired. Enter the host key again.");
    return false;
  }

  function normalizedReference(value) {
    if (typeof value !== "string") return null;
    const reference = value.trim();
    if (reference.length < 3 || reference.length > 128 || /[\u0000-\u001f\u007f]/.test(reference)) return null;
    return { display: reference, key: reference.toLocaleLowerCase("en-US") };
  }

  function referenceInUse(key) {
    return state.payments.some(item => item.referenceKey === key) || state.settlements.some(item => item.referenceKey === key);
  }

  async function handleApi(req, res, pathname) {
    if (req.method === "GET" && pathname === "/api/state") {
      send(res, 200, { state: publicState() });
      return;
    }
    if (!hasSameOrigin(req)) {
      sendError(res, 403, "Cross-origin updates are not allowed.");
      return;
    }
    if (req.method === "POST" && pathname === "/api/players") {
      const body = await readJson(req);
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      if (!name || name.length > 24 || /[\u0000-\u001f\u007f]/.test(name)) {
        sendError(res, 400, "Enter a player name using 1 to 24 characters.");
        return;
      }
      const duplicate = state.players.find(player => player.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"));
      if (duplicate) {
        send(res, 200, { player: { id: duplicate.id, name: duplicate.name, paid: duplicate.paid }, state: publicState() });
        return;
      }
      const player = { id: crypto.randomUUID(), name, paid: false, paymentReference: null };
      state.players.push(player);
      persistState(state);
      send(res, 201, { player: { id: player.id, name: player.name, paid: player.paid }, state: publicState() });
      return;
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/players/")) {
      const playerId = decodeURIComponent(pathname.slice("/api/players/".length));
      const index = state.players.findIndex(player => player.id === playerId);
      if (index < 0) {
        sendError(res, 404, "Player not found.");
        return;
      }
      if (state.players[index].paid) {
        sendError(res, 409, "A confirmed participant cannot be removed during this round.");
        return;
      }
      state.players.splice(index, 1);
      persistState(state);
      send(res, 200, { state: publicState() });
      return;
    }
    if (req.method === "POST" && pathname.startsWith("/api/admin/")) {
      const isAuthRequest = pathname === "/api/admin/auth";
      if (isAuthRequest ? !checkAdminKey(req, res) : !checkAdminSession(req, res)) return;
      const body = await readJson(req);
      if (isAuthRequest) {
        const token = crypto.randomBytes(32).toString("hex");
        adminSessions.set(token, Date.now() + 30 * 60 * 1000);
        const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
        const secure = forwardedProto === "https" ? "; Secure" : "";
        const cookie = "spin_admin=" + token + "; HttpOnly; SameSite=Strict; Path=/api/admin" + secure;
        send(res, 200, { ok: true, state: publicState() }, { "Set-Cookie": cookie });
        return;
      }
      if (pathname === "/api/admin/payments") {
        if (state.payout) {
          sendError(res, 409, "This round's prize has already been claimed. Confirmations are closed until the next round.");
          return;
        }
        const player = state.players.find(item => item.id === body.playerId);
        if (!player) {
          sendError(res, 404, "Choose an existing participant.");
          return;
        }
        const reference = normalizedReference(body.reference);
        if (!reference) {
          sendError(res, 400, "Enter a payment reference with 3 to 128 characters.");
          return;
        }
        if (player.paid) {
          if (player.paymentReference && player.paymentReference.toLocaleLowerCase("en-US") === reference.key) {
            send(res, 200, { state: publicState(), alreadyConfirmed: true });
          } else {
            sendError(res, 409, "This participant already has one confirmed 500៛ payment in this round.");
          }
          return;
        }
        if (referenceInUse(reference.key)) {
          sendError(res, 409, "That reference was already used. Check the receipt and enter a unique reference.");
          return;
        }
        player.paid = true;
        player.paymentReference = reference.display;
        state.payments.push({
          playerId: player.id,
          playerName: player.name,
          round: state.round,
          amountRiel: ENTRY_FEE_RIEL,
          reference: reference.display,
          referenceKey: reference.key,
          confirmedAt: new Date().toISOString()
        });
        persistState(state);
        send(res, 200, { state: publicState() });
        return;
      }
      if (pathname === "/api/admin/settle") {
        const reference = normalizedReference(body.reference);
        if (!reference) {
          sendError(res, 400, "Enter a transfer reference with 3 to 128 characters.");
          return;
        }
        if (!state.payout) {
          sendError(res, 409, "There is no prize waiting to be settled.");
          return;
        }
        if (state.payout.status === "settled") {
          if (state.payout.transferReference && state.payout.transferReference.toLocaleLowerCase("en-US") === reference.key) {
            send(res, 200, { state: publicState(), alreadySettled: true });
          } else {
            sendError(res, 409, "This prize has already been settled.");
          }
          return;
        }
        if (referenceInUse(reference.key)) {
          sendError(res, 409, "That reference was already used in the payment ledger.");
          return;
        }
        state.payout.status = "settled";
        state.payout.settledAt = new Date().toISOString();
        state.payout.transferReference = reference.display;
        state.settlements.push({
          round: state.round,
          playerId: state.payout.playerId,
          playerName: state.payout.playerName,
          amountRiel: state.payout.amountRiel,
          reference: reference.display,
          referenceKey: reference.key,
          settledAt: state.payout.settledAt
        });
        persistState(state);
        send(res, 200, { state: publicState() });
        return;
      }
      if (pathname === "/api/admin/round") {
        const paidCount = state.players.filter(player => player.paid).length;
        if (state.payout && state.payout.status !== "settled") {
          sendError(res, 409, "Settle the current prize before starting another round.");
          return;
        }
        if (paidCount > 0 && !state.payout) {
          sendError(res, 409, "The current prize pool must be won and settled before starting another round.");
          return;
        }
        state.roundHistory.push({
          round: state.round,
          paidCount,
          poolRiel: paidCount * ENTRY_FEE_RIEL,
          spinCount: state.spins.length,
          winnerName: state.payout ? state.payout.playerName : null,
          payoutRiel: state.payout ? state.payout.amountRiel : 0,
          payoutStatus: state.payout ? state.payout.status : null
        });
        state.roundHistory = state.roundHistory.slice(-50);
        state.round += 1;
        state.players.forEach(player => { player.paid = false; player.paymentReference = null; });
        state.spins = [];
        state.turnIndex = 0;
        state.pendingAdvance = false;
        state.payout = null;
        persistState(state);
        send(res, 200, { state: publicState() });
        return;
      }
      sendError(res, 404, "Unknown host endpoint.");
      return;
    }
    if (req.method === "POST" && pathname === "/api/spin") {
      const body = await readJson(req);
      const paidPlayers = state.players.filter(player => player.paid);
      if (!state.players.length) {
        sendError(res, 409, "Add at least one player before spinning.");
        return;
      }
      if (state.pendingAdvance) {
        sendError(res, 409, "Finish the current player action before spinning again.");
        return;
      }
      const player = state.players[state.turnIndex % state.players.length];
      if (body.playerId !== player.id) {
        sendError(res, 409, "The turn has changed. Refresh the game before spinning.");
        return;
      }
      const availableOutcomeIds = OUTCOME_IDS.filter(id => id !== "money" || (paidPlayers.length > 0 && !state.payout));
      const selectedIndex = selectIndex(availableOutcomeIds.length);
      const outcomeId = availableOutcomeIds[selectedIndex];
      if (!outcomeId || !OUTCOME_IDS.includes(outcomeId)) {
        throw new Error("The outcome selector returned an invalid result.");
      }
      const spin = {
        id: crypto.randomUUID(),
        round: state.round,
        playerId: player.id,
        playerName: player.name,
        outcomeId,
        payoutRiel: 0,
        at: new Date().toISOString()
      };
      if (outcomeId === "money") {
        const poolRiel = paidPlayers.length * ENTRY_FEE_RIEL;
        state.payout = {
          playerId: player.id,
          playerName: player.name,
          amountRiel: poolRiel,
          status: "pending",
          claimedAt: spin.at,
          settledAt: null,
          transferReference: null
        };
        spin.payoutRiel = poolRiel;
      }
      state.spins.push(spin);
      state.spins = state.spins.slice(-200);
      if (outcomeId === "command") state.pendingAdvance = true;
      else if (outcomeId !== "again") state.turnIndex += 1;
      persistState(state);
      send(res, 200, {
        outcome: { id: spin.id, round: spin.round, playerId: spin.playerId, playerName: spin.playerName, outcomeId: spin.outcomeId, payoutRiel: spin.payoutRiel, at: spin.at },
        availableOutcomeIds,
        state: publicState()
      });
      return;
    }
    if (req.method === "POST" && pathname === "/api/turn/advance") {
      await readJson(req);
      if (!state.pendingAdvance) {
        sendError(res, 409, "There is no pending action to complete.");
        return;
      }
      state.pendingAdvance = false;
      state.turnIndex += 1;
      persistState(state);
      send(res, 200, { state: publicState() });
      return;
    }
    sendError(res, 404, "Unknown API endpoint.");
  }

  async function handle(req, res) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch (_) {
      res.writeHead(400, SECURITY_HEADERS);
      res.end("Bad Request");
      return;
    }
    if (pathname.startsWith("/api/")) {
      try {
        await handleApi(req, res, pathname);
      } catch (error) {
        if (res.headersSent || res.destroyed) return;
        if (error.statusCode) {
          sendError(res, error.statusCode, error.message);
          return;
        }
        console.error("Request failed:", error.message);
        sendError(res, 500, "The request could not be completed.");
      }
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.resolve(root, "." + pathname);
    const relativePath = path.relative(root, filePath);
    if (relativePath === ".." || relativePath.startsWith(".." + path.sep) || path.isAbsolute(relativePath)) {
      res.writeHead(403, SECURITY_HEADERS);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(error.code === "ENOENT" ? 404 : 500, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
        res.end(error.code === "ENOENT" ? "Not Found" : "Server Error");
        return;
      }
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "Content-Length": data.length
      });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  }

  const server = http.createServer((req, res) => { void handle(req, res); });
  return { server, publicState, handleApi };
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, "0.0.0.0", () => {
    console.log("Lucky Party Wheel listening on port " + app.server.address().port);
  });
}

module.exports = { createApp, ENTRY_FEE_RIEL, OUTCOME_IDS };
