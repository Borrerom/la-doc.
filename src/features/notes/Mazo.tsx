import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../core/db/db'
import { notasDeMazo, tituloNota } from '../../core/db/notas'
import { listarMazos, rutaDeMazo } from '../../core/db/organizacion'
import { listarTiposNota, nombresDeTipo, TIPO_FARMACO } from '../../core/db/tiposNota'
import type { Id } from '../../core/model/tipos'
import { FichaNota } from './FichaNota'
import { TablaNotas } from './TablaNotas'

const CLAVE_VISTA = 'la-doc:vista-mazo'

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

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
    const [materia, mazos, notas, tipos] = await Promise.all([
      db.materias.get(m.materiaId),
      listarMazos(m.materiaId),
      notasDeMazo(id),
      listarTiposNota(),
    ])
    const fichas = await db.fichas.where('notaId').anyOf(notas.map((n) => n.id)).filter((f) => !f.suspendida).toArray()
    // El tipo principal de la materia va primero (en Farmacología, el fármaco).
    const principal = materia?.tipoPrincipal ?? TIPO_FARMACO
    const ordenados = [...tipos.filter((t) => t.id === principal), ...tipos.filter((t) => t.id !== principal)]
    return { materia, mazos, notas, tipos: ordenados, totalFichas: fichas.length }
  }, [id])
  const [vista, setVista] = useState(leerVista)

  if (mazo === undefined || datos === undefined) return null
  if (!mazo || mazo.borrada || !datos?.tipos.length || !datos.materia) {
    return (
      <main>
        <section className="tarjeta">
          <p>Este mazo no existe.</p>
          <a href="#/">Volver al inicio</a>
        </section>
      </main>
    )
  }

  const { mazos, notas, tipos, totalFichas } = datos
  const nombresMazo = new Map(mazos.map((m) => [m.id, m.nombre]))
  const padre = mazos.find((m) => m.id === mazo.padreId)
  const subtemas = mazos.filter((m) => m.padreId === id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  // Una sección por tipo con notas: fármacos, patologías, casos…
  const grupos = tipos
    .map((tipo) => ({
      tipo,
      notas: notas.filter((n) => n.tipoNotaId === tipo.id).sort((a, b) => tituloNota(a, tipo).localeCompare(tituloNota(b, tipo), 'es')),
    }))
    .filter((g) => g.notas.length > 0)
  const resumen = grupos.map((g) => plural(g.notas.length, nombresDeTipo(g.tipo).uno, nombresDeTipo(g.tipo).varios)).join(', ')

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
      {/* Se vuelve al tema de arriba o, desde un tema, al tablero del Inicio con la materia abierta. */}
      {padre ? (
        <a href={`#/mazo/${padre.id}`} className="volver">
          ← {padre.nombre}
        </a>
      ) : (
        <a href="#/" className="volver">
          ← Inicio
        </a>
      )}
      <section className="tarjeta">
        <h2>{rutaDeMazo(mazos, id).join(' › ')}</h2>
        <p>
          {notas.length === 0
            ? 'Todavía no hay nada en este tema.'
            : `${resumen} y ${plural(totalFichas, 'ficha', 'fichas')}, contando los subtemas.`}
        </p>
        <div className="fila">
          {tipos.map((t, i) => (
            <a key={t.id} className={i === 0 ? 'boton' : 'boton-secundario'} href={`#/nota/nueva/${id}/${t.id}`}>
              + {nombresDeTipo(t).nuevo}
            </a>
          ))}
          {notas.length > 0 && (
            <a className="boton-secundario" href={`#/estudiar/tema/${id}`}>
              📚 Estudiar este tema
            </a>
          )}
          {notas.length > 0 && (
            <a className="boton-secundario" href={`#/escuchar/${id}`}>
              🎧 Escuchar el mazo
            </a>
          )}
          <a className="boton-secundario" href={`#/capturar/${id}`}>
            📷 Cargar con IA
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

      {subtemas.length > 0 && (
        <section className="tarjeta">
          <h2>Subtemas</h2>
          <ul className="lista">
            {subtemas.map((m) => (
              <li key={m.id}>
                <a className="fila-enlace" href={`#/mazo/${m.id}`}>
                  <span className="tema-nombre">{m.nombre}</span>
                  <span aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grupos.map(({ tipo, notas: deTipo }) => (
        <section key={tipo.id} className="grupo-tipo">
          {/* Con un solo tipo no hace falta el título: es lo único que hay. */}
          {grupos.length > 1 && (
            <h2 className="grupo-titulo">
              {nombresDeTipo(tipo).emoji} {nombresDeTipo(tipo).varios[0].toUpperCase() + nombresDeTipo(tipo).varios.slice(1)}
            </h2>
          )}
          {vista === 'tabla' ? (
            <TablaNotas notas={deTipo} tipo={tipo} nombresMazo={nombresMazo} mazoActual={id} />
          ) : (
            deTipo.map((n) => <FichaNota key={n.id} nota={n} tipo={tipo} mazo={n.mazoId !== id ? nombresMazo.get(n.mazoId) : undefined} />)
          )}
        </section>
      ))}
    </main>
  )
}
