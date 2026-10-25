import { useLiveQuery } from 'dexie-react-hooks'
import { fuentesDeNota } from '../../core/db/ejemplos'
import type { Id } from '../../core/model/tipos'

// Muestra de dónde salen los datos de la nota. Sin fuente citada, avisa que hay que validarlos.
export function Fuentes({ notaId }: { notaId: Id }) {
  const fuentes = useLiveQuery(() => fuentesDeNota(notaId), [notaId])
  if (!fuentes || fuentes.length === 0) return null
  return (
    <p className="fuentes">
      Fuente:{' '}
      {fuentes.map((f, i) => (
        <span key={f.id}>
          {i > 0 && ' · '}
          {f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer">
              {f.titulo}
            </a>
          ) : (
            f.titulo
          )}
        </span>
      ))}
    </p>
  )
}
