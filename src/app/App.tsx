import { useEffect, useState } from 'react'
import { pedirAlmacenamientoPersistente, type EstadoAlmacenamiento } from '../core/storage/persist'
import { PruebaAudio } from '../features/podcast/PruebaAudio'
import { AvisoActualizacion } from './AvisoActualizacion'
import { useConexion } from './useConexion'
import { useRuta } from './useRuta'

function Inicio() {
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamiento | null>(null)

  useEffect(() => {
    pedirAlmacenamientoPersistente().then(setAlmacenamiento)
  }, [])

  return (
    <main>
      <section className="tarjeta">
        <h2>Farmacología 1</h2>
        <p>Aquí van a aparecer tus mazos, el repaso del día y el modo escuchar.</p>
      </section>

      <a className="tarjeta enlace" href="#/prueba-audio">
        <h2>Prueba de audio</h2>
        <p>Comprueba qué voz sigue sonando con la pantalla apagada.</p>
      </a>

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
  )
}

function App() {
  const enLinea = useConexion()
  const ruta = useRuta()

  return (
    <div className="app">
      <header className="barra">
        <h1>
          <a href="#/">La Doc</a>
        </h1>
        <span className={enLinea ? 'estado en-linea' : 'estado sin-internet'} data-testid="conexion">
          {enLinea ? 'Con internet' : 'Sin internet'}
        </span>
      </header>

      {ruta === '/prueba-audio' ? <PruebaAudio /> : <Inicio />}

      <footer className="pie">Versión {__APP_VERSION__}</footer>
      <AvisoActualizacion />
    </div>
  )
}

export default App
