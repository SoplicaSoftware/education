import 'katex/dist/katex.min.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Toaster } from './components/ui.tsx'
import { DecksProvider } from './lib/store.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DecksProvider>
      <Toaster>
        <App />
      </Toaster>
    </DecksProvider>
  </StrictMode>,
)
