import { db } from '../../core/db/db'
import { verFicha } from '../../core/db/fichas'
import { notasDeMazo } from '../../core/db/notas'
import type { Id } from '../../core/model/tipos'
import { armarCola } from '../../core/srs/repaso'

export type FichaTexto = { fichaId: Id; titulo: string; frente: string; reverso: string }

// Escuchar no califica: solo repasa de oído. Las fichas salen del repaso de hoy o de un mazo completo.
export async function fichasParaEscuchar(origen: 'hoy' | Id): Promise<FichaTexto[]> {
  const tipos = new Map((await db.tiposNota.toArray()).map((t) => [t.id, t]))
  let pares: { ficha: Parameters<typeof verFicha>[0] & { id: Id }; nota: Parameters<typeof verFicha>[1] & { tipoNotaId: Id } }[]
  if (origen === 'hoy') {
    const cola = await armarCola(Date.now())
    pares = [...cola.ahora, ...cola.luego].map((c) => ({ ficha: c.ficha, nota: c.nota }))
  } else {
    const notas = await notasDeMazo(origen)
    const porId = new Map(notas.map((n) => [n.id, n]))
    const fichas = (await db.fichas.where('notaId').anyOf([...porId.keys()]).toArray()).filter((f) => !f.suspendida)
    pares = fichas.map((f) => ({ ficha: f, nota: porId.get(f.notaId)! }))
  }
  return pares.flatMap(({ ficha, nota }) => {
    const tipo = tipos.get(nota.tipoNotaId)
    if (!tipo) return []
    const v = verFicha(ficha, nota, tipo)
    return [{ fichaId: ficha.id, titulo: v.frente.split('\n')[0], frente: v.frente, reverso: v.reverso }]
  })
}
