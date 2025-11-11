import React, { useState } from "react";
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
};

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
            {icons[issue.type]}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {issue.type.toUpperCase()}
            </Typography>
          </Box>
          <Chip
            label={issue.severity.toUpperCase()}
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
          Line: {issue.line}
        </Typography>

        {/* Suggestion */}
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

export default function IssuesPanel({ results }) {
  if (!results) {
    return (
      <Box sx={{ p: 4, color: "gray", textAlign: "center" }}>
        No results yet. Run <b>Review Code</b>.
      </Box>
    );
  }

  const grouped = results.issues.reduce((acc, issue) => {
    acc[issue.type] = acc[issue.type] || [];
    acc[issue.type].push(issue);
    return acc;
  }, {});

  const categories = ["syntax", "style", "security", "quality", "rule"];

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      {categories.map((cat) => {
        const [open, setOpen] = useState(true);
        const count = grouped[cat]?.length || 0;

        return (
          <Grid item xs={12} md={6} key={cat}>
            <Card sx={{ background: "#0f172a", color: "white" }}>
              <CardContent>
                {/* Header */}
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  onClick={() => setOpen(!open)}
                  sx={{ cursor: "pointer" }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    {icons[cat]}
                    <Typography variant="h6">
                      {cat.toUpperCase()} ({count})
                    </Typography>
                  </Box>

                  {open ? (
                    <ExpandLessIcon sx={{ color: "#94a3b8" }} />
                  ) : (
                    <ExpandMoreIcon sx={{ color: "#94a3b8" }} />
                  )}
                </Box>

                <Divider sx={{ opacity: 0.2, mt: 1, mb: 2 }} />

                {/* Expandable content */}
                <Collapse in={open}>
                  {count === 0 ? (
                    <Typography sx={{ opacity: 0.6 }}>
                      No {cat} issues found.
                    </Typography>
                  ) : (
                    grouped[cat].map((issue, i) => (
                      <IssueCard key={i} issue={issue} />
                    ))
                  )}

                  {/* Raw JSON */}
                  <RawJSON label={cat} data={results.raw[cat]} />
                </Collapse>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
