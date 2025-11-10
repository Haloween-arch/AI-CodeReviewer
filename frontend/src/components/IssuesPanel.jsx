import React from "react";
import { Grid, Card, CardContent, Typography } from "@mui/material";

function Section({ title, children }) {
  return (
    <Card sx={{ height: "100%", background: "#1e293b", color: "white" }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <pre
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
            margin: 0,
          }}
        >
          {children}
        </pre>
      </CardContent>
    </Card>
  );
}

export default function IssuesPanel({ results }) {
  if (!results || !results.results) {
    return (
      <Typography sx={{ p: 3, color: "gray" }}>
        No results yet. Run **Review Code**.
      </Typography>
    );
  }

  // ✅ Extract real data from backend structure
  const r = results.results;

  return (
    <Grid
      container
      spacing={2}
      sx={{ height: "100%", overflowY: "auto", p: 1 }}
    >
      <Grid item xs={12} md={6}>
        <Section title="Syntax">
          {JSON.stringify(r.syntax || {}, null, 2)}
        </Section>
      </Grid>

      <Grid item xs={12} md={6}>
        <Section title="Style">
          {JSON.stringify(r.style || {}, null, 2)}
        </Section>
      </Grid>

      <Grid item xs={12} md={6}>
        <Section title="Security">
          {JSON.stringify(r.security || {}, null, 2)}
        </Section>
      </Grid>

      <Grid item xs={12} md={6}>
        <Section title="Quality">
          {JSON.stringify(r.quality || {}, null, 2)}
        </Section>
      </Grid>

      <Grid item xs={12}>
        <Section title="Rule / Report">
          {JSON.stringify(
            {
              rule: r.rule,
              report: results.report || {},
            },
            null,
            2
          )}
        </Section>
      </Grid>
    </Grid>
  );
}
