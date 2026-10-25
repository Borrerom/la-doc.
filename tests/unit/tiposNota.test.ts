import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBase } from '../../src/core/db/db'
import {
  CAMPO_NOMBRE_FARMACO,
  CAMPO_NOMBRE_PATOLOGIA,
  agregarCampo,
  asegurarTiposDeFabrica,
  camposOrdenados,
  cambiarTipoNota,
  cambiarCampo,
  listarTiposNota,
  moverCampo,
  textoPlantilla,
  tipoFarmacoDeFabrica,
} from '../../src/core/db/tiposNota'

let n = 0
beforeEach(() => {
  usarBase(`tipos-${++n}`)
})

describe('tipo de nota Fármaco', () => {
  it('se crea una sola vez con los 8 campos del brief', async () => {
    await asegurarTiposDeFabrica()
    await asegurarTiposDeFabrica()
    const tipos = await listarTiposNota()
    expect(tipos.map((t) => t.nombre)).toEqual(['Fármaco', 'Patología', 'Caso clínico'])
    expect(tipos[0].campos.map((c) => c.nombre)).toEqual([
      'Nombre genérico y comercial',
      'Grupo o familia',
      'Vía de administración',
      'Mecanismo de acción',
      'Farmacocinética (ADME)',
      'Indicaciones',
      'Contraindicaciones',
      'Efectos secundarios',
      'Interacciones con otros fármacos',
      'Dosis, y ajustes por edad o peso',
    ])
    expect(tipos[0].plantillas).toHaveLength(9)
  })

  it('a un fármaco guardado con la versión anterior le suma vía y farmacocinética en su lugar', async () => {
    const fabrica = tipoFarmacoDeFabrica()
    const viejo = {
      ...fabrica,
      campos: fabrica.campos.filter((c) => c.id !== 'farmaco-via' && c.id !== 'farmaco-adme').map((c, i) => ({ ...c, orden: i + 1 })),
      plantillas: fabrica.plantillas.filter((p) => !p.id.includes('farmaco-via') && !p.id.includes('farmaco-adme')),
    }
    const renombrado = agregarCampo(cambiarCampo(viejo, 'farmaco-dosis', { nombre: 'Posología' }), 'Uso en embarazo', CAMPO_NOMBRE_FARMACO)
    await db.tiposNota.add(renombrado)
    await asegurarTiposDeFabrica()
    const [farmaco] = await listarTiposNota()
    expect(camposOrdenados(farmaco.campos).map((c) => c.nombre)).toEqual([
      'Nombre genérico y comercial',
      'Grupo o familia',
      'Vía de administración',
      'Mecanismo de acción',
      'Farmacocinética (ADME)',
      'Indicaciones',
      'Contraindicaciones',
      'Efectos secundarios',
      'Interacciones con otros fármacos',
      'Posología',
      'Uso en embarazo',
    ])
    expect(farmaco.plantillas.map((p) => p.id)).toContain('plantilla-farmaco-adme')
    // Una segunda vez no cambia nada.
    await asegurarTiposDeFabrica()
    expect((await listarTiposNota())[0].campos).toHaveLength(11)
  })

  it('la patología trae los 8 campos del brief y el caso se repasa entero', async () => {
    await asegurarTiposDeFabrica()
    const [, patologia, caso] = await listarTiposNota()
    expect(patologia.campos.map((c) => c.nombre)).toEqual([
      'Nombre',
      'Definición breve',
      'Causas y factores de riesgo',
      'Fisiopatología',
      'Signos y síntomas',
      'Diagnóstico: exámenes y hallazgos',
      'Tratamiento',
      'Complicaciones',
    ])
    expect(textoPlantilla(patologia.plantillas[0].frente, patologia, { [CAMPO_NOMBRE_PATOLOGIA]: 'Asma' })).toBe('Definición breve de Asma')
    expect(caso.plantillas).toHaveLength(1)
    const valores = { 'caso-titulo': 'Mujer de 58 años', 'caso-paciente': '58 años, 70 kg', 'caso-respuesta': 'Hipertensión' }
    expect(textoPlantilla(caso.plantillas[0].frente, caso, valores)).toContain('Datos del paciente: 58 años, 70 kg')
    expect(textoPlantilla(caso.plantillas[0].reverso, caso, valores)).toBe('Hipertensión')
  })

  it('renombrar un campo cambia la pregunta sin perder el valor', () => {
    let tipo = tipoFarmacoDeFabrica()
    const plantilla = tipo.plantillas.find((p) => p.id === 'plantilla-farmaco-contraindicaciones')!
    const valores = { [CAMPO_NOMBRE_FARMACO]: 'Metformina', 'farmaco-contraindicaciones': 'Insuficiencia renal grave' }
    expect(textoPlantilla(plantilla.frente, tipo, valores)).toBe('Contraindicaciones de Metformina')

    tipo = cambiarCampo(tipo, 'farmaco-contraindicaciones', { nombre: 'Cuándo NO usar' })
    expect(textoPlantilla(plantilla.frente, tipo, valores)).toBe('Cuándo NO usar de Metformina')
    expect(textoPlantilla(plantilla.reverso, tipo, valores)).toBe('Insuficiencia renal grave')
  })

  it('dos cambios seguidos no se pisan', async () => {
    await asegurarTiposDeFabrica()
    await Promise.all([
      cambiarTipoNota('tipo-farmaco', (t) => cambiarCampo(t, 'farmaco-mecanismo', { oculto: true })),
      cambiarTipoNota('tipo-farmaco', (t) => moverCampo(t, 'farmaco-dosis', -1)),
    ])
    const [tipo] = await listarTiposNota()
    expect(tipo.campos.find((c) => c.id === 'farmaco-mecanismo')!.oculto).toBe(true)
    expect(camposOrdenados(tipo.campos).at(-1)!.id).toBe('farmaco-interacciones')
  })

  it('agrega un campo nuevo con su pregunta y rechaza duplicados', () => {
    let tipo = tipoFarmacoDeFabrica()
    tipo = agregarCampo(tipo, 'Embarazo', CAMPO_NOMBRE_FARMACO)
    expect(tipo.campos).toHaveLength(11)
    expect(tipo.plantillas).toHaveLength(10)
    expect(() => agregarCampo(tipo, ' embarazo ', CAMPO_NOMBRE_FARMACO)).toThrow('Ya existe')
  })

  it('oculta y reordena campos', () => {
    let tipo = tipoFarmacoDeFabrica()
    tipo = cambiarCampo(tipo, 'farmaco-mecanismo', { oculto: true })
    expect(tipo.campos.find((c) => c.id === 'farmaco-mecanismo')!.oculto).toBe(true)
    tipo = moverCampo(tipo, 'farmaco-dosis', -1)
    expect(camposOrdenados(tipo.campos).slice(-2).map((c) => c.id)).toEqual(['farmaco-dosis', 'farmaco-interacciones'])
    expect(moverCampo(tipo, CAMPO_NOMBRE_FARMACO, 1)).toBe(tipo)
    expect(moverCampo(tipo, 'farmaco-grupo', -1)).toBe(tipo)
  })
})
