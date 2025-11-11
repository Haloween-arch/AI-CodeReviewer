// src/utils/export.js
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMarkdown(results) {
  const r = results || {};
  const md = `# CodeSAGE Report

## Summary
- Total issues: ${r.summary?.totalIssues ?? 0}
- Critical: ${r.summary?.critical ?? 0}
- High: ${r.summary?.high ?? 0}
- Medium: ${r.summary?.medium ?? 0}
- Low: ${r.summary?.low ?? 0}
- Security Score: ${r.summary?.securityScore ?? "-"}
- Quality Score: ${r.summary?.qualityScore ?? "-"}

## Issues
${(r.issues || [])
  .map(
    (i) =>
      `- [${i.severity}] (${i.type}) line ${i.line}: ${i.message}\n  - Suggestion: ${i.suggestion}`
  )
  .join("\n")}
`;
  downloadText("codesage-report.md", md);
}

export async function exportPDF(selector = "body") {
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const el = document.querySelector(selector);
    const canvas = await html2canvas(el, { backgroundColor: "#0b1220", scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, "PNG", 0, 0, pageW, pageH);
    pdf.save("codesage-report.pdf");
  } catch (e) {
    alert("PDF export needs 'html2canvas' and 'jspdf'. Install and retry.");
  }
}
