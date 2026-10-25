import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { usarBase } from '../../src/core/db/db'
import {
  CAMPO_NOMBRE_FARMACO,
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
    expect(tipos).toHaveLength(1)
    expect(tipos[0].campos.map((c) => c.nombre)).toEqual([
      'Nombre genérico y comercial',
      'Grupo o familia',
      'Mecanismo de acción',
      'Indicaciones',
      'Contraindicaciones',
      'Efectos secundarios',
      'Interacciones con otros fármacos',
      'Dosis, y ajustes por edad o peso',
    ])
    expect(tipos[0].plantillas).toHaveLength(7)
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
    expect(tipo.campos).toHaveLength(9)
    expect(tipo.plantillas).toHaveLength(8)
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
