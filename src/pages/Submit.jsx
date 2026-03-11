import { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { CASE_FIELDS, NEWSLETTER_FIELDS, REPORT_FIELDS, TYPE_LABELS, TYPE_ICONS, TYPE_DESCS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";
import { downloadDocx } from "../utils/docxExport.js";

// Compress image to base64 JPEG — two quality levels:
// "preview" = small (400px, stored in Firestore for display)
// "full"    = larger (1200px, stored for admin full-res download)
function compressImage(file, maxWidth = 400, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale   = Math.min(1, maxWidth / img.width);
        const canvas  = document.createElement("canvas");
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

function PhotoUploadSlot({ label, photo, onFile, onRemove }) {
  const ref = useRef();
  return (
    <div style={{ flex: 1 }}>
      <label style={shared.fieldLabel}>{label}</label>
      <div
        style={{ border: `2px dashed ${photo ? C.green : C.greyBorder}`, borderRadius: 5, padding: photo ? 0 : "14px 10px", textAlign: "center", cursor: "pointer", background: photo ? "transparent" : C.greyLight, overflow: "hidden", minHeight: 90 }}
        onClick={() => ref.current?.click()}>
        {photo
          ? <img src={photo.preview} alt={label} style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
          : <>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
              <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>Click to upload</div>
            </>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => onFile(e.target.files[0])} />
      {photo && (
        <button style={{ ...shared.btnRed, marginTop: 6, fontSize: 10, padding: "4px 8px" }} onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}

export default function Submit({ user }) {
  const [ctype,    setCtype]    = useState("case_story");
  const [form,     setForm]     = useState({});
  const [photo1,   setPhoto1]   = useState(null);
  const [photo2,   setPhoto2]   = useState(null);
  const [genning,  setGenning]  = useState(false);
  const [output,   setOutput]   = useState("");
  const [genErr,   setGenErr]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState("");
  const [copied,   setCopied]   = useState(false);
  const [dlLoading,setDlLoading]= useState(false);

  const getFields = () =>
    ctype === "case_story" ? CASE_FIELDS : ctype === "newsletter" ? NEWSLETTER_FIELDS : REPORT_FIELDS;

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handlePhoto(slot, file) {
    if (!file) return;
    const [preview, full] = await Promise.all([
      compressImage(file, 400,  0.65),  // small for display + AI
      compressImage(file, 1200, 0.88),  // larger for full-res download
    ]);
    const obj = { preview, previewB64: preview.split(",")[1], fullData: full };
    if (slot === 1) setPhoto1(obj);
    else            setPhoto2(obj);
  }

  async function callGenerate() {
    const fields = getFields();
    for (const f of fields.slice(0, 3)) {
      if (!form[f.k]) { alert(`Please fill in: ${f.label}`); return; }
    }
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
    const fields = getFields();
    if (!form[fields[0].k]) { alert("Please fill in at least the first few fields."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "submissions"), {
        type:             ctype,
        data:             form,
        // Preview (400px) for display
        photo1Data:       photo1?.preview  || null,
        photo2Data:       photo2?.preview  || null,
        // Full-res (1200px) for admin download
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
        setForm({}); setPhoto1(null); setPhoto2(null); setOutput(""); setGenErr("");
      }
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  }

  function copyText() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
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
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black, marginBottom: 4 }}>Submit field data</div>
        <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginBottom: 24 }}>
          Choose content type, fill the form, then generate or save for later
        </div>

        {/* Type selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 26 }}>
          {Object.keys(TYPE_LABELS).map(key => (
            <div key={key}
              style={{ padding: "16px 12px", border: `2px solid ${ctype === key ? C.green : C.greyBorder}`, borderRadius: 5, background: ctype === key ? C.greenLight : C.white, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}
              onClick={() => { setCtype(key); setForm({}); setPhoto1(null); setPhoto2(null); setOutput(""); setGenErr(""); }}>
              <div style={{ fontSize: 24, marginBottom: 5 }}>{TYPE_ICONS[key]}</div>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 12, color: ctype === key ? C.green : C.black }}>{TYPE_LABELS[key]}</div>
              <div style={{ fontFamily: F.head, fontSize: 10, color: C.grey, marginTop: 3 }}>{TYPE_DESCS[key]}</div>
            </div>
          ))}
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${C.greyBorder}`, margin: "0 0 22px 0" }} />

        {/* Form fields */}
        {getFields().map(f => (
          <div key={f.k} style={{ marginBottom: 16 }}>
            <label style={shared.fieldLabel}>{f.label}</label>
            {f.type === "textarea"
              ? <textarea style={{ ...shared.inputBase, minHeight: 85, resize: "vertical", lineHeight: 1.65 }} placeholder={f.ph} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)} rows={3} />
              : f.type === "select"
              ? <select style={{ ...shared.inputBase, cursor: "pointer" }} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)}>
                  <option value="">Select...</option>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              : <input style={shared.inputBase} type="text" placeholder={f.ph} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)} />
            }
          </div>
        ))}

        {/* Photo upload — Case Story only (2 slots) */}
        {ctype === "case_story" && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 13, color: C.black, marginBottom: 10 }}>
              Field Photos (up to 2)
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <PhotoUploadSlot label="Photo 1" photo={photo1} onFile={f => handlePhoto(1, f)} onRemove={() => setPhoto1(null)} />
              <PhotoUploadSlot label="Photo 2 (optional)" photo={photo2} onFile={f => handlePhoto(2, f)} onRemove={() => setPhoto2(null)} />
            </div>
            {(photo1 || photo2) && (
              <div style={{ marginTop: 8, fontFamily: F.head, fontSize: 11, color: C.green }}>
                Photos will be embedded in the generated story and .docx download
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 20 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18 }}>Generated {TYPE_LABELS[ctype]}</div>
            {output && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={shared.btnOutline} onClick={copyText}>{copied ? "Copied!" : "Copy text"}</button>
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
              {/* Inline photo preview inside generated story */}
              {ctype === "case_story" && (photo1 || photo2) && (
                <div style={{ display: "flex", gap: 12, margin: "12px 0 16px 0" }}>
                  {photo1 && <img src={photo1.preview} alt="Photo 1" style={{ flex: 1, maxHeight: 160, objectFit: "cover", borderRadius: 4 }} />}
                  {photo2 && <img src={photo2.preview} alt="Photo 2" style={{ flex: 1, maxHeight: 160, objectFit: "cover", borderRadius: 4 }} />}
                </div>
              )}
              <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "20px 22px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
                {output}
              </div>
              <div style={{ marginTop: 14, fontFamily: F.head, fontSize: 11, color: C.grey }}>
                Happy with this? Click <strong>Save to Repository</strong> or <strong>Download .docx</strong>.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
