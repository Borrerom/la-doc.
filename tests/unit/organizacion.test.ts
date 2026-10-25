import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { usarBase } from '../../src/core/db/db'
import {
  arbolDeMazos,
  borrarMazo,
  crearMateria,
  crearMazo,
  crearSemestre,
  listarMaterias,
  listarMazos,
  listarSemestres,
  renombrar,
  rutaDeMazo,
} from '../../src/core/db/organizacion'

let n = 0
beforeEach(() => {
  usarBase(`prueba-${++n}`)
})

describe('organización', () => {
  it('crea semestre, materia y submazos, y arma el árbol', async () => {
    const sem = await crearSemestre('  Semestre   5 ')
    expect(sem.nombre).toBe('Semestre 5')
    const farmaco = await crearMateria('Farmacología 1', sem.id)
    const antibioticos = await crearMazo('Antibióticos', farmaco.id)
    await crearMazo('Penicilinas', farmaco.id, antibioticos.id)
    await crearMazo('Analgésicos', farmaco.id)

    const mazos = await listarMazos(farmaco.id)
    const arbol = arbolDeMazos(mazos)
    expect(arbol.map((m) => m.nombre)).toEqual(['Antibióticos', 'Analgésicos'])
    expect(arbol[0].hijos.map((m) => m.nombre)).toEqual(['Penicilinas'])
    expect(rutaDeMazo(mazos, arbol[0].hijos[0].id)).toEqual(['Antibióticos', 'Penicilinas'])
  })

  it('borrar un mazo borra también sus submazos', async () => {
    const sem = await crearSemestre('Semestre 5')
    const mat = await crearMateria('Farmacología 1', sem.id)
    const a = await crearMazo('Antibióticos', mat.id)
    const b = await crearMazo('Penicilinas', mat.id, a.id)
    await crearMazo('Cefalosporinas', mat.id, a.id)
    await crearMazo('Penicilinas naturales', mat.id, b.id)
    await crearMazo('Analgésicos', mat.id)

    await borrarMazo(a.id)
    expect((await listarMazos(mat.id)).map((m) => m.nombre)).toEqual(['Analgésicos'])
  })

  it('renombra y ordena materias alfabéticamente', async () => {
    const sem = await crearSemestre('Semestre 5')
    const m1 = await crearMateria('Práctica Médica 1', sem.id)
    await crearMateria('Farmacología 1', sem.id)
    await renombrar('materias', m1.id, 'Morfofisiopatología 2')
    expect((await listarMaterias()).map((m) => m.nombre)).toEqual(['Farmacología 1', 'Morfofisiopatología 2'])
    expect((await listarSemestres()).length).toBe(1)
  })

  it('no acepta nombres vacíos', async () => {
    await expect(crearSemestre('   ')).rejects.toThrow('vacío')
  })
})
