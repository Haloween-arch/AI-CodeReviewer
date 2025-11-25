// src/components/IssuesPanel.jsx
import React, { useState, useMemo } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
  Tabs,
  Tab,
} from "@mui/material";

import CodeIcon from "@mui/icons-material/Code";
import BrushIcon from "@mui/icons-material/Brush";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import RuleIcon from "@mui/icons-material/Rule";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const icons = {
  syntax: <CodeIcon />,
  style: <BrushIcon />,
  security: <SecurityIcon />,
  quality: <SpeedIcon />,
  rule: <RuleIcon />,
};

const severityColors = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  warning: "#f59e0b",
  error: "#dc2626",
};

// Expanded set of low-value / formatting-only codes (tuneable)
const LOW_VALUE_CODES = new Set([
  // pylint
  "C0114", // missing module docstring
  "C0115", // missing class docstring
  "C0116", // missing function docstring
  "C0304", // final newline missing
  "C0303", // trailing whitespace
  // flake8 / pycodestyle / pyflakes
  "W291",
  "W292",
  "W293", // whitespace/newline warnings
  "E501", // line too long (often stylistic)
  "E203",
  "E231",
  "E302", // formatting-only cases
  // other common low-value flake8 warnings
  "W503", // line break before binary operator (style preference)
]);

const LOW_VALUE_KEYWORDS = [
  "missing module docstring",
  "no newline at end of file",
  "trailing whitespace",
  "line too long",
  "blank line",
  "whitespace",
  "expected 2 blank lines",
  "whitespace before",
];

function isLowValue(issue) {
  if (!issue) return false;
  const code = (issue.code || "").toString().toUpperCase();
  if (code && LOW_VALUE_CODES.has(code)) return true;
  const msg = (issue.message || "").toLowerCase();
  return LOW_VALUE_KEYWORDS.some((k) => msg.includes(k));
}

function IssueCard({ issue }) {
  return (
    <Card
      sx={{
        background: "#1e293b",
        color: "white",
        borderLeft: `4px solid ${severityColors[issue.severity] || "#4b5563"}`,
        mb: 2,
      }}
    >
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            {icons[issue.type] || <CodeIcon />}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {issue.type?.toUpperCase() || "ISSUE"}
            </Typography>
          </Box>
          <Chip
            label={(issue.severity || "UNKNOWN").toUpperCase()}
            size="small"
            sx={{
              bgcolor: severityColors[issue.severity] || "gray",
              color: "white",
              fontWeight: 600,
            }}
          />
        </Box>

        {/* Message */}
        <Typography sx={{ mt: 1, fontSize: 14 }}>{issue.message}</Typography>

        {/* Line */}
        <Typography sx={{ mt: 0.5, fontSize: 12, opacity: 0.7 }}>
          Line: {issue.line ?? "-"}
        </Typography>

        {/* Suggestion */}
        {issue.suggestion && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <Typography
              variant="caption"
              sx={{ opacity: 0.7, display: "block", mb: 0.5 }}
            >
              Suggestion
            </Typography>
            <Typography sx={{ fontSize: 13 }}>{issue.suggestion}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function RawJSON({ label, data }) {
  const json = JSON.stringify(data || {}, null, 2);
  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Raw {label} JSON
        </Typography>
        <Tooltip title="Copy JSON">
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(json)}
            sx={{ color: "#94a3b8" }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          mt: 1,
          background: "#0f172a",
          color: "#cbd5e1",
          p: 1.5,
          borderRadius: 1,
          fontSize: 13,
          fontFamily: "ui-monospace",
          whiteSpace: "pre-wrap",
          minHeight: 80,
          maxHeight: 250,
          overflowY: "auto",
        }}
      >
        {json}
      </Box>
    </Box>
  );
}

// Helper: map severity to weight for "top issues"
const severityWeight = (sev) => {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return 4;
  if (s === "high") return 3;
  if (s === "error") return 3;
  if (s === "medium") return 2;
  if (s === "warning") return 2;
  if (s === "low" || s === "style") return 1;
  return 0;
};

// Helper: "why it matters" explanation
function explainWhy(issue) {
  const type = (issue.type || "").toLowerCase();
  const sev = (issue.severity || "").toLowerCase();

  if (type === "security") {
    if (sev === "critical" || sev === "high") {
      return "This can expose your application to serious security risks, like data leaks or unauthorized access.";
    }
    return "It may open smaller security gaps that are still worth fixing to keep the code safe.";
  }

  if (type === "syntax") {
    return "This kind of problem can stop the program from running at all until it is fixed.";
  }

  if (type === "quality") {
    return "It can make the code slower, harder to scale, or more expensive to run over time.";
  }

  if (type === "style") {
    return "It makes the code harder for others (and future you) to read and maintain.";
  }

  if (type === "rule") {
    return "It breaks project or team rules, which may cause confusion or bugs later.";
  }

  return "It reduces the overall reliability or readability of the code.";
}

// Helper: fallback suggestion if analyzer didn’t provide one
function fallbackSuggestion(issue) {
  const type = (issue.type || "").toLowerCase();
  if (issue.suggestion) return issue.suggestion;

  if (type === "security") {
    return "Use safer patterns or libraries, validate inputs, and avoid directly trusting user data.";
  }
  if (type === "syntax") {
    return "Fix the syntax on this line so the code can compile or run correctly.";
  }
  if (type === "quality") {
    return "Consider simplifying the logic, reducing complexity, or using a more efficient approach.";
  }
  if (type === "style") {
    return "Rename variables or functions clearly, and follow consistent formatting and style rules.";
  }
  if (type === "rule") {
    return "Update this line to follow your project’s coding rules or guidelines.";
  }
  return "Adjust this part of the code to make it clearer, safer, or easier to maintain.";
}

export default function IssuesPanel({ results }) {
  const [openMap, setOpenMap] = useState({
    syntax: true,
    style: true,
    security: true,
    quality: true,
    rule: true,
    minor: false, // minor (low-value) collapsed by default
  });

  // "issues" | "summary"
  const [activeTab, setActiveTab] = useState("summary");

  if (!results || !results.issues) {
    return (
      <Box sx={{ p: 4, color: "gray", textAlign: "center" }}>
        No results yet. Run <b>Review Code</b>.
      </Box>
    );
  }

  // Partition issues into major (kept) and minor (low-value) lists
  const { keptIssues, minorIssues } = useMemo(() => {
    const kept = [];
    const minor = [];
    (results.issues || []).forEach((iss) => {
      if (isLowValue(iss)) {
        minor.push(iss);
      } else {
        kept.push(iss);
      }
    });
    return { keptIssues: kept, minorIssues: minor };
  }, [results.issues]);

  // Map grouped by category from keptIssues
  const grouped = useMemo(() => {
    return keptIssues.reduce((acc, issue) => {
      const t = issue.type || "rule";
      acc[t] = acc[t] || [];
      acc[t].push(issue);
      return acc;
    }, {});
  }, [keptIssues]);

  // categories to display (same order/UI)
  const categories = ["syntax", "style", "security", "quality", "rule"];

  // Simple numeric summary values (fallback if AI text not present)
  const summary = results.summary || {};
  const totalIssues = summary.totalIssues ?? results.issues.length;
  const criticalCount =
    summary.critical ?? keptIssues.filter((i) => i.severity === "critical").length;
  const highCount =
    summary.high ?? keptIssues.filter((i) => i.severity === "high").length;
  const mediumCount =
    summary.medium ?? keptIssues.filter((i) => i.severity === "medium").length;
  const lowCount =
    summary.low ??
    keptIssues.filter(
      (i) =>
        i.severity === "low" ||
        i.severity === "style" ||
        i.severity === "warning"
    ).length;

  const securityIssues = keptIssues.filter((i) => i.type === "security").length;
  const styleIssues = keptIssues.filter((i) => i.type === "style").length;
  const syntaxIssues = keptIssues.filter((i) => i.type === "syntax").length;
  const qualityIssues = keptIssues.filter((i) => i.type === "quality").length;
  const ruleIssues = keptIssues.filter((i) => i.type === "rule").length;

  const qualityScore = summary.qualityScore ?? 0;
  const securityScore = summary.securityScore ?? 0;

  // 🔹 AI human-readable summary from backend (report_service)
  // Expecting this string to come either directly on results, or inside results.report
  const aiSummaryText =
    results.summary_readable ||
    results.aiSummary ||
    results.humanSummary ||
    results.report?.summary_readable ||
    null;

  // 🔹 Choose top few issues (by severity) for "Key Problems & Fixes"
  const topIssues = useMemo(() => {
    return [...keptIssues]
      .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
      .slice(0, 5);
  }, [keptIssues]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Top bar with Simple Summary / Issues Tabs */}
      <Card sx={{ background: "#020617", color: "white", mb: 2 }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Analysis Overview
            </Typography>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            textColor="inherit"
            indicatorColor="primary"
            sx={{
              mt: 1,
              "& .MuiTab-root": { textTransform: "none", fontSize: 14 },
            }}
          >
            <Tab label="Simple Summary" value="summary" />
            <Tab label="Detailed Issues" value="issues" />
          </Tabs>
        </CardContent>
      </Card>

      {/* SUMMARY TAB */}
      {activeTab === "summary" && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card sx={{ background: "#020617", color: "white" }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Simple Summary
                </Typography>

                {/* AI summary if available */}
                {aiSummaryText ? (
                  <>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                      This summary is generated by the AI report service to be
                      easy to understand for non-technical readers.
                    </Typography>

                    <Box
                      sx={{
                        background: "#030712",
                        borderRadius: 2,
                        border: "1px solid #1f2937",
                        p: 2,
                        mb: 3,
                        maxHeight: 260,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        fontSize: 14,
                      }}
                    >
                      {aiSummaryText}
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                    AI summary is not available. Showing numeric summary instead.
                  </Typography>
                )}

                {/* 🔹 Key Problems & Fixes (line-level, simple explanation) */}
                {topIssues.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      Key Problems & Fixes (Top {topIssues.length})
                    </Typography>
                    {topIssues.map((issue, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          background: "#030712",
                          border: "1px solid #1f2937",
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, mb: 0.5 }}
                        >
                          {idx + 1}. {issue.type?.toUpperCase() || "ISSUE"}{" "}
                          (Line {issue.line ?? "-"})
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          <b>Problem:</b> {issue.message}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          <b>Why it matters:</b> {explainWhy(issue)}
                        </Typography>

                        <Typography variant="body2">
                          <b>Suggested fix:</b> {fallbackSuggestion(issue)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Quick numeric breakdown */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.5 }}
                  >
                    Overall
                  </Typography>
                  <Typography variant="body2">
                    • We found <b>{totalIssues}</b> total issues in your code.
                  </Typography>
                  <Typography variant="body2">
                    • Most serious issues: <b>{criticalCount}</b> critical and{" "}
                    <b>{highCount}</b> high-severity items.
                  </Typography>
                  <Typography variant="body2">
                    • Less serious issues: <b>{mediumCount}</b> medium and{" "}
                    <b>{lowCount}</b> low-level findings, plus{" "}
                    <b>{minorIssues.length}</b> minor style details.
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.5 }}
                  >
                    By Category
                  </Typography>
                  <Typography variant="body2">
                    • <b>Syntax</b>: {syntaxIssues} issue(s) – things that can break
                    your code or stop it from running.
                  </Typography>
                  <Typography variant="body2">
                    • <b>Style</b>: {styleIssues} issue(s) – naming, formatting, and
                    readability problems.
                  </Typography>
                  <Typography variant="body2">
                    • <b>Security</b>: {securityIssues} issue(s) – potential
                    vulnerabilities or unsafe patterns.
                  </Typography>
                  <Typography variant="body2">
                    • <b>Quality</b>: {qualityIssues} issue(s) – performance or
                    complexity-related concerns.
                  </Typography>
                  <Typography variant="body2">
                    • <b>Rules</b>: {ruleIssues} issue(s) – project-specific or
                    best-practice rule violations.
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.5 }}
                  >
                    Scores (higher is better)
                  </Typography>
                  <Typography variant="body2">
                    • <b>Quality Score</b>: {qualityScore}/100 – how clean and
                    maintainable your code looks.
                  </Typography>
                  <Typography variant="body2">
                    • <b>Security Score</b>: {securityScore}/100 – how safe your
                    code appears from a security point of view.
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ mt: 1, opacity: 0.85 }}>
                  To see exact lines and detailed explanations for each problem,
                  switch to the <b>“Detailed Issues”</b> tab above.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ISSUES TAB (existing detailed UI) */}
      {activeTab === "issues" && (
        <Grid container spacing={2}>
          {categories.map((cat) => {
            const count = (grouped[cat] || []).length;
            return (
              <Grid item xs={12} md={6} key={cat}>
                <Card sx={{ background: "#0f172a", color: "white" }}>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ cursor: "pointer" }}
                      onClick={() =>
                        setOpenMap((m) => ({ ...m, [cat]: !m[cat] }))
                      }
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        {icons[cat]}
                        <Typography variant="h6">
                          {cat.toUpperCase()} ({count})
                        </Typography>
                      </Box>

                      {openMap[cat] ? (
                        <ExpandLessIcon sx={{ color: "#94a3b8" }} />
                      ) : (
                        <ExpandMoreIcon sx={{ color: "#94a3b8" }} />
                      )}
                    </Box>

                    <Divider sx={{ opacity: 0.2, mt: 1, mb: 2 }} />

                    <Collapse in={openMap[cat]}>
                      {count === 0 ? (
                        <Typography sx={{ opacity: 0.6 }}>
                          No {cat} issues found.
                        </Typography>
                      ) : (
                        (grouped[cat] || []).map((issue, i) => (
                          <IssueCard key={i} issue={issue} />
                        ))
                      )}

                      {/* Raw JSON for this category (kept issues only) */}
                      <RawJSON
                        label={cat}
                        data={results.raw?.[cat] ?? (grouped[cat] || [])}
                      />
                    </Collapse>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}

          {/* Minor Style Warnings (collapsed, separate card) */}
          <Grid item xs={12}>
            <Card sx={{ background: "#071029", color: "white" }}>
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    setOpenMap((m) => ({ ...m, minor: !m.minor }))
                  }
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <BrushIcon />
                    <Typography variant="h6">
                      Minor Style Warnings ({minorIssues.length})
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, ml: 1 }}>
                      (filtered out from main lists)
                    </Typography>
                  </Box>

                  {openMap.minor ? (
                    <ExpandLessIcon sx={{ color: "#94a3b8" }} />
                  ) : (
                    <ExpandMoreIcon sx={{ color: "#94a3b8" }} />
                  )}
                </Box>

                <Divider sx={{ opacity: 0.2, mt: 1, mb: 2 }} />

                <Collapse in={openMap.minor}>
                  {minorIssues.length === 0 ? (
                    <Typography sx={{ opacity: 0.6 }}>
                      No minor style warnings.
                    </Typography>
                  ) : (
                    minorIssues.map((issue, idx) => (
                      <Card
                        key={idx}
                        sx={{
                          background: "#0f172a",
                          color: "white",
                          borderLeft: `4px solid ${
                            severityColors[issue.severity] || "#4b5563"
                          }`,
                          mb: 1.25,
                        }}
                      >
                        <CardContent sx={{ py: 1.25 }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Box>
                              <Typography
                                sx={{ fontWeight: 700, fontSize: 14 }}
                              >
                                {issue.code ? `${issue.code} — ` : ""}
                                {issue.message}
                              </Typography>
                              <Typography
                                sx={{ fontSize: 12, opacity: 0.7 }}
                              >
                                {issue.type?.toUpperCase() || "STYLE"} — Line:{" "}
                                {issue.line ?? "-"}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={(issue.severity || "LOW").toUpperCase()}
                                size="small"
                              />
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))
                  )}

                  {/* Raw JSON for minor warnings (copy/export) */}
                  <RawJSON label="minor_style_warnings" data={minorIssues} />
                </Collapse>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
