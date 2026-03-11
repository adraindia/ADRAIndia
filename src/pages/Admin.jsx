import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";
import PreviewModal from "../components/PreviewModal.jsx";

export default function Admin({ user }) {
  const [tab,       setTab]       = useState("repository");
  const [allSubs,   setAllSubs]   = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [filter,    setFilter]    = useState("finalized");
  const [preview,   setPreview]   = useState(null); // { sub }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [subSnap, userSnap] = await Promise.all([
        // No orderBy — avoids composite index requirement
        getDocs(collection(db, "submissions")),
        getDocs(collection(db, "users")),
      ]);
      const items = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setAllSubs(items);
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Admin fetch error:", e);
    }
    setLoading(false);
  }

  async function toggleStatus(sub) {
    const newStatus = sub.status === "finalized" ? "draft" : "finalized";
    try {
      await updateDoc(doc(db, "submissions", sub.id), { status: newStatus, updatedAt: serverTimestamp() });
      fetchAll();
    } catch (e) { alert("Update failed: " + e.message); }
  }

  async function adminDelete(id) {
    if (!confirm("Delete this submission permanently?")) return;
    try {
      await deleteDoc(doc(db, "submissions", id));
      fetchAll();
    } catch (e) { alert("Delete failed: " + e.message); }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const filtered = filter === "all" ? allSubs : allSubs.filter(s => s.status === filter);

  const statCards = [
    { label: "Total Submissions", value: allSubs.length, color: C.green },
    { label: "Finalized",         value: allSubs.filter(s => s.status === "finalized").length, color: C.greenDark },
    { label: "Drafts",            value: allSubs.filter(s => s.status === "draft").length,     color: "#B45309" },
    { label: "Team Members",      value: users.length, color: "#2563EB" },
  ];

  if (loading) return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: F.head, color: C.grey }}>
      Loading admin data…
    </div>
  );

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "26px 24px" }}>

      {/* Admin header */}
      <div style={{ background: C.greenDark, borderRadius: 6, padding: "20px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 20, color: "#fff" }}>Admin Dashboard</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Signed in as {user?.email}</div>
        </div>
        <div style={{ fontFamily: F.head, fontSize: 11, color: C.greenMid, letterSpacing: "0.1em" }}>ADMINISTRATOR</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderRadius: 6, padding: "18px 20px", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 28, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey, marginTop: 4, letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.greyBorder}`, marginBottom: 20 }}>
        {[["repository","Submissions Repository"],["users","Team Members"]].map(([id,label]) => (
          <button key={id}
            style={{ padding: "10px 20px", border: "none", borderBottom: tab===id ? `3px solid ${C.green}` : "3px solid transparent", background: "transparent", color: tab===id ? C.green : C.grey, fontFamily: F.head, fontWeight: tab===id?700:400, fontSize: 13, cursor: "pointer" }}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── Repository tab ── */}
      {tab === "repository" && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginRight: 4 }}>Filter:</span>
          {["all","draft","finalized"].map(f => (
            <button key={f}
              style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter===f?C.green:C.greyBorder}`, background: filter===f?C.greenLight:C.white, color: filter===f?C.green:C.grey, fontFamily: F.head, fontSize: 11, fontWeight: filter===f?700:400, cursor: "pointer", textTransform: "capitalize" }}
              onClick={() => setFilter(f)}>{f} ({f==="all"?allSubs.length:allSubs.filter(s=>s.status===f).length})</button>
          ))}
        </div>

        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "40px", color: C.grey, fontFamily: F.head }}>No submissions matching filter.</div>
          : filtered.map(sub => {
              const isOpen = expanded === sub.id;
              const ts = sub.createdAt?.toDate?.() || new Date();
              return (
                <div key={sub.id} style={{ marginBottom: 12 }}>
                  <div style={{ ...shared.card, marginBottom: 0, borderBottomLeftRadius: isOpen?0:6, borderBottomRightRadius: isOpen?0:6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : sub.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={shared.tag(sub.type)}>{TYPE_LABELS[sub.type]}</span>
                          <span style={{ fontFamily: F.head, fontSize: 10, background: sub.status==="finalized"?C.greenLight:"#FEF3E2", color: sub.status==="finalized"?C.green:"#B45309", padding: "2px 8px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {sub.status}
                          </span>
                          {sub.photoData && <span style={{ fontSize: 12 }}>📷</span>}
                        </div>
                        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{sub.data?.projectName || "Untitled"}</div>
                        <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>
                          By {sub.userName || sub.userEmail} · {ts.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button style={{ ...shared.btnOutline, fontSize: 11 }} onClick={() => toggleStatus(sub)}>
                          {sub.status === "finalized" ? "↩ Unfinalize" : "✅ Finalize"}
                        </button>
                        <button style={shared.btnRed} onClick={() => adminDelete(sub.id)}>Delete</button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderTop: "none", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: "18px 24px" }}>
                      {sub.photoData && <img src={sub.photoData} alt="Field" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 4, marginBottom: 14 }} />}
                      {/* Full-res photo downloads for admin */}
                      {(sub.photo1Full || sub.photo2Full || sub.photo1Data || sub.photo2Data) && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                          {(sub.photo1Full || sub.photo1Data) && (
                            <a href={sub.photo1Full || sub.photo1Data} download={`photo1_${sub.id}.jpg`}
                              style={{ ...shared.btnOutline, textDecoration: "none", fontSize: 11 }}>
                              Download Photo 1 (full res)
                            </a>
                          )}
                          {(sub.photo2Full || sub.photo2Data) && (
                            <a href={sub.photo2Full || sub.photo2Data} download={`photo2_${sub.id}.jpg`}
                              style={{ ...shared.btnOutline, textDecoration: "none", fontSize: 11 }}>
                              Download Photo 2 (full res)
                            </a>
                          )}
                        </div>
                      )}
                      {sub.generatedContent
                        ? <>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 10 }}>
                              <button style={shared.btnOutline} onClick={() => copyText(sub.generatedContent)}>{copied?"✓ Copied!":"Copy"}</button>
                              <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB" }}
                                onClick={() => setPreview({ sub })}>
                                📄 Preview &amp; Download
                              </button>
                            </div>
                            <div style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "16px 18px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                              {sub.generatedContent}
                            </div>
                          </>
                        : <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>No generated content for this submission.</div>
                      }
                    </div>
                  )}
                </div>
              );
            })
        }
      </>}

      {/* ── Users tab ── */}
      {tab === "users" && (
        <div style={{ ...shared.card }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Team Members ({users.length})</div>
          {users.length === 0
            ? <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>No users yet.</div>
            : users.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.greyBorder}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {u.photoURL
                      ? <img src={u.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, color: C.green }}>{(u.displayName||"U")[0].toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.head, fontWeight: 600, fontSize: 13 }}>{u.displayName || "—"}</div>
                    <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>{u.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontFamily: F.head, fontSize: 10, color: C.grey }}>
                      {allSubs.filter(s=>s.userId===u.uid).length} submissions
                    </span>
                    {u.isAdmin && <span style={{ fontFamily: F.head, fontSize: 10, background: C.greenLight, color: C.green, padding: "2px 8px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.08em" }}>ADMIN</span>}
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {preview && (
        <PreviewModal
          type={preview.sub.type}
          content={preview.sub.generatedContent}
          data={preview.sub.data}
          photo1={preview.sub.photo1Data || null}
          photo2={preview.sub.photo2Data || null}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
