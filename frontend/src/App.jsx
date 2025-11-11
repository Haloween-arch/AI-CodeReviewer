// src/App.jsx
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
  const [loading, setLoading] = useState(false);

  // ✅ Upload + auto-detect language
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

  // ✅ Trigger backend analysis
  const onReview = async () => {
    setLoading(true);
    try {
      const res = await analyzeAll(code, language);
      setResults(res);
      setTab(1); // move to results tab
    } catch (e) {
      console.error("Review failed:", e);
      alert("Analysis failed. Check backend logs.");
    }
    setLoading(false);
  };

  // ✅ Hidden file input
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
        {/* ✅ Sidebar */}
        <Sidebar language={language} onPickLang={setLanguage} />

        {/* ✅ Main Content */}
        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          <AppBar position="static" sx={{ background: "#1e293b" }}>
            <Toolbar>
              <SecurityIcon sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CodeSAGE AI — Dashboard
              </Typography>

              <Box sx={{ flex: 1 }} />

              {/* ✅ Upload button */}
              <FileUpload />

              {/* ✅ Review button */}
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

          {/* ✅ Tabs */}
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

          {/* ✅ Page Content */}
          <Box sx={{ flexGrow: 1, p: 2, overflow: "auto" }}>
            {tab === 0 && (
              <EditorPane code={code} language={language} onChange={setCode} />
            )}

            {tab === 1 && <IssuesPanel results={results} />}

            {tab === 2 && <InsightsPanel results={results} />}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
