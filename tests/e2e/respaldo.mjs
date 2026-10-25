// Paso 14: sin Gemini, Groq lee el PDF convertido a texto en el teléfono y transcribe la nota de voz.
// Uso: npm run build && node tests/e2e/respaldo.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4191
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

// Un PDF mínimo con texto real.
const LINEAS = [
  'AMPICILINA. Grupo: penicilinas de amplio espectro.',
  'Mecanismo: inhibe la sintesis de la pared bacteriana.',
  'Efectos adversos: diarrea, exantema y reacciones alergicas.',
  'Indicaciones: infecciones respiratorias y urinarias.',
  'Contraindicaciones: alergia a las penicilinas.',
]
const flujo = LINEAS.map((l, i) => `BT /F1 10 Tf 40 ${700 - i * 14} Td (${l}) Tj ET`).join('\n')
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
    `4 0 obj<</Length ${flujo.length}>>stream\n${flujo}\nendstream endobj\n` +
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
)
const RESPUESTA = {
  farmacos: [{ campos: { 'farmaco-nombre': 'Ampicilina', 'farmaco-grupo': 'Penicilinas' }, evidencia: { 'farmaco-nombre': 'AMPICILINA' } }],
}

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE', permissions: ['microphone'] })
  await contexto.addInitScript(() => localStorage.setItem('la-doc:sin-ejemplos', '1'))
  const textosEnviados = []
  let transcripciones = 0
  await contexto.route('https://api.groq.com/**', (ruta) => {
    if (ruta.request().url().endsWith('/audio/transcriptions')) {
      transcripciones++
      return ruta.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'La gentamicina es un aminoglucósido' }) })
    }
    const cuerpo = JSON.parse(ruta.request().postData())
    textosEnviados.push(cuerpo.messages[1].content.map((c) => c.text ?? '').join(' '))
    ruta.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(RESPUESTA) } }] }) })
  })
  const p = await contexto.newPage()
  await p.goto(`http://localhost:${PUERTO}/`)
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload()

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  await p.getByRole('button', { name: '+ Agregar materia' }).click()
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.goto(`http://localhost:${PUERTO}/#/ajustes-ia`)
  await p.getByLabel('Clave de Groq').fill('gsk_ClaveDePrueba1234')
  await p.getByTestId('proveedor-groq').getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('gsk_••••1234').waitFor()

  await p.goto(`http://localhost:${PUERTO}/#/`)
  await p.locator('details.materia', { hasText: 'Farmacología 1' }).evaluate((d) => (d.open = true))
  await p.getByRole('link', { name: '⚙ Organizar temas' }).click()
  await p.getByLabel('Nuevo mazo (tema)').fill('Antibióticos')
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByRole('link', { name: 'Antibióticos', exact: true }).click()
  await p.getByRole('link', { name: '📷 Cargar con IA' }).click()
  await p.getByRole('button', { name: '📄 PDF' }).click()
  await p.getByLabel('Elegir PDF').setInputFiles({ name: 'guia.pdf', mimeType: 'application/pdf', buffer: PDF })
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.getByRole('link', { name: 'Revisar 1 fármacos' }).waitFor({ timeout: 20000 })
  if (!textosEnviados[0]?.includes('AMPICILINA. Grupo: penicilinas')) throw new Error(`texto del PDF: ${textosEnviados[0]}`)

  await p.goBack()
  await p.getByRole('button', { name: '🎙 Voz' }).click()
  await p.getByRole('button', { name: '🎙 Grabar' }).click()
  await p.getByText('● Grabando 0:01').waitFor({ timeout: 6000 })
  await p.getByRole('button', { name: '■ Terminar' }).click()
  await p.getByLabel('Nota de voz grabada').waitFor()
  await p.getByRole('button', { name: 'Guardar en la cola' }).click()
  await p.getByRole('link', { name: 'Revisar 1 fármacos' }).nth(1).waitFor({ timeout: 20000 })
  if (transcripciones !== 1 || !textosEnviados[1]?.includes('La gentamicina es un aminoglucósido')) {
    throw new Error(`voz: ${transcripciones} ${textosEnviados[1]}`)
  }
  console.log('OK: sin Gemini, Groq lee el PDF convertido en el teléfono y la nota de voz transcrita')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
