// src/components/IssuesPanel.jsx
import React, { useMemo, useState } from "react";
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
  LinearProgress,
} from "@mui/material";

import CodeIcon from "@mui/icons-material/Code";
import BrushIcon from "@mui/icons-material/Brush";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import RuleIcon from "@mui/icons-material/Rule";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ----------------------------------------------------
// icons / colors
// ----------------------------------------------------
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
};

const catOrder = ["syntax", "style", "security", "quality", "rule"];
const catLabels = {
  syntax: "Syntax",
  style: "Style",
  security: "Security",
  quality: "Quality",
  rule: "Rule",
};

const donutColors = ["#ef4444", "#f97316", "#eab308", "#3b82f6"];

// ----------------------------------------------------
// Small reusable components
// ----------------------------------------------------
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
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            {icons[issue.type]}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {(issue.type || "").toUpperCase()}
            </Typography>
          </Box>
          <Chip
            label={(issue.severity || "info").toUpperCase()}
            size="small"
            sx={{
              bgcolor: severityColors[issue.severity] || "#64748b",
              color: "white",
              fontWeight: 600,
            }}
          />
        </Box>

        <Typography sx={{ mt: 1, fontSize: 14 }}>{issue.message}</Typography>

        <Typography sx={{ mt: 0.5, fontSize: 12, opacity: 0.7 }}>
          Line: {issue.line ?? 0}
        </Typography>

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
  const json = useMemo(() => JSON.stringify(data || {}, null, 2), [data]);

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

// Collapsible column per category (hook isolated here)
function CategoryPanel({ cat, items, raw }) {
  const [open, setOpen] = useState(true);
  const count = items?.length || 0;

  return (
    <Card sx={{ background: "#0f172a", color: "white", height: "100%" }}>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          onClick={() => setOpen((v) => !v)}
          sx={{ cursor: "pointer" }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            {icons[cat]}
            <Typography variant="h6">
              {catLabels[cat] || cat} ({count})
            </Typography>
          </Box>
          {open ? (
            <ExpandLessIcon sx={{ color: "#94a3b8" }} />
          ) : (
            <ExpandMoreIcon sx={{ color: "#94a3b8" }} />
          )}
        </Box>

        <Divider sx={{ opacity: 0.2, mt: 1, mb: 2 }} />

        <Collapse in={open} unmountOnExit>
          {count === 0 ? (
            <Typography sx={{ opacity: 0.6 }}>
              No {catLabels[cat] || cat} issues found.
            </Typography>
          ) : (
            items.map((issue, i) => <IssueCard key={i} issue={issue} />)
          )}

          <RawJSON label={catLabels[cat] || cat} data={raw} />
        </Collapse>
      </CardContent>
    </Card>
  );
}

// Simple metric tile
function StatCard({ title, value, accent }) {
  return (
    <Card sx={{ background: "#0f172a", color: "white" }}>
      <CardContent>
        <Typography variant="overline" sx={{ opacity: 0.7 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: accent }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// Circular-ish score shown as linear progress + label (lightweight)
function ScoreCard({ title, score = 0, color = "#22c55e" }) {
  return (
    <Card sx={{ background: "#0f172a", color: "white" }}>
      <CardContent>
        <Typography variant="overline" sx={{ opacity: 0.7 }}>
          {title}
        </Typography>
        <Box display="flex" alignItems="center" gap={2} sx={{ mt: 1 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, score))}
              sx={{
                height: 10,
                borderRadius: 5,
                "& .MuiLinearProgress-bar": { backgroundColor: color },
              }}
            />
          </Box>
          <Typography variant="h6" sx={{ width: 60, textAlign: "right" }}>
            {Math.round(score)}%
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------
// Main component
// ----------------------------------------------------
export default function IssuesPanel({ results }) {
  if (!results) {
    return (
      <Box sx={{ p: 4, color: "gray", textAlign: "center" }}>
        No results yet. Run <b>Review Code</b>.
      </Box>
    );
  }

  const issues = results.issues || [];
  const raw = results.raw || {};
  const summary = results.summary || {};

  // group by type
  const grouped = useMemo(() => {
    const g = {};
    for (const i of issues) {
      const t = i.type || "other";
      if (!g[t]) g[t] = [];
      g[t].push(i);
    }
    return g;
  }, [issues]);

  // chart data
  const categoryData = useMemo(
    () =>
      catOrder.map((c) => ({
        category: (catLabels[c] || c).toUpperCase(),
        count: (grouped[c] || []).length,
      })),
    [grouped]
  );

  const severityData = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of issues) {
      const s = (i.severity || "low").toLowerCase();
      if (counts[s] !== undefined) counts[s] += 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [issues]);

  const donutColorByIndex = (idx) => donutColors[idx % donutColors.length];

  return (
    <Box sx={{ p: 2 }}>
      {/* Summary header */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={2.4}>
          <StatCard title="Total Issues" value={summary.totalIssues ?? issues.length} accent="#60a5fa" />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard title="Critical" value={summary.critical ?? 0} accent={severityColors.critical} />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard title="High" value={summary.high ?? 0} accent={severityColors.high} />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard title="Medium" value={summary.medium ?? 0} accent={severityColors.medium} />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard title="Low" value={summary.low ?? 0} accent={severityColors.low} />
        </Grid>

        {/* Scores */}
        <Grid item xs={12} md={6}>
          <ScoreCard title="Security Score" score={summary.securityScore ?? 0} color="#22c55e" />
        </Grid>
        <Grid item xs={12} md={6}>
          <ScoreCard title="Quality Score" score={summary.qualityScore ?? 0} color="#a78bfa" />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ background: "#0f172a", color: "white", height: 280 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Issues by Category
              </Typography>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={categoryData}>
                  <XAxis dataKey="category" tick={{ fill: "#93a3b8", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#93a3b8", fontSize: 12 }} />
                  <RTooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", color: "#fff" }}
                  />
                  <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ background: "#0f172a", color: "white", height: 280 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Issues by Severity
              </Typography>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {severityData.map((_, i) => (
                      <Cell key={i} fill={donutColorByIndex(i)} />
                    ))}
                  </Pie>
                  <Legend />
                  <RTooltip
                    formatter={(v, n) => [v, n.toUpperCase()]}
                    contentStyle={{ background: "#111827", border: "1px solid #374151", color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category columns */}
      <Grid container spacing={2}>
        {catOrder.map((cat) => (
          <Grid item xs={12} md={6} key={cat}>
            <CategoryPanel cat={cat} items={grouped[cat]} raw={raw?.[cat]} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
