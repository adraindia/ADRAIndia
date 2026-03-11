import { signOut } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase.js";
import { C, F } from "../utils/theme.js";

// ADRA Globe + Wordmark SVG
function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" fill="none">
      <circle cx="50" cy="44" r="38" stroke="#fff" strokeWidth="4" />
      <ellipse cx="50" cy="44" rx="18" ry="38" stroke="#fff" strokeWidth="3.5" />
      <line x1="12" y1="44" x2="88" y2="44" stroke="#fff" strokeWidth="3" />
      <line x1="16" y1="24" x2="84" y2="24" stroke="#fff" strokeWidth="2.5" />
      <line x1="16" y1="64" x2="84" y2="64" stroke="#fff" strokeWidth="2.5" />
      <circle cx="34" cy="17" r="5" fill="#fff" />
      <circle cx="50" cy="12" r="6" fill="#fff" />
      <circle cx="66" cy="17" r="5" fill="#fff" />
      <text x="50" y="108" textAnchor="middle" fontFamily="'Montserrat',sans-serif" fontWeight="800" fontSize="30" fill="#fff" letterSpacing="3">ADRA</text>
    </svg>
  );
}

export default function Header({ user, isAdmin }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const activeTab  = location.pathname;

  const tabs = [
    { path: "/submit",  label: "Submit Data" },
    { path: "/library", label: "My Submissions" },
    ...(isAdmin ? [{ path: "/admin", label: "Admin ★" }] : []),
  ];

  async function handleSignOut() {
    await signOut(auth);
    navigate("/");
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ background: C.green, borderBottom: `3px solid ${C.greenDark}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo size={40} />
            <div>
              <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "-0.01em" }}>ADRA India — Content Hub</div>
              <div style={{ fontFamily: F.head, fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: "0.12em", marginTop: 2 }}>FIELD-TO-PUBLICATION WORKFLOW</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: F.head, fontSize: 12, color: "#fff", fontWeight: 600 }}>{user?.displayName || user?.email?.split("@")[0]}</div>
              {isAdmin && <div style={{ fontFamily: F.head, fontSize: 10, color: C.greenMid, letterSpacing: "0.08em" }}>ADMIN</div>}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {user?.photoURL
                ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, color: "#fff" }}>{(user?.displayName || "U")[0].toUpperCase()}</span>
              }
            </div>
            <button onClick={handleSignOut} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 4, padding: "6px 14px", color: "rgba(255,255,255,0.85)", fontFamily: F.head, fontSize: 11, cursor: "pointer", letterSpacing: "0.04em" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.greyBorder}`, display: "flex" }}>
        {tabs.map(({ path, label }) => {
          const active = activeTab === path;
          return (
            <button key={path}
              style={{ padding: "11px 22px", border: "none", borderBottom: active ? `3px solid ${C.green}` : "3px solid transparent", background: "transparent", color: active ? C.green : C.grey, fontFamily: F.head, fontWeight: active ? 700 : 400, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => navigate(path)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
