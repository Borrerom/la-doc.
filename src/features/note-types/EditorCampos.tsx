import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../core/db/db'
import {
  agregarCampo,
  cambiarCampo,
  camposOrdenados,
  cambiarTipoNota,
  listarTiposNota,
  moverCampo,
  nombresDeTipo,
  textoPlantilla,
} from '../../core/db/tiposNota'
import type { Campo, Id, TipoNota } from '../../core/model/tipos'
import { FormularioNombre } from '../../ui/FormularioNombre'

// Tarjeta de Más opciones: un acceso a los campos de cada tipo de ficha.
export function CamposDeTipos() {
  const tipos = useLiveQuery(listarTiposNota)
  return (
    <section className="tarjeta">
      <h2>Campos de las fichas</h2>
      <p>Agrega, renombra u oculta los datos que lleva cada tipo.</p>
      <ul className="lista">
        {tipos?.map((t) => (
          <li key={t.id}>
            <a className="fila-enlace" href={`#/tipo/${t.id}`}>
              <span className="tema-nombre">
                {nombresDeTipo(t).emoji} {t.nombre}
              </span>
              <span aria-hidden="true">›</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function EditorCampos({ id }: { id: Id }) {
  const tipo = useLiveQuery(() => db.tiposNota.get(id), [id])
  const [renombrando, setRenombrando] = useState<Id | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (tipo === undefined) return null
  if (!tipo) {
    return (
      <main>
        <section className="tarjeta">
          <p>Este tipo de ficha no existe.</p>
        </section>
      </main>
    )
  }

  // El primer campo es el que nombra la nota (por ejemplo, el nombre del fármaco).
  const campoNombreId = tipo.campos.find((c) => c.orden === 1)?.id ?? tipo.campos[0].id

  async function aplicar(cambio: (t: TipoNota) => TipoNota) {
    try {
      await cambiarTipoNota(id, cambio)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      throw e
    }
  }

  const pregunta = (campo: Campo) => {
    const p = tipo.plantillas.find((pl) => pl.frente.includes(`{{nombre:${campo.id}}}`))
    return p ? textoPlantilla(p.frente, tipo) : null
  }

  const campos = camposOrdenados(tipo.campos)

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>Campos de la ficha: {tipo.nombre}</h2>
        <p>
          Puedes agregar, renombrar, ocultar u ordenar los campos. Los datos ya cargados no se pierden: un campo oculto
          solo deja de mostrarse y de preguntarse. La IA usará estos campos en las próximas cargas.
        </p>
      </section>

      {error && (
        <section className="tarjeta error" role="alert">
          <p>{error}</p>
        </section>
      )}

      <section className="tarjeta">
        <ol className="campos">
          {campos.map((c, i) => (
            <li key={c.id} className={c.oculto ? 'campo oculto' : 'campo'}>
              {renombrando === c.id ? (
                <FormularioNombre
                  etiqueta="Nuevo nombre del campo"
                  boton="Guardar"
                  valorInicial={c.nombre}
                  alGuardar={async (nombre) => {
                    await aplicar((t) => cambiarCampo(t, c.id, { nombre }))
                    setRenombrando(null)
                  }}
                  alCancelar={() => setRenombrando(null)}
                />
              ) : (
                <div className="campo-cabecera">
                  <span className="campo-nombre">
                    {c.nombre}
                    {c.oculto && <em> (oculto)</em>}
                  </span>
                  <span className="mazo-acciones">
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Subir ${c.nombre}`}
                      disabled={i <= 1}
                      onClick={() => aplicar((t) => moverCampo(t, c.id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Bajar ${c.nombre}`}
                      disabled={i === 0 || i === campos.length - 1}
                      onClick={() => aplicar((t) => moverCampo(t, c.id, 1))}
                    >
                      ↓
                    </button>
                    <button type="button" className="secundario" onClick={() => setRenombrando(c.id)}>
                      Renombrar
                    </button>
                    {c.id !== campoNombreId && (
                      <button
                        type="button"
                        className="secundario"
                        onClick={() => aplicar((t) => cambiarCampo(t, c.id, { oculto: !c.oculto }))}
                      >
                        {c.oculto ? 'Mostrar' : 'Ocultar'}
                      </button>
                    )}
                  </span>
                </div>
              )}
              {pregunta(c) && !c.oculto && <p className="pregunta">Pregunta: {pregunta(c)}</p>}
              <details>
                <summary>Guía para la IA</summary>
                <textarea
                  aria-label={`Guía para la IA de ${c.nombre}`}
                  defaultValue={c.guiaIA}
                  placeholder="Qué debe ir en este campo"
                  onBlur={(e) => {
                    if (e.target.value !== c.guiaIA) void aplicar((t) => cambiarCampo(t, c.id, { guiaIA: e.target.value }))
                  }}
                />
              </details>
            </li>
          ))}
        </ol>
        <FormularioNombre
          etiqueta="Nombre del campo nuevo"
          boton="Agregar campo"
          alGuardar={(nombre) => aplicar((t) => agregarCampo(t, nombre, campoNombreId))}
        />
      </section>
    </main>
  )
}
