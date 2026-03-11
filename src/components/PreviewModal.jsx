import { useState } from "react";
import { C, F, shared } from "../utils/theme.js";
import { TYPE_LABELS } from "../utils/fields.js";
import { downloadDocx } from "../utils/docxExport.js";

export default function PreviewModal({ type, content, data, photo1, photo2, onClose }) {
  const [dlLoading, setDlLoading] = useState(false);
  const [dlErr,     setDlErr]     = useState("");
  const [copied,    setCopied]    = useState(false);

  async function handleDownload() {
    setDlLoading(true); setDlErr("");
    try {
      // photo1/photo2 can be an object {preview} or a plain base64 string
      const p1 = photo1?.preview || (typeof photo1 === "string" ? photo1 : null);
      const p2 = photo2?.preview || (typeof photo2 === "string" ? photo2 : null);
      await downloadDocx({ type, content, data, photo1: p1, photo2: p2 });
    } catch (e) {
      setDlErr("Download failed: " + e.message);
    }
    setDlLoading(false);
  }

  const lines    = content.split("\n");
  const headline = lines.find(l => l.trim());
  const body     = lines.slice(lines.indexOf(headline) + 1).join("\n");

  // Resolve preview src — handles both object and plain string
  const p1src = photo1?.preview || (typeof photo1 === "string" ? photo1 : null);
  const p2src = photo2?.preview || (typeof photo2 === "string" ? photo2 : null);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
               display: "flex", alignItems: "flex-start", justifyContent: "center",
               padding: "32px 16px", overflowY: "auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 720,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ background: C.green, padding: "16px 24px", display: "flex",
                      justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 16, color: "#fff" }}>📄 Document Preview</div>
            <div style={{ fontFamily: F.head, fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{TYPE_LABELS[type] || type}</div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                     borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontFamily: F.head, fontSize: 13 }}>
            ✕ Close
          </button>
        </div>

        {/* Document preview */}
        <div style={{ padding: "32px 40px", background: "#FAFAF8" }}>

          {/* Letterhead */}
          <div style={{ textAlign: "center", paddingBottom: 20, marginBottom: 24, borderBottom: `3px solid ${C.green}` }}>
            <img
              src="https://adraindia.org/wp-content/uploads/2022/11/ADRA-Vertical-Logo.png"
              alt="ADRA India"
              style={{ height: 64, marginBottom: 8 }}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 13, color: C.green, letterSpacing: "0.08em" }}>ADRA INDIA</div>
            <div style={{ fontFamily: F.head, fontSize: 11, color: C.grey }}>{TYPE_LABELS[type] || type}</div>
          </div>

          {/* Meta strip */}
          {(data?.projectName || data?.submitterName) && (
            <div style={{ background: "#fff", border: `1px solid ${C.greyBorder}`, borderRadius: 4,
                          padding: "12px 16px", marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
              {data?.projectName   && <div style={{ fontFamily: F.head, fontSize: 12 }}><span style={{ color: C.grey }}>Project: </span><strong>{data.projectName}</strong></div>}
              {data?.submitterName && <div style={{ fontFamily: F.head, fontSize: 12 }}><span style={{ color: C.grey }}>Submitted by: </span><strong>{data.submitterName}</strong></div>}
              {(data?.geography || data?.location) && <div style={{ fontFamily: F.head, fontSize: 12 }}><span style={{ color: C.grey }}>Geography: </span><strong>{data.geography || data.location}</strong></div>}
            </div>
          )}

          {/* Headline */}
          {headline && (
            <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 22, color: C.green,
                          lineHeight: 1.3, marginBottom: 20 }}>{headline}</div>
          )}

          {/* Photos */}
          {type === "case_story" && (p1src || p2src) && (
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {p1src && <img src={p1src} alt="" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
              {p2src && <img src={p2src} alt="" style={{ flex: 1, maxHeight: 180, objectFit: "cover", borderRadius: 4 }} />}
            </div>
          )}

          {/* Body */}
          <div style={{ fontFamily: F.body, fontSize: 15, lineHeight: 1.9, color: "#222" }}>
            {body.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return <div key={i} style={{ height: 10 }} />;
              if (t.startsWith('"') || t.startsWith('\u201C') || t.startsWith('\u2018')) {
                return (
                  <blockquote key={i} style={{ margin: "16px 0", padding: "12px 20px",
                    borderLeft: `4px solid ${C.green}`, background: C.greenLight,
                    fontStyle: "italic", color: C.grey, borderRadius: "0 4px 4px 0" }}>
                    {t}
                  </blockquote>
                );
              }
              if (/^[A-Z][A-Z\s&:/]+$/.test(t) && t.length < 60) {
                return (
                  <div key={i} style={{ fontFamily: F.head, fontWeight: 700, fontSize: 12,
                    color: C.green, letterSpacing: "0.1em", marginTop: 20, marginBottom: 4 }}>
                    {t}
                  </div>
                );
              }
              return <p key={i} style={{ margin: "0 0 12px 0" }}>{t}</p>;
            })}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: `2px solid ${C.green}`,
                        textAlign: "center", fontFamily: F.head, fontSize: 11, color: C.grey }}>
            ADRA India · adraindia.org · Justice. Compassion. Love.
          </div>
        </div>

        {/* Action bar */}
        <div style={{ padding: "16px 24px", background: "#fff", borderTop: `1px solid ${C.greyBorder}`,
                      display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          {dlErr && <span style={{ fontFamily: F.head, fontSize: 12, color: C.errorText, flex: 1 }}>{dlErr}</span>}
          <button style={shared.btnOutline}
            onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2200); }}>
            {copied ? "✓ Copied!" : "Copy text"}
          </button>
          <button style={{ ...shared.btnOutline, borderColor: "#2563EB", color: "#2563EB" }}
            onClick={handleDownload} disabled={dlLoading}>
            {dlLoading ? "⏳ Generating..." : "⬇ Download .docx"}
          </button>
          <button style={shared.btnOutline} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
