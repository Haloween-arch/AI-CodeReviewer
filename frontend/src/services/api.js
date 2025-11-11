// src/services/api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function analyzeAll(code, language) {
  const res = await axios.post(`${API_BASE}/analyze`, {
    code,
    language
  });

  const data = res.data.results || {};

  const issues = [];
  const raw = {};

  /* ✅ Store raw results for raw JSON view */
  raw.syntax = data.syntax;
  raw.style = data.style;
  raw.security = data.security;
  raw.quality = data.quality;
  raw.rule = data.rule;

  /* ✅ SYNTAX */
  if (data.syntax?.errors?.length) {
    data.syntax.errors.forEach(err => {
      issues.push({
        severity: "high",
        type: "syntax",
        line: err.line || 0,
        message: err.message,
        suggestion: "Fix syntax error"
      });
    });
  }

  /* ✅ STYLE (Local Lint) */
  if (data.style?.local_issues?.length) {
    data.style.local_issues.forEach(i => {
      issues.push({
        severity: i.severity || "low",
        type: "style",
        line: i.line || 0,
        message: i.message,
        suggestion: "Follow style guidelines"
      });
    });
  }

  /* ✅ STYLE (AI Review) */
  if (data.style?.ai_review?.issues?.length) {
    data.style.ai_review.issues.forEach(i => {
      issues.push({
        severity: "medium",
        type: "style",
        line: i.line || 0,
        message: i.message,
        suggestion: i.suggestion || "Improve code readability"
      });
    });
  }

  /* ✅ SECURITY (Bandit Static Scan) */
  if (data.security?.security_issues?.bandit?.results?.length) {
    data.security.security_issues.bandit.results.forEach(sec => {
      issues.push({
        severity: "high",
        type: "security",
        line: sec.line_number || 0,
        message: sec.issue_text,
        suggestion: sec.issue_cwe || "Fix vulnerability"
      });
    });
  }

  /* ✅ SECURITY (Gemini AI Review) */
  if (data.security?.ai?.issues?.length) {
    data.security.ai.issues.forEach(sec => {
      issues.push({
        severity: sec.severity || "medium",
        type: "security",
        line: sec.line || 0,
        message: sec.message,
        suggestion: sec.suggestion || "Fix security issue"
      });
    });
  }

  /* ✅ QUALITY ANALYSIS → Time/Space complexity */
  if (data.quality?.analysis) {
    const a = data.quality.analysis;
    issues.push({
      severity: "medium",
      type: "quality",
      line: 0,
      message: `Time: ${a.time_complexity}, Space: ${a.space_complexity}`,
      suggestion: "Optimize algorithm"
    });
  }

  /* ✅ RULE ENGINE */
  if (data.rule?.issues?.length) {
    data.rule.issues.forEach(r => {
      issues.push({
        severity: r.severity || "low",
        type: "rule",
        line: r.line || 0,
        message: r.message,
        suggestion: r.suggestion || "Fix rule violation"
      });
    });
  }

  /* ✅ Summary & Scores */
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    high: issues.filter(i => i.severity === "high").length,
    medium: issues.filter(i => i.severity === "medium").length,
    low: issues.filter(i => i.severity === "low").length,
    securityScore: 100 - issues.filter(i => i.type === "security").length * 10,
    qualityScore: 100 - issues.length * 5
  };

  return { issues, summary, raw };
}
