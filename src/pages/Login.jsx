import { signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase.js";
import { C, F } from "../utils/theme.js";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "Trisha.mahajan@adraindia.org";

function Logo() {
  return (
    <svg width={70} height={80} viewBox="0 0 100 115" fill="none">
      <circle cx="50" cy="44" r="38" stroke={C.green} strokeWidth="4" />
      <ellipse cx="50" cy="44" rx="18" ry="38" stroke={C.green} strokeWidth="3.5" />
      <line x1="12" y1="44" x2="88" y2="44" stroke={C.green} strokeWidth="3" />
      <line x1="16" y1="24" x2="84" y2="24" stroke={C.green} strokeWidth="2.5" />
      <line x1="16" y1="64" x2="84" y2="64" stroke={C.green} strokeWidth="2.5" />
      <circle cx="34" cy="17" r="5" fill={C.green} />
      <circle cx="50" cy="12" r="6" fill={C.green} />
      <circle cx="66" cy="17" r="5" fill={C.green} />
      <text x="50" y="108" textAnchor="middle" fontFamily="'Montserrat',sans-serif" fontWeight="800" fontSize="30" fill={C.green} letterSpacing="3">ADRA</text>
    </svg>
  );
}

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

export default function Login() {
  async function handleSignIn() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Enforce @adraindia.org domain
      if (!user.email?.toLowerCase().endsWith("@adraindia.org")) {
        await auth.signOut();
        alert("Access restricted to @adraindia.org email addresses only.");
        return;
      }

      // Save/update user record in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid:         user.uid,
        email:       user.email,
        displayName: user.displayName,
        photoURL:    user.photoURL,
        isAdmin:     user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        lastLogin:   serverTimestamp(),
      }, { merge: true });

    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Sign-in error:", err);
        alert("Sign-in failed. Please try again.");
      }
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.greyLight, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

      {/* Card */}
      <div style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderRadius: 8, padding: "48px 40px", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>

        <div style={{ marginBottom: 28 }}>
          <Logo />
        </div>

        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 22, color: C.black, marginBottom: 8 }}>
          ADRA India Content Hub
        </div>
        <div style={{ fontFamily: F.body, fontSize: 15, color: C.grey, marginBottom: 8, lineHeight: 1.6 }}>
          Field-to-publication workflow for case stories, newsletters, and impact reports.
        </div>
        <div style={{ fontFamily: F.head, fontStyle: "italic", fontSize: 12, color: C.greenDark, marginBottom: 36 }}>
          Justice. Compassion. Love.
        </div>

        <button onClick={handleSignIn}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "13px 20px", background: C.white, border: `1.5px solid ${C.greyBorder}`, borderRadius: 5, fontFamily: F.head, fontWeight: 600, fontSize: 14, color: C.black, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", transition: "box-shadow 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.14)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"}>
          <GoogleIcon />
          Sign in with Google
        </button>

        <div style={{ marginTop: 20, fontFamily: F.head, fontSize: 11, color: C.grey, letterSpacing: "0.02em" }}>
          Access restricted to <strong>@adraindia.org</strong> email addresses
        </div>
      </div>

      <div style={{ marginTop: 28, fontFamily: F.head, fontSize: 11, color: C.grey, letterSpacing: "0.08em" }}>
        ADRA INDIA · INTERNAL TOOL · ADRAINDIA.ORG
      </div>
    </div>
  );
}
