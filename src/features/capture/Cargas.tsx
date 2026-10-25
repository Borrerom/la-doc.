import { useLiveQuery } from 'dexie-react-hooks'
import { procesarCola } from '../../core/ai/procesar'
import { useProveedores } from '../../core/ai/proveedores'
import { useConexion } from '../../app/useConexion'
import { audioAWav } from '../../core/capture/audioWav'
import type { Borrador } from '../../core/ai/extraer'
import { archivosDeCarga, borrarCarga, reintentarCarga, useCargas } from '../../core/db/cargas'
import { db } from '../../core/db/db'
import { rutaDeMazo } from '../../core/db/organizacion'
import type { Carga, EstadoCarga } from '../../core/model/tipos'
import { Miniatura } from './Miniatura'

const ESTADOS: Record<EstadoCarga, string> = {
  en_cola: 'En cola: se procesa cuando haya internet',
  procesando: 'La IA lo está leyendo…',
  por_revisar: 'Listo para revisar',
  aprobada: 'Revisado y guardado',
  error: 'No se pudo procesar',
}

const TIPOS: Record<Carga['tipo'], string> = { foto: '📷', pdf: '📄', voz: '🎙' }

function TarjetaCarga({ carga, destino }: { carga: Carga; destino: string }) {
  const archivos = useLiveQuery(() => archivosDeCarga(carga), [carga.id, carga.archivoIds.length])
  const fecha = new Date(carga.creada).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <li className="tarjeta carga" data-estado={carga.estado}>
      <div className="campo-cabecera">
        <strong>
          {TIPOS[carga.tipo]} {destino}
        </strong>
        <span className={`insignia ${carga.estado}`}>{ESTADOS[carga.estado]}</span>
      </div>
      <p className="ayuda">
        {fecha}
        {carga.tipo === 'foto' && ` · ${carga.archivoIds.length} ${carga.archivoIds.length === 1 ? 'página' : 'páginas'}`}
      </p>
      {carga.indicacion && <p>“{carga.indicacion}”</p>}
      {carga.tipo === 'foto' && archivos && (
        <ul className="miniaturas">
          {archivos.map((a, i) => (
            <li key={a.id}>
              <Miniatura blob={a.blob} alt={`Página ${i + 1}`} />
            </li>
          ))}
        </ul>
      )}
      {carga.error && <p className="texto-error">{carga.error}</p>}
      <div className="fila">
        {carga.estado === 'por_revisar' && (
          <a className="boton" href={`#/revisar/${carga.id}`}>
            Revisar {((carga.borrador as Borrador | undefined)?.farmacos ?? []).filter((f) => f.estado === 'pendiente').length}{' '}
            fármacos
          </a>
        )}
        {carga.estado === 'aprobada' && (
          <a className="boton-secundario" href={`#/mazo/${carga.mazoId}`}>
            Ver en el mazo
          </a>
        )}
        {carga.estado === 'error' && (
          <button type="button" onClick={() => reintentarCarga(carga.id)}>
            Reintentar
          </button>
        )}
        <button
          type="button"
          className="secundario peligro"
          onClick={() => {
            if (confirm('¿Borrar esta carga y sus archivos?')) void borrarCarga(carga.id)
          }}
        >
          Borrar
        </button>
      </div>
    </li>
  )
}

export function Cargas() {
  const cargas = useCargas()
  const enLinea = useConexion()
  const proveedores = useProveedores()
  const sinClave = proveedores !== undefined && !proveedores.some((p) => p.activo && p.clave)
  const enCola = cargas?.some((c) => c.estado === 'en_cola')
  const destinos = useLiveQuery(async () => {
    const mazos = await db.mazos.toArray()
    const materias = new Map((await db.materias.toArray()).map((m) => [m.id, m.nombre]))
    return new Map(mazos.map((m) => [m.id, `${materias.get(m.materiaId) ?? ''} › ${rutaDeMazo(mazos, m.id).join(' › ')}`]))
  })

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>Cargas con IA</h2>
        <p>
          Fotos, PDF y notas de voz guardados en el teléfono. Para cargar algo nuevo, entra en un mazo y toca “Cargar
          con IA”.
        </p>
      </section>
      {sinClave && (
        <p className="tarjeta aviso-clave">
          Para que la IA procese las cargas falta una clave gratis. <a href="#/ajustes-ia">Agrégala aquí</a>.
        </p>
      )}
      {enCola && enLinea && !sinClave && (
        <div className="fila">
          <button type="button" onClick={() => void procesarCola({ convertirAudio: audioAWav })}>
            Procesar ahora
          </button>
        </div>
      )}
      {cargas?.length === 0 && <p className="tarjeta">Todavía no hay cargas.</p>}
      <ul className="lista">
        {cargas?.map((c) => <TarjetaCarga key={c.id} carga={c} destino={destinos?.get(c.mazoId) ?? ''} />)}
      </ul>
    </main>
  )
}
