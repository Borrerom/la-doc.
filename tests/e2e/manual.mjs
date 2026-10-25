// Manual de uso: se abre desde Más opciones sin internet, usa los colores elegidos y el buscador de errores filtra.
// Uso: npm run build && node tests/e2e/manual.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4194
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const browser = await chromium.launch()
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE' })
  const p = await contexto.newPage()
  await p.goto(`http://localhost:${PUERTO}/`)
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload()
  await p.evaluate(() => localStorage.setItem('la-doc:tema', 'noche-calida'))
  await contexto.setOffline(true)

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  await p.locator('summary', { hasText: 'Más opciones' }).click()
  await p.getByRole('link', { name: /Manual de uso/ }).click()
  await p.getByRole('heading', { name: 'Cómo usar Doc Desi' }).waitFor()
  if ((await p.evaluate(() => document.documentElement.dataset.tema)) !== 'noche-calida') throw new Error('El manual no usa los colores elegidos')

  const visibles = () => p.locator('.error:visible').count()
  const todos = await visibles()
  await p.getByLabel('Buscar un mensaje de error').fill('cuota')
  const filtrados = await visibles()
  if (!(filtrados > 0 && filtrados < todos)) throw new Error(`El buscador no filtra: ${filtrados} de ${todos}`)
  await p.getByText('Se acabó la cuota gratis por ahora.').waitFor()
  await p.getByLabel('Buscar un mensaje de error').fill('microfono')
  await p.getByText('No hay permiso para usar el micrófono').waitFor()
  await p.getByLabel('Buscar un mensaje de error').fill('zzz')
  await p.getByText('No hay ningún mensaje con esa palabra').waitFor()
  await p.getByLabel('Buscar un mensaje de error').fill('')
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.screenshot({ path: 'tests/e2e/manual.png', fullPage: false })

  await p.getByRole('link', { name: '‹ Volver a Doc Desi' }).click()
  await p.locator('summary', { hasText: 'Farmacología 1' }).waitFor()
  console.log(`OK: manual sin internet, ${todos} mensajes de error y buscador`)
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
