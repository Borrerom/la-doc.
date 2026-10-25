import { ulid } from 'ulid'
import type { Campo, Id, Plantilla, TipoCampo, TipoNota } from '../model/tipos'
import { db } from './db'

// Ids fijos para los tipos y campos de fábrica: así coinciden entre teléfonos y respaldos.
export const TIPO_FARMACO = 'tipo-farmaco'
export const CAMPO_NOMBRE_FARMACO = 'farmaco-nombre'

type CampoInicial = [id: string, nombre: string, tipo: TipoCampo, guiaIA: string]

const CAMPOS_FARMACO: CampoInicial[] = [
  [CAMPO_NOMBRE_FARMACO, 'Nombre genérico y comercial', 'texto', 'Nombre genérico (DCI) y nombres comerciales comunes en Venezuela.'],
  ['farmaco-grupo', 'Grupo o familia', 'texto', 'Grupo farmacológico y subgrupo.'],
  ['farmaco-mecanismo', 'Mecanismo de acción', 'texto', 'Cómo actúa, en una o dos frases.'],
  ['farmaco-indicaciones', 'Indicaciones', 'lista', 'Enfermedades o situaciones en que se usa.'],
  ['farmaco-contraindicaciones', 'Contraindicaciones', 'lista', 'Situaciones o enfermedades del paciente en que no se debe usar.'],
  ['farmaco-efectos', 'Efectos secundarios', 'lista', 'Efectos adversos, primero los frecuentes y luego los graves.'],
  ['farmaco-interacciones', 'Interacciones con otros fármacos', 'lista', 'Fármacos con los que interactúa y el efecto de la interacción.'],
  ['farmaco-dosis', 'Dosis, y ajustes por edad o peso', 'texto', 'Dosis habitual en adultos y ajustes por edad, peso o función renal.'],
]

// Pregunta de fábrica para un campo: "Contraindicaciones de Amoxicilina".
// Las plantillas usan ids de campo, así renombrar un campo no rompe las fichas.
export function plantillaParaCampo(campoId: Id, campoNombreId: Id): Plantilla {
  return {
    id: `plantilla-${campoId}`,
    nombre: `Pregunta: {{nombre:${campoId}}}`,
    tipo: 'pregunta',
    frente: `{{nombre:${campoId}}} de {{${campoNombreId}}}`,
    reverso: `{{${campoId}}}`,
  }
}

export function tipoFarmacoDeFabrica(ahora = Date.now()): TipoNota {
  const campos: Campo[] = CAMPOS_FARMACO.map(([id, nombre, tipo, guiaIA], i) => ({
    id,
    nombre,
    tipo,
    guiaIA,
    orden: i + 1,
    oculto: false,
  }))
  return {
    id: TIPO_FARMACO,
    nombre: 'Fármaco',
    creada: ahora,
    editada: ahora,
    campos,
    plantillas: campos.filter((c) => c.id !== CAMPO_NOMBRE_FARMACO).map((c) => plantillaParaCampo(c.id, CAMPO_NOMBRE_FARMACO)),
  }
}

// Crea los tipos de fábrica que falten. Se llama al abrir la app.
export async function asegurarTiposDeFabrica() {
  if (!(await db.tiposNota.get(TIPO_FARMACO))) await db.tiposNota.add(tipoFarmacoDeFabrica())
}

export async function listarTiposNota() {
  return (await db.tiposNota.toArray()).filter((t) => !t.borrada)
}

// Texto de una plantilla con los nombres de campo actuales: "{{nombre:x}}" → "Contraindicaciones".
export function textoPlantilla(texto: string, tipo: TipoNota, valores?: Record<Id, string>) {
  const porId = new Map(tipo.campos.map((c) => [c.id, c]))
  return texto.replace(/\{\{(nombre:)?([^}]+)\}\}/g, (_, esNombre, id: string) => {
    if (esNombre) return porId.get(id)?.nombre ?? '(campo borrado)'
    return valores ? (valores[id] ?? '') : `[${porId.get(id)?.nombre ?? '?'}]`
  })
}

// --- Edición de campos (funciones puras que devuelven el tipo modificado) ---

const limpiar = (nombre: string) => {
  const n = nombre.trim().replace(/\s+/g, ' ')
  if (!n) throw new Error('El nombre no puede estar vacío')
  return n
}

function ordenados(campos: Campo[]) {
  return [...campos].sort((a, b) => a.orden - b.orden)
}

export function agregarCampo(tipo: TipoNota, nombre: string, campoNombreId: Id, conPregunta = true): TipoNota {
  const n = limpiar(nombre)
  if (tipo.campos.some((c) => c.nombre.toLowerCase() === n.toLowerCase())) throw new Error(`Ya existe el campo "${n}"`)
  const campo: Campo = { id: ulid(), nombre: n, tipo: 'texto', orden: tipo.campos.length + 1, oculto: false, guiaIA: '' }
  return {
    ...tipo,
    campos: [...tipo.campos, campo],
    plantillas: conPregunta ? [...tipo.plantillas, plantillaParaCampo(campo.id, campoNombreId)] : tipo.plantillas,
  }
}

export function cambiarCampo(tipo: TipoNota, campoId: Id, cambios: Partial<Pick<Campo, 'nombre' | 'oculto' | 'guiaIA' | 'tipo'>>): TipoNota {
  if (cambios.nombre !== undefined) {
    const n = limpiar(cambios.nombre)
    if (tipo.campos.some((c) => c.id !== campoId && c.nombre.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Ya existe el campo "${n}"`)
    }
    cambios = { ...cambios, nombre: n }
  }
  return { ...tipo, campos: tipo.campos.map((c) => (c.id === campoId ? { ...c, ...cambios } : c)) }
}

export function moverCampo(tipo: TipoNota, campoId: Id, direccion: -1 | 1): TipoNota {
  const lista = ordenados(tipo.campos)
  const i = lista.findIndex((c) => c.id === campoId)
  const j = i + direccion
  // El primer campo nombra la nota (por ejemplo, el fármaco) y siempre queda primero.
  if (i <= 0 || j <= 0 || j >= lista.length) return tipo
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return { ...tipo, campos: lista.map((c, k) => ({ ...c, orden: k + 1 })) }
}

export async function guardarTipoNota(tipo: TipoNota) {
  await db.tiposNota.put({ ...tipo, editada: Date.now() })
}

export { ordenados as camposOrdenados }
