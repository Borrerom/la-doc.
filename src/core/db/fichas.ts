import { ulid } from 'ulid'
import type { Ficha, Id, Nota, Plantilla, TipoNota } from '../model/tipos'
import { db } from './db'
import { textoPlantilla } from './tiposNota'

// Fichas de completar al estilo Anki: en cualquier campo, "{{c1::amoxicilina}}" o "{{c1::amoxicilina::pista}}".
export const PLANTILLA_COMPLETAR = 'plantilla-completar'
const HUECO = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g

export function huecos(valores: Record<Id, string>): number[] {
  const n = new Set<number>()
  for (const v of Object.values(valores)) for (const m of v.matchAll(HUECO)) n.add(Number(m[1]))
  return [...n].sort((a, b) => a - b)
}

export function textoCompletar(texto: string, indice: number, revelar: boolean) {
  return texto.replace(HUECO, (_, n: string, respuesta: string, pista?: string) => {
    if (Number(n) !== indice) return respuesta
    return revelar ? `[${respuesta}]` : `[${pista ?? '…'}]`
  })
}

const sinMarcas = (texto: string) => texto.replace(HUECO, (_, __, respuesta: string) => respuesta)

// Campos que usa una plantilla de pregunta, para saber si la ficha tiene sentido.
function camposDe(plantilla: Plantilla) {
  return [...`${plantilla.frente} ${plantilla.reverso}`.matchAll(/\{\{(nombre:)?([^}]+)\}\}/g)].map((m) => m[2])
}

// Qué fichas debería tener la nota ahora: clave "plantilla#indice".
export function fichasEsperadas(nota: Pick<Nota, 'valores'>, tipo: TipoNota): { plantillaId: Id; indice: number }[] {
  const ocultos = new Set(tipo.campos.filter((c) => c.oculto).map((c) => c.id))
  const esperadas: { plantillaId: Id; indice: number }[] = []
  for (const p of tipo.plantillas) {
    if (p.tipo !== 'pregunta') continue
    const reverso = camposDe({ ...p, frente: '' })
    const usados = camposDe(p)
    if (usados.some((id) => ocultos.has(id))) continue
    if (reverso.every((id) => !nota.valores[id])) continue
    esperadas.push({ plantillaId: p.id, indice: 0 })
  }
  for (const i of huecos(nota.valores)) esperadas.push({ plantillaId: PLANTILLA_COMPLETAR, indice: i })
  return esperadas
}

export type FichaVista = { frente: string; reverso: string }

// Texto de la ficha tal como se pregunta y se responde.
export function verFicha(ficha: Pick<Ficha, 'plantillaId' | 'indice'>, nota: Pick<Nota, 'valores'>, tipo: TipoNota): FichaVista {
  if (ficha.plantillaId === PLANTILLA_COMPLETAR) {
    const visibles = tipo.campos.filter((c) => !c.oculto).sort((a, b) => a.orden - b.orden)
    const conHueco = visibles.filter((c) => new RegExp(`\\{\\{c${ficha.indice}::`).test(nota.valores[c.id] ?? ''))
    const armar = (revelar: boolean) =>
      conHueco.map((c) => `${c.nombre}: ${textoCompletar(nota.valores[c.id], ficha.indice, revelar)}`).join('\n')
    return { frente: armar(false), reverso: armar(true) }
  }
  const p = tipo.plantillas.find((x) => x.id === ficha.plantillaId)
  if (!p) return { frente: '(plantilla borrada)', reverso: '' }
  const valores = Object.fromEntries(Object.entries(nota.valores).map(([k, v]) => [k, sinMarcas(v)]))
  return { frente: textoPlantilla(p.frente, tipo, valores), reverso: textoPlantilla(p.reverso, tipo, valores) }
}

// Pone las fichas de la nota al día: crea las que faltan, suspende las que ya no aplican
// y reactiva las que vuelven a aplicar. Nunca borra, para no perder el historial de repaso.
export async function sincronizarFichas(notaId: Id) {
  await db.transaction('rw', db.notas, db.tiposNota, db.fichas, async () => {
    const nota = await db.notas.get(notaId)
    if (!nota) return
    const tipo = await db.tiposNota.get(nota.tipoNotaId)
    if (!tipo) return
    const actuales = await db.fichas.where('notaId').equals(notaId).toArray()
    const esperadas = nota.borrada ? [] : fichasEsperadas(nota, tipo)
    const clave = (f: { plantillaId: Id; indice: number }) => `${f.plantillaId}#${f.indice}`
    const porClave = new Map(actuales.map((f) => [clave(f), f]))
    const deseadas = new Set(esperadas.map(clave))
    const ahora = Date.now()

    const nuevas: Ficha[] = esperadas
      .filter((e) => !porClave.has(clave(e)))
      .map((e) => ({ id: ulid(), creada: ahora, editada: ahora, notaId, plantillaId: e.plantillaId, indice: e.indice, suspendida: false }))
    if (nuevas.length) await db.fichas.bulkAdd(nuevas)

    const cambios = actuales
      .filter((f) => f.suspendida === deseadas.has(clave(f)))
      .map((f) => ({ key: f.id, changes: { suspendida: !deseadas.has(clave(f)), editada: ahora } }))
    if (cambios.length) await db.fichas.bulkUpdate(cambios)
  })
}

export async function fichasDeNota(notaId: Id) {
  return (await db.fichas.where('notaId').equals(notaId).toArray()).filter((f) => !f.suspendida && !f.borrada)
}

// Al cambiar los campos de un tipo (ocultar, agregar), se ponen al día las fichas de todas sus notas.
export async function sincronizarTipo(tipoNotaId: Id) {
  const ids = await db.notas.where('tipoNotaId').equals(tipoNotaId).primaryKeys()
  for (const id of ids) await sincronizarFichas(id)
}
