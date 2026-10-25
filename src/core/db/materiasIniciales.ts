import type { Id } from '../model/tipos'
import { normalizar } from '../search/buscador'
import { db } from './db'
import { crearMateria } from './organizacion'
import { TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from './tiposNota'

// Las tres materias del semestre de Desi, cada una con el tipo de nota que más usa.
export const MATERIAS_INICIALES: { nombre: string; tipo: Id }[] = [
  { nombre: 'Farmacología 1', tipo: TIPO_FARMACO },
  { nombre: 'Morfofisiopatología 2', tipo: TIPO_PATOLOGIA },
  { nombre: 'Práctica Médica 1', tipo: TIPO_CASO },
]

const AJUSTE_MATERIAS = 'materias-iniciales'
// Solo para pruebas automáticas que necesitan empezar sin las materias.
export const SIN_MATERIAS = 'la-doc:sin-materias'

// Una sola vez, cuando ya hay semestre: crea las materias que falten en el primero y les pone su
// tipo principal. Si Desi después borra una, no vuelve.
let enCurso: Promise<void> | null = null
export function asegurarMateriasIniciales(): Promise<void> {
  enCurso ??= crearLasQueFalten().finally(() => {
    enCurso = null
  })
  return enCurso
}

async function crearLasQueFalten() {
  if (await db.ajustes.get(AJUSTE_MATERIAS)) return
  if (typeof localStorage !== 'undefined' && localStorage.getItem(SIN_MATERIAS)) return
  const semestres = (await db.semestres.orderBy('orden').toArray()).filter((s) => !s.borrada)
  if (semestres.length === 0) return
  const materias = (await db.materias.toArray()).filter((m) => !m.borrada)
  for (const { nombre, tipo } of MATERIAS_INICIALES) {
    // "Farmacología" o "Farmacologia 1" cuentan como la misma materia.
    const raiz = normalizar(nombre).replace(/\s*\d+$/, '')
    const existente = materias.find((m) => normalizar(m.nombre) === normalizar(nombre)) ?? materias.find((m) => normalizar(m.nombre).startsWith(raiz))
    if (existente) {
      if (!existente.tipoPrincipal) await db.materias.update(existente.id, { tipoPrincipal: tipo })
    } else {
      const nueva = await crearMateria(nombre, semestres[0].id)
      await db.materias.update(nueva.id, { tipoPrincipal: tipo })
    }
  }
  await db.ajustes.put({ clave: AJUSTE_MATERIAS, valor: Date.now() })
}
