import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import { aprobarEnlace, descartarEnlace, enlacesDeNota } from '../../src/core/db/enlaces'
import { guardarNota } from '../../src/core/db/notas'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'
import { asegurarTiposDeFabrica, TIPO_FARMACO } from '../../src/core/db/tiposNota'

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
})
