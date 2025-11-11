import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
  Chip,
} from "@mui/material";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart,
} from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
const GRADIENT_COLORS = {
  primary: ["#3b82f6", "#8b5cf6"],
  success: ["#22c55e", "#10b981"],
  warning: ["#f59e0b", "#ef4444"],
};

export default function InsightsPanel({ results }) {
  if (!results || !results.summary) {
    return (
      <Box
        sx={{
          p: 6,
          textAlign: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: 3,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <Typography
          variant="h5"
          sx={{
            color: "white",
            fontWeight: 600,
            mb: 1,
            textShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          ✨ Awaiting Analysis
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.8)" }}>
          Insights will appear here after running <b>Review Code</b>
        </Typography>
      </Box>
    );
  }

  const summary = results.summary;

  // Score Data for Graphs
  const scoreData = [
    { name: "Quality", score: summary.qualityScore || 0 },
    { name: "Security", score: summary.securityScore || 0 },
  ];

  // Time Complexity Insights
  const timeData = [
    {
      name: "Time Complexity",
      score: summary.timeComplexityScore || 40,
    },
    {
      name: "Space Efficiency",
      score: summary.spaceComplexityScore || 60,
    },
  ];

  // Radar Chart Data
  const radarData = [
    {
      subject: "Quality",
      value: summary.qualityScore || 0,
      fullMark: 100,
    },
    {
      subject: "Security",
      value: summary.securityScore || 0,
      fullMark: 100,
    },
    {
      subject: "Performance",
      value: summary.timeComplexityScore || 40,
      fullMark: 100,
    },
    {
      subject: "Efficiency",
      value: summary.spaceComplexityScore || 60,
      fullMark: 100,
    },
    {
      subject: "Maintainability",
      value: 75,
      fullMark: 100,
    },
  ];

  // Severity Distribution Pie Chart
  const severityData = [
    { name: "Critical", value: summary.critical },
    { name: "High", value: summary.high },
    { name: "Medium", value: summary.medium },
    { name: "Low", value: summary.low },
  ];

  // Hotspot detection
  const hotspotScore =
    summary.critical * 4 +
    summary.high * 3 +
    summary.medium * 2 +
    summary.low * 1;

  const hotspotLabel =
    hotspotScore >= 12
      ? "🔥 High Risk"
      : hotspotScore >= 6
      ? "⚠ Moderate Risk"
      : "✅ Safe Zone";

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(10px)",
            p: 2,
            borderRadius: 2,
            border: "1px solid rgba(59, 130, 246, 0.3)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <Typography sx={{ color: "white", fontWeight: 600 }}>
            {payload[0].name}
          </Typography>
          <Typography sx={{ color: "#3b82f6", fontSize: "1.2rem" }}>
            {payload[0].value}
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        minHeight: "100vh",
        p: 3,
      }}
    >
      <Grid container spacing={3}>
        {/* Header Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {[
              {
                label: "Quality Score",
                value: summary.qualityScore || 0,
                icon: "🎯",
                gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              },
              {
                label: "Security Score",
                value: summary.securityScore || 0,
                icon: "🔒",
                gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              },
              {
                label: "Total Issues",
                value:
                  summary.critical +
                  summary.high +
                  summary.medium +
                  summary.low,
                icon: "⚡",
                gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              },
              {
                label: "Hotspot Score",
                value: hotspotScore,
                icon: "🔥",
                gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              },
            ].map((stat, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card
                  sx={{
                    background: stat.gradient,
                    p: 3,
                    borderRadius: 3,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                    transition: "transform 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-5px)",
                      boxShadow: "0 15px 40px rgba(0,0,0,0.4)",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography sx={{ fontSize: "2.5rem" }}>
                      {stat.icon}
                    </Typography>
                    <Box>
                      <Typography
                        variant="h3"
                        sx={{ color: "white", fontWeight: 700 }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography
                        sx={{ color: "rgba(255,255,255,0.9)", fontSize: "0.9rem" }}
                      >
                        {stat.label}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Radar Chart - Overall Metrics */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(59, 130, 246, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              📊 Overall Code Metrics
            </Typography>
            <Divider sx={{ borderColor: "rgba(59, 130, 246, 0.2)", mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(59, 130, 246, 0.3)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "white", fontSize: 12 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Quality & Security Bar Chart */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(139, 92, 246, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🎯 Code Quality & Security
            </Typography>
            <Divider sx={{ borderColor: "rgba(139, 92, 246, 0.2)", mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={scoreData}>
                  <defs>
                    <linearGradient id="colorQuality" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" stopOpacity={1} />
                      <stop offset="100%" stopColor="#764ba2" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: "white" }} />
                  <YAxis tick={{ fill: "white" }} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="score"
                    fill="url(#colorQuality)"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Performance Area Chart */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(34, 197, 94, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ⚡ Performance Metrics
            </Typography>
            <Divider sx={{ borderColor: "rgba(34, 197, 94, 0.2)", mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={timeData}>
                  <defs>
                    <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4facfe" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#00f2fe" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: "white" }} />
                  <YAxis tick={{ fill: "white" }} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#4facfe"
                    strokeWidth={3}
                    fill="url(#colorPerf)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Severity Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(239, 68, 68, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
                background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🎨 Severity Distribution
            </Typography>
            <Divider sx={{ borderColor: "rgba(239, 68, 68, 0.2)", mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={severityData}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {severityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: "white" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Hotspot Detection */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${
                hotspotLabel.includes("High")
                  ? "#ef4444, #dc2626"
                  : hotspotLabel.includes("Moderate")
                  ? "#f97316, #ea580c"
                  : "#22c55e, #16a34a"
              })`,
              borderRadius: 3,
              p: 4,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "radial-gradient(circle at top right, rgba(255,255,255,0.1) 0%, transparent 60%)",
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 700,
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                position: "relative",
              }}
            >
              🔥 Hotspot Detection
            </Typography>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.3)", mb: 3 }} />
            <Box sx={{ textAlign: "center", position: "relative" }}>
              <Typography
                variant="h2"
                sx={{
                  color: "white",
                  fontWeight: 800,
                  mb: 2,
                  textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {hotspotLabel}
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                Score: {hotspotScore}
              </Typography>
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "0.9rem",
                }}
              >
                Critical=4 • High=3 • Medium=2 • Low=1
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Issue Summary */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(234, 179, 8, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
              }}
            >
              📋 Issue Breakdown
            </Typography>
            <Divider sx={{ borderColor: "rgba(234, 179, 8, 0.2)", mb: 3 }} />
            <Grid container spacing={2}>
              {[
                { label: "Critical", value: summary.critical, color: "#ef4444" },
                { label: "High", value: summary.high, color: "#f97316" },
                { label: "Medium", value: summary.medium, color: "#eab308" },
                { label: "Low", value: summary.low, color: "#22c55e" },
              ].map((item, i) => (
                <Grid item xs={6} key={i}>
                  <Box
                    sx={{
                      background: `${item.color}20`,
                      borderLeft: `4px solid ${item.color}`,
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{ color: "white", fontWeight: 700 }}
                    >
                      {item.value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Card>
        </Grid>

        {/* Top Risk Areas */}
        <Grid item xs={12}>
          <Card
            sx={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              p: 3,
              border: "1px solid rgba(239, 68, 68, 0.2)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "white",
                mb: 2,
                fontWeight: 600,
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🎯 Top 5 Risk Areas
            </Typography>
            <Divider sx={{ borderColor: "rgba(239, 68, 68, 0.2)", mb: 3 }} />
            <Grid container spacing={2}>
              {results.issues.slice(0, 5).map((issue, i) => (
                <Grid item xs={12} key={i}>
                  <Card
                    sx={{
                      background: `linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)`,
                      p: 3,
                      borderLeft: `4px solid ${
                        issue.severity === "critical"
                          ? "#ef4444"
                          : issue.severity === "high"
                          ? "#f97316"
                          : issue.severity === "medium"
                          ? "#eab308"
                          : "#22c55e"
                      }`,
                      borderRadius: 2,
                      transition: "transform 0.2s ease",
                      "&:hover": {
                        transform: "translateX(5px)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ color: "white", fontWeight: 600, flex: 1 }}
                      >
                        {issue.message}
                      </Typography>
                      <Chip
                        label={issue.severity.toUpperCase()}
                        size="small"
                        sx={{
                          background:
                            issue.severity === "critical"
                              ? "#ef4444"
                              : issue.severity === "high"
                              ? "#f97316"
                              : issue.severity === "medium"
                              ? "#eab308"
                              : "#22c55e",
                          color: "white",
                          fontWeight: 600,
                          ml: 2,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255,255,255,0.7)", mb: 0.5 }}
                    >
                      Type: <b>{issue.type.toUpperCase()}</b> • Line:{" "}
                      <b>{issue.line}</b>
                    </Typography>
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