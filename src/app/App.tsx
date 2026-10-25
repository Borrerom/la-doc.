import { useEffect, useState } from 'react'
import { pedirAlmacenamientoPersistente, type EstadoAlmacenamiento } from '../core/storage/persist'
import { AvisoActualizacion } from './AvisoActualizacion'
import { useConexion } from './useConexion'

function App() {
  const enLinea = useConexion()
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamiento | null>(null)

  useEffect(() => {
    pedirAlmacenamientoPersistente().then(setAlmacenamiento)
  }, [])

  return (
    <div className="app">
      <header className="barra">
        <h1>La Doc</h1>
        <span className={enLinea ? 'estado en-linea' : 'estado sin-internet'} data-testid="conexion">
          {enLinea ? 'Con internet' : 'Sin internet'}
        </span>
      </header>

      <main>
        <section className="tarjeta">
          <h2>Farmacología 1</h2>
          <p>Aquí van a aparecer tus mazos, el repaso del día y el modo escuchar.</p>
        </section>

        <section className="tarjeta">
          <h2>Este teléfono</h2>
          <ul className="datos">
            <li>
              Datos protegidos:{' '}
              <strong>{almacenamiento === null ? '…' : almacenamiento.persistente ? 'sí' : 'no'}</strong>
            </li>
            {almacenamiento?.disponibleMB != null && (
              <li>
                Espacio para la app: <strong>{almacenamiento.disponibleMB} MB</strong>
              </li>
            )}
          </ul>
        </section>
      </main>

      <footer className="pie">Versión {__APP_VERSION__}</footer>
      <AvisoActualizacion />
    </div>
  )
}

export default App
