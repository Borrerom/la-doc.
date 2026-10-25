// Paso 12: fotos, PDF y notas de voz quedan en la cola del teléfono, sin internet.
// Uso: npm run build && node tests/e2e/captura.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4189
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

// Micrófono simulado del navegador de pruebas.
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE', permissions: ['microphone'] })
  // Esta prueba empieza sin los fármacos de ejemplo.
  await contexto.addInitScript(() => localStorage.setItem('la-doc:sin-ejemplos', '1'))
  const p = await contexto.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto(`http://localhost:${PUERTO}/`)
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload()
  await contexto.setOffline(true)

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  await p.getByRole('button', { name: '+ Agregar materia' }).click()
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.locator('details.materia', { hasText: 'Farmacología 1' }).evaluate((d) => (d.open = true))
  await p.getByRole('link', { name: '⚙ Organizar temas' }).click()
  await p.getByLabel('Nuevo mazo (tema)').fill('Antibióticos')
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByRole('link', { name: 'Antibióticos', exact: true }).click()
  await p.getByRole('link', { name: '📷 Cargar con IA' }).click()
  await p.getByText('Farmacología 1 › Antibióticos').waitFor()

  // Dos fotos de la galería, se quita una y se agrega otra.
  await p.getByLabel('Elegir fotos de la galería').setInputFiles([
    { name: 'p1.png', mimeType: 'image/png', buffer: PNG },
    { name: 'p2.png', mimeType: 'image/png', buffer: PNG },
  ])
  await p.getByAltText('Página 2').waitFor()
  await p.getByRole('button', { name: 'Quitar página 1' }).click()
  await p.getByAltText('Página 2').waitFor({ state: 'detached' })
  await p.getByLabel('Indicaciones para la IA (opcional)').fill('Solo la amoxicilina')
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.getByText('En cola: se procesa cuando haya internet').waitFor()
  await p.getByText('“Solo la amoxicilina”').waitFor()
  await p.getByText('1 página', { exact: false }).waitFor()

  // Un PDF.
  await p.goBack()
  await p.getByRole('button', { name: '📄 PDF' }).click()
  await p.getByLabel('Elegir PDF').setInputFiles({ name: 'guia.pdf', mimeType: 'application/pdf', buffer: PDF })
  await p.getByText('guia.pdf').waitFor()
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.locator('.carga').nth(1).waitFor()

  // Una nota de voz de unos segundos.
  await p.goBack()
  await p.getByRole('button', { name: '🎙 Voz' }).click()
  await p.getByRole('button', { name: '🎙 Grabar' }).click()
  await p.getByText('● Grabando 0:02').waitFor({ timeout: 6000 })
  await p.getByRole('button', { name: '■ Terminar' }).click()
  await p.getByLabel('Nota de voz grabada').waitFor()
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.locator('.carga').nth(2).waitFor()

  // Sobrevive a recargar y aparece en Inicio.
  await p.reload()
  if ((await p.locator('.carga').count()) !== 3) throw new Error('no están las 3 cargas')
  const tamanos = await p.evaluate(async () => {
    const abrir = indexedDB.open('la-doc')
    const base = await new Promise((ok) => (abrir.onsuccess = () => ok(abrir.result)))
    const todos = await new Promise((ok) => {
      const r = base.transaction('archivos').objectStore('archivos').getAll()
      r.onsuccess = () => ok(r.result)
    })
    return todos.map((a) => `${a.tipoMime}:${a.tamano > 0}`)
  })
  if (!tamanos.some((t) => t.startsWith('audio/')) || !tamanos.includes('application/pdf:true')) {
    throw new Error(`archivos: ${tamanos}`)
  }
  await p.screenshot({ path: 'tests/e2e/captura.png', fullPage: true })
  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByText('3 cargas pendientes.').waitFor()

  // Borrar una carga.
  await p.goto(`http://localhost:${PUERTO}/#/cargas`)
  await p.locator('.carga').first().getByRole('button', { name: 'Borrar' }).click()
  await p.waitForFunction(() => document.querySelectorAll('.carga').length === 2)

  console.log('OK: fotos, PDF y voz guardados en la cola del teléfono, sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
