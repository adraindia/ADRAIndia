import { signOut } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase.js";
import { C, F } from "../utils/theme.js";
import { ADRA_LOGO_WHITE } from "../utils/logo.js";

const TABS = [
  { path: "/submit",  label: "Submit",         icon: "✦",  mobileLabel: "Submit"  },
  { path: "/library", label: "My Submissions",  icon: "◈",  mobileLabel: "Library" },
  { path: "/admin",   label: "Admin",           icon: "◉",  mobileLabel: "Admin"   },
];

export default function Header({ user, isAdmin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const active   = location.pathname;
  const initial  = (user?.displayName || user?.email || "U")[0].toUpperCase();

  const tabs = TABS.filter(t => t.path !== "/admin" || isAdmin);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/");
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          GLOBAL STYLES — mobile-first, bold redesign
      ══════════════════════════════════════════════════════ */}
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }

        :root {
          --green:       ${C.green};
          --green-dark:  ${C.greenDark};
          --green-light: ${C.greenLight};
          --green-glow:  rgba(0,123,95,0.14);
          --grey:        ${C.grey};
          --grey-border: ${C.greyBorder};
          --white:       #ffffff;
          --surface:     #F5F7F6;
          --black:       #0E1714;
          --radius-sm:   8px;
          --radius-md:   12px;
          --radius-lg:   18px;
          --radius-xl:   24px;
          --radius-pill: 999px;
          --shadow-xs:   0 1px 3px rgba(0,0,0,0.06);
          --shadow-sm:   0 2px 10px rgba(0,0,0,0.07);
          --shadow-md:   0 4px 20px rgba(0,0,0,0.09);
          --shadow-lg:   0 8px 40px rgba(0,0,0,0.11);
          --shadow-green:0 6px 24px rgba(0,123,95,0.22);
          --font-head:   'Montserrat', sans-serif;
          --font-body:   'Zilla Slab', serif;
        }

        html { scroll-behavior: smooth; }

        body {
          margin: 0;
          background: var(--surface);
          font-family: var(--font-body);
          -webkit-font-smoothing: antialiased;
        }

        /* ── Focus ring ── */
        input:focus, textarea:focus, select:focus {
          border-color: var(--green) !important;
          box-shadow: 0 0 0 3px var(--green-glow) !important;
          outline: none;
        }

        /* ── Button interactions ── */
        .btn-primary {
          background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
          color: #fff;
          border: none;
          border-radius: var(--radius-pill);
          padding: 13px 28px;
          font-family: var(--font-head);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: var(--shadow-green);
          transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
        }
        .btn-primary:hover  { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(0,123,95,0.3); }
        .btn-primary:active { transform: translateY(0); opacity: 1; }

        .btn-outline {
          background: transparent;
          color: var(--green);
          border: 1.5px solid var(--green);
          border-radius: var(--radius-pill);
          padding: 10px 20px;
          font-family: var(--font-head);
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .btn-outline:hover { background: var(--green-light); box-shadow: var(--shadow-xs); }

        .btn-ghost {
          background: transparent;
          border: 1.5px solid #fca5a5;
          color: #b91c1c;
          border-radius: var(--radius-pill);
          padding: 8px 16px;
          font-family: var(--font-head);
          font-size: 11px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-ghost:hover { background: #fef2f2; }

        /* ── Cards ── */
        .card {
          background: var(--white);
          border: 1px solid var(--grey-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .card-hover {
          transition: box-shadow 0.18s, transform 0.18s;
        }
        .card-hover:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        /* ── Upload zones ── */
        .upload-zone {
          border: 2px dashed var(--grey-border);
          border-radius: var(--radius-md);
          background: var(--surface);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          min-height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .upload-zone:hover, .upload-zone.active {
          border-color: var(--green);
          background: var(--green-light);
        }

        /* ── Section header ── */
        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin: 30px 0 18px;
          padding: 12px 16px;
          border-radius: 10px;
          border-left: 3px solid var(--green);
          background: linear-gradient(90deg, var(--green-light) 0%, transparent 100%);
        }

        /* ── Page wrapper ── */
        .page-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 28px 24px 40px;
          animation: pageIn 0.22s ease both;
        }

        /* ── Tags / pills ── */
        .tag-case  { background: ${C.greenLight}; color: ${C.green}; }
        .tag-news  { background: #EAF0FB; color: #2563EB; }
        .tag-rep   { background: #FEF3E2; color: #B45309; }
        .tag-draft { background: #FEF3E2; color: #B45309; }
        .tag-final { background: ${C.greenLight}; color: ${C.green}; }

        /* ── Nav ── */
        .bottom-nav { display: none !important; }
        .desktop-nav-strip { display: flex; }

        /* ── Animations ── */
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ════════════════════════════════
           MOBILE  ≤ 640px
        ════════════════════════════════ */
        @media (max-width: 640px) {
          .desktop-nav-strip  { display: none !important; }
          .bottom-nav         { display: flex !important; }
          .hide-on-mobile     { display: none !important; }
          .page-wrap {
            padding: 18px 14px 100px;
          }
          .card-pad-desktop { padding: 18px 14px !important; }
          .btn-row-mobile   { flex-wrap: wrap; }
          .header-subtitle  { display: none; }
        }

        /* ════════════════════════════════
           DESKTOP  > 640px
        ════════════════════════════════ */
        @media (min-width: 641px) {
          .show-mobile-only { display: none !important; }
        }

        /* iOS safe-area bottom spacing */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bottom-nav { padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════════════════ */}
      <header style={{
        background: `linear-gradient(135deg, ${C.green} 0%, ${C.greenDark} 100%)`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 20px rgba(0,0,0,0.18)",
      }}>
        {/* Subtle grain overlay */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          pointerEvents: "none",
        }} />

        <div style={{
          maxWidth: 960, margin: "0 auto",
          padding: "0 20px",
          height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative",
        }}>
          {/* ── Brand ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={ADRA_LOGO_WHITE} alt="ADRA India"
              style={{ width: 36, height: "auto", flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: F.head, fontWeight: 800, fontSize: 16,
                color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15,
              }}>
                ADRA India
              </div>
              <div className="header-subtitle" style={{
                fontFamily: F.head, fontSize: 9, fontWeight: 600,
                color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em",
                textTransform: "uppercase", marginTop: 1,
              }}>
                Content Hub
              </div>
            </div>
          </div>

          {/* ── User area ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Name block — desktop only */}
            <div className="hide-on-mobile" style={{ textAlign: "right" }}>
              <div style={{
                fontFamily: F.head, fontSize: 12, fontWeight: 600,
                color: "#fff", lineHeight: 1.2,
              }}>
                {user?.displayName || user?.email?.split("@")[0]}
              </div>
              {isAdmin && (
                <div style={{
                  fontFamily: F.head, fontSize: 9, fontWeight: 700,
                  color: C.greenMid, letterSpacing: "0.12em",
                  textTransform: "uppercase", marginTop: 1,
                }}>
                  Admin
                </div>
              )}
            </div>

            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}>
              {user?.photoURL
                ? <img src={user.photoURL} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{
                    fontFamily: F.head, fontWeight: 800, fontSize: 14, color: "#fff",
                  }}>
                    {initial}
                  </span>
              }
            </div>

            {/* Sign out */}
            <button onClick={handleSignOut} style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "999px",
              padding: "6px 14px",
              color: "rgba(255,255,255,0.88)",
              fontFamily: F.head, fontSize: 11, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.03em",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            DESKTOP NAV STRIP — inside the green header
        ══════════════════════════════════════════════════════ */}
        <div className="desktop-nav-strip" style={{
          borderTop: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.12)",
        }}>
          <div style={{
            maxWidth: 960, margin: "0 auto",
            padding: "0 12px",
            display: "flex", alignItems: "stretch",
          }}>
            {tabs.map(({ path, label, icon }) => {
              const isActive = active === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    position: "relative",
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 18px",
                    border: "none",
                    background: "transparent",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.58)",
                    fontFamily: F.head,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 12,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    transition: "color 0.15s",
                    // Active bottom bar
                    borderBottom: isActive
                      ? "2px solid rgba(255,255,255,0.9)"
                      : "2px solid transparent",
                  }}
                >
                  <span style={{
                    fontSize: 13,
                    opacity: isActive ? 1 : 0.7,
                  }}>
                    {icon}
                  </span>
                  {label}
                  {/* Active dot */}
                  {isActive && (
                    <span style={{
                      position: "absolute",
                      top: 8, right: 10,
                      width: 5, height: 5,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.7)",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MOBILE BOTTOM NAV — frosted, floating
      ══════════════════════════════════════════════════════ */}
      <nav className="bottom-nav" style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${C.greyBorder}`,
        boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
        display: "flex",
        alignItems: "center",
      }}>
        {tabs.map(({ path, label, icon, mobileLabel }) => {
          const isActive = active === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
                padding: "12px 8px 10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {/* Active pill background behind icon */}
              <div style={{
                width: 44, height: 30,
                borderRadius: "999px",
                background: isActive ? C.greenLight : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 4,
                transition: "background 0.2s",
              }}>
                <span style={{
                  fontSize: 18,
                  filter: isActive ? "none" : "grayscale(0.5) opacity(0.5)",
                  transition: "filter 0.2s",
                }}>
                  {/* Use emoji icons for mobile clarity */}
                  {path === "/submit"  && "✏️"}
                  {path === "/library" && "📂"}
                  {path === "/admin"   && "⚙️"}
                </span>
              </div>
              <span style={{
                fontFamily: F.head,
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? C.green : C.grey,
                letterSpacing: "0.02em",
                transition: "color 0.2s",
              }}>
                {mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
