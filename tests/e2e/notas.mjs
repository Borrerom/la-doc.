// Paso 5: cargar fármacos a mano, verlos como fichas y como tabla (ordenar, columnas, filtro), sin internet.
// Uso: npm run build && node tests/e2e/notas.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4184
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
  await p.getByRole('link', { name: 'Antibióticos', exact: true }).waitFor()
  await p.getByRole('button', { name: '+ Sub' }).click()
  await p.getByLabel('Submazo de Antibióticos').fill('Penicilinas')
  await p.getByRole('button', { name: 'Agregar' }).first().click()
  await p.getByRole('link', { name: 'Penicilinas', exact: true }).waitFor()

  const idMateria = await p.evaluate(() => location.hash.split('/')[2])
  async function cargar(mazo, nombre, grupo, contra) {
    await p.goto(`http://localhost:${PUERTO}/#/materia/${idMateria}`)
    await p.getByRole('link', { name: mazo, exact: true }).click()
    await p.getByRole('link', { name: '+ Nuevo fármaco' }).click()
    await p.getByLabel('Nombre genérico y comercial').fill(nombre)
    await p.getByLabel('Grupo o familia').fill(grupo)
    await p.getByLabel(/Contraindicaciones/).fill(contra)
    await p.getByRole('button', { name: 'Guardar' }).click()
    await p.getByText(nombre, { exact: true }).waitFor()
  }

  await cargar('Penicilinas', 'Amoxicilina', 'Penicilinas', 'Alergia a penicilinas')
  await cargar('Antibióticos', 'Ceftriaxona', 'Cefalosporinas', 'Alergia a cefalosporinas\nNeonatos con hiperbilirrubinemia')
  await cargar('Antibióticos', 'Azitromicina', 'Macrólidos', 'Insuficiencia hepática grave')

  // Vista fichas del mazo padre: ve las 3, incluida la del submazo.
  await p.getByText('3 fármacos y 6 fichas, contando los submazos.').waitFor()
  await p.getByText('Ceftriaxona', { exact: true }).click()
  await p.getByText('Neonatos con hiperbilirrubinemia').waitFor()

  // Vista tabla: ordenar por grupo, ocultar columna, filtrar sin acento.
  await p.getByRole('button', { name: 'Tabla' }).click()
  await p.getByRole('columnheader', { name: 'Grupo o familia' }).click()
  const primeraColumna = () => p.locator('.tabla tbody tr td:first-child').allInnerTexts()
  const orden = await primeraColumna()
  if (orden.join() !== 'Ceftriaxona,Azitromicina,Amoxicilina') throw new Error(`orden por grupo: ${orden}`)
  await p.getByText('Columnas').click()
  await p.getByLabel('Mecanismo de acción').uncheck()
  if (await p.getByRole('columnheader', { name: 'Mecanismo de acción' }).count()) throw new Error('la columna no se ocultó')
  await p.getByLabel('Filtrar la tabla').fill('hepatica')
  const filtradas = await primeraColumna()
  if (filtradas.join() !== 'Azitromicina') throw new Error(`filtro: ${filtradas}`)
  await p.screenshot({ path: 'tests/e2e/notas-tabla.png', fullPage: true })

  // Editar desde la tabla y comprobar tras recargar sin internet.
  await p.getByRole('link', { name: 'Azitromicina' }).click()
  await p.getByLabel('Nombre genérico y comercial').fill('Azitromicina (Zithromax)')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.waitForURL(/#\/mazo\//)
  await p.reload()
  await p.getByRole('button', { name: 'Fichas' }).click()
  await p.getByText('Azitromicina (Zithromax)', { exact: true }).waitFor({ timeout: 5000 })
  await p.screenshot({ path: 'tests/e2e/notas-fichas.png', fullPage: true })

  // Paso 6: fichas generadas desde el fármaco, incluida una de completar.
  await p.getByText('Ceftriaxona', { exact: true }).click()
  await p.locator('details[open]').getByRole('link', { name: 'Editar' }).click()
  await p.getByText('Fichas de repaso (2)').waitFor()
  await p.getByLabel('Mecanismo de acción').fill('Inhibe la síntesis de la {{c1::pared bacteriana}}')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.waitForURL(/#\/mazo\//)
  await p.getByText('3 fármacos y 8 fichas, contando los submazos.').waitFor()
  await p.goBack()
  await p.getByText('Fichas de repaso (4)').waitFor()
  await p.getByText('Mecanismo de acción: Inhibe la síntesis de la […]', { exact: true }).waitFor()
  await p.screenshot({ path: 'tests/e2e/fichas.png', fullPage: true })

  // Paso 15: interacción sugerida entre dos fármacos cargados, que Desi confirma.
  await p.goto(`http://localhost:${PUERTO}/#/materia/${idMateria}`)
  await p.getByRole('link', { name: 'Antibióticos', exact: true }).click()
  await p.getByRole('link', { name: '+ Nuevo fármaco' }).click()
  await p.getByLabel('Nombre genérico y comercial').fill('Warfarina')
  await p.getByLabel('Grupo o familia').fill('Anticoagulantes')
  await p.getByLabel(/Interacciones/).fill('Azitromicina: aumenta el efecto anticoagulante')
  await p.getByRole('button', { name: 'Guardar' }).click()
  await p.getByText('💡 1 sugerencia').first().waitFor()
  await p.locator('summary', { hasText: 'Warfarina' }).click()
  const abierta = p.locator('details[open]')
  await abierta.getByText('«Azitromicina: aumenta el efecto anticoagulante»').waitFor()
  await abierta.getByRole('button', { name: '✓ Confirmar' }).click()
  await abierta.locator('.relacionados').getByRole('link', { name: 'Azitromicina (Zithromax)' }).waitFor()
  if (await p.getByText('💡 1 sugerencia').count()) throw new Error('la sugerencia sigue pendiente')
  await p.screenshot({ path: 'tests/e2e/interacciones.png', fullPage: true })
  console.log('OK: fármacos cargados a mano, vistos como fichas y como tabla, sus fichas de repaso e interacciones sugeridas, sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
