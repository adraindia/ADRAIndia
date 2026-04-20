import { useState, useEffect } from "react";
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";
import PreviewModal from "../components/PreviewModal.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
function ts(sub) { return sub.createdAt?.toDate?.() || new Date(0); }
function fmtDate(d) { return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); }

function Tag({ type }) {
  return <span style={{ ...shared.tag(type), marginRight:6 }}>{TYPE_LABELS[type]}</span>;
}

function StatusBadge({ status }) {
  const fin = status === "finalized";
  return (
    <span style={{ fontFamily:F.head, fontSize:10, background:fin?C.greenLight:"#FEF3E2", color:fin?C.green:"#B45309", padding:"2px 8px", borderRadius:2, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
      {status}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SUBMISSIONS TAB
// ════════════════════════════════════════════════════════════════════════════
function SubmissionsTab({ allSubs, fetchAll, user, statusFilter, setStatusFilter }) {
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [submitterFilter, setSubmitterFilter] = useState("all");
  const [sortOrder,     setSortOrder]     = useState("newest");
  const [showFilters,   setShowFilters]   = useState(false);
  const [expanded,      setExpanded]      = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [copied,        setCopied]        = useState(false);

  const projectNames   = ["all", ...Array.from(new Set(allSubs.map(s => s.data?.projectName).filter(Boolean))).sort()];
  const submitterNames = ["all", ...Array.from(new Set(allSubs.map(s => s.userName || s.userEmail).filter(Boolean))).sort()];

  let filtered = [...allSubs];
  if (statusFilter    !== "all") filtered = filtered.filter(s => s.status === statusFilter);
  if (typeFilter      !== "all") filtered = filtered.filter(s => s.type   === typeFilter);
  if (projectFilter   !== "all") filtered = filtered.filter(s => s.data?.projectName === projectFilter);
  if (submitterFilter !== "all") filtered = filtered.filter(s => (s.userName || s.userEmail) === submitterFilter);
  if (sortOrder === "oldest") filtered.sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  else                        filtered.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const activeCount = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (projectFilter !== "all" ? 1 : 0) + (submitterFilter !== "all" ? 1 : 0) + (sortOrder !== "newest" ? 1 : 0);

  async function toggleStatus(sub) {
    const n = sub.status === "finalized" ? "draft" : "finalized";
    try { await updateDoc(doc(db,"submissions",sub.id),{status:n,updatedAt:serverTimestamp()}); fetchAll(); }
    catch(e) { alert("Update failed: " + e.message); }
  }

  async function adminDelete(id) {
    if (!confirm("Delete this submission permanently?")) return;
    try { await deleteDoc(doc(db,"submissions",id)); fetchAll(); }
    catch(e) { alert("Delete failed: " + e.message); }
  }

  return (
    <>
      {/* ── Filter bar ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10, flexWrap:"wrap" }}>
        <div style={{ fontFamily:F.head, fontSize:13, color:C.grey }}>
          <strong style={{ color:C.black }}>{filtered.length}</strong> of {allSubs.length} submissions
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:"999px", border:`1.5px solid ${activeCount > 0 ? C.green : C.greyBorder}`, background:activeCount > 0 ? C.greenLight : C.white, color:activeCount > 0 ? C.green : C.grey, fontFamily:F.head, fontSize:12, fontWeight:600, cursor:"pointer" }}>
          ⚙️ Filter & Sort
          {activeCount > 0 && <span style={{ background:C.green, color:"#fff", borderRadius:"999px", fontSize:10, padding:"1px 7px" }}>{activeCount}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ padding:"18px 20px", marginBottom:18, display:"flex", gap:18, flexWrap:"wrap", alignItems:"flex-end" }}>

          {/* Status */}
          <div>
            <div style={{ fontFamily:F.head, fontSize:10, fontWeight:700, color:C.grey, letterSpacing:"0.08em", marginBottom:7 }}>STATUS</div>
            <div style={{ display:"flex", gap:6 }}>
              {["all","draft","finalized"].map(f => (
                <button key={f}
                  style={{ padding:"5px 13px", borderRadius:"999px", border:`1.5px solid ${statusFilter===f?C.green:C.greyBorder}`, background:statusFilter===f?C.greenLight:C.white, color:statusFilter===f?C.green:C.grey, fontFamily:F.head, fontSize:11, fontWeight:statusFilter===f?700:400, cursor:"pointer", textTransform:"capitalize", transition:"all 0.15s" }}
                  onClick={() => setStatusFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <div style={{ fontFamily:F.head, fontSize:10, fontWeight:700, color:C.grey, letterSpacing:"0.08em", marginBottom:7 }}>TYPE</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[["all","All"],["case_story","Case Story"],["newsletter","Newsletter"],["report","Impact Report"]].map(([val,label]) => (
                <button key={val}
                  style={{ padding:"5px 13px", borderRadius:"999px", border:`1.5px solid ${typeFilter===val?C.green:C.greyBorder}`, background:typeFilter===val?C.greenLight:C.white, color:typeFilter===val?C.green:C.grey, fontFamily:F.head, fontSize:11, fontWeight:typeFilter===val?700:400, cursor:"pointer", transition:"all 0.15s" }}
                  onClick={() => setTypeFilter(val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Project */}
          <div>
            <div style={{ fontFamily:F.head, fontSize:10, fontWeight:700, color:C.grey, letterSpacing:"0.08em", marginBottom:7 }}>PROJECT</div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              style={{ ...shared.inputBase, padding:"5px 10px", fontSize:12, height:34, minWidth:160 }}>
              {projectNames.map(p => <option key={p} value={p}>{p === "all" ? "All projects" : p}</option>)}
            </select>
          </div>

          {/* Submitter */}
          <div>
            <div style={{ fontFamily:F.head, fontSize:10, fontWeight:700, color:C.grey, letterSpacing:"0.08em", marginBottom:7 }}>SUBMITTED BY</div>
            <select value={submitterFilter} onChange={e => setSubmitterFilter(e.target.value)}
              style={{ ...shared.inputBase, padding:"5px 10px", fontSize:12, height:34, minWidth:160 }}>
              {submitterNames.map(n => <option key={n} value={n}>{n === "all" ? "All staff" : n}</option>)}
            </select>
          </div>

          {/* Sort */}
          <div>
            <div style={{ fontFamily:F.head, fontSize:10, fontWeight:700, color:C.grey, letterSpacing:"0.08em", marginBottom:7 }}>SORT</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["newest","Newest"],["oldest","Oldest"]].map(([val,label]) => (
                <button key={val}
                  style={{ padding:"5px 13px", borderRadius:"999px", border:`1.5px solid ${sortOrder===val?C.green:C.greyBorder}`, background:sortOrder===val?C.greenLight:C.white, color:sortOrder===val?C.green:C.grey, fontFamily:F.head, fontSize:11, fontWeight:sortOrder===val?700:400, cursor:"pointer", transition:"all 0.15s" }}
                  onClick={() => setSortOrder(val)}>{label}
                </button>
              ))}
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setProjectFilter("all"); setSubmitterFilter("all"); setSortOrder("newest"); }}
              style={{ padding:"5px 13px", borderRadius:"999px", border:"1.5px solid #FCA5A5", background:"#FEF2F2", color:"#DC2626", fontFamily:F.head, fontSize:11, cursor:"pointer" }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {filtered.length === 0
        ? <div style={{ textAlign:"center", padding:"40px", color:C.grey, fontFamily:F.head }}>No submissions matching filter.</div>
        : filtered.map(sub => {
          const isOpen = expanded === sub.id;
          return (
            <div key={sub.id} style={{ marginBottom:12 }}>
              <div style={{ ...shared.card, marginBottom:0, borderBottomLeftRadius:isOpen?0:6, borderBottomRightRadius:isOpen?0:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => setExpanded(isOpen?null:sub.id)}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                      <Tag type={sub.type} />
                      <StatusBadge status={sub.status} />
                      {(sub.photo1Data||sub.photo2Data) && <span style={{ fontSize:11 }}>📷</span>}
                      {sub.consentBase64 && <span style={{ fontFamily:F.head, fontSize:10, background:"#EEF2FF", color:"#3730A3", padding:"2px 7px", borderRadius:2, fontWeight:700 }}>CONSENT</span>}
                    </div>
                    {(() => {
                      const rawContent = sub.generatedContent || "";
                      const genTitle = rawContent.split("\n").map(l => l.trim()).find(l => l.length > 0) || "";
                      const beneficiary = sub.data?.beneficiary || "";
                      return (
                        <div style={{ marginBottom:3 }}>
                          <div style={{ fontFamily:F.head, fontWeight:800, fontSize:14, color:C.black, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>
                            {genTitle || sub.data?.projectName || "Untitled"}
                          </div>
                          {beneficiary && genTitle && (
                            <div style={{ fontFamily:F.head, fontWeight:600, fontSize:12, color:C.green, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              👤 {beneficiary}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {sub.data?.projectName && <span style={{ color:C.green, fontWeight:600, marginRight:4 }}>{sub.data.projectName}</span>}
                      {sub.type==="case_story" && sub.data?.beneficiary && !sub.generatedContent && <>{sub.data.beneficiary} · </>}
                      By {sub.userName || sub.userEmail} · {fmtDate(ts(sub))}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <button style={{ ...shared.btnOutline, fontSize:11, whiteSpace:"nowrap" }} onClick={() => toggleStatus(sub)}>
                      {sub.status==="finalized"?"↩ Unfinalize":"✅ Finalize"}
                    </button>
                    <button style={{ ...shared.btnRed, whiteSpace:"nowrap" }} onClick={() => adminDelete(sub.id)}>Delete</button>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ background:C.greyLight, border:`1px solid ${C.greyBorder}`, borderTop:"none", borderBottomLeftRadius:6, borderBottomRightRadius:6, padding:"18px 24px" }}>
                  {/* Field photos */}
                  {(sub.photo1Full||sub.photo1Data||sub.photo2Full||sub.photo2Data) && (
                    <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                      {(sub.photo1Full||sub.photo1Data) && <>
                        <img src={sub.photo1Data||sub.photo1Full} alt="Photo 1" style={{ maxWidth:"45%", maxHeight:200, borderRadius:8, objectFit:"contain", background:C.greyLight }} />
                        <a href={sub.photo1Full||sub.photo1Data} download={`photo1_${sub.id}.jpg`} style={{ ...shared.btnOutline, textDecoration:"none", fontSize:11, alignSelf:"flex-end" }}>
                          ⬇ Photo 1 (full res)
                        </a>
                      </>}
                      {(sub.photo2Full||sub.photo2Data) && <>
                        <img src={sub.photo2Data||sub.photo2Full} alt="Photo 2" style={{ maxWidth:"45%", maxHeight:200, borderRadius:8, objectFit:"contain", background:C.greyLight }} />
                        <a href={sub.photo2Full||sub.photo2Data} download={`photo2_${sub.id}.jpg`} style={{ ...shared.btnOutline, textDecoration:"none", fontSize:11, alignSelf:"flex-end" }}>
                          ⬇ Photo 2 (full res)
                        </a>
                      </>}
                    </div>
                  )}

                  {/* Consent & beneficiary record */}
                  {(sub.consentBase64 || sub.beneficiaryPhotoPreview) && (
                    <div style={{ background:C.white, border:`1px solid ${C.green}30`, borderRadius:5, padding:"12px 16px", marginBottom:14 }}>
                      <div style={{ fontFamily:F.head, fontSize:11, fontWeight:700, color:C.green, marginBottom:10 }}>📋 Consent & Beneficiary Record — {sub.beneficiaryName}</div>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>
                        {sub.beneficiaryPhotoPreview && (
                          <div style={{ textAlign:"center" }}>
                            <img src={sub.beneficiaryPhotoPreview} alt="Beneficiary" style={{ width:90, height:90, objectFit:"cover", borderRadius:4, display:"block" }} />
                            <a href={sub.beneficiaryPhotoPreview}
                              download={`beneficiary_${sub.beneficiaryName || sub.id}.jpg`}
                              style={{ ...shared.btnOutline, textDecoration:"none", fontSize:10, padding:"4px 8px", display:"inline-block", marginTop:6 }}>
                              ⬇ Download
                            </a>
                          </div>
                        )}
                        {sub.consentBase64 && (
                          <div>
                            <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginBottom:6 }}>Consent form: <strong>{sub.consentFileName}</strong></div>
                            {sub.consentMime?.startsWith("image/")
                              ? <img src={sub.consentBase64} alt="Consent" style={{ maxWidth:200, maxHeight:140, objectFit:"contain", borderRadius:4, border:`1px solid ${C.greyBorder}` }} />
                              : null
                            }
                            <div style={{ marginTop:8 }}>
                              <a href={sub.consentBase64} download={sub.consentFileName || "consent.pdf"}
                                style={{ ...shared.btnOutline, textDecoration:"none", fontSize:11 }}>
                                ⬇ Download Consent Form
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sub.generatedContent
                    ? <>
                        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginBottom:10 }}>
                          <button style={shared.btnOutline} onClick={() => { navigator.clipboard.writeText(sub.generatedContent); setCopied(true); setTimeout(()=>setCopied(false),2200); }}>
                            {copied?"✓ Copied!":"Copy"}
                          </button>
                          <button style={{ ...shared.btnOutline, borderColor:"#2563EB", color:"#2563EB" }} onClick={() => setPreview({ sub })}>
                            📄 Preview &amp; Download
                          </button>
                        </div>
                        <div style={{ background:C.white, border:`1px solid ${C.greyBorder}`, borderLeft:`4px solid ${C.green}`, borderRadius:4, padding:"16px 18px", whiteSpace:"pre-wrap", fontFamily:F.body, fontSize:14, lineHeight:1.85 }}>
                          {sub.generatedContent}
                        </div>
                      </>
                    : <div style={{ fontFamily:F.head, fontSize:13, color:C.grey }}>No generated content for this submission.</div>
                  }
                </div>
              )}
            </div>
          );
        })
      }

      {preview && (
        <PreviewModal
          type={preview.sub.type} content={preview.sub.generatedContent}
          data={preview.sub.data}
          photo1={preview.sub.photo1Data||null} photo2={preview.sub.photo2Data||null}
          onClose={() => setPreview(null)} />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MEDIA REPOSITORY TAB
// ════════════════════════════════════════════════════════════════════════════
function MediaTab({ allSubs }) {
  const [groupBy,    setGroupBy]    = useState("project"); // "project" | "beneficiary"
  const [expanded,   setExpanded]   = useState(null);
  const [lightbox,   setLightbox]   = useState(null); // { src, caption }

  // Build grouped media items from submissions that have photos
  const mediaItems = allSubs
    .filter(s => s.type === "case_story" && (s.photo1Data || s.photo2Data || s.beneficiaryPhotoPreview))
    .map(s => ({
      id:          s.id,
      project:     s.data?.projectName || "Unknown Project",
      beneficiary: s.beneficiaryName || s.data?.beneficiary || "Unknown",
      date:        ts(s),
      photos: [
        s.photo1Full  ? { preview:s.photo1Data,  full:s.photo1Full,  label:"Field Photo 1",      isBeneficiary:false } : null,
        s.photo2Full  ? { preview:s.photo2Data,  full:s.photo2Full,  label:"Field Photo 2",      isBeneficiary:false } : null,
        s.beneficiaryPhotoPreview ? { preview:s.beneficiaryPhotoPreview, full:s.beneficiaryPhotoPreview, label:"Beneficiary Portrait", isBeneficiary:true } : null,
      ].filter(Boolean),
    }))
    .filter(m => m.photos.length > 0);

  // Group
  const grouped = {};
  mediaItems.forEach(m => {
    const key = groupBy === "project" ? m.project : m.beneficiary;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });
  const groupKeys = Object.keys(grouped).sort();

  if (mediaItems.length === 0) {
    return (
      <div style={{ ...shared.card, textAlign:"center", padding:48, color:C.grey, fontFamily:F.head }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🖼️</div>
        No media yet. Photos submitted with case stories will appear here.
      </div>
    );
  }

  return (
    <>
      <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"center" }}>
        <span style={{ fontFamily:F.head, fontSize:12, color:C.grey }}>Group by:</span>
        {[["project","Project Name"],["beneficiary","Beneficiary Name"]].map(([k,l]) => (
          <button key={k}
            style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${groupBy===k?C.green:C.greyBorder}`, background:groupBy===k?C.greenLight:C.white, color:groupBy===k?C.green:C.grey, fontFamily:F.head, fontSize:11, fontWeight:groupBy===k?700:400, cursor:"pointer" }}
            onClick={() => { setGroupBy(k); setExpanded(null); }}>{l}</button>
        ))}
        <span style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginLeft:"auto" }}>{mediaItems.length} submissions · {mediaItems.reduce((s,m)=>s+m.photos.length,0)} photos total</span>
      </div>

      {groupKeys.map(gk => {
        const items = grouped[gk];
        const isOpen = expanded === gk;
        const totalPhotos = items.reduce((s,m)=>s+m.photos.length,0);
        return (
          <div key={gk} style={{ marginBottom:10 }}>
            <div style={{ ...shared.card, marginBottom:0, cursor:"pointer", borderBottomLeftRadius:isOpen?0:6, borderBottomRightRadius:isOpen?0:6 }}
              onClick={() => setExpanded(isOpen?null:gk)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:F.head, fontWeight:700, fontSize:15, color:C.black }}>{gk}</div>
                  <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginTop:2 }}>
                    {items.length} submission{items.length!==1?"s":""} · {totalPhotos} photo{totalPhotos!==1?"s":""}
                  </div>
                </div>
                <div style={{ fontFamily:F.head, fontSize:18, color:C.grey }}>{isOpen?"▲":"▼"}</div>
              </div>
            </div>

            {isOpen && (
              <div style={{ background:C.greyLight, border:`1px solid ${C.greyBorder}`, borderTop:"none", borderBottomLeftRadius:6, borderBottomRightRadius:6, padding:"20px 24px" }}>
                {items.map(m => (
                  <div key={m.id} style={{ marginBottom:24 }}>
                    <div style={{ fontFamily:F.head, fontSize:12, fontWeight:700, color:C.green, marginBottom:4 }}>
                      {groupBy==="project" ? `Beneficiary: ${m.beneficiary}` : `Project: ${m.project}`}
                      <span style={{ fontWeight:400, color:C.grey, marginLeft:12 }}>{fmtDate(m.date)}</span>
                    </div>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                      {m.photos.map((ph,i) => (
                        <div key={i} style={{ textAlign:"center" }}>
                          <div style={{ position:"relative", cursor:"pointer" }} onClick={() => setLightbox({ src:ph.full||ph.preview, caption:`${m.beneficiary} — ${ph.label}` })}>
                            <img src={ph.preview} alt={ph.label}
                              style={{ width:140, height:110, objectFit:"cover", borderRadius:4, border:`2px solid ${ph.isBeneficiary?"#7C3AED":C.greyBorder}`, display:"block" }} />
                            {ph.isBeneficiary && (
                              <span style={{ position:"absolute", top:4, left:4, background:"#7C3AED", color:"#fff", fontFamily:F.head, fontSize:9, fontWeight:700, padding:"2px 5px", borderRadius:2 }}>RECORD</span>
                            )}
                          </div>
                          <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginTop:4, marginBottom:6 }}>{ph.label}</div>
                          <a href={ph.full||ph.preview} download={`${m.project}_${m.beneficiary}_${ph.label.replace(/\s+/g,"_")}.jpg`}
                            style={{ ...shared.btnOutline, textDecoration:"none", fontSize:10, padding:"4px 10px" }}>
                            ⬇ Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox.src} alt="" style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:6 }} />
          <div style={{ fontFamily:F.head, fontSize:13, color:"rgba(255,255,255,0.8)" }}>{lightbox.caption}</div>
          <button style={{ ...shared.btnOutline, borderColor:"rgba(255,255,255,0.4)", color:"#fff", background:"transparent" }}
            onClick={() => setLightbox(null)}>Close</button>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  PROJECTS TAB
// ════════════════════════════════════════════════════════════════════════════
function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [name,     setName]     = useState("");
  const [year,     setYear]     = useState(new Date().getFullYear().toString());
  const [saving,   setSaving]   = useState(false);
  const [editId,   setEditId]   = useState(null);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "projects"));
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b) => (b.year||"").localeCompare(a.year||"") || (a.name||"").localeCompare(b.name||""));
      setProjects(list);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function saveProject() {
    if (!name.trim()) { alert("Please enter a project name."); return; }
    if (!year.trim()) { alert("Please enter a year."); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db,"projects",editId), { name:name.trim(), year:year.trim(), updatedAt:serverTimestamp() });
      } else {
        await addDoc(collection(db,"projects"), { name:name.trim(), year:year.trim(), createdAt:serverTimestamp() });
      }
      setName(""); setYear(new Date().getFullYear().toString()); setEditId(null);
      fetchProjects();
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  }

  async function deleteProject(id) {
    if (!confirm("Remove this project from the dropdown? Existing submissions are not affected.")) return;
    try { await deleteDoc(doc(db,"projects",id)); fetchProjects(); }
    catch(e) { alert("Delete failed: " + e.message); }
  }

  function startEdit(p) { setEditId(p.id); setName(p.name); setYear(p.year||""); }
  function cancelEdit()  { setEditId(null); setName(""); setYear(new Date().getFullYear().toString()); }

  return (
    <div style={shared.card}>
      <div style={{ fontFamily:F.head, fontWeight:700, fontSize:15, marginBottom:6 }}>Manage Projects</div>
      <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginBottom:22, lineHeight:1.6 }}>
        Projects added here appear in the <strong>Project Name dropdown</strong> on all submission forms.
        Format displayed to users: <strong>Name + Year</strong> (e.g. "PRECISE 2025").
      </div>

      {/* Add / Edit form */}
      <div style={{ background:C.greyLight, borderRadius:6, padding:"18px 20px", marginBottom:24, border:`1px solid ${C.greyBorder}` }}>
        <div style={{ fontFamily:F.head, fontSize:12, fontWeight:700, color:C.green, marginBottom:14 }}>
          {editId ? "✏️ Edit Project" : "➕ Add New Project"}
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap" }}>
          <div style={{ flex:2, minWidth:160 }}>
            <label style={shared.fieldLabel}>Project Name</label>
            <input style={shared.inputBase} placeholder="e.g. PRECISE" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:90 }}>
            <label style={shared.fieldLabel}>Year</label>
            <input style={shared.inputBase} placeholder="e.g. 2025" value={year} onChange={e=>setYear(e.target.value)} maxLength={4} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={shared.btnGreen} onClick={saveProject} disabled={saving}>
              {saving ? "Saving..." : editId ? "Update" : "Add Project"}
            </button>
            {editId && <button style={shared.btnOutline} onClick={cancelEdit}>Cancel</button>}
          </div>
        </div>
        {(name || editId) && (
          <div style={{ marginTop:10, fontFamily:F.head, fontSize:11, color:C.grey }}>
            Preview: <strong style={{ color:C.green }}>{[name.trim(), year.trim()].filter(Boolean).join(" ") || "…"}</strong>
          </div>
        )}
      </div>

      {/* Project list */}
      {loading
        ? <div style={{ fontFamily:F.head, fontSize:13, color:C.grey }}>Loading…</div>
        : projects.length === 0
        ? <div style={{ fontFamily:F.head, fontSize:13, color:C.grey, textAlign:"center", padding:24 }}>No projects yet. Add your first project above.</div>
        : projects.map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${C.greyBorder}` }}>
              <div>
                <div style={{ fontFamily:F.head, fontWeight:700, fontSize:14, color:C.black }}>{p.name} {p.year}</div>
                {p.createdAt && <div style={{ fontFamily:F.head, fontSize:10, color:C.grey }}>Added {fmtDate(p.createdAt.toDate?.() || new Date())}</div>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...shared.btnOutline, fontSize:11 }} onClick={() => startEdit(p)}>Edit</button>
                <button style={shared.btnRed} onClick={() => deleteProject(p.id)}>Remove</button>
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TEAM TAB
// ════════════════════════════════════════════════════════════════════════════
function TeamTab({ users, allSubs }) {
  return (
    <div style={shared.card}>
      <div style={{ fontFamily:F.head, fontWeight:700, fontSize:15, marginBottom:16 }}>Team Members ({users.length})</div>
      {users.length === 0
        ? <div style={{ fontFamily:F.head, fontSize:13, color:C.grey }}>No users yet.</div>
        : users.map(u => (
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0", borderBottom:`1px solid ${C.greyBorder}` }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:C.greenLight, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                {u.photoURL
                  ? <img src={u.photoURL} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontFamily:F.head, fontWeight:700, fontSize:15, color:C.green }}>{(u.displayName||"U")[0].toUpperCase()}</span>
                }
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:F.head, fontWeight:600, fontSize:13 }}>{u.displayName||"—"}</div>
                <div style={{ fontFamily:F.head, fontSize:11, color:C.grey }}>{u.email}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontFamily:F.head, fontSize:10, color:C.grey }}>{allSubs.filter(s=>s.userId===u.uid).length} submissions</span>
                {u.isAdmin && <span style={{ fontFamily:F.head, fontSize:10, background:C.greenLight, color:C.green, padding:"2px 8px", borderRadius:2, fontWeight:700, letterSpacing:"0.08em" }}>ADMIN</span>}
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Admin({ user }) {
  const [tab,          setTab]          = useState("submissions");
  const [statusFilter, setStatusFilter] = useState("all");
  const [allSubs,      setAllSubs]      = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);

  function goToTab(tabId, filter = "all") {
    setTab(tabId);
    setStatusFilter(filter);
  }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [subSnap, userSnap] = await Promise.all([
        getDocs(collection(db,"submissions")),
        getDocs(collection(db,"users")),
      ]);
      const items = subSnap.docs.map(d => ({ id:d.id, ...d.data() }));
      items.sort((a,b) => (b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
      setAllSubs(items);
      setUsers(userSnap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) { console.error("Admin fetch error:", e); }
    setLoading(false);
  }

  const csCount    = allSubs.filter(s=>s.type==="case_story").length;
  const mediaCount = allSubs.filter(s=>s.type==="case_story"&&(s.photo1Data||s.photo2Data||s.beneficiaryPhotoPreview)).length;

  const statCards = [
    { label:"Total Submissions", value:allSubs.length,                                        color:C.green,    onClick:() => goToTab("submissions","all") },
    { label:"Finalized",         value:allSubs.filter(s=>s.status==="finalized").length,       color:C.greenDark,onClick:() => goToTab("submissions","finalized") },
    { label:"Drafts",            value:allSubs.filter(s=>s.status==="draft").length,           color:"#B45309",  onClick:() => goToTab("submissions","draft") },
    { label:"Team Members",      value:users.length,                                           color:"#2563EB",  onClick:() => goToTab("team") },
  ];

  const TABS = [
    { id:"submissions", label:"Submissions" },
    { id:"media",       label:"Media Repository" },
    { id:"projects",    label:"Projects" },
    { id:"team",        label:"Team Members" },
  ];

  if (loading) return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"60px 24px", textAlign:"center", fontFamily:F.head, color:C.grey }}>
      Loading admin data…
    </div>
  );

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"26px 24px" }}>

      <div style={{ background:C.greenDark, borderRadius:6, padding:"20px 24px", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:F.head, fontWeight:800, fontSize:20, color:"#fff" }}>Admin Dashboard</div>
          <div style={{ fontFamily:F.head, fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:2 }}>Signed in as {user?.email}</div>
        </div>
        <button style={{ ...shared.btnOutline, borderColor:"rgba(255,255,255,0.4)", color:"#fff", background:"transparent", fontSize:11 }} onClick={fetchAll}>
          ↺ Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {statCards.map(s => (
          <div key={s.label} onClick={s.onClick}
            style={{ background:C.white, border:`1px solid ${C.greyBorder}`, borderRadius:6, padding:"18px 20px", borderTop:`3px solid ${s.color}`, cursor:"pointer", transition:"box-shadow 0.15s", boxShadow:"none" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
            <div style={{ fontFamily:F.head, fontWeight:800, fontSize:28, color:s.color }}>{s.value}</div>
            <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginTop:4, letterSpacing:"0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.greyBorder}`, marginBottom:20 }}>
        {TABS.map(({id,label}) => (
          <button key={id}
            style={{ padding:"10px 20px", border:"none", borderBottom:tab===id?`3px solid ${C.green}`:"3px solid transparent", background:"transparent", color:tab===id?C.green:C.grey, fontFamily:F.head, fontWeight:tab===id?700:400, fontSize:13, cursor:"pointer" }}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "submissions" && <SubmissionsTab allSubs={allSubs} fetchAll={fetchAll} user={user} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
      {tab === "media"       && <MediaTab       allSubs={allSubs} />}
      {tab === "projects"    && <ProjectsTab />}
      {tab === "team"        && <TeamTab        users={users} allSubs={allSubs} />}
    </div>
  );
}
