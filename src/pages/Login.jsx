import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, microsoftProvider } from "../firebase.js";
import { C, F } from "../utils/theme.js";
import { ADRA_LOGO } from "../utils/logo.js";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "Trisha.mahajan@adraindia.org";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

async function doSignIn(provider) {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  if (!user.email?.toLowerCase().endsWith("@adraindia.org")) {
    await auth.signOut();
    throw new Error("Access restricted to @adraindia.org email addresses only.");
  }
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid, email: user.email,
      displayName: user.displayName || user.email.split("@")[0],
      photoURL: user.photoURL || null,
      isAdmin: user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      lastLogin: serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.warn("Post-login write (non-fatal):", e); }
}

export default function Login() {
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState("");

  async function handleSignIn(provider, name) {
    setLoading(name); setError("");
    try {
      await doSignIn(provider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError(err.message || "Sign-in failed. Please try again.");
      }
      setLoading(null);
    }
  }

  const base = {
    display:"flex", alignItems:"center", justifyContent:"center", gap:12,
    width:"100%", padding:"13px 20px", borderRadius:5,
    fontFamily:F.head, fontWeight:600, fontSize:14, cursor:"pointer",
    transition:"box-shadow 0.15s", opacity: loading ? 0.65 : 1,
    pointerEvents: loading ? "none" : "auto",
  };

  return (
    <div style={{ minHeight:"100vh", background:C.greyLight, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.white, border:`1px solid ${C.greyBorder}`, borderRadius:8, padding:"48px 40px", maxWidth:420, width:"100%", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", textAlign:"center" }}>

        <div style={{ marginBottom:28 }}>
          <img src={ADRA_LOGO} alt="ADRA India" style={{ width:90, height:"auto", display:"block", margin:"0 auto" }} />
        </div>
        <div style={{ fontFamily:F.head, fontWeight:800, fontSize:22, color:C.black, marginBottom:8 }}>ADRA India Content Hub</div>
        <div style={{ fontFamily:F.body, fontSize:15, color:C.grey, marginBottom:8, lineHeight:1.6 }}>
          Field-to-publication workflow for case stories, newsletters, and impact reports.
        </div>
        <div style={{ fontFamily:F.head, fontStyle:"italic", fontSize:12, color:C.greenDark, marginBottom:36 }}>Justice. Compassion. Love.</div>

        {/* Microsoft — primary */}
        <button onClick={() => handleSignIn(microsoftProvider, "microsoft")}
          style={{ ...base, background:"#0078D4", border:"none", color:"#fff", marginBottom:8, boxShadow:"0 1px 3px rgba(0,120,212,0.3)" }}
          onMouseEnter={e => { if(!loading) e.currentTarget.style.boxShadow="0 3px 10px rgba(0,120,212,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow="0 1px 3px rgba(0,120,212,0.3)"; }}>
          <MicrosoftIcon />
          {loading === "microsoft" ? "Signing in…" : "Sign in with Microsoft"}
        </button>
        <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginBottom:14, letterSpacing:"0.03em" }}>
          Recommended — @adraindia.org runs on Microsoft 365
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 14px 0" }}>
          <div style={{ flex:1, height:1, background:C.greyBorder }} />
          <span style={{ fontFamily:F.head, fontSize:11, color:C.grey }}>or</span>
          <div style={{ flex:1, height:1, background:C.greyBorder }} />
        </div>

        {/* Google */}
        <button onClick={() => handleSignIn(googleProvider, "google")}
          style={{ ...base, background:C.white, border:`1.5px solid ${C.greyBorder}`, color:C.black, boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}
          onMouseEnter={e => { if(!loading) e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.14)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.08)"; }}>
          <GoogleIcon />
          {loading === "google" ? "Signing in…" : "Sign in with Google"}
        </button>

        {error && (
          <div style={{ marginTop:16, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, padding:"10px 14px", fontFamily:F.head, fontSize:12, color:"#DC2626", textAlign:"left" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop:22, fontFamily:F.head, fontSize:11, color:C.grey }}>
          Access restricted to <strong>@adraindia.org</strong> addresses only
        </div>
      </div>
      <div style={{ marginTop:28, fontFamily:F.head, fontSize:11, color:C.grey, letterSpacing:"0.08em" }}>
        ADRA INDIA · INTERNAL TOOL · ADRAINDIA.ORG
      </div>
    </div>
  );
}
