# ADRA India Content Hub — Deployment Guide

A field-to-publication workflow app for ADRA India communications teams.
Built with React + Vite, Firebase (Auth / Firestore / Storage), and Vercel.

---

## What you'll need (15 minutes total)

- Your Firebase project (already created ✓)
- A free Vercel account → vercel.com
- A free GitHub account → github.com
- Your Anthropic API key → console.anthropic.com

---

## STEP 1 — Configure Firebase (10 min)

### 1a. Enable Google Authentication
1. Go to Firebase Console → your project → **Build → Authentication**
2. Click **Get started** → **Sign-in method** tab
3. Click **Google** → Enable → Set project support email → **Save**

### 1b. Add authorised domain (after you get your Vercel URL)
1. Still in Authentication → **Settings** tab → **Authorised domains**
2. Add your Vercel URL e.g. `adra-content-hub.vercel.app`
3. *(Do this after Step 3 once you have the URL)*

### 1c. Create Firestore database
1. Firebase Console → **Build → Firestore Database**
2. Click **Create database** → choose **Start in production mode** → pick region `asia-south1` (Mumbai) → **Done**
3. Once created, go to **Rules** tab → paste the contents of `firestore.rules` → **Publish**

### 1d. Enable Storage
~~Firebase Storage requires the paid Blaze plan — skip this entirely.~~
Photos are compressed and stored directly in Firestore. No Storage setup needed. ✓

### 1e. Get your Firebase config
1. Firebase Console → ⚙️ Project Settings → scroll to **Your apps**
2. Click **Add app** → choose **Web (</>)**
3. Register app (any nickname) → you'll see a config object like:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123..."
};
```
4. **Copy these values** — you'll need them in Step 3.

---

## STEP 2 — Push code to GitHub (3 min)

1. Create a new **private** repository on github.com (name: `adra-content-hub`)
2. In terminal, from the project folder:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/adra-content-hub.git
git push -u origin main
```

---

## STEP 3 — Deploy to Vercel (5 min)

1. Go to **vercel.com** → Sign up / Log in
2. Click **Add New Project** → Import your GitHub repo
3. Vercel auto-detects Vite → leave Framework as **Vite**
4. Click **Environment Variables** and add ALL of the following:

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | From Step 1e |
| `VITE_FIREBASE_AUTH_DOMAIN` | From Step 1e |
| `VITE_FIREBASE_PROJECT_ID` | From Step 1e |
| `VITE_FIREBASE_STORAGE_BUCKET` | From Step 1e |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Step 1e |
| `VITE_FIREBASE_APP_ID` | From Step 1e |
| `VITE_ADMIN_EMAIL` | `Trisha.mahajan@adraindia.org` |
| `ANTHROPIC_API_KEY` | Your Anthropic key (sk-ant-...) |

5. Click **Deploy** → Wait ~2 minutes
6. Copy your URL e.g. `adra-content-hub.vercel.app`

---

## STEP 4 — Add Vercel URL to Firebase (2 min)

1. Back in Firebase → Authentication → Settings → Authorised domains
2. Click **Add domain** → paste your Vercel URL (without https://)
3. Save

---

## STEP 5 — Test the app

1. Open your Vercel URL
2. Click **Sign in with Google**
3. Use your `@adraindia.org` Google account
4. You should land on the Submit form
5. Try submitting and generating a case story

If login fails → double-check the authorised domain in Step 4.
If generation fails → double-check `ANTHROPIC_API_KEY` in Vercel environment variables.

---

## Sharing with colleagues

Send them the Vercel URL. They sign in with their `@adraindia.org` Google account.
No passwords, no sign-up form — Google handles everything.

Anyone trying to sign in with a non-ADRA email will be rejected automatically.

---

## Future updates

Any time you push changes to GitHub, Vercel auto-deploys in ~2 minutes.

```bash
git add .
git commit -m "Description of change"
git push
```

---

## Custom domain (optional, later)

In Vercel → your project → Settings → Domains → Add your own domain like `hub.adraindia.org`.
Your IT team will need to add a DNS record pointing to Vercel.

---

## Support

Built by Claude (Anthropic) for ADRA India Communications team.
Questions: Trisha.mahajan@adraindia.org
