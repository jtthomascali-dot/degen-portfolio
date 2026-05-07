# 🦍 Degen Portfolio Analyzer

A brutally funny AI-powered portfolio roaster. Enter your stocks, get destroyed.

---

## Deploy Guide (No Coding Required)

Follow these steps in order. Each one takes 2-5 minutes.

---

### Step 1: Get your accounts (all free)

Sign up for these if you don't have them:
- **GitHub**: https://github.com/signup
- **Vercel**: https://vercel.com/signup (sign up with GitHub)
- **Supabase**: https://supabase.com/dashboard/sign-up
- **Anthropic**: https://console.anthropic.com (for the AI API key)

---

### Step 2: Set up Supabase (your database)

1. Go to https://supabase.com/dashboard and click **New Project**
2. Name it `degen-portfolio`, pick a region close to you, set a password
3. Wait ~2 minutes for it to set up
4. Click **SQL Editor** in the left sidebar
5. Copy everything from the file `supabase-schema.sql` in this project
6. Paste it into the SQL editor and click **Run**
7. Go to **Settings → API** and copy:
   - `Project URL` → you'll need this
   - `anon public` key → you'll need this

---

### Step 3: Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`) → you'll need this

---

### Step 4: Upload to GitHub

1. Go to https://github.com/new and create a new repository called `degen-portfolio`
2. Make it **Private** (or public, up to you)
3. Click **uploading an existing file**
4. Drag ALL the files from this folder into the upload area
5. Click **Commit changes**

---

### Step 5: Deploy to Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `degen-portfolio` GitHub repo
3. Click **Deploy** (don't change any settings yet)
4. It will fail — that's okay! We need to add the API keys first.
5. Go to your project in Vercel → **Settings → Environment Variables**
6. Add these one by one:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | your key from Step 3 |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Step 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Step 2 |
| `NEXT_PUBLIC_SITE_URL` | your Vercel URL (e.g. https://degen-portfolio.vercel.app) |

7. Go to **Deployments** → click the three dots → **Redeploy**
8. Done! Your site is live.

---

### Step 6: (Optional) Custom domain

In Vercel → **Settings → Domains**, you can add a custom domain like `degencheck.fyi` for ~$10/year from Namecheap or Cloudflare.

---

## Running locally (for making changes)

1. Install Node.js from https://nodejs.org (LTS version)
2. Open Terminal (Mac) or Command Prompt (Windows)
3. Navigate to this folder: `cd path/to/degen-portfolio`
4. Copy the env file: `cp .env.example .env.local`
5. Fill in `.env.local` with your keys from above
6. Run: `npm install`
7. Run: `npm run dev`
8. Open http://localhost:3000

---

## Making changes

Every time you change a file and want to update your live site:
1. Upload the changed files to GitHub (drag and drop)
2. Vercel automatically redeploys within ~1 minute

---

## Features

- **Portfolio roaster** — enter any stocks/ETFs/crypto, get brutally roasted by Claude AI
- **Degen score** — 0 (Buffett) to 100 (Peak Ape)
- **Shareable results** — unique link for every analysis
- **Leaderboard** — public hall of shame sorted by degen score
- **History** — track your score over time
- **AI chat** — ask follow-up questions about your portfolio

---

## Tech Stack

- **Next.js 14** — the web framework
- **Tailwind CSS** — styling
- **Anthropic Claude API** — the AI roasting engine
- **Supabase** — database for storing results + leaderboard
- **Vercel** — hosting

---

*Not financial advice. Obviously.*
