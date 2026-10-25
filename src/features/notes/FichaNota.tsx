import { useLiveQuery } from 'dexie-react-hooks'
import { enlacesDeNota } from '../../core/db/enlaces'
import type { Nota, TipoNota } from '../../core/model/tipos'
import { camposOrdenados } from '../../core/db/tiposNota'
import { BotonLeer } from '../podcast/BotonLeer'
import { frasesDeNota } from '../podcast/frases'
import { Fuentes } from './Fuentes'
import { Relacionados } from './Relacionados'

// Vista única de cualquier nota (fármaco, patología, caso o un tipo nuevo): se arma con los campos
// del tipo, así que un campo nuevo o renombrado aparece solo, con el mismo formato y el botón 🔊 Escuchar.
export function FichaNota({ nota, tipo, mazo }: { nota: Nota; tipo: TipoNota; mazo?: string }) {
  const [primero, ...resto] = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  const sugeridas = useLiveQuery(async () => (await enlacesDeNota(nota.id)).filter((e) => e.estado === 'propuesto').length, [nota.id])
  return (
    <details className="tarjeta ficha">
      <summary>
        <strong>{nota.valores[primero.id] ?? '(sin nombre)'}</strong>
        {mazo && <small> · {mazo}</small>}
        {!!sugeridas && <small> · 💡 {sugeridas === 1 ? '1 sugerencia' : `${sugeridas} sugerencias`}</small>}
      </summary>
      <dl>
        {resto
          .filter((c) => nota.valores[c.id])
          .map((c) => (
            <div key={c.id}>
              <dt>{c.nombre}</dt>
              <dd>
                {c.tipo === 'lista' ? (
                  <ul>
                    {nota.valores[c.id].split('\n').map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                ) : (
                  nota.valores[c.id]
                )}
              </dd>
            </div>
          ))}
      </dl>
      {nota.etiquetas.length > 0 && (
        <p className="etiquetas">
          {nota.etiquetas.map((e) => (
            <span key={e}>#{e}</span>
          ))}
        </p>
      )}
      <Fuentes notaId={nota.id} />
      <Relacionados notaId={nota.id} />
      <div className="fila">
        <BotonLeer frases={frasesDeNota(nota, tipo)} />
        <a href={`#/nota/${nota.id}`}>Editar</a>
      </div>
    </details>
  )
}
