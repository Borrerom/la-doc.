import { ulid } from 'ulid'
import { db } from '../db/db'
import type { Calificacion, EstadoRepaso, Ficha, Id, Nota } from '../model/tipos'
import { calificar, estadoNuevo } from './fsrs'

export const NUEVAS_POR_DIA = 20
// Una ficha en aprendizaje que vuelve dentro de este margen se puede mostrar antes si no queda otra.
export const MARGEN_APRENDIZAJE_MS = 20 * 60 * 1000

export function inicioDelDia(ahora: number) {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function finDelDia(ahora: number) {
  return inicioDelDia(ahora) + 24 * 60 * 60 * 1000 - 1
}

export type FichaEnCola = { ficha: Ficha; nota: Nota; estado: EstadoRepaso; nueva: boolean }

export type Cola = {
  ahora: FichaEnCola[]
  // Fichas en aprendizaje que vuelven en unos minutos.
  luego: FichaEnCola[]
  nuevasRestantes: number
  totalHoy: number
}

// Intercala las fichas nuevas por nota, para no ver seguidas todas las preguntas del mismo fármaco.
function intercalar(fichas: FichaEnCola[]) {
  const porNota = new Map<Id, FichaEnCola[]>()
  for (const f of fichas) porNota.set(f.nota.id, [...(porNota.get(f.nota.id) ?? []), f])
  const grupos = [...porNota.values()]
  const resultado: FichaEnCola[] = []
  for (let i = 0; resultado.length < fichas.length; i++) for (const g of grupos) if (g[i]) resultado.push(g[i])
  return resultado
}

export async function armarCola(ahora: number, filtro: { materiaId?: Id } = {}): Promise<Cola> {
  const notas = (await db.notas.toArray()).filter((n) => !n.borrada && (!filtro.materiaId || n.materiaId === filtro.materiaId))
  const notaPorId = new Map(notas.map((n) => [n.id, n]))
  const fichas = (await db.fichas.where('notaId').anyOf([...notaPorId.keys()]).toArray()).filter(
    (f) => !f.suspendida && !f.borrada,
  )
  const estados = new Map((await db.estadosRepaso.bulkGet(fichas.map((f) => f.id))).flatMap((e) => (e ? [[e.fichaId, e]] : [])))

  const nuevasHoy = await db.registrosRepaso
    .where('fecha')
    .aboveOrEqual(inicioDelDia(ahora))
    .filter((r) => r.estadoAnterior.estado === 0)
    .count()
  const nuevasRestantes = Math.max(0, NUEVAS_POR_DIA - nuevasHoy)

  const aprendiendo: FichaEnCola[] = []
  const luego: FichaEnCola[] = []
  const repaso: FichaEnCola[] = []
  const nuevas: FichaEnCola[] = []
  for (const ficha of fichas) {
    const nota = notaPorId.get(ficha.notaId)!
    const estado = estados.get(ficha.id)
    if (!estado || estado.estado === 0) {
      nuevas.push({ ficha, nota, estado: estado ?? estadoNuevo(ficha.id, ahora), nueva: true })
      continue
    }
    const item = { ficha, nota, estado, nueva: false }
    const enAprendizaje = estado.estado === 1 || estado.estado === 3
    if (enAprendizaje && estado.vence <= ahora) aprendiendo.push(item)
    else if (enAprendizaje && estado.vence <= ahora + MARGEN_APRENDIZAJE_MS) luego.push(item)
    else if (!enAprendizaje && estado.vence <= finDelDia(ahora)) repaso.push(item)
  }

  aprendiendo.sort((a, b) => a.estado.vence - b.estado.vence)
  luego.sort((a, b) => a.estado.vence - b.estado.vence)
  repaso.sort((a, b) => a.estado.vence - b.estado.vence)
  nuevas.sort((a, b) => a.nota.creada - b.nota.creada || a.ficha.creada - b.ficha.creada)
  const nuevasDeHoy = intercalar(nuevas).slice(0, nuevasRestantes)

  const colaAhora = [...aprendiendo, ...repaso, ...nuevasDeHoy]
  return { ahora: colaAhora, luego, nuevasRestantes, totalHoy: colaAhora.length + luego.length }
}

export async function registrarRespuesta(item: FichaEnCola, calificacion: Calificacion, ahora: number, duracionMs: number) {
  const nuevo = calificar(item.estado, calificacion, ahora)
  await db.transaction('rw', db.estadosRepaso, db.registrosRepaso, async () => {
    await db.estadosRepaso.put(nuevo)
    await db.registrosRepaso.add({
      id: ulid(),
      fichaId: item.ficha.id,
      calificacion,
      fecha: ahora,
      estadoAnterior: item.estado,
      duracionMs: Math.min(duracionMs, 5 * 60 * 1000),
    })
  })
  return nuevo
}

export async function repasadasHoy(ahora: number) {
  return db.registrosRepaso.where('fecha').aboveOrEqual(inicioDelDia(ahora)).count()
}
