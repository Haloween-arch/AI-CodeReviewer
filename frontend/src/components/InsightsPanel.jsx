// src/components/InsightsPanel.jsx
import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from "@mui/material";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
const GRADIENT_PRIMARY = ["#6366f1", "#8b5cf6"];
const GRADIENT_SEC = ["#06b6d4", "#3b82f6"];

function SmallStat({ title, value, hint, bg, icon }) {
  return (
    <Card sx={{ p: 2.5, background: bg, color: "white", borderRadius: 2, boxShadow: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.9, fontSize: "0.75rem" }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          {icon}
          {hint && (
            <Tooltip title={hint}>
              <IconButton size="small" sx={{ color: "rgba(255,255,255,0.9)" }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <Box
      sx={{
        background: "rgba(2,6,23,0.95)",
        color: "white",
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
      }}
    >
      {label && <Typography variant="caption" sx={{ opacity: 0.8 }}>{label}</Typography>}
      {payload.map((p, i) => (
        <Box key={i} sx={{ mt: 0.5 }}>
          <Typography variant="subtitle2" sx={{ color: p.color }}>
            {p.name}: {p.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function getSeverityIcon(severity) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <ErrorIcon sx={{ color: "#ef4444" }} />;
    case "high":
      return <WarningAmberIcon sx={{ color: "#f97316" }} />;
    case "medium":
      return <WarningAmberIcon sx={{ color: "#eab308" }} />;
    case "low":
      return <CheckCircleIcon sx={{ color: "#22c55e" }} />;
    default:
      return null;
  }
}

export default function InsightsPanel({ results }) {
  if (!results || !results.summary) {
    return (
      <Box
        sx={{
          p: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <Card sx={{ p: 6, borderRadius: 3, width: "100%", maxWidth: 600, textAlign: "center", boxShadow: 3 }}>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
            Ready for insights ✨
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Run the analysis to populate quality, security, performance and hotspots.
          </Typography>
        </Card>
      </Box>
    );
  }

  const summary = results.summary;
  const issues = results.issues || [];

  // Enhanced score data with targets
  const scoreData = [
    {
      name: "Quality",
      score: summary.qualityScore ?? 0,
      target: 85,
      color: GRADIENT_PRIMARY[0],
    },
    {
      name: "Security",
      score: summary.securityScore ?? 0,
      target: 90,
      color: GRADIENT_SEC[0],
    },
    {
      name: "Performance",
      score: summary.performanceScore ?? 0,
      target: 80,
      color: "#10b981",
    },
  ];

  const severityData = [
    { name: "Critical", value: summary.critical ?? 0, color: COLORS[0] },
    { name: "High", value: summary.high ?? 0, color: COLORS[1] },
    { name: "Medium", value: summary.medium ?? 0, color: COLORS[2] },
    { name: "Low", value: summary.low ?? 0, color: COLORS[3] },
  ];

  const perfTimeSeries =
    (summary.timeSeries && summary.timeSeries.slice(-12)) || [
      { name: "Jan", score: 65, issues: 45 },
      { name: "Feb", score: 68, issues: 42 },
      { name: "Mar", score: 70, issues: 38 },
      { name: "Apr", score: 72, issues: 35 },
      { name: "May", score: 74, issues: 32 },
      { name: "Jun", score: 76, issues: 28 },
      { name: "Jul", score: 75, issues: 30 },
      { name: "Aug", score: 77, issues: 26 },
      { name: "Sep", score: 79, issues: 24 },
      { name: "Oct", score: 81, issues: 20 },
      { name: "Nov", score: 83, issues: 18 },
      { name: "Now", score: summary.qualityScore ?? 85, issues: 15 },
    ];

  const topFiles = (summary.topRiskFiles || []).slice(0, 8);
  const issuesByFile = useMemo(() => {
    if (topFiles.length) return topFiles.map((f) => ({ file: f.name, score: f.score, issues: f.count }));

    const map = {};
    issues.forEach((it) => {
      const file = it.file || "unknown";
      map[file] = map[file] || { file, score: 0, issues: 0 };
      map[file].issues += 1;
      const boost = it.severity === "critical" ? 4 : it.severity === "high" ? 3 : it.severity === "medium" ? 2 : 1;
      map[file].score += boost;
    });
    return Object.values(map).sort((a, b) => b.score - a.score).slice(0, 8);
  }, [issues, topFiles]);

  const complexityBuckets =
    summary.timeComplexityBreakdown || [
      { label: "O(1)", count: 12, color: COLORS[3] },
      { label: "O(log n)", count: 8, color: COLORS[2] },
      { label: "O(n)", count: 25, color: COLORS[2] },
      { label: "O(n log n)", count: 6, color: COLORS[1] },
      { label: "O(n²)", count: 3, color: COLORS[0] },
    ];

  const hotspotScore =
    (summary.critical ?? 0) * 4 + (summary.high ?? 0) * 3 + (summary.medium ?? 0) * 2 + (summary.low ?? 0);
  const hotspotLabel = hotspotScore >= 12 ? "High Risk" : hotspotScore >= 6 ? "Moderate" : "Low Risk";

  const totalIssues =
    (summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0) + (summary.low ?? 0);

  // Radar chart data for multi-dimensional analysis
  const radarData = [
    { metric: "Code Quality", score: summary.qualityScore ?? 0, fullMark: 100 },
    { metric: "Security", score: summary.securityScore ?? 0, fullMark: 100 },
    { metric: "Performance", score: summary.performanceScore ?? 0, fullMark: 100 },
    { metric: "Maintainability", score: summary.maintainabilityScore ?? 75, fullMark: 100 },
    { metric: "Test Coverage", score: summary.testCoverage ?? 68, fullMark: 100 },
  ];

  return (
    <Box sx={{ p: 3, minHeight: "100vh", background: "transparent" }}>
      <Grid container spacing={3}>
        {/* Top Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <SmallStat
                title="Quality Score"
                value={summary.qualityScore ?? 0}
                hint="Overall code quality from style, complexity and tests"
                bg={`linear-gradient(135deg, ${GRADIENT_PRIMARY[0]}, ${GRADIENT_PRIMARY[1]})`}
                icon={<CheckCircleIcon sx={{ fontSize: 32, opacity: 0.9 }} />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SmallStat
                title="Security Score"
                value={summary.securityScore ?? 0}
                hint="Static analysis + AI security findings"
                bg={`linear-gradient(135deg, ${GRADIENT_SEC[0]}, ${GRADIENT_SEC[1]})`}
                icon={<CheckCircleIcon sx={{ fontSize: 32, opacity: 0.9 }} />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SmallStat
                title="Risk Level"
                value={hotspotLabel}
                hint="Weighted risk based on severity counts"
                bg={hotspotScore >= 12 ? "#ef4444" : hotspotScore >= 6 ? "#f97316" : "#22c55e"}
                icon={<WarningAmberIcon sx={{ fontSize: 32, opacity: 0.9 }} />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SmallStat
                title="Total Issues"
                value={totalIssues}
                hint="Sum of all detected issues"
                bg="#334155"
                icon={<ErrorIcon sx={{ fontSize: 32, opacity: 0.9 }} />}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Main Charts Row */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ p: 3, height: 450, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Quality Metrics vs Target
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 360 }}>
              <ResponsiveContainer>
                <ComposedChart data={scoreData} margin={{ left: -10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8" }} />
                  <YAxis tick={{ fill: "#94a3b8" }} domain={[0, 100]} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={50} name="Current Score" />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Target"
                    strokeDasharray="5 5"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card sx={{ p: 3, height: 450, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Issue Severity Distribution
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 360, display: "flex", alignItems: "center" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={4}
                    label={(entry) => (entry.value > 0 ? `${entry.name}: ${entry.value}` : "")}
                  >
                    {severityData.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Performance Trend */}
        <Grid item xs={12}>
          <Card sx={{ p: 3, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Quality & Issues Trend Over Time
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer>
                <ComposedChart data={perfTimeSeries} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8" }} />
                  <YAxis yAxisId="left" tick={{ fill: "#94a3b8" }} domain={[0, 100]} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8" }} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="score"
                    stroke="#60a5fa"
                    fill="url(#perfGrad)"
                    strokeWidth={3}
                    name="Quality Score"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="issues"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Issue Count"
                    dot={{ fill: "#ef4444", r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Radar Chart & Complexity */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, height: 400, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Multi-Dimensional Analysis
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                  <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                  <ReTooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, height: 400, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Time Complexity Distribution
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={complexityBuckets} layout="horizontal" margin={{ left: 10, right: 20, top: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8" }} />
                  <YAxis tick={{ fill: "#94a3b8" }} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                    {complexityBuckets.map((entry, idx) => (
                      <Cell key={`cb-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Top Risk Files Table */}
        <Grid item xs={12}>
          <Card sx={{ p: 3, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Top Risk Files
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b" }}>Rank</TableCell>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b" }}>File Path</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, background: "#1e293b" }}>Issues</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, background: "#1e293b" }}>Risk Score</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, background: "#1e293b" }}>Risk Level</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issuesByFile.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          No risky files detected
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    issuesByFile.map((f, i) => {
                      const riskLevel = f.score >= 10 ? "critical" : f.score >= 6 ? "high" : f.score >= 3 ? "medium" : "low";
                      return (
                        <TableRow key={i} hover>
                          <TableCell>
                            <Chip label={`#${i + 1}`} size="small" color={i === 0 ? "error" : i === 1 ? "warning" : "default"} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, fontFamily: "monospace" }}>{f.file}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={f.issues} size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={(f.score / 16) * 100}
                                sx={{
                                  flex: 1,
                                  height: 8,
                                  borderRadius: 1,
                                  backgroundColor: "#334155",
                                  "& .MuiLinearProgress-bar": {
                                    backgroundColor:
                                      riskLevel === "critical"
                                        ? "#ef4444"
                                        : riskLevel === "high"
                                        ? "#f97316"
                                        : riskLevel === "medium"
                                        ? "#eab308"
                                        : "#22c55e",
                                  },
                                }}
                              />
                              <Typography sx={{ fontWeight: 700, minWidth: 30 }}>{f.score}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={riskLevel.toUpperCase()}
                              size="small"
                              color={
                                riskLevel === "critical" ? "error" : riskLevel === "high" ? "warning" : riskLevel === "medium" ? "info" : "success"
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Detailed Issues Table */}
        <Grid item xs={12}>
          <Card sx={{ p: 3, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Critical Issues Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b", width: 60 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b" }}>Issue</TableCell>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b", width: 100 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b", width: 80 }}>Line</TableCell>
                    <TableCell sx={{ fontWeight: 700, background: "#1e293b" }}>Suggestion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {issues.slice(0, 10).map((issue, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {getSeverityIcon(issue.severity)}
                          <Chip
                            label={issue.severity?.toUpperCase()}
                            size="small"
                            color={
                              issue.severity === "critical" ? "error" : issue.severity === "high" ? "warning" : issue.severity === "medium" ? "info" : "success"
                            }
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>{issue.message}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={issue.type?.toUpperCase()} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{issue.line || "-"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {issue.suggestion || "No suggestion provided"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
