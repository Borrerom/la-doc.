import MiniSearch from 'minisearch'
import { db } from '../db/db'
import { tituloNota } from '../db/notas'
import type { Id, Nota, TipoNota } from '../model/tipos'

// "Amoxicilina" y "amoxicilína" son lo mismo para el buscador.
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const quitarMarcas = (t: string) => t.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1')

type Documento = { id: Id; titulo: string; contenido: string; etiquetas: string }

export type Resultado = {
  notaId: Id
  titulo: string
  mazoId: Id
  // Campo donde aparece la búsqueda y un fragmento de su texto.
  campo?: string
  fragmento?: string
}

export function crearIndice(notas: Nota[], tipos: Map<Id, TipoNota>) {
  const indice = new MiniSearch<Documento>({
    fields: ['titulo', 'contenido', 'etiquetas'],
    storeFields: ['titulo'],
    processTerm: (t) => normalizar(t),
    searchOptions: { boost: { titulo: 3, etiquetas: 2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  })
  indice.addAll(
    notas.flatMap((n) => {
      const tipo = tipos.get(n.tipoNotaId)
      if (!tipo) return []
      return [
        {
          id: n.id,
          titulo: tituloNota(n, tipo),
          contenido: Object.values(n.valores).map(quitarMarcas).join('\n'),
          etiquetas: n.etiquetas.join(' '),
        },
      ]
    }),
  )
  return indice
}

// Busca el campo donde aparece algún término, para mostrar de dónde sale el resultado.
function fragmento(nota: Nota, tipo: TipoNota, terminos: string[]) {
  const visibles = [...tipo.campos].sort((a, b) => a.orden - b.orden).filter((c) => !c.oculto)
  for (const c of visibles.slice(1)) {
    const texto = quitarMarcas(nota.valores[c.id] ?? '')
    const plano = normalizar(texto)
    const pos = Math.min(...terminos.map((t) => plano.indexOf(t)).filter((i) => i >= 0))
    if (Number.isFinite(pos)) {
      const inicio = Math.max(0, pos - 30)
      const corte = texto.slice(inicio, pos + 70).replace(/\n/g, ' · ')
      return { campo: c.nombre, fragmento: `${inicio > 0 ? '…' : ''}${corte}${pos + 70 < texto.length ? '…' : ''}` }
    }
  }
  return {}
}

export async function buscar(consulta: string, limite = 30): Promise<Resultado[]> {
  if (!consulta.trim()) return []
  const notas = (await db.notas.toArray()).filter((n) => !n.borrada)
  const tipos = new Map((await db.tiposNota.toArray()).map((t) => [t.id, t]))
  const porId = new Map(notas.map((n) => [n.id, n]))
  const resultados = crearIndice(notas, tipos).search(consulta).slice(0, limite)
  return resultados.map((r) => {
    const nota = porId.get(r.id as Id)!
    return {
      notaId: nota.id,
      titulo: r.titulo as string,
      mazoId: nota.mazoId,
      ...fragmento(nota, tipos.get(nota.tipoNotaId)!, r.terms.map(normalizar)),
    }
  })
}
