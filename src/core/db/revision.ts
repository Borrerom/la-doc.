import { ulid } from 'ulid'
import type { Borrador } from '../ai/extraer'
import type { Carga, Fuente, Id } from '../model/tipos'
import { db } from './db'
import { guardarNota } from './notas'
import { normalizar } from '../search/buscador'
import { camposOrdenados, TIPO_FARMACO } from './tiposNota'

const TITULO: Record<Carga['tipo'], string> = { foto: 'Tus fotos', pdf: 'Tu PDF', voz: 'Tu nota de voz' }

async function fuenteDeCarga(carga: Carga, borrador: Borrador): Promise<Id> {
  if (borrador.fuenteId && (await db.fuentes.get(borrador.fuenteId))) return borrador.fuenteId
  const ahora = Date.now()
  const fecha = new Date(carga.creada).toLocaleDateString('es-VE', { dateStyle: 'medium' })
  const fuente: Fuente = {
    id: ulid(),
    creada: ahora,
    editada: ahora,
    tipo: 'apunte',
    titulo: `${TITULO[carga.tipo]} del ${fecha} (leído por ${borrador.proveedor})`,
    proveedor: `${borrador.proveedor} · ${borrador.modelo}`,
    fechaConsulta: borrador.fecha,
    cargaId: carga.id,
  }
  await db.fuentes.add(fuente)
  return fuente.id
}

async function terminarSiCorresponde(cargaId: Id, borrador: Borrador) {
  const quedan = borrador.farmacos.some((f) => f.estado === 'pendiente')
  await db.cargas.update(cargaId, { borrador, editada: Date.now(), ...(quedan ? {} : { estado: 'aprobada' as const }) })
}

async function cargaEnRevision(cargaId: Id) {
  const carga = await db.cargas.get(cargaId)
  const borrador = carga?.borrador as Borrador | undefined
  if (!carga || !borrador) throw new Error('La carga ya no existe')
  return { carga, borrador }
}

// Guarda en el mazo el fármaco revisado, con la cita del material en cada dato que trajo la IA.
export async function aprobarFarmaco(cargaId: Id, indice: number, valores: Record<Id, string>) {
  const { carga, borrador } = await cargaEnRevision(cargaId)
  const propuesto = borrador.farmacos[indice]
  if (!propuesto || propuesto.estado !== 'pendiente') return
  const nota = await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId: carga.mazoId, valores, etiquetas: [] })
  await db.notas.update(nota.id, { cargaId })
  const fuenteId = await fuenteDeCarga(carga, borrador)
  const ahora = Date.now()
  // Solo se cita el material en los datos que trajo la IA; lo que Kiko escribe a mano no lleva esa fuente.
  await db.citas.bulkAdd(
    Object.keys(nota.valores).filter((campoId) => propuesto.valores[campoId]).map((campoId) => ({
      id: ulid(),
      creada: ahora,
      editada: ahora,
      notaId: nota.id,
      campoId,
      fuenteId,
      ...(propuesto.evidencia[campoId] ? { fragmento: propuesto.evidencia[campoId] } : {}),
      ...(propuesto.pagina ? { pagina: propuesto.pagina } : {}),
    })),
  )
  borrador.fuenteId = fuenteId
  borrador.farmacos[indice] = { ...propuesto, valores: nota.valores, estado: 'aprobado', notaId: nota.id }
  await terminarSiCorresponde(cargaId, borrador)
  return { ...nota, cargaId }
}

export async function descartarFarmaco(cargaId: Id, indice: number) {
  const { borrador } = await cargaEnRevision(cargaId)
  if (borrador.farmacos[indice]?.estado !== 'pendiente') return
  borrador.farmacos[indice] = { ...borrador.farmacos[indice], estado: 'descartado' }
  await terminarSiCorresponde(cargaId, borrador)
}

// Fármacos que ya están en la materia con el mismo nombre genérico (la primera palabra).
export async function posiblesDuplicados(materiaId: Id, nombre: string) {
  const tipo = await db.tiposNota.get(TIPO_FARMACO)
  if (!tipo) return []
  const campoNombre = camposOrdenados(tipo.campos)[0].id
  const clave = normalizar(nombre).split(/[\s(,/]+/)[0]
  if (!clave) return []
  const notas = await db.notas.where('materiaId').equals(materiaId).toArray()
  return notas.filter((n) => !n.borrada && normalizar(n.valores[campoNombre] ?? '').split(/[\s(,/]+/)[0] === clave)
}
