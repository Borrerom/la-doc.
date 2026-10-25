// Comprueba que la app instalada abre sin internet: carga una vez, corta la red y recarga.
// Uso: npm run build && npm run test:offline
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4179
const URL = `http://localhost:${PUERTO}/`

const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const browser = await chromium.launch()
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE' })
  const pagina = await contexto.newPage()
  await pagina.goto(URL)
  await pagina.evaluate(() => navigator.serviceWorker.ready)
  // Recarga para que el service worker controle la página antes de cortar la red.
  await pagina.reload()
  await pagina.waitForFunction(() => navigator.serviceWorker.controller !== null)

  const manifiesto = await pagina.evaluate(async () => {
    const enlace = document.querySelector('link[rel="manifest"]')
    return enlace ? (await fetch(enlace.href)).json() : null
  })
  if (manifiesto?.lang !== 'es' || manifiesto?.display !== 'standalone') throw new Error('manifiesto incompleto')

  await contexto.setOffline(true)
  await pagina.reload()
  await pagina.getByRole('heading', { name: 'La Doc' }).waitFor({ timeout: 5000 })
  const estado = await pagina.getByTestId('conexion').textContent()
  if (estado !== 'Sin internet') throw new Error(`indicador de conexión dice "${estado}"`)
  await pagina.screenshot({ path: 'tests/e2e/offline.png' })
  console.log('OK: la app abre sin internet y lo indica')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
