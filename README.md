# Spin-And-Drink — កង់សំណាងជាក្រុម

A Khmer, mobile-first party wheel served by a small Node.js application.

## Game features

- A bundled Team ស្មោះស្នេហ៍ logo and a responsive animated galaxy theme.
- Adjustable spin speed, 3–15 second duration, and four animation styles, with reduced-motion support.
- Free play for every registered player. Add names and spin in turn without payment or an admin account.
- Editable wheel labels, emojis, colors, order, and custom items in Settings. Wheel edits and preferences are saved in this browser.
- Optional generated spin, tick, and win sounds, background music, particle, and wheel-glow controls.
- A new **រាំ 2 នាទី** outcome. It does not start a timer automatically.
- The default wheel no longer includes the three items marked in the supplied screenshot: water, truth-or-dare, and friend-picks.
- The **សំណាងបានលុយ 💰** outcome appears only when a prize pool has been funded.
- The server randomly chooses and records an outcome from the wheel item IDs sent by the browser; the browser cannot request a preferred result or change the prize pool.
- Optional host-only payment and prize-settlement API endpoints remain available for deployments that choose to fund a prize pool.

## Start locally

Use Node.js 18 or newer, then start the server:

```powershell
npm start
```

Open `http://localhost:3000`, add player names, and spin. Open **ការកំណត់** to edit wheel items, change spin behavior, and manage audio or galaxy effects. Settings are stored in that browser's local storage. Free play does not require `ADMIN_KEY` or payment setup. If you enable the optional host-only payment API, set `ADMIN_KEY` to a private value of at least 32 characters; do not put it in browser code or commit it.

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
