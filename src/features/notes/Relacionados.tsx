import { useLiveQuery } from 'dexie-react-hooks'
import { aprobarEnlace, descartarEnlace, enlacesDeNota } from '../../core/db/enlaces'
import { CAMPO_NOMBRE_FARMACO } from '../../core/db/tiposNota'
import type { Id } from '../../core/model/tipos'

// Enlaces de la nota: los confirmados como accesos directos y los sugeridos para confirmar o descartar.
export function Relacionados({ notaId }: { notaId: Id }) {
  const enlaces = useLiveQuery(() => enlacesDeNota(notaId), [notaId])
  if (!enlaces?.length) return null
  const nombre = (e: (typeof enlaces)[number]) => e.otra.valores[CAMPO_NOMBRE_FARMACO] ?? '(sin nombre)'
  const aprobados = enlaces.filter((e) => e.estado === 'aprobado')
  const propuestos = enlaces.filter((e) => e.estado === 'propuesto')
  return (
    <div className="relacionados">
      {aprobados.length > 0 && (
        <p>
          🔗 Interactúa con:{' '}
          {aprobados.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <a href={`#/mazo/${e.otra.mazoId}`} title={e.comentario}>
                {nombre(e)}
              </a>
            </span>
          ))}
        </p>
      )}
      {propuestos.map((e) => (
        <div key={e.id} className="sugerencia">
          <p>
            💡 Posible interacción con <strong>{nombre(e)}</strong>: «{e.comentario}»
          </p>
          <div className="fila">
            <button type="button" className="secundario" onClick={() => aprobarEnlace(e.id)}>
              ✓ Confirmar
            </button>
            <button type="button" className="secundario peligro" onClick={() => descartarEnlace(e.id)}>
              ✕ Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
