import { useLiveQuery } from 'dexie-react-hooks'
import { armarCola, repasadasHoy } from '../../core/srs/repaso'

export function ResumenRepaso() {
  const datos = useLiveQuery(async () => {
    const ahora = Date.now()
    const cola = await armarCola(ahora)
    return { pendientes: cola.totalHoy, hechas: await repasadasHoy(ahora) }
  })
  if (!datos || (datos.pendientes === 0 && datos.hechas === 0)) return null

  return (
    <section className="tarjeta repaso-resumen">
      <div>
        <h2>Repaso de hoy</h2>
        <p>
          {datos.pendientes > 0
            ? `${datos.pendientes} ${datos.pendientes === 1 ? 'ficha pendiente' : 'fichas pendientes'}`
            : 'Terminaste por hoy'}
          {datos.hechas > 0 && ` · ${datos.hechas} ${datos.hechas === 1 ? 'hecha' : 'hechas'}`}
        </p>
      </div>
      {datos.pendientes > 0 && (
        <a className="boton" href="#/repaso">
          Repasar
        </a>
      )}
    </section>
  )
}
