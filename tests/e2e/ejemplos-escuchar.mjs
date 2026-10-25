// Ejemplos con fuente y modo escuchar (voz del teléfono), sin internet.
// Uso: npm run build && node tests/e2e/ejemplos-escuchar.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4186
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

const browser = await chromium.launch()
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE' })
  // El navegador de pruebas no trae voces: se simula una lectura que dura 200 ms.
  await contexto.addInitScript(() => {
    speechSynthesis.speak = (frase) => setTimeout(() => frase.onend?.(new Event('end')), 200)
    speechSynthesis.cancel = () => {}
  })
  const p = await contexto.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto(`http://localhost:${PUERTO}/`)
  await p.evaluate(() => navigator.serviceWorker.ready)
  await p.reload()
  await contexto.setOffline(true)

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  // Farmacología 1 y sus 3 ejemplos aparecen solos al crear el semestre.
  // Tablero: la materia se despliega con sus temas, y cada tema abre su pantalla.
  await p.getByText('1 tema · 3 fármacos').waitFor()
  await p.locator('summary', { hasText: 'Farmacología 1' }).click()
  await p.screenshot({ path: 'tests/e2e/tablero.png', fullPage: true })
  await p.getByRole('link', { name: /Ejemplos \(MedlinePlus\)/ }).click()
  await p.getByText('3 fármacos y 21 fichas, contando los submazos.').waitFor()
  // Al volver, la materia sigue abierta.
  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByRole('link', { name: /Ejemplos \(MedlinePlus\)/ }).click()
  await p.getByText('Metformina', { exact: true }).click()
  await p.getByRole('link', { name: 'Metformina: MedlinePlus medicinas' }).waitFor()
  await p.getByRole('link', { name: /ficha técnica \(CIMA, AEMPS\)/ }).first().waitFor()
  await p.screenshot({ path: 'tests/e2e/ejemplos.png', fullPage: true })

  // Botón para escuchar la ficha completa, y el mazo entero en modo escuchar.
  await p.getByRole('button', { name: '🔊 Escuchar' }).click()
  await p.getByRole('button', { name: '■ Detener' }).waitFor()
  await p.getByRole('button', { name: '🔊 Escuchar' }).waitFor({ timeout: 15000 })
  // Si el teléfono no empieza a leer, se avisa con la ayuda en vez de quedarse mudo.
  await p.evaluate(() => {
    window.hablarBien = speechSynthesis.speak
    speechSynthesis.speak = () => {}
  })
  await p.getByRole('button', { name: '🔊 Escuchar' }).click()
  await p.getByText(/no empezó a leer/).waitFor({ timeout: 10000 })
  await p.evaluate(() => (speechSynthesis.speak = window.hablarBien))
  // El motor de la voz neuronal viene dentro de la app y abre sin internet.
  const motor = await p.evaluate(async () => typeof (await import(new URL('ort/ort-wasm-simd-threaded.mjs', document.baseURI).href)).default)
  if (motor !== 'function') throw new Error('motor ONNX: ' + motor)
  await p.getByRole('link', { name: '🎧 Escuchar el mazo' }).click()
  await p.waitForFunction(() => document.querySelector('select')?.selectedOptions[0]?.textContent?.includes('Ejemplos'))

  // El buscador los encuentra, también sin acentos.
  await p.goto(`http://localhost:${PUERTO}/#/buscar`)
  for (const nombre of ['amoxicilina', 'enalapril', 'metformina']) {
    await p.getByRole('searchbox', { name: 'Buscar' }).fill(nombre)
    await p.locator('.resultados strong', { hasText: new RegExp(`^${nombre}$`, 'i') }).first().waitFor()
  }

  // Modo escuchar con la voz del teléfono, en manual: muestra la ficha en pantalla.
  await p.goto(`http://localhost:${PUERTO}/#/escuchar`)
  // Los ajustes se guardan en el teléfono y la pantalla se actualiza un instante después.
  await p.getByLabel(/Del\s+teléfono/).click()
  await p.waitForFunction(() => document.querySelectorAll('input[type=radio]')[0].checked)
  await p.getByLabel(/Manual/).click()
  await p.waitForFunction(() => document.querySelectorAll('input[type=radio]')[3].checked)
  await p.getByRole('button', { name: '▶ Empezar' }).click()
  await p.getByText('Ficha 1 de 20').waitFor()
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByText('Ficha 2 de 20').waitFor()
  await p.screenshot({ path: 'tests/e2e/escuchar.png', fullPage: true })
  await p.getByRole('button', { name: 'Detener' }).click()
  await p.getByRole('button', { name: '▶ Empezar' }).waitFor()

  // Repaso con lectura activada no se rompe.
  await p.goto(`http://localhost:${PUERTO}/#/repaso`)
  await p.getByRole('button', { name: 'Leer en voz alta' }).click()
  await p.getByRole('button', { name: 'Mostrar respuesta' }).click()
  await p.getByRole('button', { name: /^Bien/ }).click()
  await p.getByText('Quedan', { exact: false }).waitFor()

  // Colores de la pantalla: Estudiando con todo en la noche se aplica y se recuerda al recargar.
  await p.goto(`http://localhost:${PUERTO}/#/`)
  await p.getByText('⚙ Más opciones').click()
  await p.getByLabel(/Estudiando con todo en la noche/).check()
  await p.reload()
  const fondo = await p.evaluate(() => [document.documentElement.dataset.tema, getComputedStyle(document.body).backgroundColor])
  if (fondo[0] !== 'noche-calida' || fondo[1] !== 'rgb(23, 19, 15)') throw new Error(`tema: ${fondo}`)
  await p.locator('summary', { hasText: 'Farmacología 1' }).waitFor()
  await p.screenshot({ path: 'tests/e2e/noche-calida.png', fullPage: true })
  await p.getByText('⚙ Más opciones').click()
  await p.getByLabel(/Modo Desi/).check()

  // Borrar los ejemplos de una vez.
  await p.goto(`http://localhost:${PUERTO}/#/`)
  await p.locator('details.materia', { hasText: 'Farmacología 1' }).evaluate((d) => (d.open = true))
  await p.getByRole('link', { name: '⚙ Organizar temas' }).click()
  await p.getByRole('button', { name: 'Borrar ejemplos' }).click()
  await p.getByRole('button', { name: 'Cargar 3 ejemplos' }).waitFor()
  if (await p.getByRole('link', { name: 'Ejemplos (MedlinePlus)' }).count()) throw new Error('el mazo de ejemplos sigue')
  console.log('OK: ejemplos con fuente, modo escuchar y lectura en el repaso, sin internet')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
