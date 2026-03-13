import { useState, useEffect } from "react";
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

  const [statusFilter,  setStatusFilter]  = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortOrder,     setSortOrder]     = useState("newest");
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

  const projectNames = ["all", ...Array.from(new Set(subs.map(s => s.data?.projectName).filter(Boolean)))];
  let displayed = [...subs];
  if (statusFilter !== "all")  displayed = displayed.filter(s => s.status === statusFilter);
  if (projectFilter !== "all") displayed = displayed.filter(s => s.data?.projectName === projectFilter);
  if (sortOrder === "oldest")  displayed.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  else                         displayed.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (projectFilter !== "all" ? 1 : 0) + (sortOrder !== "newest" ? 1 : 0);

  if (loading) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <div style={{ fontFamily: F.head, fontSize: 14, color: C.grey }}>Loading your submissions…</div>
    </div>
  );

  return (
    <div className="page-wrap">

      {/* ── Page header ──────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: F.head, fontWeight: 800, fontSize: 22, color: C.black, margin: 0, lineHeight: 1.2 }}>
            My Submissions
          </h1>
          <p style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginTop: 4, marginBottom: 0 }}>
            {subs.length} total · {subs.filter(s => s.status === "finalized").length} finalized
            {activeFilterCount > 0 && <span style={{ color: C.green, marginLeft: 6 }}>· {displayed.length} shown</span>}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "999px", border: `1.5px solid ${activeFilterCount > 0 ? C.green : C.greyBorder}`, background: activeFilterCount > 0 ? C.greenLight : C.white, color: activeFilterCount > 0 ? C.green : C.grey, fontFamily: F.head, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          <span>⚙️</span>
          <span className="hide-mobile">Filter & Sort</span>
          {activeFilterCount > 0 && (
            <span style={{ background: C.green, color: "#fff", borderRadius: "999px", fontSize: 10, padding: "1px 7px" }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Filter panel ─────────────────────────────────────── */}
      {showFilters && (
        <div style={{ padding: "18px 20px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>

          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 8 }}>STATUS</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "draft", "finalized"].map(f => (
                <button key={f}
                  style={{ padding: "6px 14px", borderRadius: "999px", border: `1.5px solid ${statusFilter === f ? C.green : C.greyBorder}`, background: statusFilter === f ? C.greenLight : C.white, color: statusFilter === f ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: statusFilter === f ? 700 : 400, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s" }}
                  onClick={() => setStatusFilter(f)}>{f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 8 }}>PROJECT</div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              style={{ ...shared.inputBase, padding: "6px 12px", fontSize: 12, minWidth: 160, height: 36 }}>
              {projectNames.map(p => (
                <option key={p} value={p}>{p === "all" ? "All projects" : p}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontFamily: F.head, fontSize: 10, fontWeight: 700, color: C.grey, letterSpacing: "0.08em", marginBottom: 8 }}>SORT</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["newest", "Newest"], ["oldest", "Oldest"]].map(([val, label]) => (
                <button key={val}
                  style={{ padding: "6px 14px", borderRadius: "999px", border: `1.5px solid ${sortOrder === val ? C.green : C.greyBorder}`, background: sortOrder === val ? C.greenLight : C.white, color: sortOrder === val ? C.green : C.grey, fontFamily: F.head, fontSize: 11, fontWeight: sortOrder === val ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}
                  onClick={() => setSortOrder(val)}>{label}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setStatusFilter("all"); setProjectFilter("all"); setSortOrder("newest"); }}
              style={{ padding: "6px 14px", borderRadius: "999px", border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontFamily: F.head, fontSize: 11, cursor: "pointer" }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 24px" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 16, color: C.black, marginBottom: 6 }}>
            {subs.length === 0 ? "No submissions yet" : "No submissions match your filters"}
          </div>
          <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey }}>
            {subs.length === 0 ? "Head to Submit Data to create your first story." : "Try clearing the filters above."}
          </div>
        </div>
      ) : displayed.map(sub => {
        const isOpen       = expanded === sub.id;
        const currentOut   = regenOut[sub.id] || sub.generatedContent;
        const ts           = sub.createdAt?.toDate?.() || new Date();
        const projectName  = sub.data?.projectName  || "Untitled Project";
        const beneficiary  = sub.data?.beneficiary  || "";
        const submitterName= sub.data?.submitterName || "";
        const location     = sub.data?.location || sub.data?.geography || "";
        const rawContent   = regenOut[sub.id] || sub.generatedContent || "";
        const generatedTitle = rawContent.split("\n").map(l => l.trim()).find(l => l.length > 0) || "";
        const isFinalized  = sub.status === "finalized";

        return (
          <div key={sub.id} className="sub-card" style={{ marginBottom: 14 }}>

            {/* ── Card header (always visible) ─────────────── */}
            <div
              style={{ padding: "16px 18px", cursor: "pointer" }}
              onClick={() => setExpanded(isOpen ? null : sub.id)}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Tag row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={shared.tag(sub.type)}>{TYPE_LABELS[sub.type]}</span>
                    <span style={{ fontFamily: F.head, fontSize: 10, padding: "2px 9px", borderRadius: "999px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", ...(isFinalized ? { background: C.greenLight, color: C.green } : { background: "#FEF3E2", color: "#B45309" }) }}>
                      {sub.status}
                    </span>
                    {(sub.photo1Data || sub.photo2Data) && (
                      <span style={{ fontSize: 12 }}>📷</span>
                    )}
                    <span style={{ fontFamily: F.head, fontSize: 11, color: C.grey, marginLeft: "auto" }}>
                      {ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Primary title */}
                  <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 15, color: C.black, lineHeight: 1.35, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {generatedTitle || (beneficiary ? `${beneficiary}'s Story` : projectName)}
                    {beneficiary && generatedTitle && (
                      <span style={{ fontWeight: 500, color: C.grey, fontSize: 13 }}> — {beneficiary}</span>
                    )}
                  </div>

                  {/* Sub-heading */}
                  <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: C.green, fontWeight: 600 }}>{projectName}</span>
                    {submitterName && <><span style={{ color: C.greyBorder }}>·</span><span>{submitterName}</span></>}
                    {location && <><span style={{ color: C.greyBorder }}>·</span><span>{location}</span></>}
                  </div>
                </div>

                {/* Chevron */}
                <div style={{ color: C.grey, fontSize: 12, marginTop: 2, flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
              </div>
            </div>

            {/* ── Expanded panel ───────────────────────────── */}
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.greyBorder}`, background: C.surface, padding: "20px 18px" }}>

                {/* Photos */}
                {(sub.photo1Data || sub.photo2Data) && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                    {sub.photo1Data && <img src={sub.photo1Data} alt="Photo 1" style={{ flex: 1, maxWidth: "50%", maxHeight: 220, objectFit: "contain", borderRadius: 12, background: C.greyLight }} />}
                    {sub.photo2Data && <img src={sub.photo2Data} alt="Photo 2" style={{ flex: 1, maxWidth: "50%", maxHeight: 220, objectFit: "contain", borderRadius: 12, background: C.greyLight }} />}
                  </div>
                )}

                {/* Action buttons */}
                <div className="btn-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  {sub.status === "draft" && (
                    <button className="btn-green"
                      className="btn-primary" style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #1e40af 100%)", boxShadow: "0 4px 14px rgba(29,78,216,0.25)", fontSize: 12, padding: "9px 18px" }}
                      onClick={() => navigate(`/submit?edit=${sub.id}`)}>
                      ✏️ Edit Draft
                    </button>
                  )}
                  <button className="btn-outline" style={{ ...shared.btnOutline, fontSize: 12, padding: "9px 18px" }}
                    onClick={() => regenerate(sub)} disabled={regenning === sub.id}>
                    {regenning === sub.id ? "✍️ Writing…" : "↻ Regenerate"}
                  </button>
                  {currentOut && (
                    <>
                      <button className="btn-outline" style={{ ...shared.btnOutline, fontSize: 12, padding: "9px 18px" }}
                        onClick={() => copyText(currentOut)}>
                        {copied ? "✓ Copied!" : "Copy text"}
                      </button>
                      <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB", fontSize: 12, padding: "9px 18px" }}
                        onClick={() => setPreview({ sub, content: currentOut })}>
                        📄 Preview & Download
                      </button>
                      {!isFinalized && (
                        <button className="btn-green" style={{ ...shared.btnGreen, fontSize: 12, padding: "9px 18px" }}
                          onClick={() => finalizeFromLibrary(sub)}>
                          ✓ Finalize
                        </button>
                      )}
                    </>
                  )}
                  <button className="btn-red" style={{ ...shared.btnRed, fontSize: 11, padding: "9px 14px", marginLeft: "auto" }}
                    onClick={() => deleteSub(sub.id)}>
                    Delete
                  </button>
                </div>

                {/* Generated content */}
                {regenning === sub.id && (
                  <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey, padding: "12px 0" }}>
                    ✍️ Writing your {TYPE_LABELS[sub.type]}…
                  </div>
                )}
                {currentOut && regenning !== sub.id && (
                  <div style={{ background: C.white, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 12, padding: "18px 20px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                    {currentOut}
                  </div>
                )}
                {!currentOut && regenning !== sub.id && (
                  <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey, fontStyle: "italic" }}>
                    No content generated yet — click Regenerate to create the story.
                  </div>
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
