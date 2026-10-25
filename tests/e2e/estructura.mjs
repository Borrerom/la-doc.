// Las tres materias: al crear el semestre aparecen Farmacología 1, Morfofisiopatología 2 y Práctica Médica 1.
// En cada tema se crea primero el tipo principal de la materia (patología, caso) con la misma ficha y 🔊.
// Uso: npm run build && node tests/e2e/estructura.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4193
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

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  for (const m of ['Farmacología 1', 'Morfofisiopatología 2', 'Práctica Médica 1']) await p.locator('summary', { hasText: m }).waitFor()

  // Morfofisiopatología: el botón principal es "Nueva patología".
  await p.locator('summary', { hasText: 'Morfofisiopatología 2' }).click()
  await p.getByRole('button', { name: '+ Nuevo tema' }).click()
  await p.getByLabel('Nombre del tema').fill('Cardiovascular')
  await p.getByRole('button', { name: 'Agregar', exact: true }).click()
  await p.getByRole('link', { name: /Cardiovascular/ }).click()
  const principal = p.locator('a.boton', { hasText: '+ Nueva patología' })
  await principal.waitFor()
  await principal.click()
  await p.getByRole('heading', { name: 'Nueva patología' }).waitFor()
  await p.getByLabel('Nombre', { exact: true }).fill('Hipertensión arterial')
  await p.getByLabel(/Signos y síntomas/).fill('Cefalea\nMareo')
  await p.getByLabel(/Tratamiento/).fill('Enalapril')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('1 patología y 2 fichas, contando los subtemas.').waitFor()

  // En el mismo tema también se puede agregar un caso: aparecen dos grupos.
  await p.getByRole('link', { name: '+ Nuevo caso clínico' }).click()
  await p.getByLabel('Título del caso').fill('Mujer de 58 años con cefalea')
  await p.getByLabel('Datos del paciente').fill('58 años, 72 kg, diabética')
  await p.getByLabel('Respuesta razonada').fill('Hipertensión arterial; enalapril protege el riñón.')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('1 patología, 1 caso y 3 fichas, contando los subtemas.').waitFor()
  await p.getByRole('heading', { name: '🩺 Patologías' }).waitFor()
  await p.getByRole('heading', { name: /Casos/ }).waitFor()
  await p.locator('summary', { hasText: 'Mujer de 58 años' }).click()
  await p.getByText('58 años, 72 kg, diabética').waitFor()
  await p.locator('details[open]').getByRole('button', { name: /Escuchar/ }).waitFor()

  // El tablero cuenta por tipo.
  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByText('1 tema · 1 patología · 1 caso').waitFor()
  await p.locator('summary', { hasText: 'Práctica Médica 1' }).getByText('Sin temas todavía').waitFor()
  await p.screenshot({ path: 'tests/e2e/estructura.png', fullPage: true })
  console.log('OK: tres materias, patologías y casos con la misma ficha, sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
