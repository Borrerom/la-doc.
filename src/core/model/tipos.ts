// Modelo de datos de La Doc (ver la propuesta técnica, sección 3).
// Todas las tablas usan ULID como id, fechas en milisegundos y borrado lógico,
// para poder restaurar respaldos y combinar cambios sin perder nada.

export type Id = string

export type Base = {
  id: Id
  creada: number
  editada: number
  borrada?: number
}

// --- Organización ---

export type Semestre = Base & { nombre: string; orden: number }

export type Materia = Base & { nombre: string; semestreId: Id; color: string }

export type Mazo = Base & { nombre: string; materiaId: Id; padreId: Id | null; orden: number }

// --- Contenido con campos flexibles ---

export type TipoCampo = 'texto' | 'lista' | 'numero'

export type Campo = {
  id: Id
  nombre: string
  tipo: TipoCampo
  orden: number
  oculto: boolean
  guiaIA: string
}

export type Plantilla = {
  id: Id
  nombre: string
  tipo: 'pregunta' | 'completar'
  frente: string
  reverso: string
}

export type TipoNota = Base & { nombre: string; campos: Campo[]; plantillas: Plantilla[] }

export type Nota = Base & {
  tipoNotaId: Id
  mazoId: Id
  materiaId: Id
  semestreId: Id
  valores: Record<Id, string>
  etiquetas: string[]
  cargaId?: Id
}

export type Ficha = Base & { notaId: Id; plantillaId: Id; indice: number; suspendida: boolean }

// --- Enlaces ---

export type TipoEnlace = Base & { nombre: string; nombreInverso: string }

export type Enlace = Base & {
  origenNotaId: Id
  destinoNotaId: Id
  tipoEnlaceId: Id
  comentario: string
  estado: 'propuesto' | 'aprobado'
  creadoPor: string
  fuenteIds: Id[]
}

// --- Fuentes ---

export type Fuente = Base & {
  tipo: 'apunte' | 'web' | 'ia'
  titulo: string
  url?: string
  proveedor?: string
  fechaConsulta?: number
  textoGuardado?: string
  // Material del teléfono (fotos, PDF o voz) del que salió.
  cargaId?: Id
}

export type Cita = Base & { notaId: Id; campoId: Id; fuenteId: Id; fragmento?: string; pagina?: number }

// --- Repaso FSRS (campos de ts-fsrs) ---

export type EstadoFsrs = 0 | 1 | 2 | 3 // nueva, aprendiendo, repaso, reaprendiendo

export type EstadoRepaso = {
  fichaId: Id
  vence: number
  estabilidad: number
  dificultad: number
  diasTranscurridos: number
  diasProgramados: number
  pasosAprendizaje: number
  repeticiones: number
  fallos: number
  estado: EstadoFsrs
  ultimoRepaso?: number
}

export type Calificacion = 1 | 2 | 3 | 4 // mal, difícil, bien, fácil

export type RegistroRepaso = {
  id: Id
  fichaId: Id
  calificacion: Calificacion
  fecha: number
  estadoAnterior: EstadoRepaso
  duracionMs: number
}

// --- Carga y sistema ---

export type EstadoCarga = 'en_cola' | 'procesando' | 'por_revisar' | 'aprobada' | 'error'

export type Carga = Base & {
  tipo: 'foto' | 'pdf' | 'voz'
  archivoIds: Id[]
  materiaId: Id
  semestreId: Id
  mazoId: Id
  estado: EstadoCarga
  intentos: number
  // Lo que Kiko le pide a la IA, por ejemplo "solo los fármacos de la página 2".
  indicacion?: string
  // Texto de la nota de voz, si ya se transcribió (así no se transcribe dos veces).
  transcripcion?: string
  proveedorUsado?: string
  borrador?: unknown
  error?: string
}

export type Archivo = { id: Id; tipoMime: string; blob: Blob; tamano: number; creada: number }

export type AudioFicha = { fichaId: Id; huella: string; blob: Blob }

export type ProveedorIA = {
  id: 'gemini' | 'groq' | 'openrouter'
  clave: string
  modelo: string
  orden: number
  activo: boolean
  agotadoHasta?: number
  prueba?: { fecha: number; ok: boolean; mensaje: string }
}

export type Ajuste = { clave: string; valor: unknown }
