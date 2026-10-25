import { ulid } from 'ulid'
import type { Id, Materia, Mazo, Semestre } from '../model/tipos'
import { db } from './db'

const vivo = <T extends { borrada?: number }>(x: T) => x.borrada === undefined
const base = () => {
  const ahora = Date.now()
  return { id: ulid(), creada: ahora, editada: ahora }
}
const limpiar = (nombre: string) => {
  const n = nombre.trim().replace(/\s+/g, ' ')
  if (!n) throw new Error('El nombre no puede estar vacío')
  return n
}

export const COLORES_MATERIA = ['#7c3aed', '#0f766e', '#c2410c', '#1d4ed8', '#be123c', '#4d7c0f']

// --- Semestres ---

export async function crearSemestre(nombre: string): Promise<Semestre> {
  const orden = (await db.semestres.count()) + 1
  const semestre: Semestre = { ...base(), nombre: limpiar(nombre), orden }
  await db.semestres.add(semestre)
  return semestre
}

export async function listarSemestres() {
  return (await db.semestres.orderBy('orden').toArray()).filter(vivo)
}

// --- Materias ---

export async function crearMateria(nombre: string, semestreId: Id): Promise<Materia> {
  const cantidad = await db.materias.count()
  const materia: Materia = {
    ...base(),
    nombre: limpiar(nombre),
    semestreId,
    color: COLORES_MATERIA[cantidad % COLORES_MATERIA.length],
  }
  await db.materias.add(materia)
  return materia
}

export async function listarMaterias() {
  return (await db.materias.toArray()).filter(vivo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// --- Mazos y submazos ---

export async function crearMazo(nombre: string, materiaId: Id, padreId: Id | null = null): Promise<Mazo> {
  const hermanos = (await db.mazos.where('materiaId').equals(materiaId).toArray()).filter(
    (m) => vivo(m) && m.padreId === padreId,
  )
  const mazo: Mazo = { ...base(), nombre: limpiar(nombre), materiaId, padreId, orden: hermanos.length + 1 }
  await db.mazos.add(mazo)
  return mazo
}

export async function listarMazos(materiaId: Id) {
  return (await db.mazos.where('materiaId').equals(materiaId).toArray()).filter(vivo)
}

export async function renombrar(tabla: 'semestres' | 'materias' | 'mazos', id: Id, nombre: string) {
  await db[tabla].update(id, { nombre: limpiar(nombre), editada: Date.now() })
}

// Borra el mazo y todos sus submazos (borrado lógico).
export async function borrarMazo(id: Id) {
  const mazo = await db.mazos.get(id)
  if (!mazo) return
  const todos = await listarMazos(mazo.materiaId)
  const ids = [id, ...descendientes(todos, id).map((m) => m.id)]
  const ahora = Date.now()
  await db.mazos.bulkUpdate(ids.map((key) => ({ key, changes: { borrada: ahora, editada: ahora } })))
}

// --- Árbol (funciones puras) ---

export type NodoMazo = Mazo & { hijos: NodoMazo[] }

export function arbolDeMazos(mazos: Mazo[]): NodoMazo[] {
  const porPadre = new Map<Id | null, Mazo[]>()
  for (const m of mazos) porPadre.set(m.padreId, [...(porPadre.get(m.padreId) ?? []), m])
  const armar = (padreId: Id | null): NodoMazo[] =>
    (porPadre.get(padreId) ?? [])
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
      .map((m) => ({ ...m, hijos: armar(m.id) }))
  return armar(null)
}

export function descendientes(mazos: Mazo[], id: Id): Mazo[] {
  const hijos = mazos.filter((m) => m.padreId === id)
  return hijos.flatMap((h) => [h, ...descendientes(mazos, h.id)])
}

// "Farmacología 1 > Antibióticos > Penicilinas"
export function rutaDeMazo(mazos: Mazo[], id: Id): string[] {
  const porId = new Map(mazos.map((m) => [m.id, m]))
  const ruta: string[] = []
  for (let m = porId.get(id); m; m = m.padreId ? porId.get(m.padreId) : undefined) ruta.unshift(m.nombre)
  return ruta
}

// Al pasar la app a lila (versión 0.14), las materias que tenían el verde de antes toman el lila.
export async function materiasALila() {
  await db.materias.filter((m) => m.color === '#0f766e').modify({ color: COLORES_MATERIA[0] })
}
