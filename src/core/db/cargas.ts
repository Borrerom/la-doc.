import { useLiveQuery } from 'dexie-react-hooks'
import { ulid } from 'ulid'
import type { Carga, Id } from '../model/tipos'
import { db } from './db'

// Límite de lo que se manda en un solo pedido a la IA: Gemini acepta unos 20 MB y el envío
// en base64 ocupa un tercio más.
export const MAXIMO_MB = 14

export type NuevaCarga = {
  tipo: Carga['tipo']
  archivos: Blob[]
  mazoId: Id
  indicacion?: string
}

export async function crearCarga({ tipo, archivos, mazoId, indicacion }: NuevaCarga): Promise<Carga> {
  if (archivos.length === 0) throw new Error('No hay nada que cargar')
  const totalMB = archivos.reduce((t, a) => t + a.size, 0) / 1024 / 1024
  if (totalMB > MAXIMO_MB) {
    throw new Error(`Son ${Math.ceil(totalMB)} MB y el máximo es ${MAXIMO_MB} MB. Divide el material en partes.`)
  }
  const mazo = await db.mazos.get(mazoId)
  if (!mazo || mazo.borrada) throw new Error('El mazo ya no existe')
  const materia = await db.materias.get(mazo.materiaId)
  if (!materia) throw new Error('La materia ya no existe')

  const ahora = Date.now()
  const archivosGuardados = archivos.map((blob) => ({
    id: ulid(),
    tipoMime: blob.type || 'application/octet-stream',
    blob,
    tamano: blob.size,
    creada: ahora,
  }))
  const carga: Carga = {
    id: ulid(),
    creada: ahora,
    editada: ahora,
    tipo,
    archivoIds: archivosGuardados.map((a) => a.id),
    materiaId: materia.id,
    semestreId: materia.semestreId,
    mazoId,
    estado: 'en_cola',
    intentos: 0,
    ...(indicacion?.trim() ? { indicacion: indicacion.trim() } : {}),
  }
  await db.transaction('rw', db.cargas, db.archivos, async () => {
    await db.archivos.bulkAdd(archivosGuardados)
    await db.cargas.add(carga)
  })
  return carga
}

export async function listarCargas(): Promise<Carga[]> {
  return (await db.cargas.orderBy('creada').reverse().toArray()).filter((c) => !c.borrada)
}

export function useCargas() {
  return useLiveQuery(listarCargas)
}

export async function contarPendientes() {
  return (await listarCargas()).filter((c) => c.estado !== 'aprobada').length
}

export async function archivosDeCarga(carga: Carga) {
  return (await db.archivos.bulkGet(carga.archivoIds)).filter((a) => a !== undefined)
}

// Borra la carga y sus archivos (las fotos y audios ocupan espacio en el teléfono).
export async function borrarCarga(id: Id) {
  await db.transaction('rw', db.cargas, db.archivos, async () => {
    const carga = await db.cargas.get(id)
    if (!carga) return
    await db.archivos.bulkDelete(carga.archivoIds)
    const ahora = Date.now()
    await db.cargas.update(id, { borrada: ahora, editada: ahora, archivoIds: [] })
  })
}

export async function reintentarCarga(id: Id) {
  await db.cargas.update(id, { estado: 'en_cola', error: undefined, editada: Date.now() })
}
