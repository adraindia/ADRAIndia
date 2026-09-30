# ADRA India Content Hub

A field-to-publication workflow app for ADRA India communications teams.
Staff submit field reports and photos, the app drafts case stories with Claude,
and finished stories export to Word.

Built with React + Vite, Firebase (Auth / Firestore), and Vercel.

**Live app:** https://adra-india.vercel.app

---

## Where everything lives

| Part | Where | Managed by |
|------|-------|------------|
| Code | GitHub: [`adraindia/ADRAIndia`](https://github.com/adraindia/ADRAIndia) (public) | `adraindia` GitHub organisation |
| Hosting | Vercel project `adra-india` (Hobby team) | New ADRA Vercel account |
| Web addresses | `adra-india.vercel.app` (main), `adra-india-alpha.vercel.app` | Vercel → Settings → Domains |
| Sign-in and database | Firebase project `adra-ind-contenthub` | Owner: trisha.mahajan@adraindia.org |
| Story generation | Anthropic API, called from `api/generate.js` | `ANTHROPIC_API_KEY` in Vercel |

Nothing is hosted on personal accounts.

---

## How deploys work

Every push to `main` on GitHub deploys to Vercel automatically, in about 2 minutes.
Other branches get their own preview address, which you can find under Vercel → Deployments.

**Firestore rules are not deployed by Vercel.** After changing `firestore.rules`,
paste the whole file into Firebase Console → Firestore Database → Rules and click **Publish**:
https://console.firebase.google.com/project/adra-ind-contenthub/firestore/databases/-default-/security/rules

---

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Visibility | Value |
|------|-----------|-------|
| `VITE_FIREBASE_API_KEY` | Config | Firebase → Project settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Config | `adra-ind-contenthub.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Config | `adra-ind-contenthub` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Config | Firebase → Project settings → Your apps |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Config | Firebase → Project settings → Your apps |
| `VITE_FIREBASE_APP_ID` | Config | Firebase → Project settings → Your apps |
| `VITE_ADMIN_EMAIL` | Config | `Trisha.mahajan@adraindia.org` (the super admin, see below) |
| `ANTHROPIC_API_KEY` | **Sensitive** | From console.anthropic.com |

- `VITE_` variables are built into the browser code, so Vercel will not let them be Sensitive.
  That is fine: the Firebase web config is public by design, and data is protected by `firestore.rules`.
- `ANTHROPIC_API_KEY` is the only real secret. It is only used server-side and must stay Sensitive.
- Never commit keys or `.env` files to the repo. It is public.
- After changing any variable, redeploy (Deployments → ⋯ → Redeploy).

---

## Sign-in

- Staff sign in with Google or Microsoft using their `@adraindia.org` account. Other emails are rejected.
- Every address the app is served from must be listed in Firebase → Authentication → Settings →
  **Authorised domains** (currently `adra-india.vercel.app` and `adra-india-alpha.vercel.app`).
  If sign-in shows `auth/unauthorized-domain`, the address is missing there.

---

## Admins

- **Super admin:** the email in `VITE_ADMIN_EMAIL` (also written into `firestore.rules`).
  Always an admin and cannot be removed from inside the app.
- **Other admins:** managed in the app under **Admin → Team Members → Make admin / Remove admin**.
  The person must have signed in once to appear in the list, and must sign out and back in after being made admin.
- Users cannot make themselves admin. Only admins can change another user's admin status.

### Changing the super admin

The super admin email appears in three places, all of which must match:

1. Vercel: set `VITE_ADMIN_EMAIL` to the new email, then redeploy.
2. Code: the fallback email in `src/App.jsx`, `src/pages/Login.jsx` and `src/pages/Admin.jsx`.
3. `firestore.rules`: the email in `isAdmin()` and `isMainAdmin()`. Then publish the rules in Firebase.

The old super admin is then an ordinary user, unless they are made admin from the Team Members tab.

---

## Common tasks

**Add a new admin:** have them sign in once, then Admin → Team Members → Make admin.

**Add a web address:** Vercel → Settings → Domains → Add, then add the same address to Firebase Authorised domains.

**Rotate the Anthropic key:** create a new key at console.anthropic.com, replace `ANTHROPIC_API_KEY` in Vercel (Sensitive), redeploy, then delete the old key.

**Give someone access to manage the app:**
- GitHub: invite them to the `adraindia` organisation.
- Vercel: Hobby plans can't add team members, so upgrade to Pro or share the account login.
- Firebase: https://console.cloud.google.com/iam-admin/iam?project=adra-ind-contenthub → Grant access.

---

## Running locally

```bash
npm install
# create .env.local with the VITE_ variables from the table above
npm run dev      # http://localhost:3000
```

The story generator (`/api/generate`) runs as a Vercel function, so use `vercel dev` to test it locally.

---

## Support

Questions: Trisha.mahajan@adraindia.org
