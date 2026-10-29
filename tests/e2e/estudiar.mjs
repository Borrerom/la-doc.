// Estudiar un tema: elegir materia o tema, estudiar todas sus fichas a su ritmo, sin tocar el repaso de hoy.
// Uso: npm run build && node tests/e2e/estudiar.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4195
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

async function estudiarHastaTerminar(p, primera) {
  for (let i = 0; i < 200; i++) {
    const fin = p.getByRole('heading', { name: '¡Terminaste!' })
    const mostrar = p.getByRole('button', { name: 'Mostrar respuesta' })
    await fin.or(mostrar).waitFor()
    if (await fin.isVisible()) return i
    await mostrar.click()
    // La primera ficha se marca "Mal" una vez: debe volver en la misma sesión.
    await p.getByRole('button', { name: i === 0 && primera ? /^Mal/ : /^Bien/ }).click()
  }
  throw new Error('La sesión no termina')
}

const browser = await chromium.launch()
let fallo = null
try {
  for (const equipo of ['Pixel 7', 'iPhone 13']) {
    const contexto = await browser.newContext({ ...devices[equipo], locale: 'es-VE' })
    const p = await contexto.newPage()
    await p.goto(`http://localhost:${PUERTO}/`)
    await p.evaluate(() => navigator.serviceWorker.ready)
    await p.reload()
    await contexto.setOffline(true)

    await p.getByLabel('Nombre del semestre').fill('Semestre 5')
    await p.getByRole('button', { name: 'Crear' }).click()
    // Espera a que terminen de crearse todos los ejemplos (los de Práctica Médica 1 son los últimos).
    await p.locator('summary', { hasText: 'Práctica Médica 1' }).getByText('1 tema · 2 casos').waitFor()
    const resumen = p.locator('.repaso-resumen p')
    await resumen.waitFor()
    const antes = await resumen.textContent()

    // Desde Inicio: elegir la materia completa.
    await p.getByRole('link', { name: /Estudiar un tema/ }).click()
    await p.getByRole('heading', { name: 'Farmacología 1' }).waitFor()
    await p.locator('section', { has: p.getByRole('heading', { name: 'Farmacología 1' }) }).getByRole('link', { name: 'Toda la materia' }).click()
    await p.getByRole('heading', { name: /Estudiar Farmacología 1/ }).waitFor()
    const total = Number((await p.locator('.estudiar-ajustes p').first().textContent()).match(/\d+/)[0])
    await p.getByLabel('Mezcladas').check()
    if (equipo === 'Pixel 7') await p.screenshot({ path: 'tests/e2e/estudiar.png', fullPage: true })
    await p.getByRole('button', { name: '▶ Empezar' }).click()
    await p.getByText(`Quedan ${total}`).waitFor()
    await p.getByRole('button', { name: 'Mostrar respuesta' }).click()
    await p.getByRole('button', { name: /^Mal/ }).getByText('otra vez').waitFor()
    if (equipo === 'Pixel 7') await p.screenshot({ path: 'tests/e2e/estudiar-ficha.png' })
    await p.getByRole('button', { name: /^Bien/ }).click()
    const respuestas = await estudiarHastaTerminar(p, true)
    if (respuestas !== total) throw new Error(`Esperaba ${total} respuestas más (una "Mal" repetida), hubo ${respuestas}`)

    // Práctica libre: el repaso de hoy no cambió.
    await p.getByRole('link', { name: '← Volver' }).click()
    if ((await resumen.textContent()) !== antes) throw new Error(`El repaso cambió: "${antes}" → "${await resumen.textContent()}"`)

    // Desde un tema: el botón dentro del tema.
    await p.locator('summary', { hasText: 'Morfofisiopatología 2' }).click()
    await p.getByRole('link', { name: /Ejemplos \(MedlinePlus\)/ }).click()
    await p.getByRole('link', { name: '📚 Estudiar este tema' }).click()
    await p.getByRole('heading', { name: /Estudiar Ejemplos \(MedlinePlus\)/ }).waitFor()
    await p.getByLabel('En orden').check()
    await p.getByLabel('Contar para mi repaso').check()
    await p.getByRole('button', { name: '▶ Empezar' }).click()
    await estudiarHastaTerminar(p, false)
    await p.getByRole('button', { name: 'Otra vuelta' }).waitFor()
    await p.getByRole('link', { name: '← Volver' }).click()
    await p.getByRole('link', { name: '← Inicio' }).click()
    if ((await resumen.textContent()) === antes) throw new Error('Con "Contar para mi repaso" el repaso debía cambiar')
    await contexto.close()
    console.log(`OK (${equipo}): estudiar materia y tema a su ritmo, sin internet; ${total} fichas`)
  }
} catch (e) {
  fallo = e
  for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: 'tests/e2e/estudiar-fallo.png' }).catch(() => {})
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
