import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { asegurarMateriasIniciales } from '../../src/core/db/materiasIniciales'
import { crearMateria, crearSemestre, listarMaterias } from '../../src/core/db/organizacion'
import { TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from '../../src/core/db/tiposNota'

let n = 0
beforeEach(() => {
  usarBase(`materias-${++n}`)
})

describe('materias iniciales', () => {
  it('sin semestre no hace nada', async () => {
    await asegurarMateriasIniciales()
    expect(await db.materias.count()).toBe(0)
  })

  it('crea las que faltan una sola vez y respeta la Farmacología que ya había', async () => {
    const s = await crearSemestre('Semestre 5')
    const farmaco = await crearMateria('Farmacologia 1', s.id)
    await Promise.all([asegurarMateriasIniciales(), asegurarMateriasIniciales()])
    const materias = await listarMaterias()
    expect(materias.map((m) => [m.nombre, m.tipoPrincipal])).toEqual([
      ['Farmacologia 1', TIPO_FARMACO],
      ['Morfofisiopatología 2', TIPO_PATOLOGIA],
      ['Práctica Médica 1', TIPO_CASO],
    ])
    expect(materias[0].id).toBe(farmaco.id)
    // Si Desi borra una, no vuelve.
    await db.materias.update(materias[2].id, { borrada: Date.now() })
    await asegurarMateriasIniciales()
    expect(await listarMaterias()).toHaveLength(2)
  })
})
