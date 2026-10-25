import { describe, expect, it } from 'vitest'
import { duracionSegundos, escribirWav, leerWav, unirWav, type Pcm } from '../../src/core/audio/wav'

const tono = (segundos: number, sampleRate = 22050): Pcm => ({
  sampleRate,
  channels: 1,
  bitsPerSample: 16,
  data: new Uint8Array(Math.round(segundos * sampleRate) * 2).fill(7),
})

describe('wav', () => {
  it('escribe y vuelve a leer el mismo audio', () => {
    const original = tono(0.5)
    const leido = leerWav(escribirWav(original))
    expect(leido.sampleRate).toBe(22050)
    expect(leido.data).toEqual(original.data)
  })

  it('une partes con silencios y suma la duración', () => {
    const unido = unirWav([tono(1), { silencioSegundos: 2 }, tono(0.5)])
    expect(duracionSegundos(unido)).toBeCloseTo(3.5, 3)
    // El silencio queda en ceros entre las dos partes.
    expect(unido.data[22050 * 2 + 10]).toBe(0)
    expect(unido.data[unido.data.length - 1]).toBe(7)
  })

  it('rechaza audios con formatos distintos', () => {
    expect(() => unirWav([tono(1, 22050), tono(1, 16000)])).toThrow('formatos distintos')
  })

  it('rechaza archivos que no son WAV', () => {
    expect(() => leerWav(new ArrayBuffer(44))).toThrow('No es un WAV')
  })
})
