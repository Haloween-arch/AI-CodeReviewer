// src/services/api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

/* -------------------------------------------------------
   🔍 ANALYZE — Master Aggregated Analysis Endpoint
------------------------------------------------------- */
export async function analyzeAll(code, language) {
  const res = await axios.post(`${API_BASE}/analyze`, {
    code,
    language
  });

  const data = res.data.results || {};

  const issues = [];
  const raw = {
    syntax: data.syntax,
    style: data.style,
    security: data.security,
    quality: data.quality,
    rule: data.rule
  };

  /* ----------------------------
     🔹 SYNTAX SERVICE
  ---------------------------- */
  if (data.syntax?.errors?.length) {
    data.syntax.errors.forEach(err => {
      issues.push({
        severity: "high",
        type: "syntax",
        line: err.line,
        message: err.message,
        suggestion: "Fix syntax error"
      });
    });
  }

  /* ----------------------------
     🔹 STYLE SERVICE (local lint)
  ---------------------------- */
  if (data.style?.local_issues?.length) {
    data.style.local_issues.forEach(i => {
      issues.push({
        severity: i.severity || "medium",
        type: "style",
        line: i.line,
        message: i.message,
        suggestion: "Follow code style"
      });
    });
  }

  /* ----------------------------
     🔹 STYLE SERVICE (AI review)
  ---------------------------- */
  if (data.style?.ai_review?.issues?.length) {
    data.style.ai_review.issues.forEach(i => {
      issues.push({
        severity: "medium",
        type: "style",
        line: i.line,
        message: i.message,
        suggestion: i.suggestion || "Improve readability"
      });
    });
  }

  /* ----------------------------
     🔹 SECURITY SERVICE (Bandit)
  ---------------------------- */
  if (data.security?.security_issues?.bandit?.results?.length) {
    data.security.security_issues.bandit.results.forEach(sec => {
      issues.push({
        severity: "high",
        type: "security",
        line: sec.line_number,
        message: sec.issue_text,
        suggestion: sec.issue_cwe || "Fix security flaw"
      });
    });
  }

  /* ----------------------------
     🔹 SECURITY SERVICE (AI)
  ---------------------------- */
  if (data.security?.ai?.issues?.length) {
    data.security.ai.issues.forEach(sec => {
      issues.push({
        severity: sec.severity || "medium",
        type: "security",
        line: sec.line,
        message: sec.message,
        suggestion: sec.suggestion || "Fix security issue"
      });
    });
  }

  /* ----------------------------
     🔹 QUALITY SERVICE
  ---------------------------- */
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

  /* ----------------------------
     🔹 RULE ENGINE
  ---------------------------- */
  if (data.rule?.issues?.length) {
    data.rule.issues.forEach(r => {
      issues.push({
        severity: r.severity,
        type: "rule",
        line: r.line,
        message: r.message,
        suggestion: r.suggestion || "Fix rule violation"
      });
    });
  }

  /* -------------------------------------------------------
     📊 UPDATED SUMMARY — Using style_v5 combined score
  ------------------------------------------------------- */
  const styleSummary = data.style?.summary || {};

  const summary = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    high: issues.filter(i => i.severity === "high").length,
    medium: issues.filter(i => i.severity === "medium").length,
    low: issues.filter(i => i.severity === "low" || i.severity === "style").length,

    /* From style service v5 — weighted score */
    qualityScore: styleSummary.qualityScore || 0,
    qualityScoreLocal: styleSummary.qualityScoreLocal || 0,
    qualityScoreAI: styleSummary.qualityScoreAI || 0,

    securityScore: 100 - issues.filter(i => i.type === "security").length * 10,
  };

  return { issues, summary, raw };
}

/* -------------------------------------------------------
   🧠 STYLE OPTIMIZER (Gemini Rewrite)
------------------------------------------------------- */
export async function optimizeStyle(code, language, prefer_readability = true) {
  const res = await axios.post(`${API_BASE}/optimize/style`, {
    code,
    language,
    prefer_readability
  });

  return res.data;
}
