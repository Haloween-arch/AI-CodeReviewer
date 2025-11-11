import React from 'react'
import {
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Typography,
  Chip,
  Stack,
  Tooltip
} from '@mui/material'
import CodeRoundedIcon from '@mui/icons-material/CodeRounded'
import CoffeeRoundedIcon from '@mui/icons-material/CoffeeRounded'
import IntegrationInstructionsRoundedIcon from '@mui/icons-material/IntegrationInstructionsRounded'
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded'
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'

const LANGS = [
  { id: 'python', label: 'Python', icon: <TerminalRoundedIcon fontSize="small" /> },
  { id: 'javascript', label: 'JavaScript', icon: <IntegrationInstructionsRoundedIcon fontSize="small" /> },
  { id: 'java', label: 'Java', icon: <CoffeeRoundedIcon fontSize="small" /> },
  { id: 'cpp', label: 'C++', icon: <DataObjectRoundedIcon fontSize="small" /> }
]

const SERVICES = [
  { name: 'Syntax', local: true, ai: true },
  { name: 'Style', local: true, ai: true },
  { name: 'Security', local: true, ai: true },
  { name: 'Quality', local: false, ai: true },
  { name: 'Rule', local: true, ai: false },
  { name: 'Report', local: true, ai: false }
]

export default function Sidebar({ language, onPickLang }) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: 0,
        p: 2
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5
        }}
      >
        <CodeRoundedIcon sx={{ opacity: 0.8 }} />
        <Typography variant="overline" sx={{ letterSpacing: 1, opacity: 0.8 }}>
          Language
        </Typography>
      </Box>

      {/* Languages */}
      <List dense disablePadding aria-label="Choose a programming language">
        {LANGS.map(l => (
          <ListItemButton
            key={l.id}
            selected={l.id === language}
            onClick={() => onPickLang && onPickLang(l.id)}
            sx={{
              borderRadius: 1.5,
              mb: 0.5,
              '&.Mui-selected': {
                bgcolor: theme => (theme.palette.mode === 'light' ? 'action.selected' : 'action.selected'),
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>{l.icon}</ListItemIcon>
            <ListItemText
              primary={l.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
              secondary={l.id}
              secondaryTypographyProps={{ fontSize: 11, opacity: 0.6 }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      {/* Services Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CheckCircleRoundedIcon sx={{ opacity: 0.8 }} />
        <Typography variant="overline" sx={{ letterSpacing: 1, opacity: 0.8 }}>
          Services
        </Typography>
      </Box>

      {/* Services Grid */}
      <Stack spacing={1}>
        {SERVICES.map(svc => (
          <Paper
            key={svc.name}
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {svc.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Local analysis">
                <Chip
                  size="small"
                  label="Local"
                  variant={svc.local ? 'filled' : 'outlined'}
                  color={svc.local ? 'success' : 'default'}
                />
              </Tooltip>
              <Tooltip title="AI-powered analysis">
                <Chip
                  size="small"
                  label="AI"
                  variant={svc.ai ? 'filled' : 'outlined'}
                  color={svc.ai ? 'info' : 'default'}
                />
              </Tooltip>
            </Box>
          </Paper>
        ))}
      </Stack>

      {/* Footer hint */}
      <Box sx={{ mt: 2.5, px: 1, py: 1, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
          Tip: You can switch languages anytime. Your last choice stays selected.
        </Typography>
      </Box>
    </Paper>
  )
}
