import { describe, expect, it } from 'vitest'
import { pedirAlmacenamientoPersistente } from '../../src/core/storage/persist'

const storageFalso = (yaPersistente: boolean, concede: boolean) =>
  ({
    persisted: async () => yaPersistente,
    persist: async () => concede,
    estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 2048 * 1024 * 1024 }),
  }) as unknown as StorageManager

describe('pedirAlmacenamientoPersistente', () => {
  it('pide persistencia cuando aún no la tiene', async () => {
    const estado = await pedirAlmacenamientoPersistente(storageFalso(false, true))
    expect(estado).toEqual({ persistente: true, usadoMB: 5, disponibleMB: 2048 })
  })

  it('informa cuando Android la niega', async () => {
    const estado = await pedirAlmacenamientoPersistente(storageFalso(false, false))
    expect(estado.persistente).toBe(false)
  })

  it('no falla en navegadores sin StorageManager', async () => {
    const estado = await pedirAlmacenamientoPersistente(undefined)
    expect(estado).toEqual({ persistente: false, usadoMB: null, disponibleMB: null })
  })
})
