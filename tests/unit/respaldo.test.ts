import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica, TIPO_FARMACO } from '../../src/core/db/tiposNota'
import { exportarDatos, importarDatos } from '../../src/core/respaldo/datos'
import {
  hayCambiosSinRespaldar,
  leerEstadoRespaldo,
  prepararOtraCuenta,
  respaldarAhora,
  restaurarDeDrive,
  vincularCuenta,
} from '../../src/core/respaldo/respaldo'

// localStorage mínimo para el permiso de Google guardado.
const memoria = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
} as Storage

// Drive falso: guarda carpetas y archivos en memoria y anota cada llamada.
function driveFalso() {
  const archivos = new Map<string, { name: string; contenido?: string }>()
  const llamadas: string[] = []
  let n = 0
  const hacerFetch = (async (url: string, init: RequestInit = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push(`${metodo} ${url.split('?')[0]}`)
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 })
    if (url.includes('/userinfo')) return json({ email: 'desi@gmail.com' })
    if (url.includes('/upload/')) {
      const contenido = String(init.body).split('\r\n\r\n')[2].split('\r\n--')[0]
      const id = url.match(/files\/([^?]+)/)?.[1] ?? `a${++n}`
      if (metodo === 'PATCH' && !archivos.has(id)) return new Response('', { status: 404 })
      archivos.set(id, { name: 'la-doc-respaldo.json', contenido })
      return json({ id })
    }
    if (metodo === 'POST') {
      const id = `c${++n}`
      archivos.set(id, { name: JSON.parse(String(init.body)).name })
      return json({ id })
    }
    const alt = url.match(/files\/([^?]+)\?alt=media/)
    if (alt) return new Response(archivos.get(alt[1])!.contenido!, { status: 200 })
    const q = decodeURIComponent(url.split('q=')[1] ?? '')
    const files = [...archivos].filter(([, a]) => q.includes(`'${a.name}'`)).map(([id]) => ({ id }))
    return json({ files })
  }) as unknown as typeof fetch
  return { hacerFetch, archivos, llamadas }
}

describe('respaldo en Google Drive', () => {
  let mazoId = ''
  beforeEach(async () => {
    usarBase(`respaldo-${Math.random()}`)
    memoria.clear()
    memoria.set('la-doc:google-token', JSON.stringify({ valor: 'tok', vence: Date.now() + 3600_000 }))
    await asegurarTiposDeFabrica()
    const sem = await crearSemestre('Semestre 5')
    mazoId = (await crearMazo('Antibióticos', (await crearMateria('Farmacología 1', sem.id)).id)).id
    await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId, valores: { 'farmaco-nombre': 'Amoxicilina' }, etiquetas: [] })
  })

  it('exportar e importar deja todo igual, sin los ajustes del teléfono', async () => {
    await db.ajustes.put({ clave: 'respaldo', valor: { correo: 'x' } })
    const r = await exportarDatos()
    expect(r.tablas.notas).toHaveLength(1)
    expect(r.tablas.ajustes.some((a) => (a as { clave: string }).clave === 'respaldo')).toBe(false)
    usarBase(`otra-${Math.random()}`)
    await db.ajustes.put({ clave: 'respaldo', valor: { correo: 'y' } })
    await importarDatos(JSON.parse(JSON.stringify(r)))
    expect(await db.notas.count()).toBe(1)
    expect(await db.semestres.count()).toBe(1)
    expect((await db.ajustes.get('respaldo'))?.valor).toEqual({ correo: 'y' })
  })

  it('vincula, respalda solo si hay cambios, recupera y prepara el teléfono para otra cuenta', async () => {
    const drive = driveFalso()
    // vincularCuenta pide la ventana de Google; aquí se simula con el permiso ya guardado.
    const google = await import('../../src/core/respaldo/google')
    const token = google.tokenGuardado()!
    expect(await google.correoDeToken(token, drive.hacerFetch)).toBe('desi@gmail.com')
    await db.ajustes.put({ clave: 'respaldo', valor: { correo: 'desi@gmail.com', carpetaId: 'c0', archivoId: null } })
    drive.archivos.set('c0', { name: 'La Doc' })

    expect(await hayCambiosSinRespaldar()).toBe(true)
    await respaldarAhora({ hacerFetch: drive.hacerFetch })
    const estado = await leerEstadoRespaldo()
    expect(estado.archivoId).toBeTruthy()
    expect(await hayCambiosSinRespaldar()).toBe(false)

    // Otra nota: hay cambios y el segundo respaldo reemplaza el mismo archivo.
    await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId, valores: { 'farmaco-nombre': 'Enalapril' }, etiquetas: [] })
    expect(await hayCambiosSinRespaldar()).toBe(true)
    await respaldarAhora({ hacerFetch: drive.hacerFetch })
    expect(drive.llamadas.filter((l) => l.startsWith('PATCH'))).toHaveLength(1)

    // Otra persona: se respalda, se borra todo y se quita la cuenta.
    await prepararOtraCuenta({ hacerFetch: drive.hacerFetch })
    expect(await db.notas.count()).toBe(0)
    expect(await db.proveedoresIA.count()).toBe(0)
    expect(await leerEstadoRespaldo()).toEqual({})
    expect(memoria.has('la-doc:google-token')).toBe(false)

    // Desi vuelve a entrar y recupera sus 2 fármacos.
    memoria.set('la-doc:google-token', JSON.stringify({ valor: 'tok', vence: Date.now() + 3600_000 }))
    await db.ajustes.put({ clave: 'respaldo', valor: { correo: 'desi@gmail.com', carpetaId: 'c0', archivoId: estado.archivoId } })
    await restaurarDeDrive({ hacerFetch: drive.hacerFetch })
    expect(await db.notas.count()).toBe(2)
    expect(await hayCambiosSinRespaldar()).toBe(false)
    expect(typeof vincularCuenta).toBe('function')
  })

  it('sin permiso vigente no abre ventanas solo: pide un toque', async () => {
    memoria.clear()
    await db.ajustes.put({ clave: 'respaldo', valor: { correo: 'desi@gmail.com', carpetaId: 'c0' } })
    await expect(respaldarAhora({ hacerFetch: driveFalso().hacerFetch })).rejects.toThrow(/Respaldar ahora/)
    expect((await leerEstadoRespaldo()).error).toMatch(/Respaldar ahora/)
  })
})

describe('errores de Drive explicados', () => {
  it('dice qué hacer si la API de Drive no está activada o falta el permiso', async () => {
    const { asegurarCarpeta } = await import('../../src/core/respaldo/drive')
    const responder = (cuerpo: unknown) => (async () => new Response(JSON.stringify(cuerpo), { status: 403 })) as unknown as typeof fetch
    const token = { valor: 'tok', vence: Date.now() + 3600_000 }
    await expect(
      asegurarCarpeta(responder({ error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'accessNotConfigured' }] } }), token),
    ).rejects.toThrow(/no está activada.*drive\.googleapis\.com/)
    await expect(
      asegurarCarpeta(responder({ error: { status: 'PERMISSION_DENIED', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }), token),
    ).rejects.toThrow(/marca la casilla de Google Drive/)
  })
})
