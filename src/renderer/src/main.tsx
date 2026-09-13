import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Dayplan could not find its application root.')

document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
