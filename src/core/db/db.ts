import Dexie, { type EntityTable } from 'dexie'
import type {
  Ajuste,
  Archivo,
  AudioFicha,
  Carga,
  Cita,
  EstadoRepaso,
  Enlace,
  Ficha,
  Fuente,
  Materia,
  Mazo,
  Nota,
  ProveedorIA,
  RegistroRepaso,
  Semestre,
  TipoEnlace,
  TipoNota,
} from '../model/tipos'

export class BaseLaDoc extends Dexie {
  semestres!: EntityTable<Semestre, 'id'>
  materias!: EntityTable<Materia, 'id'>
  mazos!: EntityTable<Mazo, 'id'>
  tiposNota!: EntityTable<TipoNota, 'id'>
  notas!: EntityTable<Nota, 'id'>
  fichas!: EntityTable<Ficha, 'id'>
  estadosRepaso!: EntityTable<EstadoRepaso, 'fichaId'>
  registrosRepaso!: EntityTable<RegistroRepaso, 'id'>
  tiposEnlace!: EntityTable<TipoEnlace, 'id'>
  enlaces!: EntityTable<Enlace, 'id'>
  fuentes!: EntityTable<Fuente, 'id'>
  citas!: EntityTable<Cita, 'id'>
  cargas!: EntityTable<Carga, 'id'>
  archivos!: EntityTable<Archivo, 'id'>
  audiosFicha!: EntityTable<AudioFicha, 'fichaId'>
  proveedoresIA!: EntityTable<ProveedorIA, 'id'>
  ajustes!: EntityTable<Ajuste, 'clave'>

  constructor(nombre: string) {
    super(nombre)
    this.version(1).stores({
      semestres: 'id, orden',
      materias: 'id, semestreId',
      mazos: 'id, materiaId, padreId',
      tiposNota: 'id',
      notas: 'id, tipoNotaId, mazoId, materiaId, semestreId, *etiquetas, editada',
      fichas: 'id, notaId',
      estadosRepaso: 'fichaId, vence, estado',
      registrosRepaso: 'id, fichaId, fecha',
      tiposEnlace: 'id',
      enlaces: 'id, origenNotaId, destinoNotaId, tipoEnlaceId, estado',
      fuentes: 'id, tipo',
      citas: 'id, notaId, fuenteId',
      cargas: 'id, estado, creada',
      archivos: 'id',
      audiosFicha: 'fichaId',
      proveedoresIA: 'id, orden',
      ajustes: 'clave',
    })
  }
}

// Una base por cuenta (paso 17). Hasta entonces se usa la base local por defecto.
export const NOMBRE_BASE_LOCAL = 'la-doc'

export let db = new BaseLaDoc(NOMBRE_BASE_LOCAL)

// Solo para pruebas: cambia a una base nueva y vacía.
export function usarBase(nombre: string) {
  db = new BaseLaDoc(nombre)
  return db
}
