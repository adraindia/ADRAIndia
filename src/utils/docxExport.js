// src/utils/docxExport.js
// Generates a real .docx file entirely in the browser by building OOXML
// and zipping it with fflate. No CDN, no server, no legacy libraries.
// A .docx is just a ZIP containing a handful of XML files.

import { strToU8, zipSync } from "fflate";
import { TYPE_LABELS } from "./fields.js";

const GREEN = "007B5F";
const GREY  = "54585A";
const enc   = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ── OOXML helpers ─────────────────────────────────────────────────────────────

function rPr({ bold, italic, size = 22, color, font = "Calibri" } = {}) {
  return `<w:rPr>
    ${bold   ? "<w:b/>"              : ""}
    ${italic ? "<w:i/>"              : ""}
    <w:sz w:val="${size}"/><w:szCs w:val="${size}"/>
    ${color  ? `<w:color w:val="${color}"/>` : ""}
    <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>
  </w:rPr>`;
}

function run(text, opts = {}) {
  return `<w:r>${rPr(opts)}<w:t xml:space="preserve">${enc(text)}</w:t></w:r>`;
}

function para(children, { align, spBefore = 0, spAfter = 120, borderBottom, borderTop, indLeft, indRight } = {}) {
  const pPr = `<w:pPr>
    ${align ? `<w:jc w:val="${align}"/>` : ""}
    <w:spacing w:before="${spBefore}" w:after="${spAfter}"/>
    ${indLeft || indRight ? `<w:ind ${indLeft?`w:left="${indLeft}"`:""}${indRight?` w:right="${indRight}"`:""} />` : ""}
    ${borderBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${borderBottom}"/></w:pBdr>` : ""}
    ${borderTop    ? `<w:pBdr><w:top    w:val="single" w:sz="4" w:space="1" w:color="${borderTop}"/></w:pBdr>`    : ""}
  </w:pPr>`;
  return `<w:p>${pPr}${children}</w:p>`;
}

function hrPara(color = "CCCCCC") {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${color}"/></w:pBdr><w:spacing w:after="160"/></w:pPr></w:p>`;
}

// ── Content → paragraphs ──────────────────────────────────────────────────────

function contentToParas(content) {
  const lines = content.split("\n");
  let firstDone = false;
  const out = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) { out.push(`<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`); continue; }

    if (!firstDone) {
      firstDone = true;
      out.push(para(run(t, { bold: true, size: 32, color: GREEN }), { spBefore: 120, spAfter: 240 }));
      continue;
    }

    // Pull-quote
    if (t[0] === '"' || t[0] === '\u201C' || t[0] === '\u2018') {
      out.push(`<w:p>
        <w:pPr>
          <w:spacing w:before="200" w:after="200"/>
          <w:ind w:left="720" w:right="720"/>
          <w:pBdr><w:left w:val="thick" w:sz="12" w:space="12" w:color="${GREEN}"/></w:pBdr>
        </w:pPr>
        ${run(t, { italic: true, size: 24, color: GREY, font: "Georgia" })}
      </w:p>`);
      continue;
    }

    // Bullet
    if (t.startsWith("- ") || t.startsWith("• ")) {
      out.push(`<w:p>
        <w:pPr>
          <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
          <w:spacing w:after="100"/>
        </w:pPr>
        ${run(t.replace(/^[-•]\s+/, ""), { size: 22 })}
      </w:p>`);
      continue;
    }

    // Section heading (ALL CAPS short)
    if (/^[A-Z][A-Z\s&:/]+$/.test(t) && t.length < 60) {
      out.push(para(run(t, { bold: true, size: 24, color: GREEN }), { spBefore: 280, spAfter: 120 }));
      continue;
    }

    out.push(para(run(t, { size: 22 }), { spAfter: 140 }));
  }
  return out.join("\n");
}

// ── Image paragraph (base64 JPEG) ─────────────────────────────────────────────

function imgPara(rId, widthEmu = 3500000, heightEmu = 2400000) {
  return `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
    <w:r><w:rPr/><w:drawing>
      <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:docPr id="1" name="Photo"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="Photo"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing></w:r>
  </w:p>`;
}

// ── Build the full docx ZIP ───────────────────────────────────────────────────

export async function downloadDocx({ type, content, data, photo1 = null, photo2 = null }) {
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const typeLabel = TYPE_LABELS[type] || "Document";

  // Resolve photo sources
  const p1src = photo1?.preview || (typeof photo1 === "string" ? photo1 : null);
  const p2src = photo2?.preview || (typeof photo2 === "string" ? photo2 : null);

  // Extract base64 data from data URLs
  function b64FromDataUrl(src) {
    if (!src) return null;
    return src.includes(",") ? src.split(",")[1] : src;
  }
  const p1b64 = b64FromDataUrl(p1src);
  const p2b64 = b64FromDataUrl(p2src);

  // ── Meta table rows ──
  const metaRows = [
    data?.projectName   && ["Project",      data.projectName],
    data?.submitterName && ["Submitted by", data.submitterName],
    (data?.geography||data?.location) && ["Geography", data.geography||data.location],
    data?.donorName     && ["Donor",        data.donorName],
    data?.reportingPeriod && ["Period",     data.reportingPeriod],
  ].filter(Boolean);

  const metaParas = metaRows.map(([k,v]) =>
    `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>
      ${run(k + ":  ", { bold: true, size: 20, color: GREY })}
      ${run(v || "",    { size: 20 })}
    </w:p>`
  ).join("\n");

  // ── Body paragraphs ──
  const bodyParas = contentToParas(content);

  // ── Photo paragraphs ──
  let photoParas = "";
  let rels = "";
  let imgCount = 0;
  const imgFiles = {};

  if (type === "case_story" && (p1b64 || p2b64)) {
    photoParas += hrPara();
    photoParas += para(run("FIELD PHOTOS", { bold: true, size: 20, color: GREEN }), { spBefore: 160, spAfter: 120 });
    for (const b64 of [p1b64, p2b64].filter(Boolean)) {
      imgCount++;
      const rId   = `rIdImg${imgCount}`;
      const fname = `media/photo${imgCount}.jpeg`;
      imgFiles[`word/${fname}`] = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      rels  += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${fname}"/>`;
      photoParas += imgPara(rId);
    }
  }

  // ── Photo URLs (newsletter) ──
  let urlParas = "";
  if (type === "newsletter") {
    const urls = [1,2,3,4,5].map(i => data?.[`photoUrl${i}`]).filter(Boolean);
    if (urls.length) {
      urlParas += hrPara();
      urlParas += para(run("PHOTO REFERENCES", { bold: true, size: 20, color: GREEN }), { spBefore: 120, spAfter: 80 });
      urls.forEach((u, i) => {
        urlParas += para(run(`Photo ${i+1}: ${u}`, { size: 18, color: "2563EB" }), { spAfter: 80 });
      });
    }
  }

  // ── document.xml ──────────────────────────────────────────────────────────
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>

  <!-- LETTERHEAD -->
  ${para(
    run("ADRA India", { bold: true, size: 28, color: GREEN }) +
    run("  ·  " + typeLabel + "  ·  " + dateStr, { size: 18, color: GREY }),
    { align: "center", spAfter: 80, borderBottom: GREEN }
  )}
  ${para("", { spAfter: 120 })}

  <!-- META -->
  ${metaParas}
  ${metaRows.length ? hrPara() : ""}

  <!-- BODY -->
  ${bodyParas}

  ${photoParas}
  ${urlParas}

  <!-- FOOTER -->
  ${para(
    run("ADRA India  |  adraindia.org  |  Justice. Compassion. Love.", { size: 16, color: GREY }),
    { align: "center", spBefore: 400, spAfter: 60, borderTop: GREEN }
  )}
  ${para(
    run("This document is for internal use only.", { size: 14, color: "AAAAAA" }),
    { align: "center", spAfter: 0 }
  )}

  <w:sectPr>
    <w:pgSz w:w="12240" w:h="15840"/>
    <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/>
  </w:sectPr>
</w:body>
</w:document>`;

  // ── word/_rels/document.xml.rels ─────────────────────────────────────────
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  ${rels}
</Relationships>`;

  // ── word/styles.xml ───────────────────────────────────────────────────────
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  // ── word/numbering.xml (for bullet lists) ────────────────────────────────
  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

  // ── [Content_Types].xml ───────────────────────────────────────────────────
  const imgContentTypes = Array.from({ length: imgCount }, (_, i) =>
    `<Override PartName="/word/media/photo${i+1}.jpeg" ContentType="image/jpeg"/>`
  ).join("\n");

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  ${imgContentTypes}
</Types>`;

  // ── _rels/.rels ───────────────────────────────────────────────────────────
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // ── ZIP it ────────────────────────────────────────────────────────────────
  const files = {
    "[Content_Types].xml":            strToU8(contentTypes),
    "_rels/.rels":                    strToU8(rootRels),
    "word/document.xml":              strToU8(documentXml),
    "word/_rels/document.xml.rels":   strToU8(documentRels),
    "word/styles.xml":                strToU8(stylesXml),
    "word/numbering.xml":             strToU8(numberingXml),
    ...imgFiles,
  };

  const zipped   = zipSync(files, { level: 6 });
  const blob     = new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  const label    = (TYPE_LABELS[type] || "Document").replace(/\s+/g, "_");
  const proj     = (data?.projectName || "ADRA").replace(/\s+/g, "_").slice(0, 40);
  const date     = new Date().toISOString().slice(0, 10);
  a.href         = url;
  a.download     = `${label}_${proj}_${date}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
