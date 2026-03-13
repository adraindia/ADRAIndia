import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";
import PreviewModal from "../components/PreviewModal.jsx";

export default function Library({ user }) {
  const navigate                  = useNavigate();
  const [subs,      setSubs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [regenning, setRegenning] = useState(null);
  const [regenOut,  setRegenOut]  = useState({});
  const [copied,    setCopied]    = useState(false);
  const [preview,   setPreview]   = useState(null);

  // Filter & sort state
  const [statusFilter,  setStatusFilter]  = useState("all");       // all | draft | finalized
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortOrder,     setSortOrder]     = useState("newest");     // newest | oldest
  const [showFilters,   setShowFilters]   = useState(false);

  useEffect(() => { fetchSubs(); }, [user]);

  async function fetchSubs() {
    setLoading(true);
    try {
      const q = query(collection(db, "submissions"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setSubs(items);
    } catch (e) { console.error("Fetch error:", e); }
    setLoading(false);
  }

  async function regenerate(sub) {
    setRegenning(sub.id);
    setRegenOut(p => ({ ...p, [sub.id]: "" }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: sub.type, data: sub.data, photoBase64: sub.photo1Base64 || null, photoMime: "image/jpeg" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRegenOut(p => ({ ...p, [sub.id]: json.content }));
    } catch (e) { setRegenOut(p => ({ ...p, [sub.id]: "Error: " + e.message })); }
    setRegenning(null);
  }

  async function finalizeFromLibrary(sub) {
    const newContent = regenOut[sub.id] || sub.generatedContent;
    if (!newContent) { alert("Generate content first before finalizing."); return; }
    try {
      await updateDoc(doc(db, "submissions", sub.id), { status: "finalized", generatedContent: newContent, updatedAt: serverTimestamp() });
      fetchSubs();
    } catch (e) { alert("Update failed: " + e.message); }
  }

  async function deleteSub(id) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    try { await deleteDoc(doc(db, "submissions", id)); fetchSubs(); }
    catch (e) { alert("Delete failed: " + e.message); }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  // Unique project names for filter dropdown
  const projectNames = ["all", ...Array.from(new Set(subs.map(s => s.data?.projectName).filter(Boolean)))];

  // Apply filters + sort
  let displayed = [...subs];
  if (statusFilter !== "all")  displayed = displayed.filter(s => s.status === statusFilter);
  if (projectFilter !== "all") displayed = displayed.filter(s => s.data?.projectName === projectFilter);
  if (sortOrder === "oldest")  displayed.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  else                         displayed.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (projectFilter !== "all" ? 1 : 0) + (sortOrder !== "newest" ? 1 : 0);

  if (loading) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: F.head, color: C.grey }}>
      Loading submissions...
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px" }}>

      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black }}>My Submissions</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 2 }}>
            {subs.length} total · {subs.filter(s => s.status === "finalized").length} finalized
            {activeFilterCount > 0 && <span style={{ color: C.green, marginLeft: 8 }}>· {displayed.length} shown</span>}
          </div>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${activeFilterCount > 0 ? C.green : C.greyBorder}`, background: activeFilterCount > 0 ? C.greenLight : C.white, color: activeFilterCount > 0 ? C.green : C.grey, fontFamily: F.head, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <span>⚙️</span>
          Filter &amp; Sort
          {activeFilterCount > 0 && <span style={{ background: C.green, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", marginLeft: 2 }}>{activeFilterCount}</span>}
        </button>
      </div>

      {/* ── Filter / sort panel ─────────────────────────────────────────── */}
      {showFilters && (
        <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Status */}
          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 6 }}>STATUS</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "draft", "finalized"].map(f => (
                <button key={f}
                  style={{ padding: "5px 13px", borderRadius: 20, border: `1px solid ${statusFilter === f ? C.green : C.greyBorder}`, background: statusFilter === f ? C.greenLight : C.white, color: statusFilter === f ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: statusFilter === f ? 700 : 400, cursor: "pointer", textTransform: "capitalize" }}
                  onClick={() => setStatusFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          {/* Project */}
          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 6 }}>PROJECT</div>
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              style={{ ...shared.inputBase, padding: "5px 10px", fontSize: 12, minWidth: 180 }}>
              {projectNames.map(p => (
                <option key={p} value={p}>{p === "all" ? "All projects" : p}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 6 }}>SORT BY DATE</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([val, label]) => (
                <button key={val}
                  style={{ padding: "5px 13px", borderRadius: 20, border: `1px solid ${sortOrder === val ? C.green : C.greyBorder}`, background: sortOrder === val ? C.greenLight : C.white, color: sortOrder === val ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: sortOrder === val ? 700 : 400, cursor: "pointer" }}
                  onClick={() => setSortOrder(val)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setStatusFilter("all"); setProjectFilter("all"); setSortOrder("newest"); }}
              style={{ padding: "5px 13px", borderRadius: 20, border: `1px solid #FCA5A5`, background: "#FEF2F2", color: "#DC2626", fontFamily: F.head, fontSize: 11, cursor: "pointer" }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── List ───────────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: C.grey }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontFamily: F.head, fontSize: 14 }}>No submissions match your filters</div>
          <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 6 }}>Try clearing the filters above</div>
        </div>
      ) : displayed.map(sub => {
        const isOpen     = expanded === sub.id;
        const currentOut = regenOut[sub.id] || sub.generatedContent;
        const ts         = sub.createdAt?.toDate?.() || new Date();
        const projectName   = sub.data?.projectName   || "Untitled Project";
        const beneficiary   = sub.data?.beneficiary   || "";
        const submitterName = sub.data?.submitterName  || "";
        const location      = sub.data?.location || sub.data?.geography || "";

        return (
          <div key={sub.id} style={{ marginBottom: 14 }}>
            <div
              style={{ ...shared.card, marginBottom: 0, cursor: "pointer", borderBottomLeftRadius: isOpen ? 0 : 6, borderBottomRightRadius: isOpen ? 0 : 6, padding: "16px 20px" }}
              onClick={() => setExpanded(isOpen ? null : sub.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>

                  {/* Tags row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={shared.tag(sub.type)}>{TYPE_LABELS[sub.type]}</span>
                    <span style={{ fontFamily: F.head, fontSize: 10, background: sub.status === "finalized" ? C.greenLight : "#FEF3E2", color: sub.status === "finalized" ? C.green : "#B45309", padding: "2px 8px", borderRadius: 2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {sub.status}
                    </span>
                    {(sub.photo1Data || sub.photo2Data) && <span style={{ fontSize: 11 }}>📷</span>}
                    <span style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>
                      {ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Primary title: Project + Beneficiary */}
                  <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 16, color: C.black, marginBottom: 2, lineHeight: 1.3 }}>
                    {projectName}
                    {beneficiary && (
                      <span style={{ fontWeight: 400, color: C.grey, fontSize: 14 }}> — {beneficiary}</span>
                    )}
                  </div>

                  {/* Sub-heading: Project · Submitter · Location */}
                  <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 3 }}>
                    {submitterName && <span>{submitterName}</span>}
                    {submitterName && location && <span style={{ color: C.greyBorder }}>·</span>}
                    {location && <span>{location}</span>}
                  </div>
                </div>
                <div style={{ fontFamily: F.head, fontSize: 16, color: C.grey, marginTop: 4 }}>{isOpen ? "▲" : "▼"}</div>
              </div>
            </div>

            {isOpen && (
              <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderTop: "none", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, padding: "20px 24px" }}>
                {(sub.photo1Data || sub.photo2Data) && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    {sub.photo1Data && <img src={sub.photo1Data} alt="Photo 1" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
                    {sub.photo2Data && <img src={sub.photo2Data} alt="Photo 2" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  {sub.status === "draft" && (
                    <button style={{ ...shared.btnGreen, background: "#1D4ED8" }} onClick={() => navigate(`/submit?edit=${sub.id}`)}>
                      ✏️ Edit Draft
                    </button>
                  )}
                  <button style={shared.btnGreen} onClick={() => regenerate(sub)} disabled={regenning === sub.id}>
                    {regenning === sub.id ? "Writing..." : "Regenerate"}
                  </button>
                  {currentOut && <>
                    <button style={shared.btnOutline} onClick={() => copyText(currentOut)}>{copied ? "Copied!" : "Copy text"}</button>
                    <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB" }}
                      onClick={() => setPreview({ sub, content: currentOut })}>
                      📄 Preview &amp; Download
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

      {preview && (
        <PreviewModal
          type={preview.sub.type}
          content={preview.content}
          data={preview.sub.data}
          photo1={preview.sub.photo1Data || null}
          photo2={preview.sub.photo2Data || null}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
