import { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

// Compress an image file to a small base64 JPEG (max 400px wide, ~50KB)
// so it can be stored in Firestore without needing Firebase Storage.
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
import { CASE_FIELDS, NEWSLETTER_FIELDS, REPORT_FIELDS, TYPE_LABELS, TYPE_ICONS, TYPE_DESCS } from "../utils/fields.js";
import { C, F, shared } from "../utils/theme.js";

export default function Submit({ user }) {
  const [ctype,   setCtype]   = useState("case_story");
  const [form,    setForm]    = useState({});
  const [photo,   setPhoto]   = useState(null); // { file, preview, base64, mime }
  const [genning, setGenning] = useState(false);
  const [output,  setOutput]  = useState("");
  const [genErr,  setGenErr]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [savedOk, setSavedOk] = useState("");
  const [copied,  setCopied]  = useState(false);
  const fileRef = useRef();

  const getFields = () =>
    ctype === "case_story" ? CASE_FIELDS : ctype === "newsletter" ? NEWSLETTER_FIELDS : REPORT_FIELDS;

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handlePhotoFile(file) {
    if (!file) return;
    // Compress to ~400px wide JPEG before storing — keeps Firestore doc small
    const compressed = await compressImage(file);
    setPhoto({
      preview:  compressed,
      base64:   compressed.split(",")[1],
      mime:     "image/jpeg",
    });
  }

  // ── Call the Vercel serverless function (keeps API key server-side)
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
        body: JSON.stringify({ type: ctype, data: form, photoBase64: photo?.base64 || null, photoMime: photo?.mime || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setOutput(json.content);
    } catch (e) {
      setGenErr("Generation failed: " + e.message);
    }
    setGenning(false);
  }

  // ── Save submission to Firestore
  // Photo is stored as a compressed base64 string directly in the document.
  // No Firebase Storage needed — works on the free Spark plan.
  async function saveToFirestore(status = "draft") {
    const fields = getFields();
    if (!form[fields[0].k]) { alert("Please fill in at least the first few fields."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "submissions"), {
        type:             ctype,
        data:             form,
        photoData:        photo?.preview || null,   // compressed base64 JPEG
        generatedContent: output || "",
        status:           status,
        userId:           user.uid,
        userEmail:        user.email,
        userName:         user.displayName,
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
      });

      setSavedOk(status === "finalized" ? "Saved to repository!" : "Draft saved!");
      setTimeout(() => setSavedOk(""), 3500);
      if (status === "finalized") {
        setForm({}); setPhoto(null); setOutput(""); setGenErr("");
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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 24px" }}>

      <div style={shared.card}>
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 21, color: C.black, marginBottom: 4 }}>Submit field data</div>
        <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey, marginBottom: 24, letterSpacing: "0.01em" }}>
          Choose content type → fill the form → generate instantly or save for later
        </div>

        {/* Type selector */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 26 }}>
          {Object.keys(TYPE_LABELS).map(key => (
            <div key={key}
              style={{ padding: "16px 12px", border: `2px solid ${ctype === key ? C.green : C.greyBorder}`, borderRadius: 5, background: ctype === key ? C.greenLight : C.white, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}
              onClick={() => { setCtype(key); setForm({}); setOutput(""); setGenErr(""); }}>
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
              ? <textarea style={{ ...shared.inputBase, minHeight: 85, resize: "vertical", lineHeight: 1.65 }} placeholder={f.ph} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)} rows={["background","intervention","keyIndicators"].includes(f.k) ? 4 : 3} />
              : f.type === "select"
              ? <select style={{ ...shared.inputBase, cursor: "pointer" }} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)}>
                  <option value="">— Select —</option>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              : <input style={shared.inputBase} type="text" placeholder={f.ph} value={form[f.k] || ""} onChange={e => setField(f.k, e.target.value)} />
            }
          </div>
        ))}

        {/* Photo upload */}
        <div style={{ marginBottom: 18 }}>
          <label style={shared.fieldLabel}>Upload a field photo (optional)</label>
          <div
            style={{ border: `2px dashed ${photo ? C.green : C.greyBorder}`, borderRadius: 5, padding: "18px 14px", textAlign: "center", cursor: "pointer", background: photo ? C.greenLight : C.greyLight, transition: "all 0.15s" }}
            onClick={() => fileRef.current?.click()}>
            {photo
              ? <img src={photo.preview} alt="Field photo" style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 4, objectFit: "cover" }} />
              : <>
                  <div style={{ fontSize: 26, marginBottom: 5 }}>📷</div>
                  <div style={{ fontFamily: F.head, fontSize: 12, color: C.grey }}>Click to upload a field photo</div>
                  <div style={{ fontFamily: F.head, fontSize: 10, color: C.grey, marginTop: 2 }}>JPG, PNG — max ~3MB recommended</div>
                </>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handlePhotoFile(e.target.files[0])} />
          {photo && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <button style={shared.btnRed} onClick={() => setPhoto(null)}>Remove photo</button>
              <span style={{ fontFamily: F.head, fontSize: 11, color: C.green }}>✓ Photo attached — AI will reference it</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 20 }}>
          <button style={shared.btnGreen} onClick={callGenerate} disabled={genning}>
            {genning ? "⏳ Writing…" : `✨ Generate ${TYPE_LABELS[ctype]}`}
          </button>
          <button style={shared.btnOutline} onClick={() => saveToFirestore("draft")} disabled={saving}>
            {saving ? "Saving…" : "💾 Save Draft"}
          </button>
          {savedOk && <span style={{ fontFamily: F.head, fontSize: 12, color: C.green }}>✓ {savedOk}</span>}
        </div>
      </div>

      {/* Generated output */}
      {(genning || output || genErr) && (
        <div style={shared.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18 }}>Generated {TYPE_LABELS[ctype]}</div>
            {output && (
              <div style={{ display: "flex", gap: 10 }}>
                <button style={shared.btnOutline} onClick={copyText}>{copied ? "✓ Copied!" : "Copy"}</button>
                <button style={shared.btnGreen} onClick={() => saveToFirestore("finalized")} disabled={saving}>
                  {saving ? "Saving…" : "✅ Save to Repository"}
                </button>
              </div>
            )}
          </div>
          {genning && <div style={{ fontFamily: F.head, fontSize: 13, color: C.grey, padding: "14px 0" }}>Writing your {TYPE_LABELS[ctype]}…</div>}
          {genErr  && <div style={{ background: C.errorBg, color: C.errorText, borderRadius: 4, padding: "12px 16px", fontFamily: F.head, fontSize: 13 }}>{genErr}</div>}
          {output  && (
            <div style={{ background: C.greyLight, border: `1px solid ${C.greyBorder}`, borderLeft: `4px solid ${C.green}`, borderRadius: 4, padding: "20px 22px", whiteSpace: "pre-wrap", fontFamily: F.body, fontSize: 14, lineHeight: 1.85 }}>
              {output}
            </div>
          )}
          {output && (
            <div style={{ marginTop: 14, fontFamily: F.head, fontSize: 11, color: C.grey }}>
              Happy with this? Click <strong>Save to Repository</strong> to add it to the shared library. Or <strong>Save Draft</strong> to revise later.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
