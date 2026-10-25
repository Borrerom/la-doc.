import { ulid } from 'ulid'
import type { Enlace, Id, Nota, TipoEnlace, TipoNota } from '../model/tipos'
import { db } from './db'
import { tituloNota } from './notas'
import { TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from './tiposNota'

// Enlaces tipados entre notas: "Enalapril trata Presión arterial alta", "Metformina interactúa con…".
// La app los sugiere cuando un campo de una nota nombra a otra; Desi los confirma o los descarta.
// Un enlace descartado queda borrado y no se vuelve a proponer. También se pueden agregar a mano.
export const TIPO_INTERACCION = 'enlace-interaccion'
export const TIPO_TRATA = 'enlace-trata'
export const TIPO_CONTRAINDICADO = 'enlace-contraindicado'
export const TIPO_EN_CASO = 'enlace-caso'

// nombre: cómo se lee desde el origen; nombreInverso: desde el destino.
const TIPOS_ENLACE: Pick<TipoEnlace, 'id' | 'nombre' | 'nombreInverso'>[] = [
  { id: TIPO_TRATA, nombre: 'Trata', nombreInverso: 'Se trata con' },
  { id: TIPO_CONTRAINDICADO, nombre: 'Contraindicado en', nombreInverso: 'No usar' },
  { id: TIPO_INTERACCION, nombre: 'Interactúa con', nombreInverso: 'Interactúa con' },
  { id: TIPO_EN_CASO, nombre: 'Incluye', nombreInverso: 'Aparece en el caso' },
]

// Qué campo de qué tipo de nota se lee para sugerir cada enlace, y hacia qué tipo apunta.
// invertir: el enlace va del mencionado al que menciona (la patología nombra al fármaco que la trata).
type Regla = { enlace: Id; lee: Id; campos: Id[] | 'todos'; busca: Id; invertir?: boolean }
const REGLAS: Regla[] = [
  { enlace: TIPO_INTERACCION, lee: TIPO_FARMACO, campos: ['farmaco-interacciones'], busca: TIPO_FARMACO },
  { enlace: TIPO_TRATA, lee: TIPO_FARMACO, campos: ['farmaco-indicaciones'], busca: TIPO_PATOLOGIA },
  { enlace: TIPO_TRATA, lee: TIPO_PATOLOGIA, campos: ['patologia-tratamiento'], busca: TIPO_FARMACO, invertir: true },
  { enlace: TIPO_CONTRAINDICADO, lee: TIPO_FARMACO, campos: ['farmaco-contraindicaciones'], busca: TIPO_PATOLOGIA },
  { enlace: TIPO_EN_CASO, lee: TIPO_CASO, campos: 'todos', busca: TIPO_FARMACO },
  { enlace: TIPO_EN_CASO, lee: TIPO_CASO, campos: 'todos', busca: TIPO_PATOLOGIA },
]

const CAMPO_GRUPO = 'farmaco-grupo'

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export async function asegurarTiposEnlace() {
  const ahora = Date.now()
  for (const t of TIPOS_ENLACE) {
    if (!(await db.tiposEnlace.get(t.id))) await db.tiposEnlace.put({ ...t, creada: ahora, editada: ahora })
  }
}

// "aine" aparece en "Aspirina y AINE como ibuprofeno" como palabra entera, no dentro de otra.
function menciona(texto: string, termino: string) {
  const t = normalizar(termino).trim()
  if (t.length < 4) return false
  const escapado = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}])${escapado}($|[^\\p{L}])`, 'u').test(normalizar(texto))
}

// Cómo se reconoce una nota en el texto de otra: "Azitromicina (Zithromax)" por el genérico o el
// comercial, un fármaco también por su grupo, "Presión arterial alta (hipertensión)" por cualquiera.
function terminos(nota: Nota, tipo: TipoNota): string[] {
  const nombre = tituloNota(nota, tipo)
  const lista = nombre.split(/[(),;/]/)
  if (nota.tipoNotaId === TIPO_FARMACO) lista.push((nota.valores[CAMPO_GRUPO] ?? '').split(/[,;(]/)[0])
  return lista
}

function lineaQueNombra(texto: string, buscados: string[]): string | null {
  return texto.split('\n').find((l) => buscados.some((t) => menciona(l, t))) ?? null
}

const par = (tipo: Id, x: Id, y: Id) => (x < y ? `${tipo}|${x}|${y}` : `${tipo}|${y}|${x}`)

export async function proponerEnlaces(): Promise<number> {
  await asegurarTiposEnlace()
  const tipos = new Map((await db.tiposNota.toArray()).map((t) => [t.id, t]))
  const notas = (await db.notas.toArray()).filter((n) => n.borrada === undefined && tipos.has(n.tipoNotaId))
  const porTipo = (id: Id) => notas.filter((n) => n.tipoNotaId === id)
  // Los descartados (borrados) cuentan como existentes para no volver a proponerlos.
  const existentes = new Set((await db.enlaces.toArray()).map((e) => par(e.tipoEnlaceId, e.origenNotaId, e.destinoNotaId)))
  const nuevos: Enlace[] = []
  const ahora = Date.now()
  for (const r of REGLAS) {
    for (const a of porTipo(r.lee)) {
      const texto = (r.campos === 'todos' ? Object.values(a.valores) : r.campos.map((c) => a.valores[c] ?? '')).join('\n')
      if (!texto.trim()) continue
      for (const b of porTipo(r.busca)) {
        if (a.id === b.id || existentes.has(par(r.enlace, a.id, b.id))) continue
        const linea = lineaQueNombra(texto, terminos(b, tipos.get(b.tipoNotaId)!))
        if (!linea) continue
        existentes.add(par(r.enlace, a.id, b.id))
        const [origen, destino] = r.invertir ? [b, a] : [a, b]
        nuevos.push({
          id: ulid(),
          origenNotaId: origen.id,
          destinoNotaId: destino.id,
          tipoEnlaceId: r.enlace,
          comentario: linea,
          estado: 'propuesto',
          creadoPor: 'deteccion',
          fuenteIds: [],
          creada: ahora,
          editada: ahora,
        })
      }
    }
  }
  if (nuevos.length) await db.enlaces.bulkPut(nuevos)
  return nuevos.length
}

// relacion: cómo se lee el enlace desde esta nota ("Trata", "Se trata con"…).
export type EnlaceVisible = Enlace & { otra: Nota; tituloOtra: string; tipoOtra: TipoNota; relacion: string }

export async function enlacesDeNota(notaId: Id): Promise<EnlaceVisible[]> {
  const todos = [
    ...(await db.enlaces.where('origenNotaId').equals(notaId).toArray()),
    ...(await db.enlaces.where('destinoNotaId').equals(notaId).toArray()),
  ].filter((e) => e.borrada === undefined)
  const tiposEnlace = new Map((await db.tiposEnlace.toArray()).map((t) => [t.id, t]))
  const visibles: EnlaceVisible[] = []
  for (const e of todos) {
    const desdeOrigen = e.origenNotaId === notaId
    const otra = await db.notas.get(desdeOrigen ? e.destinoNotaId : e.origenNotaId)
    const tipoOtra = otra && (await db.tiposNota.get(otra.tipoNotaId))
    const tipoEnlace = tiposEnlace.get(e.tipoEnlaceId)
    if (!otra || otra.borrada !== undefined || !tipoOtra) continue
    const relacion = tipoEnlace ? (desdeOrigen ? tipoEnlace.nombre : tipoEnlace.nombreInverso) : 'Relacionado con'
    visibles.push({ ...e, otra, tipoOtra, tituloOtra: tituloNota(otra, tipoOtra), relacion })
  }
  return visibles.sort((a, b) => a.relacion.localeCompare(b.relacion, 'es') || a.tituloOtra.localeCompare(b.tituloOtra, 'es'))
}

// Opciones para enlazar a mano: cada tipo en los dos sentidos ("Trata" y "Se trata con").
export async function opcionesDeEnlace() {
  await asegurarTiposEnlace()
  const tipos = (await db.tiposEnlace.toArray()).filter((t) => !t.borrada)
  return tipos.flatMap((t) =>
    t.nombre === t.nombreInverso
      ? [{ valor: `${t.id}>`, nombre: t.nombre }]
      : [
          { valor: `${t.id}>`, nombre: t.nombre },
          { valor: `${t.id}<`, nombre: t.nombreInverso },
        ],
  )
}

// opcion: "<tipo>>" si esta nota es el origen, "<tipo><" si es el destino.
export async function crearEnlace(notaId: Id, opcion: string, otraId: Id) {
  if (notaId === otraId) throw new Error('Elige otra nota')
  const tipoEnlaceId = opcion.slice(0, -1)
  const [origenNotaId, destinoNotaId] = opcion.endsWith('<') ? [otraId, notaId] : [notaId, otraId]
  const ahora = Date.now()
  const enlace: Enlace = {
    id: ulid(),
    origenNotaId,
    destinoNotaId,
    tipoEnlaceId,
    comentario: '',
    estado: 'aprobado',
    creadoPor: 'manual',
    fuenteIds: [],
    creada: ahora,
    editada: ahora,
  }
  await db.enlaces.add(enlace)
  return enlace
}

export async function aprobarEnlace(id: Id) {
  await db.enlaces.update(id, { estado: 'aprobado', editada: Date.now() })
}

export async function descartarEnlace(id: Id) {
  const ahora = Date.now()
  await db.enlaces.update(id, { borrada: ahora, editada: ahora })
}
