import React, { useState } from "react";
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

import {
  Code as CodeIcon,
  BugReport as BugIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";

import "./App.css";

// Components
import Sidebar from "./components/Sidebar.jsx";
import EditorPane from "./components/EditorPane.jsx";
import IssuesPanel from "./components/IssuesPanel.jsx";
import ChartsPanel from "./components/ChartsPanel.jsx";
import FileUpload from "./components/FileUpload.jsx";

// ✅ REAL backend API call (not mock)
import { analyzeAll } from "./services/api.js";

export default function App() {
  // ✅ Theme (Dark UI)
  const theme = createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#3b82f6" },
      secondary: { main: "#8b5cf6" },
      background: {
        default: "#0f172a",
        paper: "#1e293b",
      },
    },
  });

  // ✅ Main state
  const [tab, setTab] = useState(0);
  const [code, setCode] = useState("// paste or upload code here");
  const [language, setLanguage] = useState("python");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ When file is uploaded
  const onUpload = (text, filename) => {
    setCode(text);
    const ext = filename.split(".").pop();
    const map = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      cxx: "cpp",
      cc: "cpp",
      go: "go",
    };
    setLanguage(map[ext] || "javascript");
  };

  // ✅ Trigger full backend scan (via API Gateway)
  const onReview = async () => {
    setLoading(true);
    try {
      const response = await analyzeAll(code, language);
      setResults(response);
      setTab(1); // Switch to Results tab
    } catch (err) {
      console.error(err);
      alert("Analysis failed — check console");
    }
    setLoading(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Box className="app-container">

        {/* ✅ Sidebar (Language Picker + Branding) */}
        <Sidebar language={language} onPickLang={setLanguage} />

        {/* ✅ Main Window */}
        <Box className="main-content">

          {/* ✅ Top Bar */}
          <AppBar position="static" className="app-header">
            <Toolbar>
              <SecurityIcon className="header-icon" />
              <Typography variant="h6" className="header-title">
                CodeSAGE AI — Dashboard
              </Typography>

              <Box sx={{ flex: 1 }} />

              <FileUpload onUpload={onUpload} />

              <Button
                variant="contained"
                onClick={onReview}
                disabled={loading}
                startIcon={<CodeIcon />}
                className="review-button"
              >
                {loading ? "Analyzing..." : "Review Code"}
              </Button>
            </Toolbar>

            {/* ✅ Progress bar while scanning */}
            {loading && <LinearProgress className="progress-bar" />}
          </AppBar>

          {/* ✅ Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            className="tab-bar"
            variant="fullWidth"
          >
            <Tab label="Editor" icon={<CodeIcon />} />
            <Tab label="Results" icon={<BugIcon />} />
            <Tab label="Insights" icon={<AssessmentIcon />} />
          </Tabs>

          {/* ✅ Main Content Area */}
          <Box className="content-area">

            {/* Editor */}
            {tab === 0 && (
              <EditorPane
                code={code}
                language={language}
                onChange={(v) => setCode(v)}
              />
            )}

            {/* Analysis Results */}
            {tab === 1 && <IssuesPanel results={results} />}

            {/* Charts */}
            {tab === 2 && <ChartsPanel results={results} />}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
