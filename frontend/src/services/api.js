// src/services/api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export async function analyzeAll(code, language) {
  const response = await axios.post(`${API_BASE}/analyze`, {
    code,
    language
  });

  const data = response.data.results || {};
  const issues = [];

  // ✅ Syntax
  if (data.syntax?.errors) {
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

  // ✅ Style (local)
  if (data.style?.local_issues) {
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

  // ✅ Style (AI)
  if (data.style?.ai_review?.issues) {
    data.style.ai_review.issues.forEach(i => {
      issues.push({
        severity: "low",
        type: "style",
        line: i.line || 0,
        message: i.message,
        suggestion: i.suggestion || "Fix style issue"
      });
    });
  }

  // ✅ Security
  if (data.security?.security_issues?.bandit?.results) {
    data.security.security_issues.bandit.results.forEach(sec => {
      issues.push({
        severity: "high",
        type: "security",
        line: sec.line_number,
        message: sec.issue_text,
        suggestion: sec.issue_cwe || "Fix vulnerability"
      });
    });
  }

  if (data.security?.ai?.issues) {
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

  // ✅ Quality
  if (data.quality?.analysis) {
    issues.push({
      severity: "medium",
      type: "quality",
      line: 0,
      message: `Time complexity: ${data.quality.analysis.time_complexity}`,
      suggestion: "Optimize algorithm"
    });
  }

  // ✅ Summary → Scores
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    high: issues.filter(i => i.severity === "high").length,
    medium: issues.filter(i => i.severity === "medium").length,
    low: issues.filter(i => i.severity === "low").length,
    securityScore: 100 - issues.filter(i => i.type === "security").length * 10,
    qualityScore: 100 - issues.length * 5,
  };

  return { issues, summary };
}
