import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../core/db/db'
import { arbolDeMazos, borrarMazo, crearMazo, listarMazos, renombrar, type NodoMazo } from '../../core/db/organizacion'
import type { Id } from '../../core/model/tipos'
import { FormularioNombre } from '../../ui/FormularioNombre'

type Accion = { tipo: 'submazo' | 'renombrar'; id: Id } | null

export function Materia({ id }: { id: Id }) {
  const materia = useLiveQuery(() => db.materias.get(id), [id])
  const mazos = useLiveQuery(() => listarMazos(id), [id])
  const [accion, setAccion] = useState<Accion>(null)

  if (materia === undefined || mazos === undefined) return null
  if (!materia || materia.borrada) {
    return (
      <main>
        <section className="tarjeta">
          <p>Esta materia no existe.</p>
          <a href="#/">Volver al inicio</a>
        </section>
      </main>
    )
  }

  const arbol = arbolDeMazos(mazos)

  const Nodo = ({ nodo, nivel }: { nodo: NodoMazo; nivel: number }) => (
    <li>
      <div className="mazo" style={{ paddingLeft: nivel * 16 }}>
        {accion?.tipo === 'renombrar' && accion.id === nodo.id ? (
          <FormularioNombre
            etiqueta="Nuevo nombre"
            boton="Guardar"
            valorInicial={nodo.nombre}
            alGuardar={async (n) => {
              await renombrar('mazos', nodo.id, n)
              setAccion(null)
            }}
            alCancelar={() => setAccion(null)}
          />
        ) : (
          <>
            <span className="mazo-nombre">{nodo.nombre}</span>
            <span className="mazo-acciones">
              <button type="button" className="secundario" onClick={() => setAccion({ tipo: 'submazo', id: nodo.id })}>
                + Sub
              </button>
              <button
                type="button"
                className="secundario"
                onClick={() => setAccion({ tipo: 'renombrar', id: nodo.id })}
              >
                Renombrar
              </button>
              <button
                type="button"
                className="secundario peligro"
                onClick={() => {
                  const extra = nodo.hijos.length ? ' y sus submazos' : ''
                  if (confirm(`¿Borrar "${nodo.nombre}"${extra}?`)) void borrarMazo(nodo.id)
                }}
              >
                Borrar
              </button>
            </span>
          </>
        )}
      </div>
      {accion?.tipo === 'submazo' && accion.id === nodo.id && (
        <div style={{ paddingLeft: (nivel + 1) * 16 }}>
          <FormularioNombre
            etiqueta={`Submazo de ${nodo.nombre}`}
            boton="Agregar"
            alGuardar={async (n) => {
              await crearMazo(n, id, nodo.id)
              setAccion(null)
            }}
            alCancelar={() => setAccion(null)}
          />
        </div>
      )}
      {nodo.hijos.length > 0 && (
        <ul className="lista">
          {nodo.hijos.map((h) => (
            <Nodo key={h.id} nodo={h} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  )

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>
          <span className="punto" style={{ background: materia.color }} /> {materia.nombre}
        </h2>
        <p>Organiza la materia por temas. Cada tema puede tener subtemas, por ejemplo Antibióticos &gt; Penicilinas.</p>
      </section>

      <section className="tarjeta">
        <h2>Mazos</h2>
        {arbol.length === 0 && <p>Todavía no hay mazos.</p>}
        <ul className="lista">
          {arbol.map((n) => (
            <Nodo key={n.id} nodo={n} nivel={0} />
          ))}
        </ul>
        <FormularioNombre etiqueta="Nuevo mazo (tema)" boton="Agregar" alGuardar={(n) => crearMazo(n, id)} />
      </section>
    </main>
  )
}
