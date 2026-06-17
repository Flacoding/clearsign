# ClearSign — Deployment Guide

## What you need before starting
- Node.js installed (https://nodejs.org — download the LTS version)
- A GitHub account
- A Vercel account connected to GitHub (https://vercel.com)
- Your Anthropic API key (https://console.anthropic.com → API Keys)

---

## Step 1 — Install dependencies locally (one time)

Open Terminal (Mac) or Command Prompt (Windows), navigate to this folder, and run:

```bash
npm install
```

---

## Step 2 — Test it locally (optional but recommended)

Create a file called `.env.local` in this folder and add:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000 in your browser. Upload a contract to test it.

---

## Step 3 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial ClearSign build"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/clearsign.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.
(Create the repo first at https://github.com/new — name it `clearsign`, keep it private if you prefer)

---

## Step 4 — Deploy on Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select your `clearsign` repo
4. Click **Deploy** — Vercel auto-detects Next.js, no config needed

---

## Step 5 — Add your API key in Vercel

1. In Vercel, open your project
2. Go to **Settings → Environment Variables**
3. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-your-real-key-here`
4. Click **Save**
5. Go to **Deployments** → click the three dots on your latest deployment → **Redeploy**

Your app is now live at `https://clearsign.vercel.app` (or similar URL Vercel assigns).

---

## Updating the app in the future

Every time you push code to GitHub, Vercel auto-deploys. The workflow is:

```bash
# Make your changes, then:
git add .
git commit -m "describe your change"
git push
```

Vercel picks it up automatically within ~30 seconds.

---

## Custom domain (optional)

In Vercel → your project → **Settings → Domains**, add your own domain (e.g. `clearsign.io`).
Vercel handles the SSL certificate automatically.

---

## Cost estimate

| Item | Cost |
|------|------|
| Vercel hosting | Free (Hobby plan) |
| GitHub | Free |
| Claude API per analysis | ~$0.02–0.05 |
| Claude API follow-up chat | ~$0.001 per message |

**Total fixed cost: $0/month.** You only pay per analysis at Anthropic's usage rates.
