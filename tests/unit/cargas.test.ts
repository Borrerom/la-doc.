import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { archivosDeCarga, borrarCarga, contarPendientes, crearCarga, listarCargas, reintentarCarga } from '../../src/core/db/cargas'
import { db, usarBase } from '../../src/core/db/db'
import { crearMateria, crearMazo, crearSemestre } from '../../src/core/db/organizacion'

let mazoId = ''
let materiaId = ''
beforeEach(async () => {
  usarBase(`cargas-${Math.random()}`)
  const sem = await crearSemestre('Semestre 5')
  materiaId = (await crearMateria('Farmacología 1', sem.id)).id
  mazoId = (await crearMazo('Antibióticos', materiaId, null)).id
})

const foto = (n = 10) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' })

describe('cola de cargas', () => {
  it('guarda fotos con su destino y queda en cola', async () => {
    const carga = await crearCarga({ tipo: 'foto', archivos: [foto(), foto()], mazoId, indicacion: '  solo la página 2 ' })
    expect(carga).toMatchObject({ estado: 'en_cola', intentos: 0, materiaId, indicacion: 'solo la página 2' })
    const archivos = await archivosDeCarga(carga)
    expect(archivos.map((a) => a.tipoMime)).toEqual(['image/jpeg', 'image/jpeg'])
    expect(await contarPendientes()).toBe(1)
  })

  it('rechaza cargas vacías o demasiado grandes', async () => {
    await expect(crearCarga({ tipo: 'foto', archivos: [], mazoId })).rejects.toThrow('No hay nada')
    await expect(crearCarga({ tipo: 'pdf', archivos: [foto(15 * 1024 * 1024)], mazoId })).rejects.toThrow('Divide')
    expect(await listarCargas()).toEqual([])
  })

  it('al borrar libera los archivos y al reintentar vuelve a la cola', async () => {
    const carga = await crearCarga({ tipo: 'voz', archivos: [new Blob(['x'], { type: 'audio/webm' })], mazoId })
    await db.cargas.update(carga.id, { estado: 'error', error: 'sin cuota' })
    await reintentarCarga(carga.id)
    expect(await db.cargas.get(carga.id)).toMatchObject({ estado: 'en_cola' })
    expect((await db.cargas.get(carga.id))?.error).toBeUndefined()
    await borrarCarga(carga.id)
    expect(await db.archivos.count()).toBe(0)
    expect(await listarCargas()).toEqual([])
  })
})
