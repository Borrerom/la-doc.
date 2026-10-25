import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorIA, pedirIA } from '../../src/core/ai/clientes'
import {
  asegurarProveedores,
  guardarProveedor,
  listarProveedores,
  moverProveedor,
  pedirConRespaldoDeModelo,
  probarProveedor,
  proveedoresDisponibles,
} from '../../src/core/ai/proveedores'
import { db, usarBase } from '../../src/core/db/db'
import type { ProveedorIA } from '../../src/core/model/tipos'

const gemini: ProveedorIA = { id: 'gemini', clave: 'AIza-prueba', modelo: 'gemini-2.5-flash', orden: 0, activo: true }
const groq: ProveedorIA = { id: 'groq', clave: 'gsk_prueba', modelo: 'llama', orden: 1, activo: true }

function respuestaFalsa(estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  const pedidos: { url: string; init: RequestInit }[] = []
  const hacerFetch = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init })
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status: estado, headers: cabeceras })
  }) as unknown as typeof fetch
  return { hacerFetch, pedidos }
}

describe('cliente de IA', () => {
  it('arma el pedido de Gemini con imagen y lee la respuesta', async () => {
    const { hacerFetch, pedidos } = respuestaFalsa(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })
    const texto = await pedirIA(
      gemini,
      { instrucciones: 'Extrae', partes: [{ texto: 'hola' }, { datos: 'QUJD', mime: 'image/jpeg' }], json: true },
      hacerFetch,
    )
    expect(texto).toBe('{"a":1}')
    expect(pedidos[0].url).toContain('/models/gemini-2.5-flash:generateContent')
    expect((pedidos[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-prueba')
    const cuerpo = JSON.parse(pedidos[0].init.body as string)
    expect(cuerpo.contents[0].parts[1]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } })
    expect(cuerpo.generationConfig.responseMimeType).toBe('application/json')
  })

  it('arma el pedido compatible con OpenAI para Groq', async () => {
    const { hacerFetch, pedidos } = respuestaFalsa(200, { choices: [{ message: { content: 'listo' } }] })
    expect(await pedirIA(groq, { instrucciones: 'x', partes: [{ datos: 'QUJD', mime: 'image/png' }] }, hacerFetch)).toBe('listo')
    expect(pedidos[0].url).toBe('https://api.groq.com/openai/v1/chat/completions')
    const cuerpo = JSON.parse(pedidos[0].init.body as string)
    expect(cuerpo.messages[1].content[0].image_url.url).toBe('data:image/png;base64,QUJD')
  })

  it('distingue cuota agotada, clave mala y falta de red', async () => {
    const cuota = respuestaFalsa(429, 'demasiados', { 'retry-after': '30' })
    await expect(pedirIA(gemini, { instrucciones: '', partes: [] }, cuota.hacerFetch)).rejects.toMatchObject({
      tipo: 'cuota',
      esperarMs: 30000,
    })
    const clave = respuestaFalsa(400, { error: { message: 'API key not valid' } })
    await expect(pedirIA(gemini, { instrucciones: '', partes: [] }, clave.hacerFetch)).rejects.toMatchObject({ tipo: 'clave' })
    const sinRed = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(pedirIA(gemini, { instrucciones: '', partes: [] }, sinRed)).rejects.toBeInstanceOf(ErrorIA)
    await expect(pedirIA({ ...gemini, clave: ' ' }, { instrucciones: '', partes: [] }, sinRed)).rejects.toMatchObject({
      tipo: 'clave',
    })
  })
})

describe('proveedores guardados', () => {
  beforeEach(async () => {
    usarBase(`ia-${Math.random()}`)
    await asegurarProveedores()
  })

  it('empiezan en el orden Gemini, Groq, OpenRouter y se reordenan', async () => {
    await asegurarProveedores()
    expect((await listarProveedores()).map((p) => p.id)).toEqual(['gemini', 'groq', 'openrouter'])
    await moverProveedor('openrouter', -1)
    await moverProveedor('gemini', -1)
    expect((await listarProveedores()).map((p) => p.id)).toEqual(['gemini', 'openrouter', 'groq'])
  })

  it('solo están disponibles los activos con clave y sin cuota agotada', async () => {
    expect(await proveedoresDisponibles()).toEqual([])
    await guardarProveedor('groq', { clave: '  gsk_1  ' })
    await guardarProveedor('gemini', { clave: 'AIza1' })
    await db.proveedoresIA.update('gemini', { agotadoHasta: Date.now() + 60_000 })
    expect((await proveedoresDisponibles()).map((p) => p.id)).toEqual(['groq'])
    expect((await db.proveedoresIA.get('groq'))?.clave).toBe('gsk_1')
    // Una clave nueva borra el "agotado".
    await guardarProveedor('gemini', { clave: 'AIza2' })
    expect((await proveedoresDisponibles()).map((p) => p.id)).toEqual(['gemini', 'groq'])
    await guardarProveedor('groq', { activo: false })
    expect((await proveedoresDisponibles()).map((p) => p.id)).toEqual(['gemini'])
  })

  it('guarda el resultado de la prueba', async () => {
    await guardarProveedor('gemini', { clave: 'AIza1' })
    const ok = respuestaFalsa(200, { candidates: [{ content: { parts: [{ text: 'listo' }] } }] })
    expect(await probarProveedor('gemini', ok.hacerFetch)).toMatchObject({ ok: true })
    const mala = respuestaFalsa(401, 'no')
    expect(await probarProveedor('gemini', mala.hacerFetch)).toMatchObject({ ok: false })
    expect((await db.proveedoresIA.get('gemini'))?.prueba?.mensaje).toMatch(/clave/)
  })

  it('pasa el modelo por defecto viejo al alias que Google mantiene al día', async () => {
    await db.proveedoresIA.update('gemini', { modelo: 'gemini-2.5-flash' })
    await guardarProveedor('groq', { modelo: 'mi-modelo' })
    await asegurarProveedores()
    expect((await db.proveedoresIA.get('gemini'))?.modelo).toBe('gemini-flash-latest')
    expect((await db.proveedoresIA.get('groq'))?.modelo).toBe('mi-modelo')
  })

  it('si Google retiró el modelo, prueba otro y se queda con el que responde', async () => {
    await guardarProveedor('gemini', { clave: 'AIza1', modelo: 'gemini-viejo' })
    const urls: string[] = []
    const hacerFetch = (async (url: string) => {
      urls.push(url)
      if (url.includes('gemini-viejo')) return new Response('{"error":{"message":"models/gemini-viejo is not found"}}', { status: 404 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'listo' }] } }] }), { status: 200 })
    }) as unknown as typeof fetch
    const p = (await db.proveedoresIA.get('gemini'))!
    expect(await pedirConRespaldoDeModelo(p, { instrucciones: '', partes: [] }, hacerFetch)).toEqual({
      texto: 'listo',
      modelo: 'gemini-flash-latest',
    })
    expect(urls[1]).toContain('gemini-flash-latest:generateContent')
    expect((await db.proveedoresIA.get('gemini'))?.modelo).toBe('gemini-flash-latest')
    expect((await probarProveedor('gemini', respuestaFalsa(404, 'not found').hacerFetch))?.mensaje).toMatch(/modelo/)
  })

  it('si Google está saturado (503) reintenta, prueba otro modelo y lo explica sin culpar la clave', async () => {
    await guardarProveedor('gemini', { clave: 'AIza1' })
    const urls: string[] = []
    const esperas: number[] = []
    const esperar = async (ms: number) => {
      esperas.push(ms)
    }
    const saturadoHasta = (n: number) =>
      (async (url: string) => {
        urls.push(url)
        if (urls.length <= n) return new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 })
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'listo' }] } }] }), { status: 200 })
      }) as unknown as typeof fetch
    const p = (await db.proveedoresIA.get('gemini'))!

    // Al segundo intento ya responde: mismo modelo.
    expect(await pedirConRespaldoDeModelo(p, { instrucciones: '', partes: [] }, saturadoHasta(1), esperar)).toMatchObject({
      modelo: 'gemini-flash-latest',
    })
    expect(esperas).toEqual([1500])

    // Saturado los 3 intentos: responde otro modelo, pero no se cambia el guardado.
    urls.length = 0
    expect(await pedirConRespaldoDeModelo(p, { instrucciones: '', partes: [] }, saturadoHasta(3), esperar)).toMatchObject({
      modelo: 'gemini-2.5-flash',
    })
    expect((await db.proveedoresIA.get('gemini'))?.modelo).toBe('gemini-flash-latest')

    // Siempre saturado: el mensaje dice que no es la clave.
    const prueba = await probarProveedor('gemini', respuestaFalsa(503, 'overloaded').hacerFetch, esperar)
    expect(prueba).toMatchObject({ ok: false })
    expect(prueba?.mensaje).toMatch(/Google está saturado.*No es tu clave.*Detalle: "overloaded"/)
    await guardarProveedor('gemini', { clave: ' AIza\u200B12\n' })
    expect((await db.proveedoresIA.get('gemini'))?.clave).toBe('AIza12')
  })
})
