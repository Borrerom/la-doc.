import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { materiasALila } from './core/db/organizacion'
import { asegurarTiposDeFabrica } from './core/db/tiposNota'
import { aplicarTema, leerTema } from './core/tema/tema'
import { desbloquearVozAlTocar } from './core/audio/vozTelefono'

aplicarTema(leerTema())
desbloquearVozAlTocar()

void asegurarTiposDeFabrica()
void materiasALila()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
