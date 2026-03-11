// api/docx.js
// Vercel serverless function — generates a branded .docx file server-side.
// Uses the 'docx' npm package (no CDN dependency).

import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, BorderStyle, WidthType,
} from "docx";

const TYPE_LABELS = {
  case_story: "Case Story",
  newsletter:  "Newsletter Update",
  report:      "Impact Report",
};

const GREEN       = "007B5F";
const GREY        = "54585A";

// Fetch ADRA logo as buffer (graceful fallback if unreachable)
async function fetchLogo() {
  try {
    const res = await fetch(
      "https://adraindia.org/wp-content/uploads/2022/11/ADRA-Vertical-Logo.png",
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Parse plain-text content into docx Paragraph objects
function contentToParagraphs(content, { Paragraph, TextRun, AlignmentType, BorderStyle }) {
  const lines = content.split("\n");
  const paras = [];
  let firstHeadlineDone = false;

  for (const line of lines) {
    const t = line.trim();

    if (!t) {
      paras.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }

    // First non-empty line = headline
    if (!firstHeadlineDone) {
      firstHeadlineDone = true;
      paras.push(new Paragraph({
        spacing: { before: 120, after: 240 },
        children: [new TextRun({ text: t, bold: true, size: 32, color: GREEN, font: "Calibri" })],
      }));
      continue;
    }

    // Pull-quote (starts with " or ")
    if (t.startsWith('"') || t.startsWith('\u201C') || t.startsWith('\u2018')) {
      paras.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        indent:    { left: 720, right: 720 },
        spacing:   { before: 200, after: 200 },
        border:    { left: { style: BorderStyle.THICK, size: 12, color: GREEN, space: 12 } },
        children:  [new TextRun({ text: t, italics: true, size: 24, color: GREY, font: "Georgia" })],
      }));
      continue;
    }

    // Bullet point
    if (t.startsWith("- ") || t.startsWith("• ")) {
      paras.push(new Paragraph({
        spacing: { after: 100 },
        bullet:  { level: 0 },
        children: [new TextRun({ text: t.replace(/^[-•]\s+/, ""), size: 22, font: "Calibri" })],
      }));
      continue;
    }

    // Section heading (ALL CAPS, short)
    if (/^[A-Z][A-Z\s&:/]+$/.test(t) && t.length < 60) {
      paras.push(new Paragraph({
        spacing: { before: 280, after: 120 },
        children: [new TextRun({ text: t, bold: true, size: 24, color: GREEN, font: "Calibri" })],
      }));
      continue;
    }

    // Regular paragraph
    paras.push(new Paragraph({
      spacing: { after: 140 },
      children: [new TextRun({ text: t, size: 22, font: "Calibri" })],
    }));
  }

  return paras;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, content, data, photo1, photo2 } = req.body;
  if (!content) return res.status(400).json({ error: "Missing content" });

  // ── Logo ────────────────────────────────────────────────────────────────────
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
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: "ADRA India", bold: true, size: 28, color: GREEN, font: "Calibri" })],
      spacing:   { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: TYPE_LABELS[type] || "Document", size: 20, color: GREY, font: "Calibri" })],
      spacing:   { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({
        text: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        size: 18, color: GREY, font: "Calibri",
      })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      border:   { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 1 } },
      spacing:  { after: 280 },
      children: [],
    }),
  );

  // ── Meta rows ───────────────────────────────────────────────────────────────
  const metaRows = [];
  if (data?.projectName)     metaRows.push(["Project",      data.projectName]);
  if (data?.donorName)       metaRows.push(["Donor",        data.donorName]);
  if (data?.geography || data?.location) metaRows.push(["Geography", data.geography || data.location]);
  if (data?.reportingPeriod) metaRows.push(["Period",       data.reportingPeriod]);
  if (data?.submitterName)   metaRows.push(["Submitted by", data.submitterName]);

  const metaParas = metaRows.map(([k, v]) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${k}:  `, bold: true, size: 20, color: GREY, font: "Calibri" }),
        new TextRun({ text: v || "", size: 20, font: "Calibri" }),
      ],
    })
  );
  if (metaParas.length) {
    metaParas.push(new Paragraph({
      border:   { bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
      spacing:  { after: 280 },
      children: [],
    }));
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const bodyParas = contentToParagraphs(content, { Paragraph, TextRun, AlignmentType, BorderStyle });

  // ── Photos (case story) ─────────────────────────────────────────────────────
  const photoParas = [];
  if (type === "case_story" && (photo1 || photo2)) {
    photoParas.push(new Paragraph({
      border:   { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
      spacing:  { before: 320, after: 160 },
      children: [new TextRun({ text: "FIELD PHOTOS", bold: true, size: 20, color: GREEN, font: "Calibri" })],
    }));

    for (const photoDataUrl of [photo1, photo2].filter(Boolean)) {
      try {
        const base64 = photoDataUrl.includes(",") ? photoDataUrl.split(",")[1] : photoDataUrl;
        const buf = Buffer.from(base64, "base64");
        photoParas.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 120 },
          children:  [new ImageRun({ data: buf, transformation: { width: 380, height: 260 }, type: "jpg" })],
        }));
      } catch (e) {
        console.warn("Photo embed failed:", e.message);
      }
    }

    if (data?.photoCredit) {
      photoParas.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { after: 120 },
        children:  [new TextRun({ text: data.photoCredit, size: 16, color: GREY, italics: true, font: "Calibri" })],
      }));
    }
  }

  // ── Photo URLs (newsletter) ──────────────────────────────────────────────────
  const urlParas = [];
  const photoUrls = [1,2,3,4,5].map(i => data?.[`photoUrl${i}`]).filter(Boolean);
  if (type === "newsletter" && photoUrls.length) {
    urlParas.push(new Paragraph({
      spacing:  { before: 280, after: 120 },
      children: [new TextRun({ text: "PHOTO REFERENCES", bold: true, size: 20, color: GREEN, font: "Calibri" })],
    }));
    photoUrls.forEach((url, i) => {
      urlParas.push(new Paragraph({
        spacing:  { after: 80 },
        children: [new TextRun({ text: `Photo ${i + 1}: ${url}`, size: 18, color: "2563EB", font: "Calibri" })],
      }));
    });
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerParas = [
    new Paragraph({
      border:    { top: { style: BorderStyle.SINGLE, size: 4, color: GREEN, space: 1 } },
      spacing:   { before: 400, after: 80 },
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: "ADRA India  |  adraindia.org  |  Justice. Compassion. Love.", size: 16, color: GREY, font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: "This document is for internal use only.", size: 14, color: "AAAAAA", font: "Calibri" })],
    }),
  ];

  // ── Assemble ─────────────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [
        ...headerChildren,
        ...metaParas,
        ...bodyParas,
        ...photoParas,
        ...urlParas,
        ...footerParas,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const label  = (TYPE_LABELS[type] || "Document").replace(/\s+/g, "_");
  const proj   = (data?.projectName || "ADRA").replace(/\s+/g, "_").slice(0, 40);
  const date   = new Date().toISOString().slice(0, 10);
  const filename = `${label}_${proj}_${date}.docx`;

  res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length",      buffer.length);
  return res.status(200).send(buffer);
}
