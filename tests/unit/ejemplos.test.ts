import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { asegurarEjemplosIniciales, borrarEjemplos, cargarEjemplos, fuentesDeNota, hayEjemplos } from '../../src/core/db/ejemplos'
import { crearMateria, crearSemestre } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica } from '../../src/core/db/tiposNota'
import { armarCola, NUEVAS_POR_DIA } from '../../src/core/srs/repaso'
import { buscar } from '../../src/core/search/buscador'

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
    // Todos los campos llenos: MedlinePlus para casi todo y la ficha técnica de la AEMPS para la dosis.
    for (const n of notas) expect(Object.keys(n.valores)).toHaveLength(8)
    const fuentes = await fuentesDeNota(notas[0].id)
    expect(fuentes.map((f) => new URL(f.url!).host).sort()).toEqual(['cima.aemps.es', 'medlineplus.gov'])
    const citaDosis = (await db.citas.where('notaId').equals(notas[0].id).toArray()).find((c) => c.campoId === 'farmaco-dosis')
    expect((await db.fuentes.get(citaDosis!.fuenteId))?.url).toMatch(/^https:\/\/cima\.aemps\.es\//)
    expect((await armarCola(Date.now())).ahora.length).toBe(NUEVAS_POR_DIA)

    await borrarEjemplos(materiaId)
    expect((await db.notas.toArray()).filter((n) => !n.borrada)).toHaveLength(0)
    expect(await hayEjemplos(materiaId)).toBe(false)
    expect((await armarCola(Date.now())).ahora.length).toBe(0)
  })

  it('vienen ya cargados en Farmacología 1, se encuentran al buscar y, si se borran, no vuelven', async () => {
    await asegurarEjemplosIniciales()
    expect(await hayEjemplos(materiaId)).toBe(true)
    for (const nombre of ['amoxicilina', 'enalapril', 'metformina']) {
      expect((await buscar(nombre))[0]?.titulo.toLowerCase()).toBe(nombre)
    }
    await borrarEjemplos(materiaId)
    await asegurarEjemplosIniciales()
    expect(await hayEjemplos(materiaId)).toBe(false)
  })

  it('crea Farmacología 1 si todavía no existe', async () => {
    usarBase(`ejemplos-${Math.random()}`)
    await asegurarTiposDeFabrica()
    await asegurarEjemplosIniciales()
    expect(await db.materias.count()).toBe(0)
    await crearSemestre('Semestre 5')
    await asegurarEjemplosIniciales()
    const materias = await db.materias.toArray()
    expect(materias.map((m) => m.nombre)).toEqual(['Farmacología 1'])
    expect(await hayEjemplos(materias[0].id)).toBe(true)
  })

  it('completa la dosis de los ejemplos cargados con la versión anterior', async () => {
    await cargarEjemplos(materiaId)
    const notas = await db.notas.toArray()
    for (const n of notas) {
      const { 'farmaco-dosis': _, ...sinDosis } = n.valores
      await db.notas.update(n.id, { valores: sinDosis })
    }
    await asegurarEjemplosIniciales()
    for (const n of await db.notas.toArray()) expect(n.valores['farmaco-dosis']).toMatch(/mg/)
  })
})
