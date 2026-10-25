import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { usarBase } from '../../src/core/db/db'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { TIPO_FARMACO, asegurarTiposDeFabrica } from '../../src/core/db/tiposNota'
import { buscar } from '../../src/core/search/buscador'

beforeEach(async () => {
  usarBase(`buscar-${Math.random()}`)
  await asegurarTiposDeFabrica()
  const sem = await crearSemestre('Semestre 5')
  const mat = await crearMateria('Farmacología 1', sem.id)
  const mazoId = (await crearMazo('Varios', mat.id)).id
  const cargar = (valores: Record<string, string>, etiquetas: string[] = []) =>
    guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId, valores, etiquetas })
  await cargar({ 'farmaco-nombre': 'Amoxicilina', 'farmaco-grupo': 'Penicilinas', 'farmaco-contraindicaciones': 'Alergia a penicilinas' })
  await cargar({ 'farmaco-nombre': 'Enalapril', 'farmaco-grupo': 'IECA', 'farmaco-efectos': 'Tos seca\nHiperpotasemia' }, ['hipertensión'])
  await cargar({ 'farmaco-nombre': 'Metformina', 'farmaco-mecanismo': 'Reduce la {{c1::gluconeogénesis}} hepática' })
})

describe('buscador sin internet', () => {
  it('encuentra por nombre con errores de tipeo y sin acentos', async () => {
    expect((await buscar('amoxicilna')).map((r) => r.titulo)).toEqual(['Amoxicilina'])
    expect((await buscar('HIPERTENSION')).map((r) => r.titulo)).toEqual(['Enalapril'])
  })

  it('busca dentro de los campos y dice dónde está', async () => {
    const [r] = await buscar('tos')
    expect(r.titulo).toBe('Enalapril')
    expect(r.campo).toBe('Efectos secundarios')
    expect(r.fragmento).toContain('Tos seca')
  })

  it('ignora las marcas de completar y busca por prefijo', async () => {
    const [r] = await buscar('gluconeo')
    expect(r.titulo).toBe('Metformina')
    expect(r.fragmento).toContain('Reduce la gluconeogénesis hepática')
  })

  it('consulta vacía no devuelve nada', async () => {
    expect(await buscar('  ')).toEqual([])
  })
})
