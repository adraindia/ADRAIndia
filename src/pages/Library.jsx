import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";
import { downloadDocx } from "../utils/docxExport.js";

export default function Library({ user }) {
  const [subs,      setSubs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [regenning, setRegenning] = useState(null);
  const [regenOut,  setRegenOut]  = useState({});
  const [copied,    setCopied]    = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [dlLoading, setDlLoading] = useState(null);

  useEffect(() => { fetchSubs(); }, [user]);

  async function fetchSubs() {
    setLoading(true);
    try {
      // No orderBy — avoids composite index requirement in Firestore
      const q = query(
        collection(db, "submissions"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first client-side
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setSubs(items);
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
        body: JSON.stringify({
          type:        sub.type,
          data:        sub.data,
          photoBase64: sub.photo1Base64 || null,
          photoMime:   "image/jpeg",
        }),
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

  async function handleDownload(sub) {
    const content = regenOut[sub.id] || sub.generatedContent;
    if (!content) { alert("Generate content first before downloading."); return; }
    setDlLoading(sub.id);
    try {
      await downloadDocx({ type: sub.type, content, data: sub.data, photo1: sub.photo1Data || null, photo2: sub.photo2Data || null });
    } catch (e) { alert("Download failed: " + e.message); }
    setDlLoading(null);
  }

  const filtered = filter === "all" ? subs : subs.filter(s => s.status === filter);

  if (loading) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: F.head, color: C.grey }}>
      Loading submissions...
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black }}>My Submissions</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 2 }}>
            {subs.length} total · {subs.filter(s => s.status === "finalized").length} finalized
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "draft", "finalized"].map(f => (
            <button key={f}
              style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.green : C.greyBorder}`, background: filter === f ? C.greenLight : C.white, color: filter === f ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: filter === f ? 700 : 400, cursor: "pointer", textTransform: "capitalize" }}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: C.grey }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontFamily: F.head, fontSize: 14 }}>No {filter !== "all" ? filter : ""} submissions yet</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 6 }}>Go to Submit Data to create one</div>
        </div>
      ) : filtered.map(sub => {
        const isOpen     = expanded === sub.id;
        const currentOut = regenOut[sub.id] || sub.generatedContent;
        const ts         = sub.createdAt?.toDate?.() || new Date();

        return (
          <div key={sub.id} style={{ marginBottom: 16 }}>
            <div style={{ ...shared.card, marginBottom: 0, cursor: "pointer", borderBottomLeftRadius: isOpen ? 0 : 6, borderBottomRightRadius: isOpen ? 0 : 6 }}
              onClick={() => setExpanded(isOpen ? null : sub.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={shared.tag(sub.type)}>{TYPE_LABELS[sub.type]}</span>
                    <span style={{ fontFamily: F.head, fontSize: 10, background: sub.status === "finalized" ? C.greenLight : "#FEF3E2", color: sub.status === "finalized" ? C.green : "#B45309", padding: "2px 8px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {sub.status}
                    </span>
                    {(sub.photo1Data || sub.photo2Data) && <span style={{ fontSize: 12 }}>📷</span>}
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

            {isOpen && (
              <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderTop: "none", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: "20px 28px" }}>
                {(sub.photo1Data || sub.photo2Data) && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    {sub.photo1Data && <img src={sub.photo1Data} alt="Photo 1" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
                    {sub.photo2Data && <img src={sub.photo2Data} alt="Photo 2" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <button style={shared.btnGreen} onClick={() => regenerate(sub)} disabled={regenning === sub.id}>
                    {regenning === sub.id ? "Writing..." : "Regenerate"}
                  </button>
                  {currentOut && <>
                    <button style={shared.btnOutline} onClick={() => copyText(currentOut)}>{copied ? "Copied!" : "Copy text"}</button>
                    <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB" }}
                      onClick={() => handleDownload(sub)} disabled={dlLoading === sub.id}>
                      {dlLoading === sub.id ? "Preparing..." : "Download .docx"}
                    </button>
                    {sub.status !== "finalized" && (
                      <button style={{ ...shared.btnGreen, background: C.greenDark }} onClick={() => finalizeFromLibrary(sub)}>Finalize</button>
                    )}
                  </>}
                  <button style={shared.btnRed} onClick={() => deleteSub(sub.id)}>Delete</button>
                </div>

                {regenning === sub.id && <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>Writing...</div>}
                {currentOut && regenning !== sub.id && (
                  <div style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "18px 20px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                    {currentOut}
                  </div>
                )}
                {!currentOut && regenning !== sub.id && (
                  <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>No content yet — click Regenerate.</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
