// src/utils/docxExport.js
// Client-side .docx generation using html-docx-js (bundled by Vite — no CDN, no server).
// Converts a styled HTML string to a Word-compatible .docx Blob and triggers download.

import htmlDocx from "html-docx-js/dist/html-docx";
import { TYPE_LABELS } from "./fields.js";

const GREEN = "#007B5F";
const GREY  = "#54585A";

// Convert plain text content into styled HTML for Word
function contentToHtml({ type, content, data, photo1, photo2 }) {
  const lines    = content.split("\n");
  const headline = lines.find(l => l.trim()) || "";
  const bodyLines = lines.slice(lines.indexOf(headline) + 1);

  const metaRows = [
    data?.projectName   && ["Project",      data.projectName],
    data?.submitterName && ["Submitted by", data.submitterName],
    (data?.geography || data?.location) && ["Geography", data.geography || data.location],
    data?.donorName     && ["Donor",        data.donorName],
    data?.reportingPeriod && ["Period",     data.reportingPeriod],
  ].filter(Boolean);

  const metaHtml = metaRows.length ? `
    <table style="border-collapse:collapse; margin-bottom:18pt; width:100%;">
      ${metaRows.map(([k, v]) => `
        <tr>
          <td style="padding:4pt 10pt 4pt 0; font-weight:bold; color:${GREY}; width:100pt; font-size:10pt;">${k}</td>
          <td style="padding:4pt 0; font-size:10pt;">${v}</td>
        </tr>`).join("")}
    </table>` : "";

  // Build body HTML paragraph by paragraph
  const bodyHtml = bodyLines.map(line => {
    const t = line.trim();
    if (!t) return "<p style='margin:0;'>&nbsp;</p>";
    if (t.startsWith('"') || t.startsWith('\u201C') || t.startsWith('\u2018')) {
      return `<blockquote style="border-left:4pt solid ${GREEN}; margin:12pt 0 12pt 18pt; padding:6pt 12pt; color:${GREY}; font-style:italic; font-size:11pt;">${t}</blockquote>`;
    }
    if (t.startsWith("- ") || t.startsWith("• ")) {
      return `<li style="margin:4pt 0; font-size:11pt;">${t.replace(/^[-•]\s+/, "")}</li>`;
    }
    if (/^[A-Z][A-Z\s&:/]+$/.test(t) && t.length < 60) {
      return `<h3 style="color:${GREEN}; font-size:11pt; font-weight:bold; margin:16pt 0 4pt 0; letter-spacing:0.08em;">${t}</h3>`;
    }
    return `<p style="margin:0 0 8pt 0; font-size:11pt; line-height:1.7;">${t}</p>`;
  }).join("\n");

  // Photos — embed as base64 data URIs (html-docx-js supports inline base64)
  let photosHtml = "";
  if (type === "case_story" && (photo1 || photo2)) {
    const photoSrc1 = photo1?.preview || (typeof photo1 === "string" ? photo1 : null);
    const photoSrc2 = photo2?.preview || (typeof photo2 === "string" ? photo2 : null);
    if (photoSrc1 || photoSrc2) {
      photosHtml = `
        <hr style="border:1pt solid #ccc; margin:20pt 0 12pt 0;" />
        <h3 style="color:${GREEN}; font-size:11pt; font-weight:bold; letter-spacing:0.08em;">FIELD PHOTOS</h3>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            ${photoSrc1 ? `<td style="padding:4pt; text-align:center;"><img src="${photoSrc1}" style="max-width:240pt; max-height:180pt;" /></td>` : ""}
            ${photoSrc2 ? `<td style="padding:4pt; text-align:center;"><img src="${photoSrc2}" style="max-width:240pt; max-height:180pt;" /></td>` : ""}
          </tr>
        </table>`;
    }
  }

  // Photo URLs (newsletter)
  let photoUrlsHtml = "";
  if (type === "newsletter") {
    const urls = [1,2,3,4,5].map(i => data?.[`photoUrl${i}`]).filter(Boolean);
    if (urls.length) {
      photoUrlsHtml = `
        <hr style="border:1pt solid #ccc; margin:20pt 0 12pt 0;" />
        <h3 style="color:${GREEN}; font-size:11pt; font-weight:bold; letter-spacing:0.08em;">PHOTO REFERENCES</h3>
        <ul>${urls.map((u,i) => `<li style="font-size:10pt; color:#2563EB;">Photo ${i+1}: ${u}</li>`).join("")}</ul>`;
    }
  }

  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #222; margin: 0; }
  h1 { color: ${GREEN}; font-size: 18pt; margin: 0 0 12pt 0; line-height: 1.3; }
  blockquote { page-break-inside: avoid; }
  ul, ol { margin: 4pt 0 8pt 0; padding-left: 18pt; }
  table { border-collapse: collapse; }
</style>
</head>
<body>

<!-- LETTERHEAD -->
<table style="width:100%; border-bottom:2pt solid ${GREEN}; padding-bottom:10pt; margin-bottom:14pt;">
  <tr>
    <td>
      <span style="font-size:16pt; font-weight:bold; color:${GREEN};">ADRA India</span><br/>
      <span style="font-size:10pt; color:${GREY};">${TYPE_LABELS[type] || "Document"} &nbsp;·&nbsp; ${dateStr}</span>
    </td>
  </tr>
</table>

<!-- META -->
${metaHtml}

<!-- HEADLINE -->
<h1>${headline}</h1>

<!-- BODY -->
${bodyHtml}

${photosHtml}
${photoUrlsHtml}

<!-- FOOTER -->
<hr style="border:1pt solid ${GREEN}; margin:24pt 0 6pt 0;" />
<p style="text-align:center; font-size:9pt; color:${GREY};">
  ADRA India &nbsp;|&nbsp; adraindia.org &nbsp;|&nbsp; Justice. Compassion. Love.<br/>
  <span style="color:#aaa;">This document is for internal use only.</span>
</p>

</body>
</html>`;
}

export async function downloadDocx({ type, content, data, photo1 = null, photo2 = null }) {
  const html  = contentToHtml({ type, content, data, photo1, photo2 });
  const blob  = htmlDocx.asBlob(html, { orientation: "portrait", margins: { top: 720, right: 720, bottom: 720, left: 720 } });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  const label = (TYPE_LABELS[type] || "Document").replace(/\s+/g, "_");
  const proj  = (data?.projectName || "ADRA").replace(/\s+/g, "_").slice(0, 40);
  const date  = new Date().toISOString().slice(0, 10);
  a.href      = url;
  a.download  = `${label}_${proj}_${date}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
