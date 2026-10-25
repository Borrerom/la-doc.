import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db } from '../../core/db/db'
import { borrarNota, guardarNota, limpiarEtiquetas } from '../../core/db/notas'
import { TIPO_FARMACO, camposOrdenados } from '../../core/db/tiposNota'
import type { Id } from '../../core/model/tipos'

// Crea una nota nueva en un mazo (notaId vacío) o edita una existente.
export function EditorNota({ notaId, mazoId }: { notaId?: Id; mazoId?: Id }) {
  const nota = useLiveQuery(async () => (notaId ? ((await db.notas.get(notaId)) ?? null) : null), [notaId])
  const tipo = useLiveQuery(() => db.tiposNota.get(nota?.tipoNotaId ?? TIPO_FARMACO), [nota?.tipoNotaId])

  if (nota === undefined || tipo === undefined) return null
  if ((notaId && !nota) || !tipo) {
    return (
      <main>
        <section className="tarjeta">
          <p>No se encontró la ficha.</p>
          <a href="#/">Volver al inicio</a>
        </section>
      </main>
    )
  }
  const destino = nota?.mazoId ?? mazoId!
  return <Formulario key={nota?.id ?? 'nueva'} notaId={nota?.id} mazoId={destino} tipoId={tipo.id} valoresIniciales={nota?.valores ?? {}} etiquetasIniciales={nota?.etiquetas ?? []} />
}

function Formulario(props: {
  notaId?: Id
  mazoId: Id
  tipoId: Id
  valoresIniciales: Record<Id, string>
  etiquetasIniciales: string[]
}) {
  const tipo = useLiveQuery(() => db.tiposNota.get(props.tipoId), [props.tipoId])
  const [valores, setValores] = useState(props.valoresIniciales)
  const [etiquetas, setEtiquetas] = useState(props.etiquetasIniciales.join(', '))
  const [error, setError] = useState<string | null>(null)
  const volver = `#/mazo/${props.mazoId}`

  if (!tipo) return null
  const campos = camposOrdenados(tipo.campos).filter((c) => !c.oculto)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    try {
      await guardarNota({
        id: props.notaId,
        tipoNotaId: props.tipoId,
        mazoId: props.mazoId,
        valores,
        etiquetas: limpiarEtiquetas(etiquetas),
      })
      location.hash = volver
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <main>
      <a href={volver} className="volver">
        ← Volver al mazo
      </a>
      <form className="tarjeta editor-nota" onSubmit={guardar}>
        <h2>{props.notaId ? 'Editar' : 'Nuevo'} {tipo.nombre.toLowerCase()}</h2>
        {campos.map((c, i) => (
          <label key={c.id}>
            <span>
              {c.nombre}
              {c.tipo === 'lista' && <small> · uno por línea</small>}
            </span>
            {i === 0 ? (
              <input
                value={valores[c.id] ?? ''}
                onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
                autoFocus={!props.notaId}
              />
            ) : (
              <textarea
                rows={c.tipo === 'lista' ? 4 : 2}
                value={valores[c.id] ?? ''}
                onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
              />
            )}
          </label>
        ))}
        <label>
          <span>
            Etiquetas <small>· separadas por coma, por ejemplo: hipertensión, embarazo</small>
          </span>
          <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
        </label>
        {error && <p className="texto-error">{error}</p>}
        <div className="fila">
          <button type="submit">Guardar</button>
          <a href={volver} className="boton-secundario">
            Cancelar
          </a>
          {props.notaId && (
            <button
              type="button"
              className="secundario peligro"
              onClick={async () => {
                if (confirm('¿Borrar esta ficha?')) {
                  await borrarNota(props.notaId!)
                  location.hash = volver
                }
              }}
            >
              Borrar
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
