import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { aprobarEnlace, crearEnlace, descartarEnlace, enlacesDeNota, TIPO_TRATA } from '../../src/core/db/enlaces'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica, TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from '../../src/core/db/tiposNota'

describe('interacciones sugeridas', () => {
  let mazoId = ''
  beforeEach(async () => {
    usarBase(`enlaces-${Math.random()}`)
    await asegurarTiposDeFabrica()
    const sem = await crearSemestre('Semestre 5')
    mazoId = (await crearMazo('Cardio', (await crearMateria('Farmacología 1', sem.id)).id)).id
  })
  const farmaco = (valores: Record<string, string>) => guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId, valores, etiquetas: [] })

  it('propone el enlace por nombre o grupo, una sola vez, y respeta lo descartado', async () => {
    const enalapril = await farmaco({
      'farmaco-nombre': 'Enalapril',
      'farmaco-interacciones': 'Sustitutos de sal con potasio\nAspirina y AINE como ibuprofeno',
    })
    const ibuprofeno = await farmaco({ 'farmaco-nombre': 'Ibuprofeno', 'farmaco-grupo': 'AINE' })
    await farmaco({ 'farmaco-nombre': 'Amoxicilina', 'farmaco-interacciones': 'Anticonceptivos hormonales' })
    // Amoxicilina no tiene relación con los otros dos: solo hay un par.
    const deEnalapril = await enlacesDeNota(enalapril.id)
    expect(deEnalapril).toHaveLength(1)
    expect(deEnalapril[0]).toMatchObject({ estado: 'propuesto', comentario: 'Aspirina y AINE como ibuprofeno' })
    expect(deEnalapril[0].otra.id).toBe(ibuprofeno.id)
    expect((await enlacesDeNota(ibuprofeno.id))[0].otra.id).toBe(enalapril.id)

    await aprobarEnlace(deEnalapril[0].id)
    expect((await enlacesDeNota(ibuprofeno.id))[0].estado).toBe('aprobado')

    await descartarEnlace(deEnalapril[0].id)
    await guardarNota({ id: enalapril.id, tipoNotaId: TIPO_FARMACO, mazoId, valores: enalapril.valores, etiquetas: [] })
    await guardarNota({ id: ibuprofeno.id, tipoNotaId: TIPO_FARMACO, mazoId, valores: ibuprofeno.valores, etiquetas: [] })
    expect(await enlacesDeNota(enalapril.id)).toHaveLength(0)
    expect(await db.enlaces.count()).toBe(1)
  })

  it('sugiere trata, contraindicado y aparece en el caso, leídos desde cada lado', async () => {
    const nota = (tipoNotaId: string, valores: Record<string, string>) => guardarNota({ tipoNotaId, mazoId, valores, etiquetas: [] })
    const hta = await nota(TIPO_PATOLOGIA, { 'patologia-nombre': 'Presión arterial alta (hipertensión)' })
    const dm2 = await nota(TIPO_PATOLOGIA, { 'patologia-nombre': 'Diabetes tipo 2', 'patologia-tratamiento': 'Biguanidas (metformina)' })
    const enalapril = await farmaco({ 'farmaco-nombre': 'Enalapril', 'farmaco-indicaciones': 'Presión arterial alta' })
    const metformina = await farmaco({
      'farmaco-nombre': 'Metformina',
      'farmaco-grupo': 'Biguanidas',
      'farmaco-contraindicaciones': 'Pacientes con hipertensión descontrolada (ejemplo de prueba)',
    })
    const caso = await nota(TIPO_CASO, { 'caso-titulo': 'Hombre de 56 años', 'caso-respuesta': 'Indicar enalapril' })

    const deHta = await enlacesDeNota(hta.id)
    expect(deHta.map((e) => [e.relacion, e.tituloOtra])).toEqual([
      ['No usar', 'Metformina'],
      ['Se trata con', 'Enalapril'],
    ])
    // La patología nombra a la metformina en su tratamiento: el enlace va del fármaco a la patología.
    const deMetformina = await enlacesDeNota(metformina.id)
    expect(deMetformina.map((e) => [e.relacion, e.tituloOtra])).toContainEqual(['Trata', 'Diabetes tipo 2'])
    expect(deMetformina.find((e) => e.otra.id === dm2.id)?.tipoEnlaceId).toBe(TIPO_TRATA)
    expect((await enlacesDeNota(caso.id)).map((e) => [e.relacion, e.tituloOtra])).toEqual([['Incluye', 'Enalapril']])
    expect((await enlacesDeNota(enalapril.id)).map((e) => e.relacion)).toContain('Aparece en el caso')

    // A mano, desde la patología: "Se trata con" deja a la patología como destino.
    await crearEnlace(dm2.id, `${TIPO_TRATA}<`, enalapril.id)
    const manual = (await enlacesDeNota(enalapril.id)).find((e) => e.otra.id === dm2.id)!
    expect(manual).toMatchObject({ relacion: 'Trata', estado: 'aprobado', origenNotaId: enalapril.id })
    await expect(crearEnlace(dm2.id, `${TIPO_TRATA}>`, dm2.id)).rejects.toThrow()
  })
})
