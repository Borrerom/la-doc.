// Pasos 16 y 17: respaldo en Google Drive, preparar el teléfono para otra persona y recuperar.
// Google y Drive se simulan. Uso: npm run build && node tests/e2e/drive.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
const PUERTO = 4192
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PUERTO), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, mal) => {
  servidor.stdout.on('data', (d) => d.toString().includes(String(PUERTO)) && ok())
  servidor.on('exit', mal)
})

// Inicio de sesión de Google simulado: entrega un permiso al tocar.
const GIS = `window.google = { accounts: { oauth2: {
  initTokenClient: (c) => ({ requestAccessToken: (o) => { window.pedidos = (window.pedidos || []).concat(o); setTimeout(() => c.callback({ access_token: 'tok', expires_in: 3600 }), 50) } }),
  revoke: () => {},
} } }`

// Drive simulado en memoria.
const archivos = new Map()
let n = 0
async function drive(ruta) {
  const pedido = ruta.request()
  const url = pedido.url()
  const metodo = pedido.method()
  const json = (x) => ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) })
  if (pedido.headers().authorization !== 'Bearer tok') return ruta.fulfill({ status: 401, body: '' })
  if (url.includes('/userinfo')) return json({ email: 'desi@gmail.com' })
  if (url.includes('/upload/')) {
    const contenido = pedido.postData().split('\r\n\r\n')[2].split('\r\n--')[0]
    const id = url.match(/files\/([^?]+)/)?.[1] ?? `a${++n}`
    archivos.set(id, { name: 'la-doc-respaldo.json', contenido })
    return json({ id })
  }
  if (metodo === 'POST') {
    const id = `c${++n}`
    archivos.set(id, { name: JSON.parse(pedido.postData()).name })
    return json({ id })
  }
  const alt = url.match(/files\/([^?]+)\?alt=media/)
  if (alt) return ruta.fulfill({ status: 200, contentType: 'application/json', body: archivos.get(alt[1]).contenido })
  const q = decodeURIComponent(new URL(url).searchParams.get('q') ?? '')
  return json({ files: [...archivos].filter(([, a]) => q.includes(`'${a.name}'`)).map(([id]) => ({ id })) })
}

const browser = await chromium.launch()
let fallo = null
try {
  const contexto = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-VE', serviceWorkers: 'block' })
  await contexto.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: GIS }))
  await contexto.route('https://www.googleapis.com/**', drive)
  const p = await contexto.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto(`http://localhost:${PUERTO}/`)

  await p.getByLabel('Nombre del semestre').fill('Semestre 5')
  await p.getByRole('button', { name: 'Crear' }).click()
  await p.getByText('1 tema · 3 fármacos').waitFor()

  // Vincular: crea la carpeta "La Doc" y hace el primer respaldo.
  await p.getByRole('link', { name: /Respaldo en Google Drive/ }).click()
  await p.getByRole('button', { name: 'Entrar con Google' }).click()
  await p.getByText('Cuenta vinculada: desi@gmail.com. Ya quedó el primer respaldo.').waitFor()
  await p.getByText('desi@gmail.com', { exact: true }).waitFor()
  const respaldo = JSON.parse([...archivos.values()].find((a) => a.contenido).contenido)
  if (respaldo.tablas.notas.length !== 3) throw new Error(`notas respaldadas: ${respaldo.tablas.notas.length}`)
  if (![...archivos.values()].some((a) => a.name === 'La Doc')) throw new Error('no se creó la carpeta La Doc')
  await p.screenshot({ path: 'tests/e2e/drive.png', fullPage: true })

  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByText('Último respaldo:').waitFor()
  await p.getByText('hace un momento').waitFor()

  // Otra persona: se respalda, se vacía el teléfono y se quita la cuenta.
  await p.getByRole('link', { name: '☁️ Respaldo en Google Drive' }).click()
  await p.getByText('Cambiar de cuenta').click()
  await p.getByRole('button', { name: 'Preparar el teléfono para otra persona' }).click()
  await p.getByText(/el teléfono quedó vacío/).waitFor()
  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByText('Bienvenida a La Doc').waitFor()

  // Desi vuelve a entrar y recupera su respaldo.
  await p.goto(`http://localhost:${PUERTO}/#/respaldo`)
  await p.getByRole('button', { name: 'Entrar con Google' }).click()
  await p.getByText('Encontré un respaldo tuyo en Drive.', { exact: false }).waitFor()
  await p.getByRole('button', { name: 'Sí, recuperar mi respaldo' }).click()
  await p.getByText(/se recuperó el respaldo/).waitFor()
  await p.getByRole('link', { name: '← Inicio' }).click()
  await p.getByText('1 tema · 3 fármacos').waitFor()
  console.log('OK: respaldo en Google Drive, teléfono preparado para otra persona y respaldo recuperado')
} catch (e) {
  fallo = e
} finally {
  await browser.close()
  servidor.kill()
}
if (fallo) console.error('FALLÓ:', fallo.message)
process.exit(fallo ? 1 : 0)
