import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { asegurarTiposDeFabrica } from './core/db/tiposNota'

void asegurarTiposDeFabrica()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
