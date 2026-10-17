# Spin-And-Drink — កង់សំណាងជាក្រុម

A Khmer, mobile-first party wheel served by a small Node.js application.

## Game features

- A bundled Team ស្មោះស្នេហ៍ logo and a new blue-and-gold night-sky theme.
- A smooth 8.2-second wheel spin, with reduced-motion support.
- The original drink-safe, friendship, challenge, repeat-spin, and lucky-pass outcomes.
- A **សំណាងបានលុយ 💰** outcome that awards the current round's pool once.
- Each participant contributes **500៛ once per round**. Only host-confirmed participants count toward the pool or may spin.
- The server chooses and records outcomes. The browser cannot submit a preferred result or change the pool amount.
- Payment confirmations and prize settlements are stored in a server-side ledger. Reusing a participant or reference cannot count the same contribution twice.

## Start locally

Use Node.js 18 or newer. Set a private host key with at least 32 characters, then start the server:

```powershell
$env:ADMIN_KEY = node -p "require('crypto').randomBytes(32).toString('hex')"
npm start
```

Open `http://localhost:3000`. The host opens **🔐 ការគ្រប់គ្រងការបង់ប្រាក់ និងប្រាក់រង្វាន់**, enters the key, and confirms a participant only after checking that the 500៛ payment was actually received. Enter a unique payment reference for each participant. When the wheel awards the pool, the host transfers the amount separately, records a transfer reference, and can then start a new round.

Run the server checks with `npm test`.

## Deploy on Railway

1. Upload these project files to your GitHub repository.
2. In Railway, deploy the repository as a Node.js service. Railway runs `npm start`.
3. Add a Railway variable named `ADMIN_KEY` with a private random value of at least 32 characters. Generate one locally with the PowerShell command above and paste its output into Railway. Never commit the key or put it in browser code.
4. Attach a Railway volume mounted at `/data` and set `DATA_DIR=/data` so the game ledger survives redeploys and restarts. Keep a single running replica because this lightweight JSON ledger is designed for one server process.
5. Open the HTTPS domain, enter the host key in the game, and confirm payments only after checking the real receipts.

## Payment and security notes

This project does **not** connect to a bank, payment wallet, or payment gateway. The host confirms incoming payments after checking them outside the app; the server stores that confirmation, fixed 500៛ amount, and unique reference. It also records one pending prize payout and prevents a second award in the same round. The host must actually transfer the prize and mark it settled in the app. If you need automatic payment verification or transfers, a provider integration and its credentials must be added separately.

Players share one game state and turn list. The host key is exchanged for a 30-minute, HTTP-only, same-site browser session and is not retained by the page script or saved in local storage. Use HTTPS and keep the key private. Player names and non-cash lucky passes are not identity-verified.

## Play safely

No one should be pressured to drink or take a challenge. Choose a non-alcoholic drink or skip any result that feels uncomfortable.
