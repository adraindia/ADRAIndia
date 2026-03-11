// api/docx.js — server-side .docx generation using docx v7
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle } from "docx";

const TYPE_LABELS = { case_story: "Case Story", newsletter: "Newsletter Update", report: "Impact Report" };
const GREEN = "007B5F";
const GREY  = "54585A";

async function fetchLogo() {
  try {
    const res = await fetch("https://adraindia.org/wp-content/uploads/2022/11/ADRA-Vertical-Logo.png",
      { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

function makePara(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing:   { before: opts.before || 0, after: opts.after || 120 },
    indent:    opts.indent ? { left: opts.indent } : undefined,
    border:    opts.borderBottom ? { bottom: { style: BorderStyle.SINGLE, size: opts.borderBottom, color: opts.borderColor || GREEN, space: 1 } } : undefined,
    bullet:    opts.bullet ? { level: 0 } : undefined,
    children: text ? [new TextRun({
      text,
      bold:    opts.bold    || false,
      italics: opts.italic  || false,
      size:    opts.size    || 22,
      color:   opts.color   || "000000",
      font:    { name: opts.font || "Calibri" },
    })] : [],
  });
}

function contentToParagraphs(content) {
  const lines = content.split("\n");
  const paras = [];
  let firstHeadlineDone = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) { paras.push(new Paragraph({ spacing: { after: 80 }, children: [] })); continue; }

    if (!firstHeadlineDone) {
      firstHeadlineDone = true;
      paras.push(makePara(t, { bold: true, size: 32, color: GREEN, before: 120, after: 240 }));
      continue;
    }
    if (t.startsWith('"') || t.startsWith('\u201C') || t.startsWith('\u2018')) {
      paras.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        indent:    { left: 720, right: 720 },
        spacing:   { before: 200, after: 200 },
        border:    { left: { style: BorderStyle.THICK, size: 12, color: GREEN, space: 12 } },
        children:  [new TextRun({ text: t, italics: true, size: 24, color: GREY, font: { name: "Georgia" } })],
      }));
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("• ")) {
      paras.push(new Paragraph({
        spacing: { after: 100 },
        bullet:  { level: 0 },
        children: [new TextRun({ text: t.replace(/^[-•]\s+/, ""), size: 22, font: { name: "Calibri" } })],
      }));
      continue;
    }
    if (/^[A-Z][A-Z\s&:/]+$/.test(t) && t.length < 60) {
      paras.push(makePara(t, { bold: true, size: 24, color: GREEN, before: 280, after: 120 }));
      continue;
    }
    paras.push(makePara(t, { after: 140 }));
  }
  return paras;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type, content, data, photo1, photo2 } = req.body;
    if (!content) return res.status(400).json({ error: "Missing content" });

    // ── Logo ──────────────────────────────────────────────────────────────────
    const logoBuffer = await fetchLogo();
    const headerChildren = [];
    if (logoBuffer) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { after: 80 },
        children:  [new ImageRun({ data: logoBuffer, transformation: { width: 65, height: 75 }, type: "png" })],
      }));
    }
    headerChildren.push(
      makePara("ADRA India", { align: AlignmentType.CENTER, bold: true, size: 28, color: GREEN, after: 40 }),
      makePara(TYPE_LABELS[type] || "Document", { align: AlignmentType.CENTER, size: 20, color: GREY, after: 40 }),
      makePara(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        { align: AlignmentType.CENTER, size: 18, color: GREY, after: 200 }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 1 } }, spacing: { after: 280 }, children: [] }),
    );

    // ── Meta rows ─────────────────────────────────────────────────────────────
    const metaRows = [];
    if (data?.projectName)   metaRows.push(["Project",      data.projectName]);
    if (data?.donorName)     metaRows.push(["Donor",        data.donorName]);
    if (data?.geography || data?.location) metaRows.push(["Geography", data.geography || data.location]);
    if (data?.reportingPeriod) metaRows.push(["Period",     data.reportingPeriod]);
    if (data?.submitterName) metaRows.push(["Submitted by", data.submitterName]);

    const metaParas = metaRows.map(([k, v]) => new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${k}:  `, bold: true, size: 20, color: GREY, font: { name: "Calibri" } }),
        new TextRun({ text: v || "",                size: 20,               font: { name: "Calibri" } }),
      ],
    }));
    if (metaParas.length) {
      metaParas.push(new Paragraph({
        border:   { bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
        spacing:  { after: 280 },
        children: [],
      }));
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    const bodyParas = contentToParagraphs(content);

    // ── Photos ────────────────────────────────────────────────────────────────
    const photoParas = [];
    if (type === "case_story" && (photo1 || photo2)) {
      photoParas.push(new Paragraph({
        border:   { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
        spacing:  { before: 320, after: 160 },
        children: [new TextRun({ text: "FIELD PHOTOS", bold: true, size: 20, color: GREEN, font: { name: "Calibri" } })],
      }));
      for (const photoDataUrl of [photo1, photo2].filter(Boolean)) {
        try {
          const base64 = photoDataUrl.includes(",") ? photoDataUrl.split(",")[1] : photoDataUrl;
          const buf = Buffer.from(base64, "base64");
          photoParas.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing:   { after: 120 },
            children:  [new ImageRun({ data: buf, transformation: { width: 380, height: 260 }, type: "jpeg" })],
          }));
        } catch (e) { console.warn("Photo embed failed:", e.message); }
      }
    }

    // ── Photo URLs (newsletter) ───────────────────────────────────────────────
    const urlParas = [];
    const photoUrls = [1,2,3,4,5].map(i => data?.[`photoUrl${i}`]).filter(Boolean);
    if (type === "newsletter" && photoUrls.length) {
      urlParas.push(makePara("PHOTO REFERENCES", { bold: true, size: 20, color: GREEN, before: 280, after: 120 }));
      photoUrls.forEach((url, i) => {
        urlParas.push(makePara(`Photo ${i + 1}: ${url}`, { size: 18, color: "2563EB", after: 80 }));
      });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerParas = [
      new Paragraph({
        border:    { top: { style: BorderStyle.SINGLE, size: 4, color: GREEN, space: 1 } },
        spacing:   { before: 400, after: 80 },
        alignment: AlignmentType.CENTER,
        children:  [new TextRun({ text: "ADRA India  |  adraindia.org  |  Justice. Compassion. Love.", size: 16, color: GREY, font: { name: "Calibri" } })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children:  [new TextRun({ text: "This document is for internal use only.", size: 14, color: "AAAAAA", font: { name: "Calibri" } })],
      }),
    ];

    // ── Assemble ──────────────────────────────────────────────────────────────
    const docx = new Document({
      sections: [{
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        children: [...headerChildren, ...metaParas, ...bodyParas, ...photoParas, ...urlParas, ...footerParas],
      }],
    });

    const buffer   = await Packer.toBuffer(docx);
    const label    = (TYPE_LABELS[type] || "Document").replace(/\s+/g, "_");
    const proj     = (data?.projectName || "ADRA").replace(/\s+/g, "_").slice(0, 40);
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `${label}_${proj}_${date}.docx`;

    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length",      buffer.length);
    return res.status(200).send(buffer);

  } catch (err) {
    console.error("docx generation error:", err);
    return res.status(500).json({ error: err.message || "docx generation failed" });
  }
}
