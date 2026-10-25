import { camposOrdenados, TIPO_FARMACO } from '../db/tiposNota'
import type { Carga, Id, TipoNota } from '../model/tipos'

// Una nota que propone la IA: un fármaco, una patología, un caso u otro tipo de ficha.
// (Se llama "FarmacoPropuesto" y vive en "borrador.farmacos" por las cargas guardadas antes de la v0.21,
// que no traen tipoNotaId y son todas fármacos.)
export type FarmacoPropuesto = {
  tipoNotaId?: Id
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

export const tipoDePropuesto = (p: Pick<FarmacoPropuesto, 'tipoNotaId'>) => p.tipoNotaId ?? TIPO_FARMACO

function describirTipo(tipo: TipoNota) {
  const campos = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  const lineas = campos.map((c) => `  - ${c.id}: ${c.nombre}${c.tipo === 'lista' ? ' (lista)' : ''}${c.guiaIA ? ` — ${c.guiaIA}` : ''}`)
  return `- "${tipo.id}" (${tipo.nombre}). Campos (id: nombre — qué poner):\n${lineas.join('\n')}`
}

// tipos: los tipos de ficha que la IA puede llenar; principal: el que más se usa en la materia.
export function armarInstrucciones(
  tipos: TipoNota[],
  contexto: { materia: string; tema: string; tipoCarga: Carga['tipo']; principal?: TipoNota },
) {
  const nombres = tipos.map((t) => t.nombre.toLowerCase()).join(', ')
  return `Eres el asistente de estudio de una estudiante de Medicina en Venezuela. Vas a recibir ${QUE_ES[contexto.tipoCarga]} de la materia "${contexto.materia}", tema "${contexto.tema}".

Tu tarea: encontrar cada elemento del material que sea de uno de estos tipos de ficha (${nombres}), decidir de qué tipo es y llenar su ficha SOLO con lo que dice el material.${contexto.principal ? `\nEn esta materia lo más común es: ${contexto.principal.nombre.toLowerCase()}.` : ''}

Cómo reconocer cada tipo:
- Fármaco: un medicamento (por ejemplo, amoxicilina): mecanismo, dosis, efectos.
- Patología: una enfermedad (por ejemplo, asma): causas, síntomas, diagnóstico, tratamiento.
- Caso clínico: un paciente concreto (edad, síntomas, hallazgos) con preguntas para resolver.
- Un caso que nombra fármacos o enfermedades es un solo caso: no crees fichas aparte de lo que solo se menciona.

Reglas:
- No inventes ni completes con tu propio conocimiento. Si un dato no aparece en el material, deja ese campo vacío ("").
- Para cada campo que llenes, copia en "evidencia" la frase del material de donde sale (máximo 200 caracteres).
- Escribe en español, corrigiendo solo errores evidentes de ortografía. En los campos de lista, un elemento por línea.
- En notas de voz, cuida la ortografía de los nombres de fármacos y enfermedades.
- Usa solo los ids de campo del tipo que elegiste.

Tipos de ficha:
${tipos.map(describirTipo).join('\n')}

Responde solo con JSON con esta forma:
{"notas":[{"tipo":"<id del tipo>","campos":{"<id>":"..."},"evidencia":{"<id>":"..."},"pagina":1}]}
"pagina" es el número de foto o de página del PDF donde está, empezando en 1. Omítelo en notas de voz.
Si no hay nada de estos tipos en el material, responde {"notas":[]}.`
}

function aTexto(v: unknown): string {
  if (Array.isArray(v)) return v.map(aTexto).filter(Boolean).join('\n')
  if (typeof v === 'string') return v.replace(/\r\n/g, '\n').trim()
  if (typeof v === 'number') return String(v)
  return ''
}

// El tipo que dijo la IA (por id o por nombre) o, si no lo dijo, el tipo con más campos en común.
function elegirTipo(dicho: unknown, campos: Record<string, unknown>, tipos: TipoNota[]): TipoNota | undefined {
  if (typeof dicho === 'string') {
    const d = dicho.trim().toLowerCase()
    const porNombre = tipos.find((t) => t.id === d || t.nombre.toLowerCase() === d || t.nombre.toLowerCase().startsWith(d))
    if (porNombre) return porNombre
  }
  const claves = Object.keys(campos)
  const puntaje = (t: TipoNota) => claves.filter((k) => t.campos.some((c) => c.id === k)).length
  const mejor = [...tipos].sort((a, b) => puntaje(b) - puntaje(a))[0]
  return mejor && puntaje(mejor) > 0 ? mejor : undefined
}

// Lee la respuesta de la IA y se queda solo con los campos que existen en la ficha de cada tipo.
export function interpretarRespuesta(texto: string, tipos: TipoNota[]): FarmacoPropuesto[] {
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
  const objeto = datos as { notas?: unknown; farmacos?: unknown }
  const lista = Array.isArray(datos) ? datos : (objeto?.notas ?? objeto?.farmacos)
  if (!Array.isArray(lista)) throw new Error('La respuesta de la IA no tiene el formato esperado.')

  const propuestos: FarmacoPropuesto[] = []
  for (const f of lista) {
    if (!f || typeof f !== 'object') continue
    const crudo = f as { tipo?: unknown; campos?: Record<string, unknown>; evidencia?: Record<string, unknown>; pagina?: unknown }
    const tipo = elegirTipo(crudo.tipo, crudo.campos ?? {}, tipos)
    if (!tipo) continue
    const ids = new Set(tipo.campos.map((c) => c.id))
    const primero = camposOrdenados(tipo.campos)[0].id
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
    propuestos.push({
      tipoNotaId: tipo.id,
      valores,
      evidencia,
      estado: 'pendiente',
      ...(Number.isInteger(pagina) && pagina > 0 ? { pagina } : {}),
    })
  }
  return propuestos
}
