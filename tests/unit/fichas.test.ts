import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { PLANTILLA_COMPLETAR, fichasDeNota, huecos, textoCompletar, verFicha } from '../../src/core/db/fichas'
import { borrarNota, guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { TIPO_FARMACO, asegurarTiposDeFabrica, cambiarCampo, cambiarTipoNota } from '../../src/core/db/tiposNota'

let n = 0
let mazoId = ''
beforeEach(async () => {
  usarBase(`fichas-${++n}`)
  await asegurarTiposDeFabrica()
  const sem = await crearSemestre('Semestre 5')
  const mat = await crearMateria('Farmacología 1', sem.id)
  mazoId = (await crearMazo('Antidiabéticos', mat.id)).id
})

const metformina = (extra: Record<string, string> = {}) =>
  guardarNota({
    tipoNotaId: TIPO_FARMACO,
    mazoId,
    valores: { 'farmaco-nombre': 'Metformina', 'farmaco-contraindicaciones': 'Insuficiencia renal grave', ...extra },
    etiquetas: [],
  })

describe('fichas', () => {
  it('crea una ficha por cada campo con contenido', async () => {
    const nota = await metformina({ 'farmaco-grupo': 'Biguanidas' })
    const fichas = await fichasDeNota(nota.id)
    expect(fichas).toHaveLength(2)
    const tipo = (await db.tiposNota.get(TIPO_FARMACO))!
    const vistas = fichas.map((f) => verFicha(f, nota, tipo))
    expect(vistas).toContainEqual({ frente: 'Contraindicaciones de Metformina', reverso: 'Insuficiencia renal grave' })
  })

  it('al editar agrega y suspende fichas sin perder su id', async () => {
    const nota = await metformina({ 'farmaco-grupo': 'Biguanidas' })
    const antes = await fichasDeNota(nota.id)
    await guardarNota({ id: nota.id, tipoNotaId: TIPO_FARMACO, mazoId, valores: { 'farmaco-nombre': 'Metformina', 'farmaco-contraindicaciones': 'Acidosis', 'farmaco-efectos': 'Diarrea' }, etiquetas: [] })
    const despues = await fichasDeNota(nota.id)
    expect(despues).toHaveLength(2)
    const idContra = antes.find((f) => f.plantillaId === 'plantilla-farmaco-contraindicaciones')!.id
    expect(despues.map((f) => f.id)).toContain(idContra)
    expect((await db.fichas.where('notaId').equals(nota.id).count())).toBe(3)
  })

  it('ocultar un campo suspende sus fichas y mostrarlo las reactiva', async () => {
    const nota = await metformina()
    await cambiarTipoNota(TIPO_FARMACO, (t) => cambiarCampo(t, 'farmaco-contraindicaciones', { oculto: true }))
    expect(await fichasDeNota(nota.id)).toHaveLength(0)
    await cambiarTipoNota(TIPO_FARMACO, (t) => cambiarCampo(t, 'farmaco-contraindicaciones', { oculto: false }))
    expect(await fichasDeNota(nota.id)).toHaveLength(1)
  })

  it('genera fichas de completar con {{c1::...}}', async () => {
    const nota = await metformina({ 'farmaco-mecanismo': 'Reduce la {{c1::gluconeogénesis hepática}} y aumenta la {{c2::sensibilidad a la insulina::efecto periférico}}' })
    const tipo = (await db.tiposNota.get(TIPO_FARMACO))!
    const completar = (await fichasDeNota(nota.id)).filter((f) => f.plantillaId === PLANTILLA_COMPLETAR)
    expect(completar.map((f) => f.indice).sort()).toEqual([1, 2])
    const c2 = verFicha(completar.find((f) => f.indice === 2)!, nota, tipo)
    expect(c2.frente).toBe('Mecanismo de acción: Reduce la gluconeogénesis hepática y aumenta la [efecto periférico]')
    expect(c2.reverso).toContain('[sensibilidad a la insulina]')
    // La ficha de pregunta del mismo campo muestra el texto sin marcas.
    const pregunta = (await fichasDeNota(nota.id)).find((f) => f.plantillaId === 'plantilla-farmaco-mecanismo')!
    expect(verFicha(pregunta, nota, tipo).reverso).toBe('Reduce la gluconeogénesis hepática y aumenta la sensibilidad a la insulina')
  })

  it('borrar la nota suspende todas sus fichas', async () => {
    const nota = await metformina()
    await borrarNota(nota.id)
    expect(await fichasDeNota(nota.id)).toHaveLength(0)
  })

  it('utilidades de huecos', () => {
    expect(huecos({ a: '{{c2::x}} y {{c1::y}}', b: '{{c2::z}}' })).toEqual([1, 2])
    expect(textoCompletar('{{c1::A}} {{c2::B}}', 1, false)).toBe('[…] B')
  })
})
