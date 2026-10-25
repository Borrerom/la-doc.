import { camposOrdenados } from '../db/tiposNota'
import type { Carga, Id, TipoNota } from '../model/tipos'

export type FarmacoPropuesto = {
  valores: Record<Id, string>
  // Frase del material de donde sale cada dato.
  evidencia: Record<Id, string>
  pagina?: number
  estado: 'pendiente' | 'aprobado' | 'descartado'
  notaId?: Id
}

export type Borrador = {
  farmacos: FarmacoPropuesto[]
  proveedor: string
  modelo: string
  fecha: number
  fuenteId?: Id
}

const QUE_ES: Record<Carga['tipo'], string> = {
  foto: 'fotos de apuntes o de un libro (cada foto es una página)',
  pdf: 'un PDF',
  voz: 'una nota de voz',
}

export function armarInstrucciones(tipo: TipoNota, contexto: { materia: string; tema: string; tipoCarga: Carga['tipo'] }) {
  const campos = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  const lineas = campos.map(
    (c) => `- ${c.id}: ${c.nombre}${c.tipo === 'lista' ? ' (lista)' : ''}${c.guiaIA ? ` — ${c.guiaIA}` : ''}`,
  )
  return `Eres el asistente de estudio de una estudiante de Medicina en Venezuela. Vas a recibir ${QUE_ES[contexto.tipoCarga]} de la materia "${contexto.materia}", tema "${contexto.tema}".

Tu tarea: encontrar cada fármaco que aparezca en el material y llenar su ficha SOLO con lo que dice el material.

Reglas:
- No inventes ni completes con tu propio conocimiento. Si un dato no aparece en el material, deja ese campo vacío ("").
- Para cada campo que llenes, copia en "evidencia" la frase del material de donde sale (máximo 200 caracteres).
- Escribe en español, corrigiendo solo errores evidentes de ortografía. En los campos de lista, un elemento por línea.
- En notas de voz, cuida la ortografía de los nombres de fármacos.

Campos de la ficha (id: nombre — qué poner):
${lineas.join('\n')}

Responde solo con JSON con esta forma:
{"farmacos":[{"campos":{"<id>":"..."},"evidencia":{"<id>":"..."},"pagina":1}]}
"pagina" es el número de foto o de página del PDF donde está el fármaco, empezando en 1. Omítelo en notas de voz.
Si no hay ningún fármaco en el material, responde {"farmacos":[]}.`
}

function aTexto(v: unknown): string {
  if (Array.isArray(v)) return v.map(aTexto).filter(Boolean).join('\n')
  if (typeof v === 'string') return v.replace(/\r\n/g, '\n').trim()
  if (typeof v === 'number') return String(v)
  return ''
}

// Lee la respuesta de la IA y se queda solo con los campos que existen en la ficha.
export function interpretarRespuesta(texto: string, tipo: TipoNota): FarmacoPropuesto[] {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  let datos: unknown
  try {
    datos = JSON.parse(limpio)
  } catch {
    const inicio = limpio.indexOf('{')
    const fin = limpio.lastIndexOf('}')
    if (inicio < 0 || fin <= inicio) throw new Error('La respuesta de la IA no tiene el formato esperado.')
    datos = JSON.parse(limpio.slice(inicio, fin + 1))
  }
  const lista = Array.isArray(datos) ? datos : (datos as { farmacos?: unknown })?.farmacos
  if (!Array.isArray(lista)) throw new Error('La respuesta de la IA no tiene el formato esperado.')

  const ids = new Set(tipo.campos.map((c) => c.id))
  const primero = camposOrdenados(tipo.campos)[0].id
  const farmacos: FarmacoPropuesto[] = []
  for (const f of lista) {
    if (!f || typeof f !== 'object') continue
    const crudo = f as { campos?: Record<string, unknown>; evidencia?: Record<string, unknown>; pagina?: unknown }
    const valores: Record<Id, string> = {}
    const evidencia: Record<Id, string> = {}
    for (const [id, v] of Object.entries(crudo.campos ?? {})) {
      const t = aTexto(v)
      if (ids.has(id) && t) valores[id] = t
    }
    for (const [id, v] of Object.entries(crudo.evidencia ?? {})) {
      const t = aTexto(v).slice(0, 300)
      if (valores[id] && t) evidencia[id] = t
    }
    if (!valores[primero]) continue
    const pagina = Number(crudo.pagina)
    farmacos.push({
      valores,
      evidencia,
      estado: 'pendiente',
      ...(Number.isInteger(pagina) && pagina > 0 ? { pagina } : {}),
    })
  }
  return farmacos
}
