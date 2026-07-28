import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ThreeBackground from './ThreeBackground'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThreeBackground accent="#D97757" />
    <App />
  </React.StrictMode>
)
