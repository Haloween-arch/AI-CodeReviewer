import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import "./CodeCanvas.css";

// Mock language detection (replace with your actual utility)
const detectLanguage = (filename, text) => {
  if (filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
      js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
      go: 'go',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      swift: 'swift'
    };
    if (langMap[ext]) return langMap[ext];
  }
  
  // Simple text-based detection
  if (text.includes('import React') || text.includes('export default')) return 'javascript';
  if (text.includes('def ') && text.includes(':')) return 'python';
  if (text.includes('public class') || text.includes('public static void main')) return 'java';
  
  return 'javascript'; // default
};

export default function CodeCanvas({ onCodeDetected }) {
  const ref = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text/plain");
    if (text.trim()) {
      setIsProcessing(true);
      setTimeout(() => {
        const lang = detectLanguage("", text);
        onCodeDetected(text, lang);
        setIsProcessing(false);
      }, 300);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const lang = detectLanguage(file.name, text);
      setTimeout(() => {
        onCodeDetected(text, lang);
        setIsProcessing(false);
      }, 300);
    } catch (error) {
      console.error("Error reading file:", error);
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <Box
      ref={ref}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`code-canvas-container ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
    >
      {/* Animated Background */}
      <div className="canvas-bg-effect">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
      </div>

      {/* Grid Pattern */}
      <div className="grid-pattern"></div>

      {/* Main Content */}
      <div className="canvas-content">
        {!isProcessing ? (
          <>
            {/* Icon */}
            <div className="canvas-icon-wrapper">
              <svg className="canvas-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="icon-pulse"></div>
            </div>

            {/* Text Content */}
            <Typography className="canvas-title">
              Drop Your Code Here
            </Typography>
            
            <Typography className="canvas-subtitle">
              or <span className="highlight">paste</span> it directly
            </Typography>

            {/* Features */}
            <div className="canvas-features">
              <div className="feature-item">
                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Auto-detect language</span>
              </div>
              <div className="feature-item">
                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Instant analysis</span>
              </div>
              <div className="feature-item">
                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure processing</span>
              </div>
            </div>

            {/* Supported Formats */}
            <div className="supported-formats">
              <Typography className="formats-label">Supported:</Typography>
              <div className="format-badges">
                <span className="format-badge">JavaScript</span>
                <span className="format-badge">Python</span>
                <span className="format-badge">TypeScript</span>
                <span className="format-badge">Java</span>
                <span className="format-badge">C++</span>
                <span className="format-badge">Go</span>
              </div>
            </div>
          </>
        ) : (
          <div className="processing-state">
            <div className="spinner-wrapper">
              <div className="spinner"></div>
              <div className="spinner-glow"></div>
            </div>
            <Typography className="processing-text">
              Processing your code...
            </Typography>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <svg className="drag-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <Typography className="drag-text">Release to analyze</Typography>
          </div>
        </div>
      )}
    </Box>
  );
}