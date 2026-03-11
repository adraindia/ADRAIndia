import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";

export default function Library({ user }) {
  const [subs,       setSubs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(null);
  const [regenning,  setRegenning]  = useState(null);
  const [regenOut,   setRegenOut]   = useState({});
  const [copied,     setCopied]     = useState(false);
  const [filter,     setFilter]     = useState("all"); // all | draft | finalized

  useEffect(() => { fetchSubs(); }, [user]);

  async function fetchSubs() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "submissions"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setSubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }

  async function regenerate(sub) {
    setRegenning(sub.id);
    setRegenOut(p => ({ ...p, [sub.id]: "" }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: sub.type, data: sub.data, photoBase64: null, photoMime: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRegenOut(p => ({ ...p, [sub.id]: json.content }));
    } catch (e) {
      setRegenOut(p => ({ ...p, [sub.id]: "Error: " + e.message }));
    }
    setRegenning(null);
  }

  async function finalizeFromLibrary(sub) {
    const newContent = regenOut[sub.id] || sub.generatedContent;
    if (!newContent) { alert("Generate content first before finalizing."); return; }
    try {
      await updateDoc(doc(db, "submissions", sub.id), {
        status: "finalized",
        generatedContent: newContent,
        updatedAt: serverTimestamp(),
      });
      fetchSubs();
    } catch (e) { alert("Update failed: " + e.message); }
  }

  async function deleteSub(id) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "submissions", id));
      fetchSubs();
    } catch (e) { alert("Delete failed: " + e.message); }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const filtered = filter === "all" ? subs : subs.filter(s => s.status === filter);

  if (loading) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: F.head, color: C.grey }}>
      Loading submissions…
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black }}>My Submissions</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 2 }}>{subs.length} total · {subs.filter(s=>s.status==="finalized").length} finalized</div>
        </div>
        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8 }}>
          {["all","draft","finalized"].map(f => (
            <button key={f}
              style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter===f ? C.green : C.greyBorder}`, background: filter===f ? C.greenLight : C.white, color: filter===f ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: filter===f ? 700 : 400, cursor: "pointer", textTransform: "capitalize" }}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: C.grey }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontFamily: F.head, fontSize: 14 }}>No {filter !== "all" ? filter : ""} submissions yet</div>
        </div>
      ) : (
        filtered.map(sub => {
          const isOpen = expanded === sub.id;
          const currentOutput = regenOut[sub.id] || sub.generatedContent;
          const ts = sub.createdAt?.toDate?.() || new Date();

          return (
            <div key={sub.id} style={{ marginBottom: 16 }}>
              {/* Submission card */}
              <div style={{ ...shared.card, marginBottom: 0, cursor: "pointer", borderBottomLeftRadius: isOpen ? 0 : 6, borderBottomRightRadius: isOpen ? 0 : 6 }}
                onClick={() => setExpanded(isOpen ? null : sub.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={shared.tag(sub.type)}>{TYPE_LABELS[sub.type]}</span>
                      <span style={{ fontFamily: F.head, fontSize: 11, background: sub.status==="finalized" ? C.greenLight : "#FEF3E2", color: sub.status==="finalized" ? C.green : "#B45309", padding: "2px 8px", borderRadius: 2, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {sub.status}
                      </span>
                      {sub.photoData && <span style={{ fontFamily: F.head, fontSize: 10, color: C.green }}>📷</span>}
                      <span style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>
                        {ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                      {sub.data?.projectName || "Untitled Project"}
                    </div>
                    <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey }}>
                      {sub.data?.submitterName} · {sub.data?.location || sub.data?.geography || ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: F.head, fontSize: 18, color: C.grey }}>{isOpen ? "▲" : "▼"}</div>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isOpen && (
                <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderTop: "none", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: "20px 28px" }}>
                  {sub.photoData && (
                    <img src={sub.photoData} alt="Field" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 5, marginBottom: 16 }} />
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    <button style={shared.btnGreen} onClick={() => regenerate(sub)} disabled={regenning === sub.id}>
                      {regenning === sub.id ? "⏳ Writing…" : "✨ Regenerate"}
                    </button>
                    {currentOutput && (
                      <>
                        <button style={shared.btnOutline} onClick={() => copyText(currentOutput)}>{copied ? "✓ Copied!" : "Copy"}</button>
                        {sub.status !== "finalized" && (
                          <button style={{ ...shared.btnGreen, background: C.greenDark }} onClick={() => finalizeFromLibrary(sub)}>
                            ✅ Finalize
                          </button>
                        )}
                      </>
                    )}
                    <button style={shared.btnRed} onClick={() => deleteSub(sub.id)}>Delete</button>
                  </div>

                  {/* Generated content */}
                  {regenning === sub.id && (
                    <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>Writing…</div>
                  )}
                  {currentOutput && regenning !== sub.id && (
                    <div style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "18px 20px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                      {currentOutput}
                    </div>
                  )}
                  {!currentOutput && regenning !== sub.id && (
                    <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>No content generated yet — click Regenerate to produce content from this submission.</div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
