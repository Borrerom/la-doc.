import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { tipoDePropuesto, type Borrador, type FarmacoPropuesto } from '../../core/ai/extraer'
import { db } from '../../core/db/db'
import { aprobarFarmaco, descartarFarmaco, posiblesDuplicados } from '../../core/db/revision'
import { camposOrdenados, listarTiposNota, nombresDeTipo } from '../../core/db/tiposNota'
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
  const duplicados = useLiveQuery(() => posiblesDuplicados(carga.materiaId, nombre, tipo.id), [carga.materiaId, nombre, tipo.id])
  const n = nombresDeTipo(tipo)

  return (
    <section className="tarjeta editor-nota revision" data-testid={`propuesto-${indice}`}>
      <p className="tipo-propuesto">
        {n.emoji} {tipo.nombre}
      </p>
      <h2>
        {propuesto.valores[campos[0].id]}
        {propuesto.pagina && <small> · página {propuesto.pagina}</small>}
      </h2>
      {duplicados && duplicados.length > 0 && (
        <p className="aviso-duplicado">
          Ya tienes {n.uno === 'patología' ? 'una' : 'un'} {n.uno} con este nombre en la materia. Si lo guardas, quedarán dos.
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
          Guardar en el tema
        </button>
        <button type="button" className="secundario peligro" onClick={() => descartarFarmaco(carga.id, indice)}>
          Descartar
        </button>
      </div>
    </section>
  )
}

// "2 fármacos y 1 patología".
function contarPorTipo(propuestos: FarmacoPropuesto[], tipos: Map<Id, TipoNota>) {
  const cuenta = new Map<Id, number>()
  for (const p of propuestos) cuenta.set(tipoDePropuesto(p), (cuenta.get(tipoDePropuesto(p)) ?? 0) + 1)
  const partes = [...cuenta].map(([id, k]) => {
    const n = nombresDeTipo(tipos.get(id) ?? { id, nombre: 'nota' })
    return `${k} ${k === 1 ? n.uno : n.varios}`
  })
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : (partes[0] ?? 'nada')
}

export function Revisar({ cargaId }: { cargaId: Id }) {
  const datos = useLiveQuery(async () => {
    const carga = await db.cargas.get(cargaId)
    const tipos = new Map((await listarTiposNota()).map((t) => [t.id, t]))
    return { carga, tipos }
  }, [cargaId])
  if (!datos) return null
  const { carga, tipos } = datos
  const borrador = carga?.borrador as Borrador | undefined

  if (!carga || carga.borrada || !borrador) {
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
          {borrador.proveedor} encontró {contarPorTipo(borrador.farmacos, tipos)}. Corrige lo que haga falta y guarda cada
          uno: entra al tema con sus fichas y con la cita del material.
        </p>
        <p className="ayuda">
          Revisa sobre todo los campos sin frase del material: la IA puede equivocarse.
        </p>
      </section>
      {pendientes.map(([f, i]) => {
        const tipo = tipos.get(tipoDePropuesto(f))
        return tipo && <FarmacoEnRevision key={i} carga={carga} indice={i} propuesto={f} tipo={tipo} />
      })}
      {pendientes.length === 0 && (
        <section className="tarjeta">
          <p>
            Listo. Guardaste {guardados.length === 0 ? 'nada' : contarPorTipo(guardados, tipos)}.
          </p>
          <a className="boton" href={`#/mazo/${carga.mazoId}`}>
            Ver el tema
          </a>
        </section>
      )}
    </main>
  )
}
