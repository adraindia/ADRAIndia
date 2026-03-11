import { useState, useRef, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { C, F, shared } from "../utils/theme.js";
import { downloadDocx } from "../utils/docxExport.js";
import { TYPE_LABELS, TYPE_ICONS, TYPE_DESCS } from "../utils/fields.js";

// Compress image to two sizes: small preview (400px) + larger for docx (1200px)
function compressImage(file, maxWidth = 400, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale   = Math.min(1, maxWidth / img.width);
        const canvas  = document.createElement("canvas");
        canvas.width  = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Section header component ─────────────────────────────────────────────────
function SectionHeader({ icon, title, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, margin: "28px 0 16px 0", paddingBottom: 12, borderBottom: `2px solid ${C.greenLight}` }}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 14, color: C.green, letterSpacing: "0.02em" }}>{title}</div>
        {desc && <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey, marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
  );
}

// ── Single form field ─────────────────────────────────────────────────────────
function Field({ f, value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={shared.fieldLabel}>{f.label}</label>
      {f.type === "textarea"
        ? <textarea style={{ ...shared.inputBase, minHeight: 85, resize: "vertical", lineHeight: 1.65 }}
            placeholder={f.ph} value={value || ""} onChange={e => onChange(f.k, e.target.value)} rows={3} />
        : f.type === "select"
        ? <select style={{ ...shared.inputBase, cursor: "pointer" }} value={value || ""} onChange={e => onChange(f.k, e.target.value)}>
            <option value="">Select...</option>
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        : <input style={shared.inputBase} type="text" placeholder={f.ph}
            value={value || ""} onChange={e => onChange(f.k, e.target.value)} />
      }
    </div>
  );
}

// ── Photo upload slot ─────────────────────────────────────────────────────────
function PhotoSlot({ label, photo, onFile, onRemove }) {
  const ref = useRef();
  return (
    <div style={{ flex: 1 }}>
      <label style={shared.fieldLabel}>{label}</label>
      <div style={{ border: `2px dashed ${photo ? C.green : C.greyBorder}`, borderRadius: 5, overflow: "hidden", cursor: "pointer", background: photo ? "transparent" : C.greyLight, minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => ref.current?.click()}>
        {photo
          ? <img src={photo.preview} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
          : <div style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
              <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>Click to upload</div>
              <div style={{ fontFamily: F.head, fontSize: 10, color: C.grey, marginTop: 2 }}>JPG or PNG</div>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
      {photo && <button style={{ ...shared.btnRed, marginTop: 6, padding: "4px 9px", fontSize: 10 }} onClick={onRemove}>Remove</button>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CASE STORY FORM
// ════════════════════════════════════════════════════════════════════════════
function CaseStoryForm({ form, setField, photo1, photo2, onPhoto1, onPhoto2, onRemove1, onRemove2 }) {
  return (
    <>
      {/* Section 1: Submitter */}
      <SectionHeader icon="👤" title="ABOUT YOU" desc="Your details so the communications team can follow up if needed." />
      {[
        { k: "submitterName",  label: "Your Name & Designation", type: "text", ph: "e.g. Ritu Sharma, Cluster Coordinator" },
        { k: "submitterEmail", label: "Your Email",              type: "text", ph: "email@adraindia.org" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 2: Project & Beneficiary */}
      <SectionHeader icon="📌" title="PROJECT & BENEFICIARY" desc="Basic details about the project and the person whose story you are sharing." />
      {[
        { k: "projectName",  label: "Project / Programme Name",                     type: "text",   ph: "e.g. BRIDGE-UP Immunization, UP" },
        { k: "beneficiary",  label: "Beneficiary Name (initials OK for privacy)",   type: "text",   ph: "e.g. Sunita D." },
        { k: "age",          label: "Age",                                           type: "text",   ph: "e.g. 28" },
        { k: "gender",       label: "Gender",                                        type: "select", opts: ["Female", "Male", "Other", "Prefer not to say"] },
        { k: "location",     label: "Village / Block / District",                    type: "text",   ph: "e.g. Rampur village, Lucknow dist., UP" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 3: The Story */}
      <SectionHeader icon="📖" title="THE STORY" desc="This is the heart of the case story. Be specific — names, numbers, and concrete details make it compelling." />
      {[
        { k: "background",   label: "Background — situation BEFORE ADRA",           type: "textarea", ph: "Include: distance to health centre, number of children, economic situation, any relevant context." },
        { k: "challenge",    label: "Specific challenge or barrier faced",           type: "textarea", ph: "e.g. Fear of vaccination, no transport, family resistance, lack of awareness..." },
        { k: "intervention", label: "What did ADRA / the project team do?",         type: "textarea", ph: "Be specific: who did what? Name the ASHA/AWW/coordinator if appropriate." },
        { k: "outcome",      label: "What changed? The outcome.",                   type: "textarea", ph: "Concrete change — include numbers if possible." },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 4: Quote */}
      <SectionHeader icon="💬" title="BENEFICIARY QUOTE" desc="Write exactly what they said — don't paraphrase here. The AI will format it as a pull-quote." />
      <Field f={{ k: "quote", label: "Direct quote (their exact words)", type: "textarea", ph: "\"Write exactly what they said, translated if needed.\"" }}
        value={form.quote} onChange={setField} />

      {/* Section 5: Photos */}
      <SectionHeader icon="📷" title="FIELD PHOTOS" desc="Upload up to 2 photos. These will be embedded in the generated story and downloadable .docx." />
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <PhotoSlot label="Photo 1" photo={photo1} onFile={onPhoto1} onRemove={onRemove1} />
        <PhotoSlot label="Photo 2 (optional)" photo={photo2} onFile={onPhoto2} onRemove={onRemove2} />
      </div>
      {(photo1 || photo2) && <div style={{ fontFamily: F.head, fontSize: 11, color: C.green, marginBottom: 16 }}>Photos attached — they will appear inside the generated story and .docx</div>}
      <Field f={{ k: "photoCredit", label: "Photo credit", type: "text", ph: "Photo: © 2025 ADRA India | Your Name" }}
        value={form.photoCredit} onChange={setField} />

      {/* Section 6: Notes */}
      <SectionHeader icon="📝" title="ADDITIONAL NOTES" desc="Anything the communications team should know — sensitivity flags, follow-up needed, extra context." />
      <Field f={{ k: "extraNotes", label: "Notes for the communications team (optional)", type: "textarea", ph: "e.g. Please don't use the beneficiary's full name. Follow-up interview possible." }}
        value={form.extraNotes} onChange={setField} />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  NEWSLETTER FORM
// ════════════════════════════════════════════════════════════════════════════
function NewsletterForm({ form, setField }) {
  return (
    <>
      {/* Section 1: Submitter */}
      <SectionHeader icon="👤" title="ABOUT YOU" desc="Your details for follow-up by the communications team." />
      {[
        { k: "submitterName",  label: "Your Name & Designation", type: "text", ph: "e.g. State Programme Manager" },
        { k: "submitterEmail", label: "Your Email",              type: "text", ph: "email@adraindia.org" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 2: Programme info */}
      <SectionHeader icon="📌" title="PROGRAMME DETAILS" desc="Basic information about the programme and reporting period." />
      {[
        { k: "projectName",     label: "Project / Programme Name",         type: "text", ph: "" },
        { k: "reportingPeriod", label: "Reporting Period",                 type: "text", ph: "e.g. January-March 2025" },
        { k: "geography",       label: "State / District / Coverage Area", type: "text", ph: "" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 3: Results */}
      <SectionHeader icon="📊" title="KEY RESULTS" desc="Lead with numbers. What did the programme achieve this period? Be specific." />
      {[
        { k: "achievement1", label: "Key Achievement #1 (with numbers)", type: "textarea", ph: "e.g. 1,240 children vaccinated across 18 villages in Lucknow district." },
        { k: "achievement2", label: "Key Achievement #2",                type: "textarea", ph: "" },
        { k: "achievement3", label: "Key Achievement #3 (optional)",     type: "textarea", ph: "" },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 4: Human story */}
      <SectionHeader icon="🙋" title="HUMAN MOMENT" desc="One brief story or moment that captures what the numbers don't. This is what donors remember." />
      <Field f={{ k: "humanStory", label: "A story or moment from the field", type: "textarea", ph: "e.g. One ASHA worker walked 8km in the rain to reach the last unvaccinated child in her village." }}
        value={form.humanStory} onChange={setField} />

      {/* Section 5: Challenges & Next steps */}
      <SectionHeader icon="🔭" title="CHALLENGES & WHAT'S NEXT" desc="Honesty about challenges builds donor trust. And upcoming activities signal momentum." />
      {[
        { k: "challenges", label: "Key challenges faced",            type: "textarea", ph: "What was hard? What slowed progress?" },
        { k: "upcoming",   label: "What's coming up next quarter?",  type: "textarea", ph: "Planned activities, milestones, events." },
      ].map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}

      {/* Section 6: Photo URLs */}
      <SectionHeader icon="🖼️" title="PHOTO REFERENCES" desc="Paste links to photos (Google Drive, Dropbox, etc.). These will appear as references in the downloaded .docx." />
      {[1,2,3,4,5].map(i => (
        <Field key={i}
          f={{ k: `photoUrl${i}`, label: `Photo URL ${i}${i > 1 ? " (optional)" : ""}`, type: "text", ph: "https://drive.google.com/..." }}
          value={form[`photoUrl${i}`]} onChange={setField} />
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  REPORT FORM
// ════════════════════════════════════════════════════════════════════════════
function ReportForm({ form, setField }) {
  const fields = [
    { k: "submitterName",      label: "Your Name & Designation",                    type: "text",     ph: "" },
    { k: "submitterEmail",     label: "Your Email",                                 type: "text",     ph: "" },
    { k: "projectName",        label: "Project Name",                               type: "text",     ph: "" },
    { k: "donorName",          label: "Donor / Funder",                             type: "text",     ph: "e.g. ECHO, USAID, Tata Trusts" },
    { k: "reportingPeriod",    label: "Reporting Period",                           type: "text",     ph: "" },
    { k: "geography",          label: "Geography (State / District)",               type: "text",     ph: "" },
    { k: "totalBeneficiaries", label: "Total Beneficiaries Reached",               type: "text",     ph: "e.g. 4,200 (2,800 female, 1,400 male)" },
    { k: "keyIndicators",      label: "Key Indicators (target vs actual)",          type: "textarea", ph: "- Children vaccinated: Target 1,000 / Actual 1,187\n- Sessions held: Target 50 / Actual 63" },
    { k: "highlight",          label: "Standout result or highlight",               type: "textarea", ph: "The most impressive thing that happened this period." },
    { k: "challenges",         label: "Challenges & How They Were Addressed",       type: "textarea", ph: "" },
    { k: "lessons",            label: "Lessons Learned / Adaptations Made",         type: "textarea", ph: "" },
    { k: "nextSteps",          label: "Next Steps / Planned Activities",            type: "textarea", ph: "" },
  ];
  return (
    <>
      <SectionHeader icon="👤" title="ABOUT YOU" desc="" />
      {fields.slice(0,2).map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}
      <SectionHeader icon="📌" title="PROJECT DETAILS" desc="" />
      {fields.slice(2,7).map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}
      <SectionHeader icon="📊" title="RESULTS & INDICATORS" desc="Include targets vs actuals wherever possible." />
      {fields.slice(7,9).map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}
      <SectionHeader icon="🔭" title="CHALLENGES, LEARNING & NEXT STEPS" desc="" />
      {fields.slice(9).map(f => <Field key={f.k} f={f} value={form[f.k]} onChange={setField} />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN SUBMIT PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function Submit({ user }) {
  const [ctype,     setCtype]     = useState("case_story");
  const [form,      setForm]      = useState({});
  const [photo1,    setPhoto1]    = useState(null);
  const [photo2,    setPhoto2]    = useState(null);
  const [genning,   setGenning]   = useState(false);
  const [output,    setOutput]    = useState("");
  const [genErr,    setGenErr]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [savedOk,   setSavedOk]   = useState("");
  const [copied,    setCopied]    = useState(false);
  const [dlLoading, setDlLoading] = useState(false);

  // Auto-populate name + email from logged-in user
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        submitterName:  prev.submitterName  || user.displayName || "",
        submitterEmail: prev.submitterEmail || user.email       || "",
      }));
    }
  }, [user, ctype]);

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function switchType(key) {
    setCtype(key);
    setOutput(""); setGenErr(""); setPhoto1(null); setPhoto2(null);
    // Preserve name/email when switching tabs
    setForm(prev => ({
      submitterName:  prev.submitterName  || user?.displayName || "",
      submitterEmail: prev.submitterEmail || user?.email       || "",
    }));
  }

  async function handlePhoto(slot, file) {
    if (!file) return;
    const [preview, fullData] = await Promise.all([
      compressImage(file, 400,  0.65),
      compressImage(file, 1200, 0.88),
    ]);
    const obj = { preview, previewB64: preview.split(",")[1], fullData };
    slot === 1 ? setPhoto1(obj) : setPhoto2(obj);
  }

  async function callGenerate() {
    if (!form.submitterName) { alert("Please fill in your name first."); return; }
    if (!form.projectName)   { alert("Please fill in the project name first."); return; }
    setGenning(true); setOutput(""); setGenErr("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:        ctype,
          data:        form,
          photoBase64: photo1?.previewB64 || null,
          photoMime:   "image/jpeg",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setOutput(json.content);
    } catch (e) {
      setGenErr("Generation failed: " + e.message);
    }
    setGenning(false);
  }

  async function saveToFirestore(status = "draft") {
    if (!form.projectName) { alert("Please fill in at least the project name."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "submissions"), {
        type:             ctype,
        data:             form,
        photo1Data:       photo1?.preview  || null,
        photo2Data:       photo2?.preview  || null,
        photo1Full:       photo1?.fullData || null,
        photo2Full:       photo2?.fullData || null,
        generatedContent: output || "",
        status,
        userId:           user.uid,
        userEmail:        user.email,
        userName:         user.displayName,
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
      });
      setSavedOk(status === "finalized" ? "Saved to repository!" : "Draft saved!");
      setTimeout(() => setSavedOk(""), 3500);
      if (status === "finalized") {
        setPhoto1(null); setPhoto2(null); setOutput(""); setGenErr("");
        setForm({
          submitterName:  user?.displayName || "",
          submitterEmail: user?.email       || "",
        });
      }
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  }

  async function handleDownload() {
    if (!output) return;
    setDlLoading(true);
    try {
      await downloadDocx({ type: ctype, content: output, data: form, photo1: photo1?.preview || null, photo2: photo2?.preview || null });
    } catch (e) { alert("Download failed: " + e.message); }
    setDlLoading(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px" }}>
      <div style={shared.card}>

        {/* Page title */}
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black, marginBottom: 4 }}>Submit field data</div>
        <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginBottom: 24 }}>
          Choose a content type, fill in the sections, then generate or save for later
        </div>

        {/* Type selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 8 }}>
          {Object.keys(TYPE_LABELS).map(key => (
            <div key={key}
              style={{ padding: "16px 12px", border: `2px solid ${ctype === key ? C.green : C.greyBorder}`, borderRadius: 5, background: ctype === key ? C.greenLight : C.white, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}
              onClick={() => switchType(key)}>
              <div style={{ fontSize: 24, marginBottom: 5 }}>{TYPE_ICONS[key]}</div>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 12, color: ctype === key ? C.green : C.black }}>{TYPE_LABELS[key]}</div>
              <div style={{ fontFamily: F.head, fontSize: 10, color: C.grey, marginTop: 3 }}>{TYPE_DESCS[key]}</div>
            </div>
          ))}
        </div>

        {/* Sectioned form */}
        {ctype === "case_story" && (
          <CaseStoryForm form={form} setField={setField}
            photo1={photo1} photo2={photo2}
            onPhoto1={f => handlePhoto(1, f)} onPhoto2={f => handlePhoto(2, f)}
            onRemove1={() => setPhoto1(null)} onRemove2={() => setPhoto2(null)} />
        )}
        {ctype === "newsletter" && <NewsletterForm form={form} setField={setField} />}
        {ctype === "report"     && <ReportForm     form={form} setField={setField} />}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.greyBorder}` }}>
          <button style={shared.btnGreen} onClick={callGenerate} disabled={genning}>
            {genning ? "Writing..." : `Generate ${TYPE_LABELS[ctype]}`}
          </button>
          <button style={shared.btnOutline} onClick={() => saveToFirestore("draft")} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {savedOk && <span style={{ fontFamily: F.head, fontSize: 12, color: C.green }}>{savedOk}</span>}
        </div>
      </div>

      {/* Generated output */}
      {(genning || output || genErr) && (
        <div style={shared.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18 }}>Generated {TYPE_LABELS[ctype]}</div>
            {output && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={shared.btnOutline} onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2200); }}>
                  {copied ? "Copied!" : "Copy text"}
                </button>
                <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB" }} onClick={handleDownload} disabled={dlLoading}>
                  {dlLoading ? "Preparing..." : "Download .docx"}
                </button>
                <button style={shared.btnGreen} onClick={() => saveToFirestore("finalized")} disabled={saving}>
                  {saving ? "Saving..." : "Save to Repository"}
                </button>
              </div>
            )}
          </div>

          {genning && <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey, padding: "14px 0" }}>Writing your {TYPE_LABELS[ctype]}...</div>}
          {genErr   && <div style={{ background: C.errorBg, color: C.errorText, borderRadius: 4, padding: "12px 16px", fontFamily: F.head, fontSize: 13 }}>{genErr}</div>}

          {output && (
            <>
              {ctype === "case_story" && (photo1 || photo2) && (
                <div style={{ display: "flex", gap: 12, margin: "0 0 16px 0" }}>
                  {photo1 && <img src={photo1.preview} alt="Photo 1" style={{ flex: 1, maxHeight: 160, objectFit: "cover", borderRadius: 4 }} />}
                  {photo2 && <img src={photo2.preview} alt="Photo 2" style={{ flex: 1, maxHeight: 160, objectFit: "cover", borderRadius: 4 }} />}
                </div>
              )}
              <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "20px 22px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                {output}
              </div>
              <div style={{ marginTop: 14, fontFamily: F.head, fontSize: 11, color: C.grey }}>
                Happy with this? Click <strong>Save to Repository</strong> to share with the team, or <strong>Download .docx</strong> for a formatted Word file.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
