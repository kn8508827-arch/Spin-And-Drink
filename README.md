# Spin-And-Drink — កង់សំណាងជាក្រុម

A Khmer, mobile-first party wheel served by a small Node.js application.

## Game features

- **3D wheel (three.js)** on a neon stage: glossy slices with emoji and short labels, gold rim with chasing marquee bulbs, Team ស្មោះស្នេហ៍ emblem hub, gem pointer that kicks on every slice, light beams and floating bokeh. three.js 0.160 is served from `/vendor` (no CDN needed).
- **One tap to play**: open → press **SPIN** (or swipe the wheel). Adding players is optional; with players the server keeps the turn order (`/api/spin`, `/api/turn/advance`), without players it is a quick local spin.
- Big result card with the emoji, a one-line description, confetti and a win jingle — very little text on screen.
- **Chill lo-fi music** (swing drums, soft keys, bass, vinyl crackle) generated in the browser, plus tick, whoosh and win sounds; music and sound toggles; Telegram haptics inside the bot.
- Settings: spin time (3/5/7/10 s), edit wheel items (emoji, name, colour, delete, add), manage players, reset the wheel. Saved in the browser.
- The **បានលុយ 💰** slice appears only when a prize pool has been funded through the optional host payment API.
- Wheel rules live in `js/wheel-logic.js` and are covered by `npm test`.

## Start locally

Use Node.js 18 or newer, then start the server:

```powershell
npm start
```

Open `http://localhost:3000` and press **SPIN**. Open ⚙️ to edit wheel items, spin time and players. Settings are stored in that browser's local storage. Free play does not require `ADMIN_KEY` or payment setup. If you enable the optional host-only payment API, set `ADMIN_KEY` to a private value of at least 32 characters; do not put it in browser code or commit it.

Run the server checks with `npm test`.

## Deploy on Railway

1. Upload these project files to your GitHub repository.
2. In Railway, deploy the repository as a Node.js service. Railway runs `npm start`.
3. Attach a Railway volume mounted at `/data` and set `DATA_DIR=/data` so the shared player list and game state survive redeploys and restarts. Keep a single running replica because this lightweight JSON store is designed for one server process.
4. Open the HTTPS domain, add players, and play for free. Set `ADMIN_KEY` only if you intend to use the optional private payment API.

## Payment and security notes

Free play does **not** collect or require payment. The optional private payment API does not connect to a bank, payment wallet, or gateway; a host would need to verify contributions and settle any prize outside the app. Do not enable a cash prize unless you can fund and transfer it.

Players share one game state and turn list. If the optional host endpoints are enabled, the key is exchanged for a 30-minute, HTTP-only, same-site browser session and is not retained by the page script or saved in local storage. Use HTTPS and keep the key private. Player names and non-cash lucky passes are not identity-verified.

## Play safely

No one should be pressured to drink or take a challenge. Choose a non-alcoholic drink or skip any result that feels uncomfortable.
