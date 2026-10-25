// Paso 4: el tipo Fármaco trae 8 campos; se puede agregar, renombrar, ocultar y ordenar, también sin internet.
// Uso: npm run build && node tests/e2e/campos.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4183
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
  await contexto.setOffline(true)

  await p.getByRole('link', { name: /Campos de la ficha de fármaco/ }).click()
  const nombres = () => p.locator('.campo-nombre').allInnerTexts()
  await p.getByText('Dosis, y ajustes por edad o peso', { exact: true }).waitFor()
  if ((await nombres()).length !== 8) throw new Error('no están los 8 campos')

  await p.getByLabel('Nombre del campo nuevo').fill('Uso en embarazo')
  await p.getByRole('button', { name: 'Agregar campo' }).click()
  await p.getByText('Pregunta: Uso en embarazo de [Nombre genérico y comercial]').waitFor()

  const fila = p.locator('.campo', { hasText: 'Contraindicaciones' })
  await fila.getByRole('button', { name: 'Renombrar' }).click()
  await p.getByLabel('Nuevo nombre del campo').fill('Cuándo no usar')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('Pregunta: Cuándo no usar de [Nombre genérico y comercial]').waitFor()

  await p.locator('.campo', { hasText: 'Mecanismo de acción' }).getByRole('button', { name: 'Ocultar' }).click()
  await p.getByText('Mecanismo de acción (oculto)').waitFor()
  await p.getByRole('button', { name: 'Subir Uso en embarazo' }).click()
  await p.waitForFunction(() => [...document.querySelectorAll('.campo-nombre')].at(-2)?.textContent === 'Uso en embarazo')

  await p.reload()
  await p.getByText('Mecanismo de acción (oculto)').waitFor({ timeout: 5000 })
  const finales = await nombres()
  if (finales.at(-2) !== 'Uso en embarazo' || !finales.includes('Cuándo no usar')) throw new Error(`orden: ${finales}`)
  await p.screenshot({ path: 'tests/e2e/campos.png', fullPage: true })
  console.log('OK: campos editables, guardados y disponibles sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
