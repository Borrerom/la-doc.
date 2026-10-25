// Paso 11: claves de IA guardadas en el teléfono, orden de proveedores y botón Probar.
// Uso: npm run build && node tests/e2e/ajustes-ia.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4188
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

  await p.getByRole('link', { name: /Inteligencia artificial/ }).click()
  const titulos = () => p.locator('.proveedor h2').allInnerTexts()
  await p.getByText('1. Google Gemini').waitFor()

  await p.getByLabel('Clave de Google Gemini').fill('AIzaClaveDePrueba1234')
  await p.getByTestId('proveedor-gemini').getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('AIza••••1234').waitFor()
  const probar = p.getByTestId('proveedor-gemini').getByRole('button', { name: 'Probar' })
  if (await probar.isEnabled()) throw new Error('Probar debería estar apagado sin internet')
  await p.getByText('Necesitas internet para probar.').waitFor()

  await p.getByRole('button', { name: 'Subir OpenRouter' }).click()
  await p.waitForFunction(() => document.querySelectorAll('.proveedor h2')[1]?.textContent === '2. OpenRouter')

  await p.getByTestId('proveedor-gemini').getByText('Cómo sacar la clave gratis').click()
  await p.getByText('Toca "Create API key" (Crear clave de API).').waitFor()

  await p.reload()
  await p.getByText('AIza••••1234').waitFor({ timeout: 5000 })
  const orden = await titulos()
  if (orden.join('|') !== '1. Google Gemini|2. OpenRouter|3. Groq') throw new Error(`orden: ${orden}`)

  // Con internet, el botón Probar llama al proveedor (aquí simulado).
  await p.route('https://generativelanguage.googleapis.com/**', (ruta) =>
    ruta.fulfill({ contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'listo' }] } }] }) }),
  )
  await contexto.setOffline(false)
  await probar.click()
  await p.getByText('✓ Funciona. Respondió: "listo"').waitFor()

  await p.screenshot({ path: 'tests/e2e/ajustes-ia.png', fullPage: true })
  console.log('OK: claves de IA guardadas en el teléfono, orden de proveedores y prueba de conexión')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
