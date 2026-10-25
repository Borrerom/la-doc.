import { describe, expect, it } from 'vitest'
import { huella } from '../../src/core/audio/cacheAudio'

describe('huella del texto', () => {
  it('cambia cuando cambia el texto y es estable', () => {
    expect(huella('Contraindicaciones de Metformina')).toBe(huella('Contraindicaciones de Metformina'))
    expect(huella('Contraindicaciones de Metformina')).not.toBe(huella('Contraindicaciones de Metformin'))
  })
})

import { textoParaLeer } from '../../src/core/audio/vozTelefono'

describe('texto para leer', () => {
  it('convierte huecos y saltos de línea', () => {
    expect(textoParaLeer('Mecanismo: reduce la […]\nOtra línea')).toBe('Mecanismo: reduce la espacio en blanco. Otra línea')
    expect(textoParaLeer('reduce la [gluconeogénesis]')).toBe('reduce la gluconeogénesis')
  })
})
