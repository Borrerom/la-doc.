import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { armarInstrucciones, interpretarRespuesta, type Borrador } from '../../src/core/ai/extraer'
import { procesarCarga } from '../../src/core/ai/procesar'
import { asegurarProveedores, guardarProveedor } from '../../src/core/ai/proveedores'
import { crearCarga } from '../../src/core/db/cargas'
import { db, usarBase } from '../../src/core/db/db'
import { fuentesDeNota } from '../../src/core/db/ejemplos'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { aprobarFarmaco, descartarFarmaco } from '../../src/core/db/revision'
import { asegurarTiposDeFabrica, TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA, tipoCasoDeFabrica, tipoFarmacoDeFabrica, tipoPatologiaDeFabrica } from '../../src/core/db/tiposNota'

const tipo = tipoFarmacoDeFabrica()
const tipos = [tipo, tipoPatologiaDeFabrica(), tipoCasoDeFabrica()]
const RESPUESTA = JSON.stringify({
  farmacos: [
    {
      campos: { 'farmaco-nombre': 'Ampicilina', 'farmaco-efectos': ['Diarrea', 'Exantema'], 'campo-inventado': 'x' },
      evidencia: { 'farmaco-nombre': 'AMPICILINA', 'farmaco-efectos': 'RAM: diarrea, exantema' },
      pagina: 2,
    },
    { campos: { 'farmaco-grupo': 'sin nombre' } },
    { campos: { 'farmaco-nombre': 'Gentamicina' } },
  ],
})

describe('lo que responde la IA', () => {
  it('las instrucciones piden no inventar e incluyen los campos', () => {
    const t = armarInstrucciones(tipos, { materia: 'Morfofisiopatología 2', tema: 'Cardio', tipoCarga: 'foto', principal: tipos[1] })
    expect(t).toContain('No inventes')
    for (const id of ['farmaco-dosis', 'patologia-signos', 'caso-respuesta', '"tipo-caso"']) expect(t).toContain(id)
    expect(t).toContain('"Cardio"')
    expect(t).toContain('lo más común es: patología')
  })

  it('se queda con los campos conocidos y los fármacos con nombre', () => {
    const f = interpretarRespuesta('```json\n' + RESPUESTA + '\n```', tipos)
    expect(f).toHaveLength(2)
    expect(f[0].valores).toEqual({ 'farmaco-nombre': 'Ampicilina', 'farmaco-efectos': 'Diarrea\nExantema' })
    expect(f[0].evidencia['farmaco-efectos']).toBe('RAM: diarrea, exantema')
    expect(f[0].pagina).toBe(2)
    expect(f[0].tipoNotaId).toBe(TIPO_FARMACO)
    expect(() => interpretarRespuesta('no sé', tipos)).toThrow('formato')
  })

  it('reconoce el tipo de cada nota, por id, por nombre o por sus campos', () => {
    const respuesta = JSON.stringify({
      notas: [
        { tipo: 'tipo-patologia', campos: { 'patologia-nombre': 'Asma', 'farmaco-dosis': 'no es de este tipo' } },
        { tipo: 'Caso clínico', campos: { 'caso-titulo': 'Niño de 8 años con tos' } },
        { campos: { 'farmaco-nombre': 'Salbutamol' } },
        { tipo: 'algo raro', campos: { 'campo-x': 'nada' } },
      ],
    })
    const f = interpretarRespuesta(respuesta, tipos)
    expect(f.map((x) => x.tipoNotaId)).toEqual([TIPO_PATOLOGIA, TIPO_CASO, TIPO_FARMACO])
    expect(f[0].valores).toEqual({ 'patologia-nombre': 'Asma' })
  })
})

function fetchFalso(...respuestas: Array<[number, unknown]>) {
  const urls: string[] = []
  const hacerFetch = (async (url: string) => {
    urls.push(url)
    const [estado, cuerpo] = respuestas.shift() ?? [500, 'sin más']
    if (estado === 0) throw new TypeError('Failed to fetch')
    return new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status: estado })
  }) as unknown as typeof fetch
  return { hacerFetch, urls }
}
const gemini = (texto: string) => ({ candidates: [{ content: { parts: [{ text: texto }] } }] })
const groq = (texto: string) => ({ choices: [{ message: { content: texto } }] })

describe('procesar la cola', () => {
  let mazoId = ''
  let materiaId = ''
  beforeEach(async () => {
    usarBase(`procesar-${Math.random()}`)
    await asegurarTiposDeFabrica()
    await asegurarProveedores()
    const sem = await crearSemestre('Semestre 5')
    materiaId = (await crearMateria('Farmacología 1', sem.id)).id
    mazoId = (await crearMazo('Antibióticos', materiaId)).id
  })
  const nuevaFoto = () => crearCarga({ tipo: 'foto', archivos: [new Blob([new Uint8Array(4)], { type: 'image/jpeg' })], mazoId })

  it('sin clave la carga se queda en cola con un aviso', async () => {
    const c = await nuevaFoto()
    expect(await procesarCarga(c.id)).toBe('sin_proveedor')
    expect(await db.cargas.get(c.id)).toMatchObject({ estado: 'en_cola', error: expect.stringMatching(/clave/) })
  })

  it('si Gemini agota la cuota pasa a Groq y deja a Gemini descansando', async () => {
    await guardarProveedor('gemini', { clave: 'AIza' })
    await guardarProveedor('groq', { clave: 'gsk' })
    const c = await nuevaFoto()
    const { hacerFetch, urls } = fetchFalso([429, 'cuota'], [200, groq(RESPUESTA)])
    expect(await procesarCarga(c.id, { hacerFetch })).toBe('listo')
    expect(urls[1]).toContain('groq.com')
    const carga = await db.cargas.get(c.id)
    expect(carga).toMatchObject({ estado: 'por_revisar', proveedorUsado: 'groq' })
    expect((carga!.borrador as Borrador).farmacos).toHaveLength(2)
    expect((await db.proveedoresIA.get('gemini'))?.agotadoHasta).toBeGreaterThan(Date.now())
  })

  it('sin red vuelve a la cola sin gastar intentos', async () => {
    await guardarProveedor('gemini', { clave: 'AIza' })
    const c = await nuevaFoto()
    expect(await procesarCarga(c.id, fetchFalso([0, '']))).toBe('sin_red')
    expect(await db.cargas.get(c.id)).toMatchObject({ estado: 'en_cola', intentos: 0 })
  })

  it('tras 3 fallos queda en error', async () => {
    await guardarProveedor('gemini', { clave: 'AIza' })
    const c = await nuevaFoto()
    for (let i = 0; i < 3; i++) await procesarCarga(c.id, { ...fetchFalso([500, 'mal']), esperar: async () => {} })
    expect(await db.cargas.get(c.id)).toMatchObject({ estado: 'error', intentos: 3 })
  })

  it('sin Gemini, el PDF va convertido y la voz transcrita por Groq', async () => {
    await guardarProveedor('groq', { clave: 'gsk' })
    const pdf = await crearCarga({ tipo: 'pdf', archivos: [new Blob(['%PDF'], { type: 'application/pdf' })], mazoId })
    expect(await procesarCarga(pdf.id)).toBe('sin_proveedor')
    expect((await db.cargas.get(pdf.id))?.error).toMatch(/Gemini/)
    const convertirPdf = async () => [{ texto: 'Página 1:\nAmpicilina...' }]
    const conPdf = fetchFalso([200, groq(RESPUESTA)])
    expect(await procesarCarga(pdf.id, { ...conPdf, convertirPdf })).toBe('listo')

    const voz = await crearCarga({ tipo: 'voz', archivos: [new Blob(['x'], { type: 'audio/webm' })], mazoId })
    const { hacerFetch, urls } = fetchFalso([200, { text: 'La ampicilina es una penicilina' }], [200, groq(RESPUESTA)])
    expect(await procesarCarga(voz.id, { hacerFetch })).toBe('listo')
    expect(urls[0]).toContain('/audio/transcriptions')
    expect((await db.cargas.get(voz.id))?.transcripcion).toBe('La ampicilina es una penicilina')
  })

  it('OpenRouter usa la transcripción guardada', async () => {
    await guardarProveedor('openrouter', { clave: 'sk-or' })
    const voz = await crearCarga({ tipo: 'voz', archivos: [new Blob(['x'], { type: 'audio/webm' })], mazoId })
    expect(await procesarCarga(voz.id)).toBe('sin_proveedor')
    await db.cargas.update(voz.id, { transcripcion: 'Gentamicina' })
    const { hacerFetch, urls } = fetchFalso([200, groq(RESPUESTA)])
    expect(await procesarCarga(voz.id, { hacerFetch })).toBe('listo')
    expect(urls[0]).toContain('openrouter.ai')
  })

  it('una patología y un caso del mismo material entran como su tipo', async () => {
    await guardarProveedor('gemini', { clave: 'AIza' })
    const c = await nuevaFoto()
    const respuesta = JSON.stringify({
      notas: [
        { tipo: 'tipo-patologia', campos: { 'patologia-nombre': 'Asma', 'patologia-signos': 'Sibilancias' } },
        { tipo: 'tipo-caso', campos: { 'caso-titulo': 'Niño de 8 años con tos', 'caso-respuesta': 'Asma' } },
      ],
    })
    expect(await procesarCarga(c.id, fetchFalso([200, gemini(respuesta)]))).toBe('listo')
    const asma = await aprobarFarmaco(c.id, 0, { 'patologia-nombre': 'Asma', 'patologia-signos': 'Sibilancias' })
    const caso = await aprobarFarmaco(c.id, 1, { 'caso-titulo': 'Niño de 8 años con tos', 'caso-respuesta': 'Asma' })
    expect([asma?.tipoNotaId, caso?.tipoNotaId]).toEqual([TIPO_PATOLOGIA, TIPO_CASO])
    expect((await db.cargas.get(c.id))?.estado).toBe('aprobada')
  })

  it('al revisar, cada fármaco entra al mazo con la cita del material', async () => {
    await guardarProveedor('gemini', { clave: 'AIza' })
    const c = await nuevaFoto()
    await procesarCarga(c.id, fetchFalso([200, gemini(RESPUESTA)]))
    const nota = await aprobarFarmaco(c.id, 0, {
      'farmaco-nombre': 'Ampicilina',
      'farmaco-efectos': 'Diarrea\nExantema\nNáuseas',
      'farmaco-mecanismo': 'Escrito a mano',
    })
    expect(nota?.mazoId).toBe(mazoId)
    expect(nota?.cargaId).toBe(c.id)
    const citas = await db.citas.where('notaId').equals(nota!.id).toArray()
    expect(citas.map((x) => x.campoId).sort()).toEqual(['farmaco-efectos', 'farmaco-nombre'])
    expect(citas.find((x) => x.campoId === 'farmaco-efectos')).toMatchObject({ fragmento: 'RAM: diarrea, exantema', pagina: 2 })
    expect((await fuentesDeNota(nota!.id))[0]).toMatchObject({ tipo: 'apunte', cargaId: c.id })
    expect((await db.cargas.get(c.id))?.estado).toBe('por_revisar')
    await descartarFarmaco(c.id, 1)
    expect((await db.cargas.get(c.id))?.estado).toBe('aprobada')
    expect(await db.fichas.where('notaId').equals(nota!.id).count()).toBeGreaterThan(0)
  })
})
