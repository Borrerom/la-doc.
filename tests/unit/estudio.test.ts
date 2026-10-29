import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { TIPO_FARMACO, asegurarTiposDeFabrica } from '../../src/core/db/tiposNota'
import { fichasParaEstudiar, mezclar, siguiente } from '../../src/core/srs/estudio'
import { NUEVAS_POR_DIA, armarCola, registrarRespuesta } from '../../src/core/srs/repaso'

const AHORA = new Date(2026, 9, 29, 9, 0).getTime()
let n = 0
let materiaId = ''
let temaId = ''
let subtemaId = ''
let otroId = ''

beforeEach(async () => {
  usarBase(`estudio-${++n}`)
  await asegurarTiposDeFabrica()
  const sem = await crearSemestre('Semestre 5')
  materiaId = (await crearMateria('Farmacología 1', sem.id)).id
  temaId = (await crearMazo('Antibióticos', materiaId)).id
  subtemaId = (await crearMazo('Penicilinas', materiaId, temaId)).id
  otroId = (await crearMazo('Antihipertensivos', materiaId)).id
})

const farmaco = (nombre: string, mazoId: string) =>
  guardarNota({
    tipoNotaId: TIPO_FARMACO,
    mazoId,
    valores: { 'farmaco-nombre': nombre, 'farmaco-grupo': `Grupo de ${nombre}`, 'farmaco-indicaciones': `Usos de ${nombre}` },
    etiquetas: [],
  })

describe('estudiar un tema', () => {
  it('trae todas las fichas del tema y sus subtemas, aunque no les toque repaso hoy', async () => {
    await farmaco('Ceftriaxona', temaId)
    await farmaco('Amoxicilina', subtemaId)
    await farmaco('Enalapril', otroId)
    const deTema = await fichasParaEstudiar({ mazoId: temaId }, AHORA)
    expect(new Set(deTema.map((f) => f.nota.valores['farmaco-nombre']))).toEqual(new Set(['Ceftriaxona', 'Amoxicilina']))
    expect(deTema.every((f) => f.nueva)).toBe(true)
    const deMateria = await fichasParaEstudiar({ materiaId }, AHORA)
    expect(deMateria.length).toBeGreaterThan(deTema.length)
  })

  it('sirve aunque el repaso de hoy ya terminó el límite de nuevas', async () => {
    for (let i = 0; i < 12; i++) await farmaco(`Fármaco ${i}`, temaId)
    let cola = await armarCola(AHORA)
    for (const item of cola.ahora.slice(0, NUEVAS_POR_DIA)) await registrarRespuesta(item, 4, AHORA, 1000)
    cola = await armarCola(AHORA)
    expect(cola.ahora.filter((f) => f.nueva)).toHaveLength(0)
    const libres = await fichasParaEstudiar({ mazoId: temaId }, AHORA)
    expect(libres.length).toBe(await db.fichas.count())
  })

  it('"Mal" vuelve pronto, "Difícil" al final y "Bien" sale', () => {
    const cola = ['a', 'b', 'c', 'd', 'e']
    expect(siguiente(cola, 1)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(siguiente(cola, 2)).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(siguiente(cola, 3)).toEqual(['b', 'c', 'd', 'e'])
    expect(siguiente(['a'], 1)).toEqual(['a'])
    expect(siguiente([], 3)).toEqual([])
  })

  it('mezclar no pierde ni repite fichas', () => {
    const lista = [1, 2, 3, 4, 5, 6]
    const m = mezclar(lista, () => 0.3)
    expect([...m].sort()).toEqual(lista)
    expect(m).not.toEqual(lista)
  })
})
