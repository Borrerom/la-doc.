import { useEffect, useState } from 'react'
import {
  desvincularCuenta,
  prepararOtraCuenta,
  respaldarAhora,
  restaurarDeDrive,
  useEstadoRespaldo,
  vincularCuenta,
} from '../../core/respaldo/respaldo'
import { useConexion } from '../../app/useConexion'
import { asegurarPermiso, precargarGoogle } from '../../core/respaldo/google'
import { haceCuanto } from './haceCuanto'

// Tarjeta del Inicio: dice cuándo fue el último respaldo y deja respaldar con un toque.
export function TarjetaRespaldo() {
  const estado = useEstadoRespaldo()
  const enLinea = useConexion()
  const [trabajando, setTrabajando] = useState(false)
  const vinculada = !!estado?.carpetaId
  useEffect(() => {
    if (enLinea && vinculada) precargarGoogle()
  }, [enLinea, vinculada])
  if (!estado) return null
  if (!estado.carpetaId) {
    return (
      <a className="tarjeta enlace" href="#/respaldo">
        <h2>☁️ Respaldo en Google Drive</h2>
        <p>Sin vincular. Toca aquí para guardar tus fichas y tu repaso en tu Drive.</p>
      </a>
    )
  }
  return (
    <section className="tarjeta respaldo">
      <h2>
        <a href="#/respaldo">☁️ Respaldo en Google Drive</a>
      </h2>
      <p>
        Último respaldo: <strong>{haceCuanto(estado.ultimo)}</strong>
      </p>
      {estado.error && <p className="texto-error">{estado.error}</p>}
      {enLinea && (
        <button
          type="button"
          className="secundario"
          disabled={trabajando}
          onClick={async () => {
            setTrabajando(true)
            // Primero el permiso, en el mismo toque; después el respaldo.
            await asegurarPermiso(estado.correo)
              .then(() => respaldarAhora({ interactivo: true }))
              .catch(() => {})
            setTrabajando(false)
          }}
        >
          {trabajando ? 'Respaldando…' : 'Respaldar ahora'}
        </button>
      )}
    </section>
  )
}

export function Respaldo() {
  const estado = useEstadoRespaldo()
  const enLinea = useConexion()
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ofrecerRestaurar, setOfrecerRestaurar] = useState(false)
  useEffect(() => {
    if (enLinea) precargarGoogle()
  }, [enLinea])

  // Las acciones que usan Drive piden el permiso al principio del toque (el iPhone lo exige).
  const hacer = (nombre: string, accion: () => Promise<string | void>, conPermiso = true) => async () => {
    const permiso = conPermiso ? asegurarPermiso(estado?.correo) : Promise.resolve(null)
    setError(null)
    setAviso(null)
    setTrabajando(nombre)
    try {
      await permiso
      const r = await accion()
      if (r) setAviso(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrabajando(null)
    }
  }

  const restaurar = hacer('restaurar', async () => {
    if (!confirm('Esto reemplaza lo que hay en este teléfono por lo que está en Drive. ¿Seguir?')) return
    const fecha = await restaurarDeDrive({ interactivo: true })
    setOfrecerRestaurar(false)
    return `Listo: se recuperó el respaldo del ${new Date(fecha).toLocaleString('es-VE')}.`
  })

  if (!estado) return null
  const vinculada = !!estado.carpetaId

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>☁️ Respaldo en Google Drive</h2>
        <p>
          La Doc guarda una copia de tus fichas, tu repaso y tus ajustes en una carpeta "La Doc" de tu Drive. Solo puede ver
          esa carpeta, nunca el resto de tu Drive. Con internet se respalda sola cada vez que hay cambios.
        </p>
        {!enLinea && <p className="ayuda">Ahora no hay internet: el respaldo se hará cuando vuelva.</p>}
      </section>

      {!vinculada ? (
        <section className="tarjeta">
          <h2>Vincular tu cuenta</h2>
          <p>Google te pedirá elegir tu cuenta y dar permiso. Si dice "Google no verificó esta app", toca "Continuar".</p>
          <button
            type="button"
            disabled={!enLinea || !!trabajando}
            onClick={hacer('vincular', async () => {
              const { correo, hayRespaldo } = await vincularCuenta()
              if (hayRespaldo) {
                setOfrecerRestaurar(true)
                return `Cuenta vinculada: ${correo}. Encontré un respaldo tuyo en Drive.`
              }
              await respaldarAhora({ interactivo: true })
              return `Cuenta vinculada: ${correo}. Ya quedó el primer respaldo.`
            }, false)}
          >
            {trabajando === 'vincular' ? 'Vinculando…' : 'Entrar con Google'}
          </button>
        </section>
      ) : (
        <section className="tarjeta">
          <h2>Tu cuenta</h2>
          <ul className="datos">
            <li>
              Cuenta: <strong>{estado.correo}</strong>
            </li>
            <li>
              Último respaldo: <strong>{haceCuanto(estado.ultimo)}</strong>
            </li>
          </ul>
          {estado.error && <p className="texto-error">{estado.error}</p>}
          <div className="fila">
            <button
              type="button"
              disabled={!enLinea || !!trabajando}
              onClick={hacer('respaldar', async () => {
                await respaldarAhora({ interactivo: true })
                return 'Respaldo guardado en tu Drive.'
              })}
            >
              {trabajando === 'respaldar' ? 'Respaldando…' : 'Respaldar ahora'}
            </button>
            <button type="button" className="secundario" disabled={!enLinea || !!trabajando} onClick={restaurar}>
              {trabajando === 'restaurar' ? 'Recuperando…' : 'Recuperar desde Drive'}
            </button>
          </div>
        </section>
      )}

      {ofrecerRestaurar && (
        <section className="tarjeta destacada">
          <p>¿Quieres traer a este teléfono lo que ya tenías respaldado? Reemplaza lo que hay ahora en el teléfono.</p>
          <div className="fila">
            <button type="button" disabled={!!trabajando} onClick={restaurar}>
              Sí, recuperar mi respaldo
            </button>
            <button type="button" className="secundario" onClick={() => setOfrecerRestaurar(false)}>
              No, empezar con lo de este teléfono
            </button>
          </div>
        </section>
      )}

      {aviso && (
        <section className="tarjeta" role="status">
          <p>{aviso}</p>
        </section>
      )}
      {error && (
        <section className="tarjeta error" role="alert">
          <p>{error}</p>
        </section>
      )}

      {vinculada && (
        <details className="tarjeta">
          <summary>Cambiar de cuenta</summary>
          <p>
            <strong>Desvincular</strong> quita la cuenta de este teléfono pero deja tus fichas aquí.
          </p>
          <button
            type="button"
            className="secundario"
            disabled={!!trabajando}
            onClick={hacer('desvincular', async () => {
              if (!confirm('¿Quitar la cuenta de Google de este teléfono? Tus fichas se quedan aquí.')) return
              await desvincularCuenta()
              return 'Cuenta desvinculada.'
            }, false)}
          >
            Desvincular cuenta
          </button>
          <p>
            <strong>Otra persona usará este teléfono:</strong> primero se respalda todo en tu Drive y luego se borran del
            teléfono tus fichas, tu repaso y tus claves de IA. La otra persona entra con su propia cuenta.
          </p>
          <button
            type="button"
            className="secundario peligro"
            disabled={!enLinea || !!trabajando}
            onClick={hacer('otra', async () => {
              if (!confirm('Se respalda todo en tu Drive y se borra de este teléfono. ¿Seguir?')) return
              await prepararOtraCuenta()
              return 'Listo: el teléfono quedó vacío. La otra persona puede tocar "Entrar con Google".'
            })}
          >
            Preparar el teléfono para otra persona
          </button>
        </details>
      )}
    </main>
  )
}
