import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { TIPO_FARMACO, asegurarTiposDeFabrica } from '../../src/core/db/tiposNota'
import { estadoNuevo, calificar, previsualizar, textoIntervalo } from '../../src/core/srs/fsrs'
import { NUEVAS_POR_DIA, armarCola, registrarRespuesta } from '../../src/core/srs/repaso'

const MIN = 60 * 1000
const DIA = 24 * 60 * MIN
const LUNES = new Date(2026, 9, 26, 9, 0).getTime()

let n = 0
let mazoId = ''
beforeEach(async () => {
  usarBase(`repaso-${++n}`)
  await asegurarTiposDeFabrica()
  const sem = await crearSemestre('Semestre 5')
  const mat = await crearMateria('Farmacología 1', sem.id)
  mazoId = (await crearMazo('Varios', mat.id)).id
})

const farmaco = (nombre: string) =>
  guardarNota({
    tipoNotaId: TIPO_FARMACO,
    mazoId,
    valores: { 'farmaco-nombre': nombre, 'farmaco-grupo': `Grupo de ${nombre}`, 'farmaco-indicaciones': `Usos de ${nombre}` },
    etiquetas: [],
  })

describe('FSRS', () => {
  it('una ficha nueva calificada "bien" queda en aprendizaje y "fácil" pasa a días', () => {
    const e = estadoNuevo('f1', LUNES)
    const p = previsualizar(e, LUNES)
    expect(p[1]).toBeLessThan(p[3])
    expect(p[3]).toBeLessThan(p[4])
    expect(p[4]).toBeGreaterThanOrEqual(DIA)
    const bien = calificar(e, 3, LUNES)
    expect(bien.repeticiones).toBe(1)
    expect([1, 2]).toContain(bien.estado)
  })

  it('formatea intervalos en español', () => {
    expect(textoIntervalo(10 * MIN)).toBe('10 min')
    expect(textoIntervalo(3 * DIA)).toBe('3 d')
    expect(textoIntervalo(400 * DIA)).toBe('1,1 a')
  })
})

describe('repaso del día', () => {
  it('limita las nuevas por día e intercala por fármaco', async () => {
    for (let i = 0; i < 15; i++) await farmaco(`Fármaco ${String(i).padStart(2, '0')}`)
    const cola = await armarCola(LUNES)
    expect(cola.ahora).toHaveLength(NUEVAS_POR_DIA)
    // Las dos primeras fichas son de fármacos distintos.
    expect(cola.ahora[0].nota.id).not.toBe(cola.ahora[1].nota.id)
  })

  it('después de responder, la ficha sale de la cola y vuelve cuando toca', async () => {
    await farmaco('Metformina')
    let cola = await armarCola(LUNES)
    expect(cola.ahora).toHaveLength(2)
    const [primera] = cola.ahora
    await registrarRespuesta(primera, 4, LUNES, 5000)

    cola = await armarCola(LUNES + MIN)
    expect(cola.ahora.map((c) => c.ficha.id)).not.toContain(primera.ficha.id)
    expect(cola.nuevasRestantes).toBe(NUEVAS_POR_DIA - 1)

    const estado = (await db.estadosRepaso.get(primera.ficha.id))!
    cola = await armarCola(estado.vence + MIN)
    expect(cola.ahora.map((c) => c.ficha.id)).toContain(primera.ficha.id)
    expect(await db.registrosRepaso.count()).toBe(1)
  })

  it('una ficha fallada vuelve en minutos como "luego"', async () => {
    await farmaco('Metformina')
    const [primera] = (await armarCola(LUNES)).ahora
    await registrarRespuesta(primera, 1, LUNES, 3000)
    const cola = await armarCola(LUNES + 10 * 1000)
    expect(cola.luego.map((c) => c.ficha.id)).toContain(primera.ficha.id)
  })
})
