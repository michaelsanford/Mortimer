import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './utils/i18n.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
