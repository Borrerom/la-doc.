import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../core/db/db'
import { aprobarEnlace, crearEnlace, descartarEnlace, enlacesDeNota, opcionesDeEnlace, type EnlaceVisible } from '../../core/db/enlaces'
import { tituloNota } from '../../core/db/notas'
import { listarTiposNota, nombresDeTipo } from '../../core/db/tiposNota'
import type { Id } from '../../core/model/tipos'

// Enlaces de la nota: los confirmados como accesos directos agrupados por relación ("Trata",
// "Se trata con"…), los sugeridos para confirmar o descartar, y un formulario para enlazar a mano.
export function Relacionados({ notaId }: { notaId: Id }) {
  const enlaces = useLiveQuery(() => enlacesDeNota(notaId), [notaId])
  if (!enlaces) return null
  const aprobados = enlaces.filter((e) => e.estado === 'aprobado')
  const propuestos = enlaces.filter((e) => e.estado === 'propuesto')
  const grupos = new Map<string, EnlaceVisible[]>()
  for (const e of aprobados) grupos.set(e.relacion, [...(grupos.get(e.relacion) ?? []), e])
  return (
    <div className="relacionados">
      {[...grupos].map(([relacion, lista]) => (
        <p key={relacion}>
          🔗 {relacion}:{' '}
          {lista.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <a href={`#/mazo/${e.otra.mazoId}`} title={e.comentario || undefined}>
                {e.tituloOtra}
              </a>
            </span>
          ))}
        </p>
      ))}
      {propuestos.map((e) => (
        <div key={e.id} className="sugerencia">
          <p>
            💡 ¿Enlazar? {e.relacion}: <strong>{e.tituloOtra}</strong>. «{e.comentario}»
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
      <AgregarEnlace notaId={notaId} />
    </div>
  )
}

function AgregarEnlace({ notaId }: { notaId: Id }) {
  const [abierto, setAbierto] = useState(false)
  const [opcion, setOpcion] = useState('')
  const [otra, setOtra] = useState('')
  const [error, setError] = useState<string | null>(null)
  const datos = useLiveQuery(async () => {
    if (!abierto) return null
    const [opciones, tipos, notas] = await Promise.all([opcionesDeEnlace(), listarTiposNota(), db.notas.toArray()])
    const grupos = tipos
      .map((t) => ({
        tipo: t,
        notas: notas
          .filter((n) => n.tipoNotaId === t.id && n.borrada === undefined && n.id !== notaId)
          .map((n) => ({ id: n.id, titulo: tituloNota(n, t) }))
          .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
      }))
      .filter((g) => g.notas.length > 0)
    return { opciones, grupos }
  }, [abierto, notaId])

  if (!abierto) {
    return (
      <button type="button" className="enlace-texto" onClick={() => setAbierto(true)}>
        + Enlazar con otra nota
      </button>
    )
  }
  if (!datos) return null
  const elegida = opcion || datos.opciones[0]?.valor
  return (
    <form
      className="agregar-enlace"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await crearEnlace(notaId, elegida, otra)
          setOtra('')
          setAbierto(false)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }}
    >
      <label>
        <span>Relación</span>
        <select aria-label="Relación" value={elegida} onChange={(e) => setOpcion(e.target.value)}>
          {datos.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Con</span>
        <select aria-label="Con" value={otra} onChange={(e) => setOtra(e.target.value)} required>
          <option value="">Elige una nota…</option>
          {datos.grupos.map((g) => (
            <optgroup key={g.tipo.id} label={`${nombresDeTipo(g.tipo).emoji} ${g.tipo.nombre}`}>
              {g.notas.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.titulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {error && <p className="texto-error">{error}</p>}
      <div className="fila">
        <button type="submit">Enlazar</button>
        <button type="button" className="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
