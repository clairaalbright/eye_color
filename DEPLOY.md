# How to Push Eye Color Identifier to Production

## What you have (your stack)

- **Frontend**: Plain HTML, CSS, and JavaScript in the `public/` folder (no React/Vue, etc.).
- **Backend**: Node.js with Express in `server/`. It serves the frontend and has one API: `POST /api/analyze` (eye color analysis using Sharp).
- **Single app**: One Node server does both. No separate frontend/backend hosts needed.

**Standard, easy host for this**: **Railway** (or **Render**). Both run Node.js, support paid plans, and host frontend + backend together.

---

## Option A: Deploy with Railway (recommended)

### 1. Put your code on GitHub (if it’s not already)

1. Go to [github.com](https://github.com) and sign in.
2. Click the **+** (top right) → **New repository**.
3. Name it (e.g. `eye-color-identifier`), leave it **Public**, click **Create repository**.
4. On your PC, open PowerShell in your project folder (`c:\eye_color`) and run:

   ```powershell
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

### 2. Create a Railway project and deploy

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **Start a New Project** → **Deploy from GitHub repo**.
3. Choose the repo you just pushed (e.g. `eye-color-identifier`).
4. Railway will detect Node.js, run `npm install` and `npm start` for you. **No extra config needed** if your `package.json` has `"start": "node server/index.js"` (it does).
5. After the first deploy, click your service → **Settings** → **Networking** → **Generate Domain**. You’ll get a URL like `https://something.up.railway.app`.

### 3. Use the live URL

- Open that URL in a browser. You should see the Eye Color Identifier and the “Analyze” button should work (it uses the same server).
- You can add your GoDaddy domain later in Railway under **Settings** → **Networking** → **Custom Domain**.

### 4. Paid plan (school paying)

- In Railway: **Account** (profile) → **Billing** → add a card and choose a paid plan so you’re not on the free tier.

---

## Option B: Deploy with Render

1. Go to [render.com](https://render.com) and sign in with GitHub.
2. **Dashboard** → **New** → **Web Service**.
3. Connect the same GitHub repo. Render will detect Node.js.
4. Use:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
5. Click **Create Web Service**. Render gives you a URL like `https://your-app-name.onrender.com`.
6. For a paid plan: **Dashboard** → **Account** → **Billing** and upgrade.

---

## Checklist before you deploy

- [ ] Code is pushed to GitHub (so Railway/Render can pull it).
- [ ] `package.json` has `"start": "node server/index.js"` (you already have this).
- [ ] Server uses `process.env.PORT` (your `server/index.js` already has `const PORT = process.env.PORT || 3000`).

You don’t need to connect a domain to get to production; the `.railway.app` or `.onrender.com` URL is enough. Add your GoDaddy domain later in the host’s **Custom domain** / **Networking** settings.
