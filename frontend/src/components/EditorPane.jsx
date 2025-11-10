import React, { useState, useEffect } from 'react'
import MonacoEditor from 'react-monaco-editor'
import { Box, IconButton, Tooltip, Chip, Paper } from '@mui/material'
import './EditorPane.css'

const monacoLanguageMap = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  ruby: 'ruby',
  php: 'php',
  csharp: 'csharp',
  swift: 'swift'
}

const languageIcons = {
  python: '🐍',
  javascript: '⚡',
  typescript: '💙',
  java: '☕',
  cpp: '⚙️',
  go: '🐹',
  ruby: '💎',
  php: '🐘',
  csharp: '#️⃣',
  swift: '🦅'
}

export default function EditorPane({ code, language, onChange }) {
  const [editorInstance, setEditorInstance] = useState(null)
  const [lineCount, setLineCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (code) {
      const lines = code.split('\n').length
      const chars = code.length
      const words = code.trim().split(/\s+/).filter(w => w.length > 0).length
      
      setLineCount(lines)
      setCharCount(chars)
      setWordCount(words)
    } else {
      setLineCount(0)
      setCharCount(0)
      setWordCount(0)
    }
  }, [code])

  const editorDidMount = (editor, monaco) => {
    setEditorInstance(editor)
    
    // Custom theme
    monaco.editor.defineTheme('codeguard-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#1e293b',
        'editor.selectionBackground': '#3b82f640',
        'editor.inactiveSelectionBackground': '#3b82f620',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#3b82f6',
        'editorCursor.foreground': '#3b82f6',
        'editor.findMatchBackground': '#8b5cf640',
        'editor.findMatchHighlightBackground': '#8b5cf620',
        'editorGutter.background': '#0f172a',
        'editorGutter.addedBackground': '#10b98160',
        'editorGutter.deletedBackground': '#ef444460',
        'editorGutter.modifiedBackground': '#3b82f660',
      }
    })
    
    monaco.editor.setTheme('codeguard-dark')
    
    // Focus editor
    editor.focus()
  }

  const handleFormatCode = () => {
    if (editorInstance) {
      editorInstance.getAction('editor.action.formatDocument').run()
    }
  }

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      // You could add a toast notification here
    }
  }

  const handleClearCode = () => {
    if (onChange) {
      onChange('')
    }
  }

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    fontLigatures: true,
    wordWrap: 'on',
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: true,
    smoothScrolling: true,
    padding: { top: 16, bottom: 16 },
    bracketPairColorization: {
      enabled: true
    },
    guides: {
      bracketPairs: true,
      indentation: true
    },
    suggest: {
      showKeywords: true,
      showSnippets: true
    }
  }

  return (
    <Box className="editor-pane-container">
      {/* Top Bar */}
      <Paper className="editor-toolbar" elevation={0}>
        <Box className="editor-info">
          <Chip
            icon={<span className="lang-emoji">{languageIcons[language] || '📝'}</span>}
            label={language.toUpperCase()}
            className="language-chip"
            size="small"
          />
          
          <div className="editor-stats">
            <span className="stat-item">
              <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {lineCount} lines
            </span>
            <span className="stat-divider">•</span>
            <span className="stat-item">
              <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {wordCount} words
            </span>
            <span className="stat-divider">•</span>
            <span className="stat-item">
              <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {charCount} chars
            </span>
          </div>
        </Box>

        <Box className="editor-actions">
          <Tooltip title="Format Code" placement="bottom">
            <IconButton 
              className="editor-action-btn"
              onClick={handleFormatCode}
              size="small"
            >
              <svg className="action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </IconButton>
          </Tooltip>

          <Tooltip title="Copy Code" placement="bottom">
            <IconButton 
              className="editor-action-btn"
              onClick={handleCopyCode}
              size="small"
            >
              <svg className="action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear Code" placement="bottom">
            <IconButton 
              className="editor-action-btn danger"
              onClick={handleClearCode}
              size="small"
            >
              <svg className="action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Monaco Editor */}
      <Box className="editor-wrapper">
        <div className="editor-glow-effect"></div>
        <MonacoEditor
          width="100%"
          height="100%"
          language={monacoLanguageMap[language] || 'javascript'}
          value={code}
          options={editorOptions}
          onChange={onChange}
          editorDidMount={editorDidMount}
        />
      </Box>

      {/* Bottom Status Bar */}
      <Paper className="editor-status-bar" elevation={0}>
        <div className="status-left">
          <span className="status-indicator ready">
            <span className="pulse-dot"></span>
            Ready
          </span>
        </div>
        
        <div className="status-right">
          <span className="status-item">
            UTF-8
          </span>
          <span className="status-divider">|</span>
          <span className="status-item">
            Spaces: 2
          </span>
          <span className="status-divider">|</span>
          <span className="status-item">
            {monacoLanguageMap[language] || 'javascript'}
          </span>
        </div>
      </Paper>
    </Box>
  )
}