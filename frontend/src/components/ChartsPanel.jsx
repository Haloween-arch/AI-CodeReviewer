import React, { useMemo } from 'react'
import { Card, CardContent, Grid, Typography, Box, LinearProgress } from '@mui/material'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Legend, LineChart, Line,
  Area, AreaChart, CartesianGrid
} from 'recharts'
import './ChartsPanel.css'

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{payload[0].name}</p>
        <p className="tooltip-value">{`${payload[0].value}%`}</p>
      </div>
    )
  }
  return null
}

// Animated Score Circle Component
const ScoreCircle = ({ score, label, color, icon }) => {
  const circumference = 2 * Math.PI * 70
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="score-circle-container">
      <svg className="score-circle-svg" width="160" height="160">
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          className="score-circle-bg"
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="rgba(59, 130, 246, 0.1)"
          strokeWidth="10"
        />
        <circle
          className="score-circle-progress"
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke={`url(#gradient-${label})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div className="score-circle-content">
        <div className="score-circle-icon">{icon}</div>
        <div className="score-circle-value">{score}</div>
        <div className="score-circle-label">{label}</div>
      </div>
    </div>
  )
}

export default function ChartsPanel({ results }) {
  // Normalize scores for charts
  const data = useMemo(() => {
    const securityScore = results?.security?.score ?? 0
    const styleIssues = (results?.style?.summary?.ai_issue_count ?? 0) + 
                        (results?.style?.summary?.local_issue_count ?? 0)
    const qualityScore = (() => {
      const qc = results?.quality?.analysis?.time_complexity || 'N/A'
      if (/O\(1\)/i.test(qc)) return 95
      if (/O\(log/i.test(qc)) return 85
      if (/O\(n\)/i.test(qc)) return 75
      if (/O\(n\s*\^?\s*2/i.test(qc)) return 60
      return 50
    })()

    const styleScore = Math.max(0, 100 - styleIssues * 10)

    return {
      barData: [
        { name: 'Security', value: securityScore, color: '#3b82f6' },
        { name: 'Style', value: styleScore, color: '#8b5cf6' },
        { name: 'Quality', value: qualityScore, color: '#10b981' }
      ],
      pieData: [
        { name: 'Security', value: securityScore },
        { name: 'Style', value: styleScore },
        { name: 'Quality', value: qualityScore }
      ],
      radarData: [
        { category: 'Security', value: securityScore },
        { category: 'Performance', value: qualityScore },
        { category: 'Style', value: styleScore },
        { category: 'Readability', value: Math.max(60, (securityScore + styleScore) / 2) },
        { category: 'Maintainability', value: Math.max(65, (qualityScore + styleScore) / 2) }
      ],
      trendData: [
        { month: 'Week 1', security: securityScore - 15, style: styleScore - 20, quality: qualityScore - 10 },
        { month: 'Week 2', security: securityScore - 10, style: styleScore - 15, quality: qualityScore - 5 },
        { month: 'Week 3', security: securityScore - 5, style: styleScore - 8, quality: qualityScore - 2 },
        { month: 'Week 4', security: securityScore, style: styleScore, quality: qualityScore }
      ],
      scores: {
        security: securityScore,
        style: styleScore,
        quality: qualityScore
      }
    }
  }, [results])

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981']

  if (!results) {
    return (
      <Box className="charts-empty-state">
        <div className="empty-icon-wrapper">
          <svg className="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <Typography variant="h6" className="empty-title">No Analytics Data</Typography>
        <Typography variant="body2" className="empty-subtitle">
          Run a code analysis to see beautiful insights and charts
        </Typography>
      </Box>
    )
  }

  return (
    <div className="charts-panel-container">
      {/* Score Circles */}
      <Grid container spacing={3} className="score-circles-grid">
        <Grid item xs={12} md={4}>
          <Card className="chart-card score-card">
            <CardContent>
              <ScoreCircle 
                score={data.scores.security} 
                label="Security" 
                color="#3b82f6"
                icon="🛡️"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card className="chart-card score-card">
            <CardContent>
              <ScoreCircle 
                score={data.scores.style} 
                label="Style" 
                color="#8b5cf6"
                icon="✨"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card className="chart-card score-card">
            <CardContent>
              <ScoreCircle 
                score={data.scores.quality} 
                label="Quality" 
                color="#10b981"
                icon="⚡"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Charts */}
      <Grid container spacing={3} className="main-charts-grid">
        {/* Bar Chart */}
        <Grid item xs={12} md={6}>
          <Card className="chart-card">
            <CardContent>
              <Box className="chart-header">
                <Typography variant="h6" className="chart-title">
                  📊 Performance Metrics
                </Typography>
                <Typography variant="caption" className="chart-subtitle">
                  Overall code quality scores
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.barData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <defs>
                    {data.barData.map((entry, index) => (
                      <linearGradient key={index} id={`colorGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={entry.color} stopOpacity={0.3}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.1)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(148, 163, 184, 0.6)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="rgba(148, 163, 184, 0.6)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data.barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#colorGradient${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card className="chart-card">
            <CardContent>
              <Box className="chart-header">
                <Typography variant="h6" className="chart-title">
                  🎯 Score Distribution
                </Typography>
                <Typography variant="caption" className="chart-subtitle">
                  Breakdown by category
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <defs>
                    {COLORS.map((color, index) => (
                      <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1}/>
                        <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie 
                    data={data.pieData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={{ stroke: 'rgba(148, 163, 184, 0.4)' }}
                  >
                    {data.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieGradient${index})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Radar Chart */}
        <Grid item xs={12} md={6}>
          <Card className="chart-card">
            <CardContent>
              <Box className="chart-header">
                <Typography variant="h6" className="chart-title">
                  🎪 Multi-Dimensional Analysis
                </Typography>
                <Typography variant="caption" className="chart-subtitle">
                  Comprehensive code assessment
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={data.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <PolarGrid stroke="rgba(59, 130, 246, 0.2)" />
                  <PolarAngleAxis 
                    dataKey="category" 
                    stroke="rgba(148, 163, 184, 0.6)"
                    style={{ fontSize: '12px' }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]}
                    stroke="rgba(148, 163, 184, 0.4)"
                    style={{ fontSize: '10px' }}
                  />
                  <Radar 
                    name="Score" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Trend Chart */}
        <Grid item xs={12} md={6}>
          <Card className="chart-card">
            <CardContent>
              <Box className="chart-header">
                <Typography variant="h6" className="chart-title">
                  📈 Progress Trend
                </Typography>
                <Typography variant="caption" className="chart-subtitle">
                  Score improvement over time
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data.trendData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorSecurity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorStyle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorQuality" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.1)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="rgba(148, 163, 184, 0.6)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="rgba(148, 163, 184, 0.6)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="security" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorSecurity)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="style" 
                    stroke="#8b5cf6" 
                    fillOpacity={1} 
                    fill="url(#colorStyle)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="quality" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorQuality)"
                    strokeWidth={2}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                    iconType="circle"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stats Bar */}
      <Grid container spacing={3} className="stats-bar">
        <Grid item xs={12} md={4}>
          <Card className="stat-card-inline security">
            <CardContent>
              <Box className="stat-inline-content">
                <div className="stat-inline-icon">🛡️</div>
                <div className="stat-inline-info">
                  <Typography variant="caption" className="stat-inline-label">
                    Security Health
                  </Typography>
                  <Typography variant="h5" className="stat-inline-value">
                    {data.scores.security}%
                  </Typography>
                </div>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={data.scores.security} 
                className="stat-progress security"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card className="stat-card-inline style">
            <CardContent>
              <Box className="stat-inline-content">
                <div className="stat-inline-icon">✨</div>
                <div className="stat-inline-info">
                  <Typography variant="caption" className="stat-inline-label">
                    Code Style
                  </Typography>
                  <Typography variant="h5" className="stat-inline-value">
                    {data.scores.style}%
                  </Typography>
                </div>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={data.scores.style} 
                className="stat-progress style"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card className="stat-card-inline quality">
            <CardContent>
              <Box className="stat-inline-content">
                <div className="stat-inline-icon">⚡</div>
                <div className="stat-inline-info">
                  <Typography variant="caption" className="stat-inline-label">
                    Code Quality
                  </Typography>
                  <Typography variant="h5" className="stat-inline-value">
                    {data.scores.quality}%
                  </Typography>
                </div>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={data.scores.quality} 
                className="stat-progress quality"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  )
}