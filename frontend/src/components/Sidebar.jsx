import React from 'react'
import { Box, List, ListItemButton, ListItemText, Divider, Typography } from '@mui/material'

const langs = ['python', 'javascript', 'java', 'cpp']

export default function Sidebar({ language, onPickLang }) {
  return (
    <Box sx={{ borderRight: 1, borderColor: 'divider', p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, opacity: 0.7 }}>Language</Typography>
      <List dense>
        {langs.map(l => (
          <ListItemButton key={l} selected={l === language} onClick={() => onPickLang(l)}>
            <ListItemText primary={l} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>Services</Typography>
      <Box sx={{ mt: 1, fontSize: 12, opacity: 0.75 }}>
        syntax ✓ (local+Gemini)<br/>
        style ✓ (local+Gemini)<br/>
        security ✓ (local+Gemini)<br/>
        quality ✓ (Gemini)<br/>
        rule ✓ local<br/>
        report ✓ local
      </Box>
    </Box>
  )
}
