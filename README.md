# Lucky Party Wheel — GitHub + Railway

This is a simple static web app served by a tiny Node.js HTTP server. It has no database, login, API key, or external API dependency.

## Deploy with GitHub and Railway

### 1. Upload to GitHub
1. Sign in to GitHub and create a new repository, for example `lucky-party-wheel`.
2. Upload the files in this folder to the repository root:
   - `index.html`
   - `server.js`
   - `package.json`
   - `README.md`
3. Commit the files to the main branch.

### 2. Deploy on Railway
1. Sign in at https://railway.com/
2. Create a new project and choose **Deploy from GitHub Repo**.
3. Connect GitHub if asked, then select `lucky-party-wheel`.
4. Railway should detect Node.js and use the start script `node server.js`.
5. After deployment, open the service's **Settings / Networking** area and generate a public domain if one is not already assigned.
6. Open the generated HTTPS URL on your phone and test the wheel.

## Low-cost notes
- The wheel runs entirely in the browser; no database or paid API is needed for the MVP.
- Railway hosting may incur charges depending on your plan and usage. Check the current Railway plan/usage page before deploying.
- Because this first version is a static single-player wheel, GitHub Pages is another possible low-cost/free hosting choice. Railway becomes more useful if a backend or synchronized multiplayer rooms are added later.

## Important limitations
This version does not yet synchronize multiple players or create rooms. Each visitor plays locally in their own browser. The wheel includes non-alcohol options and a skip option; never pressure anyone to drink or accept a challenge.
