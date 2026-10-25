import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Borrador, FarmacoPropuesto } from '../../core/ai/extraer'
import { db } from '../../core/db/db'
import { aprobarFarmaco, descartarFarmaco, posiblesDuplicados } from '../../core/db/revision'
import { camposOrdenados, TIPO_FARMACO } from '../../core/db/tiposNota'
import type { Carga, Id, TipoNota } from '../../core/model/tipos'

function FarmacoEnRevision({
  carga,
  indice,
  propuesto,
  tipo,
}: {
  carga: Carga
  indice: number
  propuesto: FarmacoPropuesto
  tipo: TipoNota
}) {
  const campos = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  const [valores, setValores] = useState<Record<Id, string>>(propuesto.valores)
  const [error, setError] = useState<string | null>(null)
  const nombre = valores[campos[0].id] ?? ''
  const duplicados = useLiveQuery(() => posiblesDuplicados(carga.materiaId, nombre), [carga.materiaId, nombre])

  return (
    <section className="tarjeta editor-nota revision" data-testid={`propuesto-${indice}`}>
      <h2>
        {propuesto.valores[campos[0].id]}
        {propuesto.pagina && <small> · página {propuesto.pagina}</small>}
      </h2>
      {duplicados && duplicados.length > 0 && (
        <p className="aviso-duplicado">
          Ya tienes un fármaco con este nombre en la materia. Si lo guardas, quedarán dos.
        </p>
      )}
      {campos.map((c) => (
        <label key={c.id}>
          <span>{c.nombre}</span>
          <textarea
            rows={c.tipo === 'lista' ? 3 : 2}
            value={valores[c.id] ?? ''}
            placeholder="No aparece en el material"
            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
          />
          {propuesto.evidencia[c.id] && <small className="evidencia">Del material: «{propuesto.evidencia[c.id]}»</small>}
          {propuesto.valores[c.id] && !propuesto.evidencia[c.id] && (
            <small className="sin-evidencia">La IA no dijo de qué frase sale: valídalo.</small>
          )}
        </label>
      ))}
      {error && <p className="texto-error">{error}</p>}
      <div className="fila">
        <button
          type="button"
          onClick={async () => {
            setError(null)
            try {
              await aprobarFarmaco(carga.id, indice, valores)
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Guardar en el mazo
        </button>
        <button type="button" className="secundario peligro" onClick={() => descartarFarmaco(carga.id, indice)}>
          Descartar
        </button>
      </div>
    </section>
  )
}

export function Revisar({ cargaId }: { cargaId: Id }) {
  const datos = useLiveQuery(async () => {
    const carga = await db.cargas.get(cargaId)
    const tipo = await db.tiposNota.get(TIPO_FARMACO)
    return { carga, tipo }
  }, [cargaId])
  if (!datos) return null
  const { carga, tipo } = datos
  const borrador = carga?.borrador as Borrador | undefined

  if (!carga || carga.borrada || !borrador || !tipo) {
    return (
      <main>
        <a href="#/cargas" className="volver">
          ← Cargas
        </a>
        <p className="tarjeta">No hay nada que revisar aquí.</p>
      </main>
    )
  }

  const pendientes = borrador.farmacos.map((f, i) => [f, i] as const).filter(([f]) => f.estado === 'pendiente')
  const guardados = borrador.farmacos.filter((f) => f.estado === 'aprobado')

  return (
    <main>
      <a href="#/cargas" className="volver">
        ← Cargas
      </a>
      <section className="tarjeta">
        <h2>Revisar lo que leyó la IA</h2>
        <p>
          {borrador.proveedor} encontró {borrador.farmacos.length}{' '}
          {borrador.farmacos.length === 1 ? 'fármaco' : 'fármacos'}. Corrige lo que haga falta y guarda cada uno: entra al
          mazo con sus fichas y con la cita del material.
        </p>
        <p className="ayuda">
          Revisa sobre todo los campos sin frase del material: la IA puede equivocarse.
        </p>
      </section>
      {pendientes.map(([f, i]) => (
        <FarmacoEnRevision key={i} carga={carga} indice={i} propuesto={f} tipo={tipo} />
      ))}
      {pendientes.length === 0 && (
        <section className="tarjeta">
          <p>
            Listo. {guardados.length} {guardados.length === 1 ? 'fármaco guardado' : 'fármacos guardados'}.
          </p>
          <a className="boton" href={`#/mazo/${carga.mazoId}`}>
            Ver el mazo
          </a>
        </section>
      )}
    </main>
  )
}
