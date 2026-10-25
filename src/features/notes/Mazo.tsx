import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../core/db/db'
import { notasDeMazo, tituloNota } from '../../core/db/notas'
import { listarMazos, rutaDeMazo } from '../../core/db/organizacion'
import { TIPO_FARMACO, camposOrdenados } from '../../core/db/tiposNota'
import type { Id, Nota, TipoNota } from '../../core/model/tipos'
import { TablaNotas } from './TablaNotas'

const CLAVE_VISTA = 'la-doc:vista-mazo'

function leerVista(): 'fichas' | 'tabla' {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'tabla' ? 'tabla' : 'fichas'
  } catch {
    return 'fichas'
  }
}

export function Mazo({ id }: { id: Id }) {
  const mazo = useLiveQuery(() => db.mazos.get(id), [id])
  const datos = useLiveQuery(async () => {
    const m = await db.mazos.get(id)
    if (!m) return null
    const [materia, mazos, notas, tipo] = await Promise.all([
      db.materias.get(m.materiaId),
      listarMazos(m.materiaId),
      notasDeMazo(id),
      db.tiposNota.get(TIPO_FARMACO),
    ])
    return { materia, mazos, notas, tipo }
  }, [id])
  const [vista, setVista] = useState(leerVista)

  if (mazo === undefined || datos === undefined) return null
  if (!mazo || mazo.borrada || !datos?.tipo || !datos.materia) {
    return (
      <main>
        <section className="tarjeta">
          <p>Este mazo no existe.</p>
          <a href="#/">Volver al inicio</a>
        </section>
      </main>
    )
  }

  const { materia, mazos, notas, tipo } = datos
  const nombresMazo = new Map(mazos.map((m) => [m.id, m.nombre]))
  const ordenadas = [...notas].sort((a, b) => tituloNota(a, tipo).localeCompare(tituloNota(b, tipo), 'es'))

  const cambiarVista = (v: 'fichas' | 'tabla') => {
    setVista(v)
    try {
      localStorage.setItem(CLAVE_VISTA, v)
    } catch {
      // Sin almacenamiento del navegador, la vista simplemente no se recuerda.
    }
  }

  return (
    <main className={vista === 'tabla' ? 'ancho' : undefined}>
      <a href={`#/materia/${materia.id}`} className="volver">
        ← {materia.nombre}
      </a>
      <section className="tarjeta">
        <h2>{rutaDeMazo(mazos, id).join(' › ')}</h2>
        <p>
          {notas.length === 0
            ? 'Todavía no hay fármacos en este mazo.'
            : `${notas.length} ${notas.length === 1 ? 'fármaco' : 'fármacos'}, contando los submazos.`}
        </p>
        <div className="fila">
          <a className="boton" href={`#/nota/nueva/${id}`}>
            + Nuevo fármaco
          </a>
          {notas.length > 0 && (
            <span className="selector" role="group" aria-label="Vista">
              <button type="button" className={vista === 'fichas' ? '' : 'secundario'} onClick={() => cambiarVista('fichas')}>
                Fichas
              </button>
              <button type="button" className={vista === 'tabla' ? '' : 'secundario'} onClick={() => cambiarVista('tabla')}>
                Tabla
              </button>
            </span>
          )}
        </div>
      </section>

      {vista === 'tabla' && notas.length > 0 ? (
        <TablaNotas notas={ordenadas} tipo={tipo} nombresMazo={nombresMazo} mazoActual={id} />
      ) : (
        ordenadas.map((n) => <FichaNota key={n.id} nota={n} tipo={tipo} mazo={n.mazoId !== id ? nombresMazo.get(n.mazoId) : undefined} />)
      )}
    </main>
  )
}

function FichaNota({ nota, tipo, mazo }: { nota: Nota; tipo: TipoNota; mazo?: string }) {
  const [primero, ...resto] = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  return (
    <details className="tarjeta ficha">
      <summary>
        <strong>{nota.valores[primero.id] ?? '(sin nombre)'}</strong>
        {mazo && <small> · {mazo}</small>}
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
      <a href={`#/nota/${nota.id}`}>Editar</a>
    </details>
  )
}
