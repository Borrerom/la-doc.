import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { asegurarEjemplosEstructura, asegurarEjemplosIniciales, borrarEjemplos, cargarEjemplos, fuentesDeNota, hayEjemplos } from '../../src/core/db/ejemplos'
import { enlacesDeNota } from '../../src/core/db/enlaces'
import { asegurarMateriasIniciales } from '../../src/core/db/materiasIniciales'
import { crearMateria, crearSemestre, listarMaterias } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica, TIPO_CASO, TIPO_PATOLOGIA } from '../../src/core/db/tiposNota'
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
    // Todos los campos llenos: MedlinePlus para casi todo y la ficha técnica de la AEMPS para dosis, vía y ADME.
    for (const n of notas) expect(Object.keys(n.valores)).toHaveLength(10)
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

  it('completa dosis, vía y farmacocinética de los ejemplos de versiones anteriores sin pisar lo editado', async () => {
    await cargarEjemplos(materiaId)
    const notas = await db.notas.toArray()
    for (const n of notas) {
      const { 'farmaco-dosis': _, 'farmaco-adme': __, ...resto } = n.valores
      await db.notas.update(n.id, { valores: { ...resto, 'farmaco-via': 'Editada por Desi' } })
    }
    await asegurarEjemplosIniciales()
    for (const n of await db.notas.toArray()) {
      expect(n.valores['farmaco-dosis']).toMatch(/mg/)
      expect(n.valores['farmaco-adme']).toMatch(/^Absorción:/)
      expect(n.valores['farmaco-via']).toBe('Editada por Desi')
    }
  })
})

describe('ejemplos de Morfofisiopatología 2 y Práctica Médica 1', () => {
  it('trae dos patologías con fuente y dos casos, enlazados a los fármacos y borrables de una vez', async () => {
    await asegurarEjemplosIniciales()
    await asegurarMateriasIniciales()
    await Promise.all([asegurarEjemplosEstructura(), asegurarEjemplosEstructura()])
    const materias = await listarMaterias()
    const morfo = materias.find((m) => m.nombre === 'Morfofisiopatología 2')!
    const practica = materias.find((m) => m.nombre === 'Práctica Médica 1')!
    const deMateria = async (id: string) => (await db.notas.where('materiaId').equals(id).toArray()).filter((n) => !n.borrada)
    const patologias = await deMateria(morfo.id)
    const casos = await deMateria(practica.id)
    expect(patologias.map((n) => n.tipoNotaId)).toEqual([TIPO_PATOLOGIA, TIPO_PATOLOGIA])
    expect(casos.map((n) => n.tipoNotaId)).toEqual([TIPO_CASO, TIPO_CASO])
    expect((await fuentesDeNota(patologias[0].id)).every((f) => f.url!.startsWith('https://medlineplus.gov/spanish/'))).toBe(true)

    const hta = patologias.find((n) => n.valores['patologia-nombre'].startsWith('Presión arterial alta'))!
    const deHta = (await enlacesDeNota(hta.id)).map((e) => `${e.estado} ${e.relacion} ${e.tituloOtra}`)
    expect(deHta).toContain('aprobado Se trata con Enalapril')
    expect(deHta).toContain('aprobado Aparece en el caso Hombre de 56 años en control de rutina')
    const dm2 = patologias.find((n) => n.valores['patologia-nombre'] === 'Diabetes tipo 2')!
    expect((await enlacesDeNota(dm2.id)).map((e) => `${e.relacion} ${e.tituloOtra}`)).toContain('Se trata con Metformina')

    await borrarEjemplos(practica.id)
    expect(await deMateria(practica.id)).toHaveLength(0)
    expect(await hayEjemplos(practica.id)).toBe(false)
    // No vuelven.
    await asegurarEjemplosEstructura()
    expect(await deMateria(practica.id)).toHaveLength(0)
  })
})
