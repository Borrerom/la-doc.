import { ulid } from 'ulid'
import type { Enlace, Id, Nota } from '../model/tipos'
import { db } from './db'
import { CAMPO_NOMBRE_FARMACO, TIPO_FARMACO } from './tiposNota'

// Interacciones sugeridas (paso 15): si en "Interacciones" de un fármaco aparece el nombre o el grupo
// de otro fármaco ya cargado, se propone un enlace entre los dos. Desi lo confirma o lo descarta;
// un enlace descartado queda borrado y no se vuelve a proponer.
export const TIPO_INTERACCION = 'enlace-interaccion'
const CAMPO_INTERACCIONES = 'farmaco-interacciones'
const CAMPO_GRUPO = 'farmaco-grupo'

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

async function asegurarTipoInteraccion() {
  if (await db.tiposEnlace.get(TIPO_INTERACCION)) return
  const ahora = Date.now()
  await db.tiposEnlace.put({ id: TIPO_INTERACCION, nombre: 'Interactúa con', nombreInverso: 'Interactúa con', creada: ahora, editada: ahora })
}

// "aine" aparece en "Aspirina y AINE como ibuprofeno" como palabra entera, no dentro de otra.
function menciona(texto: string, termino: string) {
  const t = normalizar(termino).trim()
  if (t.length < 4) return false
  const escapado = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}])${escapado}($|[^\\p{L}])`, 'u').test(normalizar(texto))
}

// La línea de "Interacciones" de `a` que habla de `b`, si la hay.
export function lineaQueMenciona(a: Nota, b: Nota): string | null {
  const lineas = (a.valores[CAMPO_INTERACCIONES] ?? '').split('\n').filter(Boolean)
  // "Azitromicina (Zithromax)" se reconoce por el genérico o por el comercial.
  const terminos = [
    ...(b.valores[CAMPO_NOMBRE_FARMACO] ?? '').split(/[(),;/]/),
    (b.valores[CAMPO_GRUPO] ?? '').split(/[,;(]/)[0],
  ]
  return lineas.find((l) => terminos.some((t) => menciona(l, t))) ?? null
}

const par = (x: Id, y: Id) => (x < y ? `${x}|${y}` : `${y}|${x}`)

export async function proponerInteracciones(): Promise<number> {
  await asegurarTipoInteraccion()
  const farmacos = (await db.notas.where('tipoNotaId').equals(TIPO_FARMACO).toArray()).filter((n) => n.borrada === undefined)
  // Los descartados (borrados) cuentan como existentes para no volver a proponerlos.
  const existentes = new Set((await db.enlaces.where('tipoEnlaceId').equals(TIPO_INTERACCION).toArray()).map((e) => par(e.origenNotaId, e.destinoNotaId)))
  const nuevos: Enlace[] = []
  const ahora = Date.now()
  for (const a of farmacos) {
    for (const b of farmacos) {
      if (a.id === b.id || existentes.has(par(a.id, b.id))) continue
      const linea = lineaQueMenciona(a, b)
      if (!linea) continue
      existentes.add(par(a.id, b.id))
      nuevos.push({
        id: ulid(),
        origenNotaId: a.id,
        destinoNotaId: b.id,
        tipoEnlaceId: TIPO_INTERACCION,
        comentario: linea,
        estado: 'propuesto',
        creadoPor: 'deteccion',
        fuenteIds: [],
        creada: ahora,
        editada: ahora,
      })
    }
  }
  if (nuevos.length) await db.enlaces.bulkPut(nuevos)
  return nuevos.length
}

export type EnlaceVisible = Enlace & { otra: Nota }

export async function enlacesDeNota(notaId: Id): Promise<EnlaceVisible[]> {
  const todos = [
    ...(await db.enlaces.where('origenNotaId').equals(notaId).toArray()),
    ...(await db.enlaces.where('destinoNotaId').equals(notaId).toArray()),
  ].filter((e) => e.borrada === undefined)
  const visibles: EnlaceVisible[] = []
  for (const e of todos) {
    const otra = await db.notas.get(e.origenNotaId === notaId ? e.destinoNotaId : e.origenNotaId)
    if (otra && otra.borrada === undefined) visibles.push({ ...e, otra })
  }
  return visibles
}

export async function aprobarEnlace(id: Id) {
  await db.enlaces.update(id, { estado: 'aprobado', editada: Date.now() })
}

export async function descartarEnlace(id: Id) {
  const ahora = Date.now()
  await db.enlaces.update(id, { borrada: ahora, editada: ahora })
}
