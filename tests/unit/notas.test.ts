import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { usarBase } from '../../src/core/db/db'
import { borrarNota, guardarNota, limpiarEtiquetas, notasDeMazo, tituloNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { TIPO_FARMACO, asegurarTiposDeFabrica, tipoFarmacoDeFabrica } from '../../src/core/db/tiposNota'

let n = 0
beforeEach(async () => {
  usarBase(`notas-${++n}`)
  await asegurarTiposDeFabrica()
})

async function preparar() {
  const sem = await crearSemestre('Semestre 5')
  const mat = await crearMateria('Farmacología 1', sem.id)
  const anti = await crearMazo('Antibióticos', mat.id)
  const peni = await crearMazo('Penicilinas', mat.id, anti.id)
  return { sem, mat, anti, peni }
}

describe('notas', () => {
  it('guarda un fármaco con materia y semestre tomados del mazo', async () => {
    const { sem, mat, peni } = await preparar()
    const nota = await guardarNota({
      tipoNotaId: TIPO_FARMACO,
      mazoId: peni.id,
      valores: { 'farmaco-nombre': '  Amoxicilina\n', 'farmaco-grupo': '', 'farmaco-indicaciones': 'Otitis\r\nFaringitis' },
      etiquetas: ['infecciones'],
    })
    expect(nota.materiaId).toBe(mat.id)
    expect(nota.semestreId).toBe(sem.id)
    expect(nota.valores).toEqual({ 'farmaco-nombre': 'Amoxicilina', 'farmaco-indicaciones': 'Otitis\nFaringitis' })
    expect(tituloNota(nota, tipoFarmacoDeFabrica())).toBe('Amoxicilina')
  })

  it('exige el nombre del fármaco', async () => {
    const { peni } = await preparar()
    await expect(
      guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId: peni.id, valores: { 'farmaco-grupo': 'Penicilinas' }, etiquetas: [] }),
    ).rejects.toThrow('Falta "Nombre genérico y comercial"')
  })

  it('el mazo padre muestra las notas de sus submazos; editar conserva el id; borrar las oculta', async () => {
    const { anti, peni } = await preparar()
    const a = await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId: peni.id, valores: { 'farmaco-nombre': 'Amoxicilina' }, etiquetas: [] })
    await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId: anti.id, valores: { 'farmaco-nombre': 'Ceftriaxona' }, etiquetas: [] })
    expect(await notasDeMazo(anti.id)).toHaveLength(2)
    expect(await notasDeMazo(peni.id)).toHaveLength(1)

    const editada = await guardarNota({ id: a.id, tipoNotaId: TIPO_FARMACO, mazoId: peni.id, valores: { 'farmaco-nombre': 'Amoxicilina (Amoxil)' }, etiquetas: [] })
    expect(editada.id).toBe(a.id)
    expect(editada.creada).toBe(a.creada)

    await borrarNota(a.id)
    expect((await notasDeMazo(anti.id)).map((x) => x.valores['farmaco-nombre'])).toEqual(['Ceftriaxona'])
  })

  it('limpia etiquetas', () => {
    expect(limpiarEtiquetas(' Hipertensión, hipertensión ,, Embarazo  ')).toEqual(['hipertensión', 'embarazo'])
  })
})
