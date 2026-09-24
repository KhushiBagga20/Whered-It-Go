import '@fontsource-variable/bricolage-grotesque/standard.css'
import '@fontsource-variable/figtree'
import '@fontsource/caveat/600.css'
import '@fontsource/caveat/700.css'
import './styles/tokens.css'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker } from './lib/pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
