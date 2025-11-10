import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Check this import path

// This line MUST find the 'root' div from your index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)