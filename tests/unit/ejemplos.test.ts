import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { borrarEjemplos, cargarEjemplos, fuentesDeNota, hayEjemplos } from '../../src/core/db/ejemplos'
import { crearMateria, crearSemestre } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica } from '../../src/core/db/tiposNota'
import { armarCola } from '../../src/core/srs/repaso'

let materiaId = ''
beforeEach(async () => {
  usarBase(`ejemplos-${Math.random()}`)
  await asegurarTiposDeFabrica()
  const sem = await crearSemestre('Semestre 5')
  materiaId = (await crearMateria('Farmacología 1', sem.id)).id
})

describe('fármacos de ejemplo', () => {
  it('se cargan una sola vez, con su fuente, y se borran de una vez', async () => {
    await cargarEjemplos(materiaId)
    await cargarEjemplos(materiaId)
    const notas = (await db.notas.toArray()).filter((n) => !n.borrada)
    expect(notas).toHaveLength(3)
    const fuentes = await fuentesDeNota(notas[0].id)
    expect(fuentes).toHaveLength(1)
    expect(fuentes[0].url).toMatch(/^https:\/\/medlineplus\.gov\/spanish\//)
    expect((await armarCola(Date.now())).ahora.length).toBe(18)

    await borrarEjemplos(materiaId)
    expect((await db.notas.toArray()).filter((n) => !n.borrada)).toHaveLength(0)
    expect(await hayEjemplos(materiaId)).toBe(false)
    expect((await armarCola(Date.now())).ahora.length).toBe(0)
  })
})
