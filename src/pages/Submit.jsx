import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { collection, addDoc, getDocs, getDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { C, F, shared } from "../utils/theme.js";
import { downloadDocx } from "../utils/docxExport.js";
import { TYPE_LABELS, TYPE_ICONS, TYPE_DESCS } from "../utils/fields.js";
import PreviewModal from "../components/PreviewModal.jsx";

// ── Image compression ─────────────────────────────────────────────────────────
function compressImage(file, maxWidth = 400, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// File → base64 data URL (for consent forms / beneficiary photo)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── UI primitives ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, desc }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, margin:"28px 0 16px 0", paddingBottom:12, borderBottom:`2px solid ${C.greenLight}` }}>
      <div style={{ fontSize:22, lineHeight:1 }}>{icon}</div>
      <div>
        <div style={{ fontFamily:F.head, fontWeight:800, fontSize:14, color:C.green, letterSpacing:"0.02em" }}>{title}</div>
        {desc && <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginTop:2 }}>{desc}</div>}
      </div>
    </div>
  );
}

function Field({ f, value, onChange }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={shared.fieldLabel}>{f.label}</label>
      {f.type === "textarea"
        ? <textarea style={{ ...shared.inputBase, minHeight:85, resize:"vertical", lineHeight:1.65 }}
            placeholder={f.ph} value={value || ""} onChange={e => onChange(f.k, e.target.value)} rows={3} />
        : f.type === "select"
        ? <select style={{ ...shared.inputBase, cursor:"pointer" }} value={value || ""} onChange={e => onChange(f.k, e.target.value)}>
            <option value="">Select...</option>
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input style={shared.inputBase} type="text" placeholder={f.ph}
            value={value || ""} onChange={e => onChange(f.k, e.target.value)} />
      }
    </div>
  );
}

function PhotoSlot({ label, photo, onFile, onRemove }) {
  const ref = useRef();
  const src = typeof photo === "string" ? photo : photo?.preview;
  return (
    <div style={{ flex:1 }}>
      <label style={shared.fieldLabel}>{label}</label>
      <div style={{ border:`2px dashed ${src ? C.green : C.greyBorder}`, borderRadius:5, overflow:"hidden", cursor:"pointer", background:src ? "transparent" : C.greyLight, minHeight:100, display:"flex", alignItems:"center", justifyContent:"center" }}
        onClick={() => ref.current?.click()}>
        {src
          ? <img src={src} alt="" style={{ width:"100%", maxHeight:160, objectFit:"cover", display:"block" }} />
          : <div style={{ textAlign:"center", padding:12 }}>
              <div style={{ fontSize:24, marginBottom:4 }}>📷</div>
              <div style={{ fontFamily:F.head, fontSize:11, color:C.grey }}>Click to upload</div>
              <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginTop:2 }}>JPG or PNG</div>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={e => onFile(e.target.files[0])} />
      {src && <button style={{ ...shared.btnRed, marginTop:6, padding:"4px 9px", fontSize:10 }} onClick={onRemove}>Remove</button>}
    </div>
  );
}

function FileSlot({ label, file, onFile, onRemove }) {
  const ref = useRef();
  return (
    <div style={{ flex:1 }}>
      <label style={shared.fieldLabel}>{label}</label>
      <div style={{ border:`2px dashed ${file ? C.green : C.greyBorder}`, borderRadius:5, cursor:"pointer", background:file ? "#F0FDF4" : C.greyLight, minHeight:90, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}
        onClick={() => ref.current?.click()}>
        {file
          ? <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>📄</div>
              <div style={{ fontFamily:F.head, fontSize:11, color:C.green, fontWeight:700 }}>{file.name}</div>
              <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginTop:2 }}>{(file.size/1024).toFixed(1)} KB</div>
            </div>
          : <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>📎</div>
              <div style={{ fontFamily:F.head, fontSize:11, color:C.grey }}>Click to upload</div>
              <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginTop:2 }}>PDF or JPG/PNG · max 700 KB</div>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) {
          alert("File is too large. Please use a file under 2MB. For PDFs, scan at lower resolution (150 DPI is enough).");
          e.target.value = "";
          return;
        }
        onFile(f);
      }} />
      {file && <button style={{ ...shared.btnRed, marginTop:6, padding:"4px 9px", fontSize:10 }} onClick={onRemove}>Remove</button>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CASE STORY FORM
// ════════════════════════════════════════════════════════════════════════════
function CaseStoryForm({ form, setField, photo1, photo2, onPhoto1, onPhoto2, onRemove1, onRemove2,
                         consentFile, onConsentFile, onConsentRemove,
                         beneficiaryPhoto, onBeneficiaryPhoto, onBeneficiaryPhotoRemove,
                         projects }) {
  const projectName = form.projectName === "__other__"
    ? (form.projectNameOther || "")
    : (form.projectName || "");

  return (
    <>
      {/* Section 1 */}
      <SectionHeader icon="👤" title="ABOUT YOU" desc="Your details so the communications team can follow up if needed." />
      {[
        { k:"submitterName",  label:"Your Name & Designation", type:"text", ph:"e.g. Ritu Sharma, Cluster Coordinator" },
        { k:"submitterEmail", label:"Your Email",              type:"text", ph:"email@adraindia.org" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 2 */}
      <SectionHeader icon="📌" title="PROJECT & BENEFICIARY" desc="Basic details about the project and the person whose story you are sharing." />

      {/* Project dropdown */}
      <div style={{ marginBottom:16 }}>
        <label style={shared.fieldLabel}>Project / Programme Name</label>
        {projects.length > 0
          ? <>
              <select style={{ ...shared.inputBase, cursor:"pointer" }}
                value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)}>
                <option value="">Select a project...</option>
                {projects.map(p => <option key={p.id} value={p.displayName}>{p.displayName}</option>)}
                <option value="__other__">Other / Not listed</option>
              </select>
              {form.projectName === "__other__" && (
                <input style={{ ...shared.inputBase, marginTop:8 }} type="text" placeholder="Type project name..."
                  value={form.projectNameOther || ""} onChange={e => setField("projectNameOther", e.target.value)} />
              )}
            </>
          : <input style={shared.inputBase} type="text" placeholder="e.g. BRIDGE-UP Immunization, UP"
              value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)} />
        }
      </div>

      {[
        { k:"beneficiary", label:"Beneficiary Name (initials OK for privacy)", type:"text",   ph:"e.g. Sunita D." },
        { k:"age",         label:"Age",                                         type:"text",   ph:"e.g. 28" },
        { k:"gender",      label:"Gender",                                      type:"select", opts:["Female","Male","Other","Prefer not to say"] },
        { k:"location",    label:"Village / Block / District",                  type:"text",   ph:"e.g. Rampur village, Lucknow dist., UP" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Consent & record-keeping */}
      <div style={{ background:"#F0FDF4", border:`1.5px solid ${C.green}30`, borderRadius:6, padding:"16px 18px", marginBottom:8 }}>
        <div style={{ fontFamily:F.head, fontWeight:700, fontSize:12, color:C.green, marginBottom:4 }}>📋 RECORD-KEEPING (Optional — not used in story)</div>
        <div style={{ fontFamily:F.head, fontSize:11, color:C.grey, marginBottom:14, lineHeight:1.55 }}>
          Upload the beneficiary's signed consent form and/or a portrait photo for internal records.
          These are <strong>stored securely, tagged to the beneficiary's name</strong>, and never used by the AI to write the story.
        </div>
        <div style={{ display:"flex", gap:16 }}>
          <FileSlot label="Consent Form (PDF or photo)"
            file={consentFile} onFile={onConsentFile} onRemove={onConsentRemove} />
          <PhotoSlot label="Beneficiary Photo (record only)"
            photo={beneficiaryPhoto} onFile={onBeneficiaryPhoto} onRemove={onBeneficiaryPhotoRemove} />
        </div>
      </div>

      {/* Section 3 */}
      <SectionHeader icon="🏗️" title="ABOUT THE PROJECT" desc="Give context about the programme — what it does, who funds it, and what it aims to achieve." />
      {[
        { k:"projectObjective", label:"Project Objective / Goal",                      type:"textarea", ph:"e.g. To improve immunization coverage among children under 5 in rural UP through community mobilisation." },
        { k:"projectDonor",     label:"Donor / Funder (if shareable)",                 type:"text",     ph:"e.g. UNICEF, Tata Trusts, USAID" },
        { k:"projectGeography", label:"Project Geography (districts / states covered)", type:"text",     ph:"e.g. Lucknow, Unnao, Rae Bareli — Uttar Pradesh" },
        { k:"projectDuration",  label:"Project Duration",                               type:"text",     ph:"e.g. Jan 2023 – Dec 2025" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 4 */}
      <SectionHeader icon="📖" title="THE STORY" desc="This is the heart of the case story. Be specific — names, numbers, and concrete details make it compelling." />
      <div style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:5, padding:"10px 14px", marginBottom:14, fontFamily:F.head, fontSize:11, color:"#92400E", lineHeight:1.6 }}>
        🌐 <strong>आप हिंदी, தமிழ், తెలుగు, ಕನ್ನಡ या किसी भी भारतीय भाषा में भर सकते हैं।</strong>
        &nbsp;Fill these fields in <em>any Indian language</em> — Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, etc.
        The AI will generate the final story in English.
      </div>
      {[
        { k:"background",   label:"Background — situation BEFORE ADRA",    type:"textarea", ph:"Include: distance to health centre, number of children, economic situation, any relevant context." },
        { k:"challenge",    label:"Specific challenge or barrier faced",    type:"textarea", ph:"e.g. Fear of vaccination, no transport, family resistance, lack of awareness..." },
        { k:"intervention", label:"What did ADRA / the project team do?",   type:"textarea", ph:"Be specific: who did what? Name the ASHA/AWW/coordinator if appropriate." },
        { k:"outcome",      label:"What changed? The outcome.",             type:"textarea", ph:"Concrete change — include numbers if possible." },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 5 */}
      <SectionHeader icon="💬" title="BENEFICIARY QUOTE" desc="Write exactly what they said — don't paraphrase here. The AI will format it as a pull-quote." />
      <Field f={{ k:"quote", label:"Direct quote (their exact words)", type:"textarea", ph:"\"Write exactly what they said, translated if needed.\"" }}
        value={form.quote} onChange={setField} />

      {/* Section 6 */}
      <SectionHeader icon="📷" title="FIELD PHOTOS" desc="Upload up to 2 photos. These will be embedded in the generated story and downloadable .docx." />
      <div style={{ display:"flex", gap:16, marginBottom:16 }}>
        <PhotoSlot label="Photo 1" photo={photo1} onFile={onPhoto1} onRemove={onRemove1} />
        <PhotoSlot label="Photo 2 (optional)" photo={photo2} onFile={onPhoto2} onRemove={onRemove2} />
      </div>
      {(photo1 || photo2) && <div style={{ fontFamily:F.head, fontSize:11, color:C.green, marginBottom:16 }}>Photos attached — they will appear inside the generated story and .docx</div>}
      <Field f={{ k:"photoCredit", label:"Photo credit", type:"text", ph:"Photo: © 2025 ADRA India | Your Name" }}
        value={form.photoCredit} onChange={setField} />

      {/* Section 7 */}
      <SectionHeader icon="📝" title="ADDITIONAL NOTES" desc="Anything the communications team should know — sensitivity flags, follow-up needed, extra context." />
      <Field f={{ k:"extraNotes", label:"Notes for the communications team (optional)", type:"textarea", ph:"e.g. Please don't use the beneficiary's full name. Follow-up interview possible." }}
        value={form.extraNotes} onChange={setField} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  NEWSLETTER FORM
// ════════════════════════════════════════════════════════════════════════════
function NewsletterForm({ form, setField, projects }) {
  return (
    <>
      <SectionHeader icon="👤" title="ABOUT YOU" desc="Your details for follow-up by the communications team." />
      {[
        { k:"submitterName",  label:"Your Name & Designation", type:"text", ph:"e.g. State Programme Manager" },
        { k:"submitterEmail", label:"Your Email",              type:"text", ph:"email@adraindia.org" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="📌" title="PROGRAMME DETAILS" desc="Basic information about the programme and reporting period." />
      <div style={{ marginBottom:16 }}>
        <label style={shared.fieldLabel}>Project / Programme Name</label>
        {projects.length > 0
          ? <select style={{ ...shared.inputBase, cursor:"pointer" }}
              value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)}>
              <option value="">Select a project...</option>
              {projects.map(p => <option key={p.id} value={p.displayName}>{p.displayName}</option>)}
              <option value="__other__">Other / Not listed</option>
            </select>
          : <input style={shared.inputBase} type="text" placeholder="e.g. PRECISE 2025"
              value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)} />
        }
        {form.projectName === "__other__" && (
          <input style={{ ...shared.inputBase, marginTop:8 }} type="text" placeholder="Type project name..."
            value={form.projectNameOther || ""} onChange={e => setField("projectNameOther", e.target.value)} />
        )}
      </div>
      {[
        { k:"reportingPeriod", label:"Reporting Period",                 type:"text", ph:"e.g. January-March 2025" },
        { k:"geography",       label:"State / District / Coverage Area", type:"text", ph:"" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="📊" title="KEY RESULTS" desc="Lead with numbers. What did the programme achieve this period? Be specific." />
      {[
        { k:"achievement1", label:"Key Achievement #1 (with numbers)", type:"textarea", ph:"e.g. 1,240 children vaccinated across 18 villages in Lucknow district." },
        { k:"achievement2", label:"Key Achievement #2",                type:"textarea", ph:"" },
        { k:"achievement3", label:"Key Achievement #3 (optional)",     type:"textarea", ph:"" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="🙋" title="HUMAN MOMENT" desc="One brief story or moment that captures what the numbers don't. This is what donors remember." />
      <Field f={{ k:"humanStory", label:"A story or moment from the field", type:"textarea", ph:"e.g. One ASHA worker walked 8km in the rain to reach the last unvaccinated child in her village." }}
        value={form.humanStory} onChange={setField} />

      <SectionHeader icon="🔭" title="CHALLENGES & WHAT'S NEXT" desc="Honesty about challenges builds donor trust. Upcoming activities signal momentum." />
      {[
        { k:"challenges", label:"Key challenges faced",           type:"textarea", ph:"What was hard? What slowed progress?" },
        { k:"upcoming",   label:"What's coming up next quarter?", type:"textarea", ph:"Planned activities, milestones, events." },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="🖼️" title="PHOTO REFERENCES" desc="Paste links to photos (Google Drive, Dropbox, etc.)." />
      {[1,2,3,4,5].map(i => (
        <Field key={i}
          f={{ k:`photoUrl${i}`, label:`Photo URL ${i}${i > 1 ? " (optional)" : ""}`, type:"text", ph:"https://drive.google.com/..." }}
          value={form[`photoUrl${i}`]} onChange={setField} />
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  REPORT FORM
// ════════════════════════════════════════════════════════════════════════════
function ReportForm({ form, setField, projects }) {
  return (
    <>
      <SectionHeader icon="👤" title="ABOUT YOU" desc="" />
      {[
        { k:"submitterName",  label:"Your Name & Designation", type:"text", ph:"" },
        { k:"submitterEmail", label:"Your Email",              type:"text", ph:"" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="📌" title="PROJECT DETAILS" desc="" />
      <div style={{ marginBottom:16 }}>
        <label style={shared.fieldLabel}>Project Name</label>
        {projects.length > 0
          ? <select style={{ ...shared.inputBase, cursor:"pointer" }}
              value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)}>
              <option value="">Select a project...</option>
              {projects.map(p => <option key={p.id} value={p.displayName}>{p.displayName}</option>)}
              <option value="__other__">Other / Not listed</option>
            </select>
          : <input style={shared.inputBase} type="text" placeholder=""
              value={form.projectName || ""} onChange={e => setField("projectName", e.target.value)} />
        }
        {form.projectName === "__other__" && (
          <input style={{ ...shared.inputBase, marginTop:8 }} type="text" placeholder="Type project name..."
            value={form.projectNameOther || ""} onChange={e => setField("projectNameOther", e.target.value)} />
        )}
      </div>
      {[
        { k:"donorName",          label:"Donor / Funder",                         type:"text",     ph:"e.g. ECHO, USAID, Tata Trusts" },
        { k:"reportingPeriod",    label:"Reporting Period",                       type:"text",     ph:"" },
        { k:"geography",          label:"Geography (State / District)",           type:"text",     ph:"" },
        { k:"totalBeneficiaries", label:"Total Beneficiaries Reached",           type:"text",     ph:"e.g. 4,200 (2,800 female, 1,400 male)" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="📊" title="RESULTS & INDICATORS" desc="Include targets vs actuals wherever possible." />
      {[
        { k:"keyIndicators", label:"Key Indicators (target vs actual)",  type:"textarea", ph:"- Children vaccinated: Target 1,000 / Actual 1,187\n- Sessions held: Target 50 / Actual 63" },
        { k:"highlight",     label:"Standout result or highlight",       type:"textarea", ph:"The most impressive thing that happened this period." },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      <SectionHeader icon="🔭" title="CHALLENGES, LEARNING & NEXT STEPS" desc="" />
      {[
        { k:"challenges", label:"Challenges & How They Were Addressed", type:"textarea", ph:"" },
        { k:"lessons",    label:"Lessons Learned / Adaptations Made",   type:"textarea", ph:"" },
        { k:"nextSteps",  label:"Next Steps / Planned Activities",      type:"textarea", ph:"" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN SUBMIT PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Submit({ user }) {
  const [searchParams]                         = useSearchParams();
  const navigate                               = useNavigate();
  const editId                                 = searchParams.get("edit"); // submission ID if editing
  const [editLoading,      setEditLoading]     = useState(!!editId);
  const [ctype,            setCtype]           = useState("case_story");
  const [form,             setForm]            = useState({});
  const [photo1,           setPhoto1]          = useState(null);
  const [photo2,           setPhoto2]          = useState(null);
  const [consentFile,      setConsentFile]     = useState(null);
  const [beneficiaryPhoto, setBeneficiaryPhoto]= useState(null);
  const [genning,          setGenning]         = useState(false);
  const [output,           setOutput]          = useState("");
  const [genErr,           setGenErr]          = useState("");
  const [saving,           setSaving]          = useState(false);
  const [savedOk,          setSavedOk]         = useState("");
  const [copied,           setCopied]          = useState(false);
  const [showModal,        setShowModal]       = useState(false);
  const [projects,         setProjects]        = useState([]);

  // Load project list from Firestore
  useEffect(() => {
    getDocs(collection(db, "projects")).then(snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b) => (b.year||"").localeCompare(a.year||"") || (a.name||"").localeCompare(b.name||""));
      setProjects(list.map(p => ({ ...p, displayName: `${p.name} ${p.year}`.trim() })));
    }).catch(() => {});
  }, []);

  // If ?edit=ID — load that submission into the form
  useEffect(() => {
    if (!editId) return;
    setEditLoading(true);
    getDoc(doc(db, "submissions", editId)).then(snap => {
      if (!snap.exists()) { alert("Submission not found."); navigate("/library"); return; }
      const data = snap.data();
      // Only allow editing own drafts
      if (data.userId !== user.uid) { alert("You can only edit your own submissions."); navigate("/library"); return; }
      if (data.status === "finalized") { alert("Finalized submissions cannot be edited."); navigate("/library"); return; }
      setCtype(data.type || "case_story");
      setForm(data.data || {});
      setOutput(data.generatedContent || "");
      // Restore photos as preview-only objects (no re-upload needed)
      if (data.photo1Data) setPhoto1({ preview: data.photo1Data, fullData: data.photo1Full || data.photo1Data, previewB64: data.photo1Data.split(",")[1] });
      if (data.photo2Data) setPhoto2({ preview: data.photo2Data, fullData: data.photo2Full || data.photo2Data, previewB64: data.photo2Data.split(",")[1] });
      if (data.beneficiaryPhotoPreview) setBeneficiaryPhoto({ preview: data.beneficiaryPhotoPreview, fullData: data.beneficiaryPhotoPreview });
    }).catch(e => {
      alert("Failed to load submission: " + e.message);
      navigate("/library");
    }).finally(() => setEditLoading(false));
  }, [editId, user]);

  // Auto-populate name + email (only when not editing)
  useEffect(() => {
    if (user && !editId) setForm(prev => ({
      ...prev,
      submitterName:  prev.submitterName  || user.displayName || "",
      submitterEmail: prev.submitterEmail || user.email       || "",
    }));
  }, [user, ctype]);

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function switchType(key) {
    setCtype(key); setOutput(""); setGenErr("");
    setPhoto1(null); setPhoto2(null); setConsentFile(null); setBeneficiaryPhoto(null);
    setForm(prev => ({
      submitterName:  prev.submitterName  || user?.displayName || "",
      submitterEmail: prev.submitterEmail || user?.email       || "",
    }));
  }

  async function handlePhoto(slot, file) {
    if (!file) return;
    const [preview, fullData] = await Promise.all([
      compressImage(file, 300,  0.60),  // preview shown in app
      compressImage(file, 700,  0.75),  // full-res for docx download
    ]);
    const obj = { preview, previewB64: preview.split(",")[1], fullData };
    slot === 1 ? setPhoto1(obj) : setPhoto2(obj);
  }

  async function handleBeneficiaryPhoto(file) {
    if (!file) return;
    // Beneficiary photo is record-only — no need for high res
    const preview = await compressImage(file, 400, 0.65);
    setBeneficiaryPhoto({ preview, fullData: preview });
  }

  // Resolve "Other" project name before saving/generating
  function resolvedProjectName() {
    return form.projectName === "__other__"
      ? (form.projectNameOther || "")
      : (form.projectName || "");
  }

  async function callGenerate() {
    if (!form.submitterName)   { alert("Please fill in your name first."); return; }
    if (!resolvedProjectName()) { alert("Please select or enter the project name."); return; }
    setGenning(true); setOutput(""); setGenErr("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ctype,
          data: { ...form, projectName: resolvedProjectName() },
          photoBase64: photo1?.previewB64 || null,
          photoMime:   "image/jpeg",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setOutput(json.content);
    } catch (e) { setGenErr("Generation failed: " + e.message); }
    setGenning(false);
  }

  async function saveToFirestore(status = "draft") {
    const projectName = resolvedProjectName();
    if (!projectName) { alert("Please select or enter the project name."); return; }
    setSaving(true);
    try {
      // Handle consent file — compress images, skip oversized PDFs gracefully
      // Firestore doc limit is 1MB total. With 2 photos + other fields,
      // budget ~300KB for consent. Images get compressed; PDFs checked directly.
      const LIMIT = 300 * 1024;
      let consentBase64 = null, consentFileName = null, consentMime = null, consentSkipped = false;
      if (consentFile) {
        consentFileName = consentFile.name;
        consentMime     = consentFile.type;
        if (consentFile.type.startsWith("image/")) {
          // Compress consent image — try 1200px first, then 800px if still too big
          let compressed = await compressImage(consentFile, 1200, 0.80);
          if (Math.round(compressed.length * 0.75) > LIMIT) {
            compressed = await compressImage(consentFile, 800, 0.65);
          }
          consentBase64 = compressed;
        } else {
          // PDF — check raw size before storing
          const raw = await fileToBase64(consentFile);
          if (Math.round(raw.length * 0.75) <= LIMIT) {
            consentBase64 = raw;
          } else {
            consentSkipped = true; // flag it but don't block the save
          }
        }
      }

      const beneficiaryName = form.beneficiary || "Unknown";

      const payload = {
        type:             ctype,
        data:             { ...form, projectName },
        photo1Data:       photo1?.fullData || null,
        photo2Data:       photo2?.fullData || null,
        photo1Full:       photo1?.fullData || null,
        photo2Full:       photo2?.fullData || null,
        consentBase64,
        consentFileName,
        consentMime,
        consentSkipped,
        beneficiaryPhotoPreview: beneficiaryPhoto?.preview || null,
        beneficiaryPhotoFull:    null,
        beneficiaryName,
        generatedContent: output || "",
        status,
        updatedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, "submissions", editId), payload);
      } else {
        await addDoc(collection(db, "submissions"), {
          ...payload,
          userId:    user.uid,
          userEmail: user.email,
          userName:  user.displayName,
          createdAt: serverTimestamp(),
        });
      }

      if (consentSkipped) {
        setSavedOk("Saved! (Note: consent PDF was too large to store — filename recorded only)");
      } else {
        setSavedOk(status === "finalized" ? "Saved to repository!" : "Draft saved!");
      }
      setTimeout(() => {
        setSavedOk("");
        // After saving/finalizing an edited draft, return to library
        if (editId) navigate("/library");
      }, 1800);
      if (status === "finalized" && !editId) {
        setPhoto1(null); setPhoto2(null);
        setConsentFile(null); setBeneficiaryPhoto(null);
        setOutput(""); setGenErr("");
        setForm({ submitterName: user?.displayName || "", submitterEmail: user?.email || "" });
      }
    } catch (e) { alert("Save failed: " + e.message); }
    setSaving(false);
  }

  if (editLoading) return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"80px 24px", textAlign:"center", fontFamily:F.head, color:C.grey }}>
      Loading draft…
    </div>
  );

  return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px" }}>
      {/* Edit mode banner */}
      {editId && (
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:6, padding:"12px 18px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:F.head, fontSize:12, color:"#1D4ED8" }}>
            ✏️ <strong>Editing draft</strong> — make your changes and save below
          </div>
          <button style={{ ...shared.btnOutline, borderColor:"#93C5FD", color:"#1D4ED8", fontSize:11 }}
            onClick={() => navigate("/library")}>
            ← Back to My Submissions
          </button>
        </div>
      )}

      <div style={shared.card}>
        <div style={{ fontFamily:F.head, fontWeight:800, fontSize:21, color:C.black, marginBottom:4 }}>
          {editId ? "Edit Draft" : "Submit field data"}
        </div>
        <div style={{ fontFamily:F.head, fontSize:12, color:C.grey, marginBottom:24 }}>
          {editId ? "Update the fields below, regenerate if needed, then save your draft or finalize it." : "Choose a content type, fill in the sections, then generate or save for later"}
        </div>

        {/* Type selector — locked when editing */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:8 }}>
          {Object.keys(TYPE_LABELS).map(key => (
            <div key={key}
              style={{ padding:"16px 12px", border:`2px solid ${ctype===key?C.green:C.greyBorder}`, borderRadius:5, background:ctype===key?C.greenLight:C.white, cursor:editId?"default":"pointer", textAlign:"center", transition:"all 0.15s", opacity:editId&&ctype!==key?0.4:1 }}
              onClick={() => { if (!editId) switchType(key); }}>
              <div style={{ fontSize:24, marginBottom:5 }}>{TYPE_ICONS[key]}</div>
              <div style={{ fontFamily:F.head, fontWeight:700, fontSize:12, color:ctype===key?C.green:C.black }}>{TYPE_LABELS[key]}</div>
              <div style={{ fontFamily:F.head, fontSize:10, color:C.grey, marginTop:3 }}>{TYPE_DESCS[key]}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        {ctype === "case_story" && (
          <CaseStoryForm form={form} setField={setField}
            photo1={photo1} photo2={photo2}
            onPhoto1={f => handlePhoto(1, f)} onPhoto2={f => handlePhoto(2, f)}
            onRemove1={() => setPhoto1(null)} onRemove2={() => setPhoto2(null)}
            consentFile={consentFile}
            onConsentFile={f => setConsentFile(f)}
            onConsentRemove={() => setConsentFile(null)}
            beneficiaryPhoto={beneficiaryPhoto}
            onBeneficiaryPhoto={handleBeneficiaryPhoto}
            onBeneficiaryPhotoRemove={() => setBeneficiaryPhoto(null)}
            projects={projects} />
        )}
        {ctype === "newsletter" && <NewsletterForm form={form} setField={setField} projects={projects} />}
        {ctype === "report"     && <ReportForm     form={form} setField={setField} projects={projects} />}

        {/* Actions */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", marginTop:28, paddingTop:20, borderTop:`1px solid ${C.greyBorder}` }}>
          <button style={shared.btnGreen} onClick={callGenerate} disabled={genning}>
            {genning ? "Writing..." : `Generate ${TYPE_LABELS[ctype]}`}
          </button>
          <button style={shared.btnOutline} onClick={() => saveToFirestore("draft")} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {savedOk && <span style={{ fontFamily:F.head, fontSize:12, color:C.green }}>{savedOk}</span>}
        </div>
      </div>

      {/* Generated output */}
      {(genning || output || genErr) && (
        <div style={shared.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div style={{ fontFamily:F.head, fontWeight:800, fontSize:18 }}>Generated {TYPE_LABELS[ctype]}</div>
            {output && (
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button style={shared.btnOutline} onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(()=>setCopied(false),2200); }}>
                  {copied ? "✓ Copied!" : "Copy text"}
                </button>
                <button style={{ ...shared.btnOutline, borderColor:"#2563EB", color:"#2563EB" }} onClick={() => setShowModal(true)}>
                  📄 Preview &amp; Download
                </button>
                <button style={shared.btnGreen} onClick={() => saveToFirestore("finalized")} disabled={saving}>
                  {saving ? "Saving..." : "Save to Repository"}
                </button>
              </div>
            )}
          </div>

          {genning && <div style={{ fontFamily:F.head, fontSize:13, color:C.grey, padding:"14px 0" }}>Writing your {TYPE_LABELS[ctype]}...</div>}
          {genErr   && <div style={{ background:C.errorBg, color:C.errorText, borderRadius:4, padding:"12px 16px", fontFamily:F.head, fontSize:13 }}>{genErr}</div>}
          {output && (
            <>
              {ctype === "case_story" && (photo1 || photo2) && (
                <div style={{ display:"flex", gap:12, margin:"0 0 16px 0" }}>
                  {photo1 && <img src={photo1.preview} alt="Photo 1" style={{ flex:1, maxHeight:160, objectFit:"cover", borderRadius:4 }} />}
                  {photo2 && <img src={photo2.preview} alt="Photo 2" style={{ flex:1, maxHeight:160, objectFit:"cover", borderRadius:4 }} />}
                </div>
              )}
              <div style={{ background:C.greyLight, border:`1px solid ${C.greyBorder}`, borderLeft:`4px solid ${C.green}`, borderRadius:4, padding:"20px 22px", whiteSpace:"pre-wrap", fontFamily:F.body, fontSize:14, lineHeight:1.85 }}>
                {output}
              </div>
              <div style={{ marginTop:14, fontFamily:F.head, fontSize:11, color:C.grey }}>
                Happy with this? Click <strong>Save to Repository</strong> to file it, or <strong>Preview &amp; Download</strong> for a formatted Word document.
              </div>
            </>
          )}
        </div>
      )}

      {showModal && (
        <PreviewModal type={ctype} content={output} data={form} photo1={photo1} photo2={photo2} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
