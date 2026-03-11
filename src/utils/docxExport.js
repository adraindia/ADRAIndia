// Client-side .docx generation using the docx library loaded from CDN.
// Produces a formatted Word document with ADRA branding, text content, and embedded photos.

import { ADRA_LOGO } from "./logo.js";
import { TYPE_LABELS } from "./fields.js";

// Dynamically load docx from CDN if not already loaded
async function loadDocx() {
  if (window.__docxLib) return window.__docxLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  window.__docxLib = window.docx;
  return window.__docxLib;
}

// Convert a base64 data URL to a Uint8Array for ImageRun
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Get actual image dimensions from a data URL
function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img   = new Image();
    img.onload  = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src     = dataUrl;
  });
}

export async function downloadDocx({ type, content, data, photo1 = null, photo2 = null }) {
  const docx = await loadDocx();
  const {
    Document, Packer, Paragraph, TextRun, ImageRun,
    AlignmentType, HeadingLevel, BorderStyle, ShadingType,
    WidthType, Table, TableRow, TableCell,
  } = docx;

  const GREEN       = "007B5F";
  const GREY        = "54585A";
  const LIGHT_GREEN = "E6F2EE";
  const pageWidth   = 9360; // DXA (US Letter, 1" margins)

  // ── Logo image ──────────────────────────────────────────────────────────────
  const logoBytes  = dataUrlToUint8Array(ADRA_LOGO);
  const logoRun    = new ImageRun({
    data:          logoBytes,
    type:          "png",
    transformation: { width: 70, height: 80 },
  });

  // ── Header section ──────────────────────────────────────────────────────────
  const headerParagraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [logoRun],
      spacing:   { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: "ADRA India", bold: true, size: 28, color: GREEN, font: "Arial" })],
      spacing:   { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: TYPE_LABELS[type] || "Document", size: 20, color: GREY, font: "Arial" })],
      spacing:   { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children:  [new TextRun({ text: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), size: 18, color: GREY, font: "Arial" })],
      spacing:   { after: 200 },
    }),
    // Divider line
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 1 } },
      spacing: { after: 240 },
      children: [],
    }),
  ];

  // ── Meta info (project, submitter) ─────────────────────────────────────────
  const metaRows = [];
  if (data?.projectName)  metaRows.push(["Project", data.projectName]);
  if (data?.donorName)    metaRows.push(["Donor", data.donorName]);
  if (data?.geography || data?.location) metaRows.push(["Geography", data.geography || data.location]);
  if (data?.reportingPeriod) metaRows.push(["Period", data.reportingPeriod]);
  if (data?.submitterName)   metaRows.push(["Submitted by", data.submitterName]);

  const metaParagraphs = metaRows.map(([k, v]) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: k + ":  ", bold: true, size: 20, color: GREY, font: "Arial" }),
        new TextRun({ text: v || "", size: 20, font: "Arial" }),
      ],
    })
  );

  if (metaParagraphs.length) {
    metaParagraphs.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
      spacing: { after: 280 },
      children: [],
    }));
  }

  // ── Body content (parse plain text into paragraphs) ────────────────────────
  const lines  = content.split("\n");
  const bodyPs = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      bodyPs.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }

    // Detect headline (first non-empty line, or ALL CAPS short line)
    const isHeadline = bodyPs.filter(p => p.children?.length > 0).length === 0 ||
                       (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && trimmed.length > 4);

    // Detect pull-quote (lines starting with " or containing "—")
    const isQuote = trimmed.startsWith('"') || trimmed.startsWith('\u201C');

    if (isHeadline && bodyPs.length < 3) {
      bodyPs.push(new Paragraph({
        spacing: { before: 120, after: 200 },
        children: [new TextRun({ text: trimmed, bold: true, size: 32, color: GREEN, font: "Arial" })],
      }));
    } else if (isQuote) {
      bodyPs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        indent:    { left: 720, right: 720 },
        spacing:   { before: 200, after: 200 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 12 },
        },
        children: [new TextRun({ text: trimmed, italics: true, size: 24, color: GREY, font: "Georgia" })],
      }));
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bodyPs.push(new Paragraph({
        spacing: { after: 100 },
        bullet:  { level: 0 },
        children: [new TextRun({ text: trimmed.slice(2), size: 22, font: "Arial" })],
      }));
    } else if (/^[A-Z][A-Z\s&:]+$/.test(trimmed) && trimmed.length < 60) {
      // Section heading (all caps)
      bodyPs.push(new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: trimmed, bold: true, size: 24, color: GREEN, font: "Arial" })],
      }));
    } else {
      bodyPs.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: trimmed, size: 22, font: "Arial" })],
      }));
    }
  }

  // ── Photo section (case story) ─────────────────────────────────────────────
  const photoPs = [];
  if ((photo1 || photo2) && type === "case_story") {
    photoPs.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 1 } },
      spacing: { before: 280, after: 200 },
      children: [new TextRun({ text: "FIELD PHOTOS", bold: true, size: 20, color: GREEN, font: "Arial" })],
    }));

    for (const photoDataUrl of [photo1, photo2].filter(Boolean)) {
      try {
        const dims    = await getImageDimensions(photoDataUrl);
        const maxW    = 4320; // ~3 inches in EMU (1 inch = 914400 EMU, but docx ImageRun uses pixels)
        const scale   = Math.min(1, 380 / dims.w);
        const dispW   = Math.round(dims.w * scale);
        const dispH   = Math.round(dims.h * scale);
        const bytes   = dataUrlToUint8Array(photoDataUrl);

        photoPs.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing:   { after: 120 },
          children:  [new ImageRun({ data: bytes, type: "jpg", transformation: { width: dispW, height: dispH } })],
        }));
      } catch (e) {
        console.warn("Photo embed failed:", e);
      }
    }

    if (data?.photoCredit) {
      photoPs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { after: 120 },
        children:  [new TextRun({ text: data.photoCredit, size: 16, color: GREY, italics: true, font: "Arial" })],
      }));
    }
  }

  // ── Photo URLs section (newsletter) ────────────────────────────────────────
  const urlPs = [];
  const photoUrls = [1,2,3,4,5].map(i => data?.[`photoUrl${i}`]).filter(Boolean);
  if (photoUrls.length && type === "newsletter") {
    urlPs.push(new Paragraph({
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text: "PHOTO REFERENCES", bold: true, size: 20, color: GREEN, font: "Arial" })],
    }));
    photoUrls.forEach((url, i) => {
      urlPs.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `Photo ${i + 1}: ${url}`, size: 18, color: "2563EB", font: "Arial" })],
      }));
    });
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerPs = [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: GREEN, space: 1 } },
      spacing: { before: 400, after: 80 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "ADRA India  |  adraindia.org  |  Justice. Compassion. Love.", size: 16, color: GREY, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "This document is for internal use only.", size: 14, color: "AAAAAA", font: "Arial" })],
    }),
  ];

  // ── Assemble document ──────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [
        ...headerParagraphs,
        ...metaParagraphs,
        ...bodyPs,
        ...photoPs,
        ...urlPs,
        ...footerPs,
      ],
    }],
  });

  // ── Download ───────────────────────────────────────────────────────────────
  const buffer   = await Packer.toBlob(doc);
  const url      = URL.createObjectURL(buffer);
  const a        = document.createElement("a");
  const filename = `${TYPE_LABELS[type] || "document"}_${(data?.projectName || "ADRA").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.docx`;
  a.href         = url;
  a.download     = filename;
  a.click();
  URL.revokeObjectURL(url);
}
