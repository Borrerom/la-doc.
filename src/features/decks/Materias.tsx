import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { crearMateria, crearSemestre, listarMaterias, listarSemestres } from '../../core/db/organizacion'
import { FormularioNombre } from '../../ui/FormularioNombre'

export function Materias() {
  const semestres = useLiveQuery(listarSemestres)
  const materias = useLiveQuery(listarMaterias)
  const [agregandoEn, setAgregandoEn] = useState<string | null>(null)

  if (!semestres || !materias) return null

  if (semestres.length === 0) {
    return (
      <section className="tarjeta">
        <h2>Bienvenida a La Doc</h2>
        <p>Para empezar, dime en qué semestre estás. Por ejemplo: "Semestre 5".</p>
        <FormularioNombre etiqueta="Nombre del semestre" boton="Crear" alGuardar={crearSemestre} />
      </section>
    )
  }

  return (
    <>
      {semestres.map((s) => {
        const deEste = materias.filter((m) => m.semestreId === s.id)
        return (
          <section className="tarjeta" key={s.id}>
            <h2>{s.nombre}</h2>
            {deEste.length === 0 && <p>Todavía no hay materias. Empieza con Farmacología 1.</p>}
            <ul className="lista">
              {deEste.map((m) => (
                <li key={m.id}>
                  <a className="fila-enlace" href={`#/materia/${m.id}`}>
                    <span className="punto" style={{ background: m.color }} />
                    {m.nombre}
                  </a>
                </li>
              ))}
            </ul>
            {agregandoEn === s.id ? (
              <FormularioNombre
                etiqueta="Nombre de la materia"
                boton="Agregar"
                valorInicial={deEste.length === 0 ? 'Farmacología 1' : ''}
                alGuardar={async (nombre) => {
                  await crearMateria(nombre, s.id)
                  setAgregandoEn(null)
                }}
                alCancelar={() => setAgregandoEn(null)}
              />
            ) : (
              <button type="button" className="secundario" onClick={() => setAgregandoEn(s.id)}>
                + Agregar materia
              </button>
            )}
          </section>
        )
      })}

      <details className="tarjeta">
        <summary>Agregar otro semestre</summary>
        <FormularioNombre etiqueta="Nombre del semestre" boton="Crear" alGuardar={crearSemestre} />
      </details>
    </>
  )
}
