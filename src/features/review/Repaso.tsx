import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../../core/db/db'
import { verFicha, type FichaVista } from '../../core/db/fichas'
import type { Calificacion } from '../../core/model/tipos'
import { previsualizar } from '../../core/srs/fsrs'
import { armarCola, registrarRespuesta, repasadasHoy, type Cola, type FichaEnCola } from '../../core/srs/repaso'
import { FichaEnPantalla } from './FichaEnPantalla'

type Actual = { item: FichaEnCola; vista: FichaVista; inicio: number; intervalos: Record<Calificacion, number> }

export function Repaso() {
  const [cola, setCola] = useState<Cola | null>(null)
  const [actual, setActual] = useState<Actual | null>(null)
  const [respuestaVisible, setRespuestaVisible] = useState(false)
  const [hechasHoy, setHechasHoy] = useState(0)
  const guardando = useRef(false)

  const cargar = useCallback(async () => {
    const ahora = Date.now()
    const c = await armarCola(ahora)
    setCola(c)
    setHechasHoy(await repasadasHoy(ahora))
    // Si solo quedan fichas en aprendizaje que vuelven en unos minutos, se muestran antes, como en Anki.
    const item = c.ahora[0] ?? c.luego[0]
    if (!item) return setActual(null)
    const tipo = await db.tiposNota.get(item.nota.tipoNotaId)
    if (!tipo) return setActual(null)
    const inicio = Date.now()
    setActual({ item, vista: verFicha(item.ficha, item.nota, tipo), inicio, intervalos: previsualizar(item.estado, inicio) })
    setRespuestaVisible(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function responder(calificacion: Calificacion) {
    if (!actual || guardando.current) return
    guardando.current = true
    try {
      const ahora = Date.now()
      await registrarRespuesta(actual.item, calificacion, ahora, ahora - actual.inicio)
      await cargar()
    } finally {
      guardando.current = false
    }
  }

  if (!cola) return null

  if (!actual) {
    return (
      <main>
        <a href="#/" className="volver">
          ← Inicio
        </a>
        <section className="tarjeta repaso-fin">
          <h2>{hechasHoy > 0 ? '¡Listo por hoy!' : 'No hay fichas para repasar'}</h2>
          <p>
            {hechasHoy > 0
              ? `Repasaste ${hechasHoy} ${hechasHoy === 1 ? 'ficha' : 'fichas'} hoy. Las demás vuelven cuando toca.`
              : 'Carga fármacos, patologías o casos en tus temas y sus fichas aparecerán aquí.'}
          </p>
          <p>Si quieres seguir, estudia el tema que tú elijas, a tu ritmo.</p>
          <a className="boton" href="#/estudiar">
            📚 Estudiar un tema
          </a>
        </section>
      </main>
    )
  }

  const pendientes = cola.ahora.length + cola.luego.length

  return (
    <FichaEnPantalla
      vista={actual.vista}
      respuestaVisible={respuestaVisible}
      alMostrar={() => setRespuestaVisible(true)}
      alResponder={(c) => void responder(c)}
      intervalos={actual.intervalos}
      salir={{ href: '#/', texto: '← Salir' }}
      estado={
        <>
          {actual.item.nueva && <span className="etiqueta-nueva">Nueva</span>} Quedan {pendientes}
        </>
      }
    />
  )
}
