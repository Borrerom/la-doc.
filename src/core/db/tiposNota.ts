import { ulid } from 'ulid'
import type { Campo, Id, Plantilla, TipoCampo, TipoNota } from '../model/tipos'
import { db } from './db'
import { sincronizarTipo } from './fichas'

// Ids fijos para los tipos y campos de fábrica: así coinciden entre teléfonos y respaldos.
export const TIPO_FARMACO = 'tipo-farmaco'
export const CAMPO_NOMBRE_FARMACO = 'farmaco-nombre'

type CampoInicial = [id: string, nombre: string, tipo: TipoCampo, guiaIA: string]

const CAMPOS_FARMACO: CampoInicial[] = [
  [CAMPO_NOMBRE_FARMACO, 'Nombre genérico y comercial', 'texto', 'Nombre genérico (DCI) y nombres comerciales comunes en Venezuela.'],
  ['farmaco-grupo', 'Grupo o familia', 'texto', 'Grupo farmacológico y subgrupo.'],
  ['farmaco-via', 'Vía de administración', 'texto', 'Vías y formas en que se administra (oral, intravenosa…), y si se toma con o sin alimentos.'],
  ['farmaco-mecanismo', 'Mecanismo de acción', 'texto', 'Cómo actúa, en una o dos frases.'],
  [
    'farmaco-adme',
    'Farmacocinética (ADME)',
    'lista',
    'Una línea para cada etapa: Absorción (biodisponibilidad, pico), Distribución (unión a proteínas), Metabolismo (dónde, metabolitos activos) y Excreción (vía, vida media).',
  ],
  ['farmaco-indicaciones', 'Indicaciones', 'lista', 'Enfermedades o situaciones en que se usa.'],
  ['farmaco-contraindicaciones', 'Contraindicaciones', 'lista', 'Situaciones o enfermedades del paciente en que no se debe usar.'],
  ['farmaco-efectos', 'Efectos secundarios', 'lista', 'Efectos adversos, primero los frecuentes y luego los graves.'],
  ['farmaco-interacciones', 'Interacciones con otros fármacos', 'lista', 'Fármacos con los que interactúa y el efecto de la interacción.'],
  ['farmaco-dosis', 'Dosis, y ajustes por edad o peso', 'texto', 'Dosis habitual en adultos y ajustes por edad, peso o función renal.'],
]

export const TIPO_PATOLOGIA = 'tipo-patologia'
export const CAMPO_NOMBRE_PATOLOGIA = 'patologia-nombre'

const CAMPOS_PATOLOGIA: CampoInicial[] = [
  [CAMPO_NOMBRE_PATOLOGIA, 'Nombre', 'texto', 'Nombre de la enfermedad y sinónimos frecuentes.'],
  ['patologia-definicion', 'Definición breve', 'texto', 'Qué es, en una o dos frases.'],
  ['patologia-causas', 'Causas y factores de riesgo', 'lista', 'Causas y factores de riesgo, uno por línea.'],
  ['patologia-fisiopatologia', 'Fisiopatología', 'texto', 'Mecanismo de la enfermedad: qué falla en el cuerpo y por qué.'],
  ['patologia-signos', 'Signos y síntomas', 'lista', 'Signos y síntomas, primero los más frecuentes.'],
  ['patologia-diagnostico', 'Diagnóstico: exámenes y hallazgos', 'lista', 'Exámenes y hallazgos que confirman el diagnóstico.'],
  ['patologia-tratamiento', 'Tratamiento', 'lista', 'Fármacos y medidas de tratamiento, con el nombre genérico de cada fármaco.'],
  ['patologia-complicaciones', 'Complicaciones', 'lista', 'Complicaciones posibles.'],
]

export const TIPO_CASO = 'tipo-caso'
export const CAMPO_NOMBRE_CASO = 'caso-titulo'

const CAMPOS_CASO: CampoInicial[] = [
  [CAMPO_NOMBRE_CASO, 'Título del caso', 'texto', 'Título corto que no revele el diagnóstico, por ejemplo "Mujer de 58 años con cefalea".'],
  ['caso-paciente', 'Datos del paciente', 'texto', 'Edad, sexo, peso y antecedentes.'],
  ['caso-consulta', 'Motivo de consulta y síntomas', 'texto', 'Por qué consulta y qué síntomas cuenta.'],
  ['caso-hallazgos', 'Hallazgos', 'lista', 'Examen físico y laboratorio, uno por línea.'],
  ['caso-preguntas', 'Preguntas', 'lista', 'Qué se le pregunta a la estudiante: diagnóstico probable, fármaco a indicar, riesgos.'],
  ['caso-respuesta', 'Respuesta razonada', 'texto', 'Respuesta explicada: diagnóstico, tratamiento y por qué, con riesgos para este paciente.'],
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

// El caso se repasa entero: frente con el paciente y las preguntas, reverso con la respuesta razonada.
const PLANTILLA_CASO: Plantilla = {
  id: 'plantilla-caso',
  nombre: 'Caso completo',
  tipo: 'pregunta',
  frente: [
    '{{caso-titulo}}',
    '{{nombre:caso-paciente}}: {{caso-paciente}}',
    '{{nombre:caso-consulta}}: {{caso-consulta}}',
    '{{nombre:caso-hallazgos}}: {{caso-hallazgos}}',
    '{{nombre:caso-preguntas}}: {{caso-preguntas}}',
  ].join('\n'),
  reverso: '{{caso-respuesta}}',
}

function campos(iniciales: CampoInicial[]): Campo[] {
  return iniciales.map(([id, nombre, tipo, guiaIA], i) => ({ id, nombre, tipo, guiaIA, orden: i + 1, oculto: false }))
}

function tipoDeFabrica(id: Id, nombre: string, iniciales: CampoInicial[], campoNombreId: Id, ahora: number, plantillas?: Plantilla[]): TipoNota {
  const lista = campos(iniciales)
  return {
    id,
    nombre,
    creada: ahora,
    editada: ahora,
    campos: lista,
    plantillas: plantillas ?? lista.filter((c) => c.id !== campoNombreId).map((c) => plantillaParaCampo(c.id, campoNombreId)),
  }
}

export function tipoFarmacoDeFabrica(ahora = Date.now()): TipoNota {
  return tipoDeFabrica(TIPO_FARMACO, 'Fármaco', CAMPOS_FARMACO, CAMPO_NOMBRE_FARMACO, ahora)
}

export function tipoPatologiaDeFabrica(ahora = Date.now()): TipoNota {
  return tipoDeFabrica(TIPO_PATOLOGIA, 'Patología', CAMPOS_PATOLOGIA, CAMPO_NOMBRE_PATOLOGIA, ahora)
}

export function tipoCasoDeFabrica(ahora = Date.now()): TipoNota {
  return tipoDeFabrica(TIPO_CASO, 'Caso clínico', CAMPOS_CASO, CAMPO_NOMBRE_CASO, ahora, [PLANTILLA_CASO])
}

const DE_FABRICA = [tipoFarmacoDeFabrica, tipoPatologiaDeFabrica, tipoCasoDeFabrica]

// Campos de fábrica que llegaron en una versión posterior: se insertan en su lugar (después del
// campo que los precede de fábrica) sin tocar los valores ni los campos que Desi agregó o renombró.
export function completarCamposDeFabrica(guardado: TipoNota, fabrica: TipoNota): TipoNota | null {
  const tiene = new Set(guardado.campos.map((c) => c.id))
  const faltan = ordenados(fabrica.campos).filter((c) => !tiene.has(c.id))
  if (faltan.length === 0) return null
  let lista = ordenados(guardado.campos)
  const deFabrica = ordenados(fabrica.campos)
  for (const campo of faltan) {
    const previo = deFabrica[deFabrica.findIndex((c) => c.id === campo.id) - 1]
    const i = lista.findIndex((c) => c.id === previo?.id)
    lista = [...lista.slice(0, i + 1), campo, ...lista.slice(i + 1)]
  }
  const plantillas = [
    ...guardado.plantillas,
    ...fabrica.plantillas.filter((p) => !guardado.plantillas.some((x) => x.id === p.id) && faltan.some((c) => p.reverso.includes(c.id))),
  ]
  return { ...guardado, campos: lista.map((c, k) => ({ ...c, orden: k + 1 })), plantillas }
}

// Crea los tipos de fábrica que falten y les suma los campos de fábrica nuevos. Se llama al abrir la app.
export async function asegurarTiposDeFabrica() {
  for (const crear of DE_FABRICA) {
    const tipo = crear()
    const guardado = await db.tiposNota.get(tipo.id)
    if (!guardado) {
      await db.tiposNota.add(tipo)
      continue
    }
    const completo = completarCamposDeFabrica(guardado, tipo)
    if (completo) await db.tiposNota.put({ ...completo, editada: Date.now() })
  }
}

// Cómo se nombra cada tipo en los textos: "3 fármacos", "+ Nueva patología".
type Nombres = { uno: string; varios: string; nuevo: string; emoji: string }
const NOMBRES: Record<Id, Nombres> = {
  [TIPO_FARMACO]: { uno: 'fármaco', varios: 'fármacos', nuevo: 'Nuevo fármaco', emoji: '💊' },
  [TIPO_PATOLOGIA]: { uno: 'patología', varios: 'patologías', nuevo: 'Nueva patología', emoji: '🩺' },
  [TIPO_CASO]: { uno: 'caso', varios: 'casos', nuevo: 'Nuevo caso clínico', emoji: '🧑‍⚕️' },
}

export function nombresDeTipo(tipo: Pick<TipoNota, 'id' | 'nombre'>): Nombres {
  const n = tipo.nombre.toLowerCase()
  return NOMBRES[tipo.id] ?? { uno: n, varios: /[aeiou]$/.test(n) ? `${n}s` : `${n}es`, nuevo: `Nuevo: ${n}`, emoji: '📝' }
}

// Orden de los tipos en pantalla: los de fábrica primero.
export function ordenTipos(a: Pick<TipoNota, 'id' | 'nombre'>, b: Pick<TipoNota, 'id' | 'nombre'>) {
  const ia = DE_FABRICA.findIndex((c) => c(0).id === a.id)
  const ib = DE_FABRICA.findIndex((c) => c(0).id === b.id)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.nombre.localeCompare(b.nombre, 'es')
}

export async function listarTiposNota() {
  return (await db.tiposNota.toArray()).filter((t) => !t.borrada).sort(ordenTipos)
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

// Aplica un cambio sobre la versión guardada (no sobre la que muestra la pantalla),
// para que dos toques seguidos no se pisen.
export async function cambiarTipoNota(id: Id, cambio: (tipo: TipoNota) => TipoNota) {
  await db.transaction('rw', db.tiposNota, async () => {
    const actual = await db.tiposNota.get(id)
    if (!actual) throw new Error('Este tipo de ficha no existe')
    await db.tiposNota.put({ ...cambio(actual), editada: Date.now() })
  })
  await sincronizarTipo(id)
}

export { ordenados as camposOrdenados }
