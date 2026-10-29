import { db } from '../db/db'
import { notasDeMazo } from '../db/notas'
import type { Calificacion, Id, Nota } from '../model/tipos'
import { estadoNuevo } from './fsrs'
import type { FichaEnCola } from './repaso'

// Estudio libre: todas las fichas de un tema (con sus subtemas) o de una materia, cuando ella quiera,
// sin esperar a que venzan. Por defecto no toca el calendario del repaso.
export type OrigenEstudio = { mazoId: Id } | { materiaId: Id }

export async function fichasParaEstudiar(origen: OrigenEstudio, ahora: number): Promise<FichaEnCola[]> {
  const notas: Nota[] =
    'mazoId' in origen
      ? await notasDeMazo(origen.mazoId)
      : (await db.notas.where('materiaId').equals(origen.materiaId).toArray()).filter((n) => !n.borrada)
  const porId = new Map(notas.map((n) => [n.id, n]))
  const fichas = (await db.fichas.where('notaId').anyOf([...porId.keys()]).toArray()).filter((f) => !f.suspendida && !f.borrada)
  const estados = new Map((await db.estadosRepaso.bulkGet(fichas.map((f) => f.id))).flatMap((e) => (e ? [[e.fichaId, e]] : [])))
  return fichas
    .map((ficha) => {
      const estado = estados.get(ficha.id)
      return { ficha, nota: porId.get(ficha.notaId)!, estado: estado ?? estadoNuevo(ficha.id, ahora), nueva: !estado || estado.estado === 0 }
    })
    .sort((a, b) => a.nota.creada - b.nota.creada || a.ficha.creada - b.ficha.creada)
}

export function mezclar<T>(lista: T[], azar = Math.random): T[] {
  const r = [...lista]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// Después de responder la primera ficha: "Mal" vuelve pronto, "Difícil" al final de la vuelta,
// "Bien" y "Fácil" salen de la sesión.
export const VUELVE_TRAS_MAL = 3

export function siguiente<T>(cola: T[], calificacion: Calificacion): T[] {
  const [actual, ...resto] = cola
  if (actual === undefined) return []
  if (calificacion === 1) return [...resto.slice(0, VUELVE_TRAS_MAL), actual, ...resto.slice(VUELVE_TRAS_MAL)]
  if (calificacion === 2) return [...resto, actual]
  return resto
}
