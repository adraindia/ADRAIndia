// src/utils/docxExport.js
// Calls /api/docx serverless function to generate the .docx server-side.
// No CDN dependency — docx npm package runs on Vercel, not in the browser.

import { TYPE_LABELS } from "./fields.js";

export async function downloadDocx({ type, content, data, photo1 = null, photo2 = null }) {
  const res = await fetch("/api/docx", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ type, content, data, photo1, photo2 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const blob  = await res.blob();
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  const label = (TYPE_LABELS[type] || "Document").replace(/\s+/g, "_");
  const proj  = (data?.projectName || "ADRA").replace(/\s+/g, "_").slice(0, 40);
  const date  = new Date().toISOString().slice(0, 10);
  a.href      = url;
  a.download  = `${label}_${proj}_${date}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
