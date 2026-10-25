import { ulid } from 'ulid'
import type { Id, Nota, TipoNota } from '../model/tipos'
import { db } from './db'
import { sincronizarFichas } from './fichas'
import { descendientes, listarMazos } from './organizacion'
import { camposOrdenados } from './tiposNota'

const vivo = (n: Nota) => n.borrada === undefined

export function limpiarValores(valores: Record<Id, string>) {
  const limpios: Record<Id, string> = {}
  for (const [k, v] of Object.entries(valores)) {
    const t = v.replace(/\r\n/g, '\n').trim()
    if (t) limpios[k] = t
  }
  return limpios
}

export function limpiarEtiquetas(texto: string) {
  const vistas = new Set<string>()
  return texto
    .split(',')
    .map((e) => e.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((e) => e && !vistas.has(e) && vistas.add(e))
}

// El título de una nota es el valor de su primer campo (por ejemplo, el nombre del fármaco).
export function tituloNota(nota: Pick<Nota, 'valores'>, tipo: TipoNota) {
  const primero = camposOrdenados(tipo.campos)[0]
  return nota.valores[primero.id]?.split('\n')[0] || '(sin nombre)'
}

export async function guardarNota(datos: {
  id?: Id
  tipoNotaId: Id
  mazoId: Id
  valores: Record<Id, string>
  etiquetas: string[]
}): Promise<Nota> {
  const mazo = await db.mazos.get(datos.mazoId)
  if (!mazo) throw new Error('El mazo no existe')
  const materia = await db.materias.get(mazo.materiaId)
  if (!materia) throw new Error('La materia no existe')
  const tipo = await db.tiposNota.get(datos.tipoNotaId)
  if (!tipo) throw new Error('El tipo de ficha no existe')

  const valores = limpiarValores(datos.valores)
  if (!valores[camposOrdenados(tipo.campos)[0].id]) {
    throw new Error(`Falta "${camposOrdenados(tipo.campos)[0].nombre}"`)
  }

  const ahora = Date.now()
  const anterior = datos.id ? await db.notas.get(datos.id) : undefined
  const nota: Nota = {
    ...(anterior ?? { id: ulid(), creada: ahora }),
    tipoNotaId: datos.tipoNotaId,
    mazoId: mazo.id,
    materiaId: materia.id,
    semestreId: materia.semestreId,
    valores,
    etiquetas: datos.etiquetas,
    editada: ahora,
  }
  await db.notas.put(nota)
  await sincronizarFichas(nota.id)
  return nota
}

export async function borrarNota(id: Id) {
  const ahora = Date.now()
  await db.notas.update(id, { borrada: ahora, editada: ahora })
  await sincronizarFichas(id)
}

// Notas del mazo y de todos sus submazos.
export async function notasDeMazo(mazoId: Id) {
  const mazo = await db.mazos.get(mazoId)
  if (!mazo) return []
  const ids = [mazoId, ...descendientes(await listarMazos(mazo.materiaId), mazoId).map((m) => m.id)]
  return (await db.notas.where('mazoId').anyOf(ids).toArray()).filter(vivo)
}
