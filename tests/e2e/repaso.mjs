// Paso 7: repaso del día con FSRS, sin internet.
// Uso: npm run build && node tests/e2e/repaso.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4185
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
  await p.getByRole('button', { name: '+ Agregar materia' }).click()
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByRole('link', { name: 'Farmacología 1' }).click()
  await p.getByLabel('Nuevo mazo (tema)').fill('Antidiabéticos')
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByRole('link', { name: 'Antidiabéticos', exact: true }).click()
  await p.getByRole('link', { name: '+ Nuevo fármaco' }).click()
  await p.getByLabel('Nombre genérico y comercial').fill('Metformina')
  await p.getByLabel('Grupo o familia').fill('Biguanidas')
  await p.getByLabel(/Contraindicaciones/).fill('Insuficiencia renal grave')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.waitForURL(/#\/mazo\//)

  await p.goto(`http://localhost:${PUERTO}/#/`)
  await p.getByText('2 fichas pendientes').waitFor()
  await p.getByRole('link', { name: 'Repasar' }).click()

  await p.getByText('Quedan 2').waitFor()
  await p.getByRole('button', { name: 'Mostrar respuesta' }).click()
  await p.screenshot({ path: 'tests/e2e/repaso.png', fullPage: true })
  await p.getByRole('button', { name: /^Fácil/ }).click()
  await p.getByText('Quedan 1').waitFor()
  await p.getByRole('button', { name: 'Mostrar respuesta' }).click()
  await p.getByRole('button', { name: /^Fácil/ }).click()
  await p.getByText('¡Listo por hoy!').waitFor()
  await p.getByText('Repasaste 2 fichas hoy.', { exact: false }).waitFor()

  await p.reload()
  await p.getByText('¡Listo por hoy!').waitFor({ timeout: 5000 })

  // Paso 8: buscador sin internet, con error de tipeo y sin acento.
  await p.getByRole('link', { name: 'Buscar' }).click()
  await p.getByRole('searchbox', { name: 'Buscar' }).fill('metfromina')
  await p.getByText('Metformina', { exact: true }).waitFor()
  await p.getByRole('searchbox', { name: 'Buscar' }).fill('insuficiencia renal')
  await p.getByText('Contraindicaciones:').waitFor()
  await p.screenshot({ path: 'tests/e2e/buscar.png', fullPage: true })
  console.log('OK: repaso del día con los cuatro botones y buscador, sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
