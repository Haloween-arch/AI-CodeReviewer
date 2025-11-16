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
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
} from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
const GRADIENT_PRIMARY = ["#6366f1", "#8b5cf6"]; // purple-blue
const GRADIENT_SEC = ["#06b6d4", "#3b82f6"]; // cyan-blue

function SmallStat({ title, value, hint, bg }) {
  return (
    <Card sx={{ p: 2, background: bg, color: "white", borderRadius: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        {hint && (
          <Tooltip title={hint}>
            <IconButton size="small" sx={{ color: "rgba(255,255,255,0.9)" }}>
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Card>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <Box
      sx={{
        background: "rgba(2,6,23,0.9)",
        color: "white",
        p: 1.25,
        borderRadius: 1,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Typography variant="subtitle2">{p.name || p.payload.name}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5 }}>
        {p.value}
      </Typography>
    </Box>
  );
}

export default function InsightsPanel({ results }) {
  // If results absent, show nice empty state
  if (!results || !results.summary) {
    return (
      <Box
        sx={{
          p: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card sx={{ p: 6, borderRadius: 3, width: "100%", textAlign: "center" }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Ready for insights ✨
          </Typography>
          <Typography color="text.secondary">
            Run the analysis to populate quality, security, performance and hotspots.
          </Typography>
        </Card>
      </Box>
    );
  }

  const summary = results.summary;
  const issues = results.issues || [];

  // Prepare data collections for charts
  const scoreData = [
    { name: "Quality", score: summary.qualityScore ?? 0 },
    { name: "Security", score: summary.securityScore ?? 0 },
    { name: "Performance", score: summary.performanceScore ?? 0 },
  ];

  const severityData = [
    { name: "Critical", value: summary.critical ?? 0 },
    { name: "High", value: summary.high ?? 0 },
    { name: "Medium", value: summary.medium ?? 0 },
    { name: "Low", value: summary.low ?? 0 },
  ];

  const perfTimeSeries =
    (summary.timeSeries && summary.timeSeries.slice(-12)) || [
      { name: "t-11", score: 30 },
      { name: "t-10", score: 40 },
      { name: "t-9", score: 55 },
      { name: "t-8", score: 60 },
      { name: "t-7", score: 65 },
      { name: "t-6", score: 70 },
      { name: "t-5", score: 72 },
      { name: "t-4", score: 68 },
      { name: "t-3", score: 74 },
      { name: "t-2", score: 78 },
      { name: "t-1", score: 80 },
      { name: "now", score: summary.qualityScore ?? 80 },
    ];

  const topFiles = (summary.topRiskFiles || []).slice(0, 6);
  // fallback creation if missing
  const issuesByFile = useMemo(() => {
    if (topFiles.length) return topFiles.map((f) => ({ file: f.name, score: f.score, issues: f.count }));
    // derive top files from issues list if summary.topRiskFiles missing
    const map = {};
    issues.forEach((it) => {
      const file = it.file || "unknown";
      map[file] = map[file] || { file, score: 0, issues: 0 };
      map[file].issues += 1;
      // boost score by severity
      const boost = it.severity === "critical" ? 4 : it.severity === "high" ? 3 : it.severity === "medium" ? 2 : 1;
      map[file].score += boost;
    });
    return Object.values(map).sort((a, b) => b.score - a.score).slice(0, 6);
  }, [issues, topFiles]);

  // Time complexity breakdown (simple histogram)
  const complexityBuckets = (summary.timeComplexityBreakdown || [
    { label: "O(1)", count: 2 },
    { label: "O(log n)", count: 1 },
    { label: "O(n)", count: 6 },
    { label: "O(n log n)", count: 3 },
    { label: "O(n^2)", count: 1 },
  ]).map((it, i) => ({ ...it, color: COLORS[i % COLORS.length] }));

  // hotspot score and label
  const hotspotScore =
    (summary.critical ?? 0) * 4 + (summary.high ?? 0) * 3 + (summary.medium ?? 0) * 2 + (summary.low ?? 0);
  const hotspotLabel =
    hotspotScore >= 12 ? "High risk" : hotspotScore >= 6 ? "Moderate risk" : "Low risk";

  return (
    <Box sx={{ p: 3, minHeight: "100vh", background: "transparent" }}>
      <Grid container spacing={3}>
        {/* Top small stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SmallStat
                title="Quality Score"
                value={summary.qualityScore ?? 0}
                hint="Overall code quality aggregated from style, complexity and tests"
                bg={`linear-gradient(135deg, ${GRADIENT_PRIMARY[0]}, ${GRADIENT_PRIMARY[1]})`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SmallStat
                title="Security Score"
                value={summary.securityScore ?? 0}
                hint="Computed from static analysis + AI findings"
                bg={`linear-gradient(135deg, ${GRADIENT_SEC[0]}, ${GRADIENT_SEC[1]})`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SmallStat
                title="Hotspot"
                value={hotspotLabel}
                hint="Weighted risk based on severity counts"
                bg="#0ea5a4"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SmallStat
                title="Total Issues"
                value={(summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0) + (summary.low ?? 0)}
                hint="Sum of all detected issues"
                bg="#334155"
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Charts row */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, height: 420 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Quality & Security Overview
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={scoreData} margin={{ left: 10, right: 10 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={GRADIENT_PRIMARY[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={GRADIENT_PRIMARY[1]} stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={GRADIENT_SEC[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={GRADIENT_SEC[1]} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: "#cbd5e1" }} />
                  <YAxis tick={{ fill: "#cbd5e1" }} domain={[0, 100]} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                  <Bar dataKey="score" fill="url(#g1)" radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 2, height: 420 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Severity Distribution
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 320, display: "flex", alignItems: "center" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={110}
                    paddingAngle={6}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {severityData.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Performance time series */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, height: 360 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Performance Trend (last runs)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={perfTimeSeries} margin={{ left: 0, right: 10 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: "#cbd5e1" }} />
                  <YAxis tick={{ fill: "#cbd5e1" }} domain={[0, 100]} />
                  <CartesianGrid opacity={0.06} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#60a5fa" fill="url(#perfGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Complexity + Top Files */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, height: 360 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Time Complexity Breakdown
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={complexityBuckets} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fill: "#cbd5e1" }} />
                  <YAxis type="category" dataKey="label" tick={{ fill: "#cbd5e1" }} width={120} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" isAnimationActive barSize={14}>
                    {complexityBuckets.map((entry, idx) => (
                      <Cell key={`cb-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>

            <Divider sx={{ mt: 1, mb: 1 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Top Risk Files
            </Typography>

            <Stack spacing={1}>
              {issuesByFile.length === 0 ? (
                <Typography color="text.secondary">No risky files detected.</Typography>
              ) : (
                issuesByFile.map((f, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{f.file}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        issues: {f.issues} — risk: {f.score}
                      </Typography>
                    </Box>
                    <Chip label={`#${i + 1}`} size="small" color={i === 0 ? "error" : "default"} />
                  </Box>
                ))
              )}
            </Stack>
          </Card>
        </Grid>

        {/* Top risk list (detailed) */}
        <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Top Risk Issues (preview)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {(results.issues || []).slice(0, 6).map((it, idx) => (
                <Grid item xs={12} md={4} key={idx}>
                  <Card sx={{ p: 2, background: "#0b1220" }}>
                    <Typography sx={{ fontWeight: 700 }}>{it.message}</Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                      {it.type.toUpperCase()} • {it.severity.toUpperCase()} • Line {it.line || "-"}
                    </Typography>
                    <Typography sx={{ mt: 1 }}>{it.suggestion || "No suggestion provided."}</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
