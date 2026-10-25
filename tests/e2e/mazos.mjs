// Paso 3: crea semestre, materia y submazos; recarga sin internet y comprueba que siguen ahí.
// Uso: npm run build && node tests/e2e/mazos.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4181
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const browser = await chromium.launch()
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE' })
  // Esta prueba empieza sin los fármacos de ejemplo.
  await contexto.addInitScript(() => localStorage.setItem('la-doc:sin-ejemplos', '1'))
  const p = await contexto.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto(`http://localhost:${PUERTO}/`)
  await p.evaluate(() => navigator.serviceWorker.ready)

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  await p.getByRole('button', { name: '+ Agregar materia' }).click()
  await p.getByRole('button', { name: 'Agregar' }).click() // viene con "Farmacología 1"
  await p.locator('details.materia', { hasText: 'Farmacología 1' }).evaluate((d) => (d.open = true))
  await p.getByRole('link', { name: '⚙ Organizar temas' }).click()

  await p.getByLabel('Nuevo mazo (tema)').fill('Antibióticos')
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByLabel('Nuevo mazo (tema)').fill('Analgésicos')
  await p.getByRole('button', { name: 'Agregar' }).click()
  await p.getByRole('button', { name: '+ Sub' }).first().click()
  await p.getByLabel('Submazo de Antibióticos').fill('Penicilinas')
  await p.getByRole('button', { name: 'Agregar' }).first().click()
  await p.getByText('Penicilinas', { exact: true }).waitFor()

  await contexto.setOffline(true)
  await p.reload()
  for (const t of ['Antibióticos', 'Penicilinas', 'Analgésicos']) await p.getByText(t, { exact: true }).waitFor({ timeout: 5000 })
  await p.screenshot({ path: 'tests/e2e/mazos.png', fullPage: true })

  // Borrar el mazo padre borra el submazo.
  await p.getByRole('button', { name: 'Borrar' }).first().click()
  await p.getByText('Penicilinas', { exact: true }).waitFor({ state: 'detached' })
  console.log('OK: mazos y submazos se guardan, sobreviven sin internet y se borran en cascada')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
