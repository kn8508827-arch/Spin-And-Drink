# Spin-And-Drink — កង់សំណាងជាក្រុម

A Khmer, mobile-first party wheel served by a small Node.js HTTP server. The game has no database, login, API key, or external API dependency.

## Game rules and features

- **អត់ស្មោះ:** penalty of two glasses. Players can choose a non-alcoholic drink or skip.
- **ស្មោះ:** escape the drinking turn.
- **បញ្ជាមិត្តម្នាក់:** name another player to drink one glass; they can choose a non-alcoholic drink or skip.
- **សំណាង ៤ ដង:** grants four passes. One pass waives the drink cost for one drinking turn. Passes belong to a player and are saved with the player list in that browser.
- Other outcomes include water, singing, a suitable truth-or-dare prompt, a friend-picked challenge, dancing, and another spin.
- Spin ticks and a short celebration tune play through the browser, with a sound toggle.
- The blue-and-gold Team ស្មោះស្នេហ៍ wallpaper is bundled at `assets/team-logo.jpg` and used as the page backdrop and brand mark.
- The requested photo and laughter outcomes are not on the wheel.

## Run locally

Install Node.js 18 or newer, then run `npm start` and open `http://localhost:3000`. The player list and lucky passes stay on that device; game rooms and cross-device synchronization are not included.

## Deploy with GitHub and Railway

1. Commit the files in this folder to the desired GitHub repository.
2. In Railway, create a project using **Deploy from GitHub Repo** and select that repository.
3. Railway should detect Node.js and run the `start` script (`node server.js`).
4. In the service networking settings, generate a public domain if one is not already assigned.
5. Open the generated HTTPS address on a phone and try the wheel.

Railway may charge for hosting depending on the current plan and usage. Check its plan and usage details before deploying.

## Play safely

No one should be pressured to drink or take a challenge. Choose a non-alcoholic drink or skip any result that feels uncomfortable.
