import { useEffect, useState } from 'react'
import { pedirAlmacenamientoPersistente, type EstadoAlmacenamiento } from '../core/storage/persist'
import { Materia } from '../features/decks/Materia'
import { Materias } from '../features/decks/Materias'
import { EditorCampos } from '../features/note-types/EditorCampos'
import { EditorNota } from '../features/notes/EditorNota'
import { Mazo } from '../features/notes/Mazo'
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
      <Materias />

      <a className="tarjeta enlace" href="#/tipo/tipo-farmaco">
        <h2>Campos de la ficha de fármaco</h2>
        <p>Agrega, renombra u oculta los datos que lleva cada fármaco.</p>
      </a>

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

      {ruta === '/prueba-audio' ? (
        <PruebaAudio />
      ) : ruta.startsWith('/tipo/') ? (
        <EditorCampos id={ruta.slice('/tipo/'.length)} />
      ) : ruta.startsWith('/mazo/') ? (
        <Mazo id={ruta.slice('/mazo/'.length)} />
      ) : ruta.startsWith('/nota/nueva/') ? (
        <EditorNota mazoId={ruta.slice('/nota/nueva/'.length)} />
      ) : ruta.startsWith('/nota/') ? (
        <EditorNota notaId={ruta.slice('/nota/'.length)} />
      ) : ruta.startsWith('/materia/') ? (
        <Materia id={ruta.slice('/materia/'.length)} />
      ) : (
        <Inicio />
      )}

      <footer className="pie">Versión {__APP_VERSION__}</footer>
      <AvisoActualizacion />
    </div>
  )
}

export default App
