// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Tabs,
  Tab,
  Button,
  AppBar,
  Toolbar,
  Typography,
  LinearProgress,
} from "@mui/material";

import SecurityIcon from "@mui/icons-material/Security";
import BugIcon from "@mui/icons-material/BugReport";
import CodeIcon from "@mui/icons-material/Code";
import AssessmentIcon from "@mui/icons-material/Assessment";
import UploadIcon from "@mui/icons-material/CloudUpload";

import Sidebar from "./components/Sidebar";
import IssuesPanel from "./components/IssuesPanel";
import InsightsPanel from "./components/InsightsPanel";
import EditorPane from "./components/EditorPane";

import { analyzeAll } from "./services/api";
import axios from "axios";   // ⭐ added for history-service communication

const HISTORY_API = "http://127.0.0.1:8010/history";

export default function App() {
  const theme = createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#3b82f6" },
      secondary: { main: "#8b5cf6" },
      background: { default: "#0f172a", paper: "#1e293b" },
    },
    typography: {
      fontFamily: "Inter, sans-serif",
    },
  });

  const [tab, setTab] = useState(0);
  const [code, setCode] = useState("// paste or upload code here");
  const [language, setLanguage] = useState("python");
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);      // ⭐ new: to store last N runs
  const [loading, setLoading] = useState(false);

  // ⭐ fetch history from backend
  const loadHistory = async () => {
    try {
      const res = await axios.get(`${HISTORY_API}/latest`);
      setHistory(res.data?.history || []);
    } catch (err) {
      console.warn("History load failed", err);
    }
  };

  // ⭐ auto-load history when switching to Insights
  useEffect(() => {
    if (tab === 2) loadHistory();
  }, [tab]);

  // Upload + auto-detect language
  const onUpload = (text, filename) => {
    setCode(text);

    const ext = filename.split(".").pop();
    const langMap = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "cpp",
      go: "go",
    };

    setLanguage(langMap[ext] || "javascript");
  };

  // ⭐ Save analysis result to DB
  const saveHistory = async (payload) => {
    try {
      await axios.post(`${HISTORY_API}/save`, payload);
    } catch (error) {
      console.warn("History save failed:", error);
    }
  };

  // Trigger backend analysis
  const onReview = async () => {
    setLoading(true);
    try {
      const res = await analyzeAll(code, language);

      setResults(res);

      // ⭐ Save run in DB
      await saveHistory({
        language,
        codeSnippet: code.slice(0, 5000),
        summary: res.summary,
        issues: res.issues,
        timestamp: Date.now(),
      });

      setTab(1);
    } catch (e) {
      console.error("Review failed:", e);
      alert("Analysis failed. Check backend logs.");
    }
    setLoading(false);
  };

  // Hidden file input
  const FileUpload = () => (
    <>
      <input
        type="file"
        id="file-upload"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => onUpload(ev.target.result, file.name);
          reader.readAsText(file);
        }}
        accept=".js,.ts,.py,.java,.cpp,.go,.jsx,.tsx"
      />
      <label htmlFor="file-upload">
        <Button
          component="span"
          variant="outlined"
          startIcon={<UploadIcon />}
          sx={{ mr: 2 }}
        >
          Upload File
        </Button>
      </label>
    </>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Box className="app-container" sx={{ display: "flex", height: "100vh" }}>
        <Sidebar language={language} onPickLang={setLanguage} />

        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          <AppBar position="static" sx={{ background: "#1e293b" }}>
            <Toolbar>
              <SecurityIcon sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CodeSAGE AI — Dashboard
              </Typography>

              <Box sx={{ flex: 1 }} />

              <FileUpload />

              <Button
                variant="contained"
                onClick={onReview}
                disabled={loading}
                startIcon={<CodeIcon />}
                sx={{ borderRadius: 2, px: 3 }}
              >
                {loading ? "Analyzing..." : "Review Code"}
              </Button>
            </Toolbar>

            {loading && <LinearProgress />}
          </AppBar>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            sx={{
              bgcolor: "#0f172a",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <Tab label="Editor" icon={<CodeIcon />} />
            <Tab label="Results" icon={<BugIcon />} />
            <Tab label="Insights" icon={<AssessmentIcon />} />
          </Tabs>

          <Box sx={{ flexGrow: 1, p: 2, overflow: "auto" }}>
            {tab === 0 && (
              <EditorPane code={code} language={language} onChange={setCode} />
            )}

            {tab === 1 && <IssuesPanel results={results} />}

            {tab === 2 && (
              <InsightsPanel results={results} history={history} /> // ⭐ NEW
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
