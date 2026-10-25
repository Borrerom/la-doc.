// Paso 13: la cola se procesa sola al volver internet (Gemini simulado) y Desi revisa antes de guardar.
// Uso: npm run build && node tests/e2e/procesar.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4190
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const RESPUESTA = {
  farmacos: [
    {
      campos: { 'farmaco-nombre': 'Ampicilina', 'farmaco-grupo': 'Penicilinas', 'farmaco-efectos': ['Diarrea', 'Exantema'] },
      evidencia: { 'farmaco-nombre': 'AMPICILINA', 'farmaco-grupo': 'grupo: penicilinas' },
      pagina: 1,
    },
    { campos: { 'farmaco-nombre': 'Gentamicina' }, evidencia: { 'farmaco-nombre': 'gentamicina' } },
  ],
}

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE', permissions: ['microphone'] })
  await contexto.addInitScript(() => localStorage.setItem('la-doc:sin-ejemplos', '1'))
  const pedidos = []
  await contexto.route('https://generativelanguage.googleapis.com/**', (ruta) => {
    pedidos.push(JSON.parse(ruta.request().postData()))
    ruta.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(RESPUESTA) }] } }] }),
    })
  })
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
  const urlMazo = p.url()

  // Sin internet: una foto y una nota de voz quedan en cola.
  await p.getByRole('link', { name: '📷 Cargar con IA' }).click()
  await p.getByLabel('Elegir fotos de la galería').setInputFiles({ name: 'p1.png', mimeType: 'image/png', buffer: PNG })
  await p.getByAltText('Página 1').waitFor()
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.getByText('Para que la IA procese las cargas falta una clave gratis.').waitFor()
  await p.goBack()
  await p.getByRole('button', { name: '🎙 Voz' }).click()
  await p.getByRole('button', { name: '🎙 Grabar' }).click()
  await p.getByText('● Grabando 0:01').waitFor({ timeout: 6000 })
  await p.getByRole('button', { name: '■ Terminar' }).click()
  await p.getByLabel('Nota de voz grabada').waitFor()
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.locator('.carga').nth(1).waitFor()

  // Clave de Gemini y vuelve internet: se procesa sola.
  await p.goto(`http://localhost:${PUERTO}/#/ajustes-ia`)
  await p.getByLabel('Clave de Google Gemini').fill('AIzaClaveDePrueba1234')
  await p.getByTestId('proveedor-gemini').getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('AIza••••1234').waitFor()
  await p.goto(`http://localhost:${PUERTO}/#/cargas`)
  await contexto.setOffline(false)
  await p.getByRole('link', { name: 'Revisar 2 pendientes' }).nth(1).waitFor({ timeout: 15000 })

  const mimes = pedidos.flatMap((c) => c.contents[0].parts.filter((x) => x.inline_data).map((x) => x.inline_data.mime_type))
  if (!mimes.includes('audio/wav') || !mimes.some((m) => m.startsWith('image/'))) throw new Error(`mimes: ${mimes}`)

  // Revisar: se corrige un dato, se guarda uno y se descarta el otro.
  await p.getByRole('link', { name: 'Revisar 2 pendientes' }).last().click()
  await p.getByText('Del material: «grupo: penicilinas»').waitFor()
  const primero = p.getByTestId('propuesto-0')
  await primero.getByLabel('Mecanismo de acción').fill('Inhibe la síntesis de la pared bacteriana')
  await p.screenshot({ path: 'tests/e2e/revisar.png', fullPage: true })
  await primero.getByRole('button', { name: 'Guardar en el tema' }).click()
  await p.getByTestId('propuesto-1').getByRole('button', { name: 'Descartar' }).click()
  await p.getByText('Listo. Guardaste 1 fármaco.').waitFor()

  await p.goto(urlMazo)
  await p.getByText('Ampicilina', { exact: true }).click()
  await p.getByText('Inhibe la síntesis de la pared bacteriana').waitFor()
  await p.getByText(/Tus fotos del .* \(leído por Google Gemini\)/).waitFor()
  console.log('OK: la cola se procesa al volver internet y cada fármaco se revisa antes de entrar al mazo')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
