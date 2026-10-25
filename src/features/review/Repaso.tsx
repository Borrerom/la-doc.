import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../../core/db/db'
import { verFicha, type FichaVista } from '../../core/db/fichas'
import type { Calificacion } from '../../core/model/tipos'
import { previsualizar, textoIntervalo } from '../../core/srs/fsrs'
import { armarCola, registrarRespuesta, repasadasHoy, type Cola, type FichaEnCola } from '../../core/srs/repaso'

const BOTONES: { valor: Calificacion; texto: string; clase: string }[] = [
  { valor: 1, texto: 'Mal', clase: 'mal' },
  { valor: 2, texto: 'Difícil', clase: 'dificil' },
  { valor: 3, texto: 'Bien', clase: 'bien' },
  { valor: 4, texto: 'Fácil', clase: 'facil' },
]

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
              : 'Carga fármacos en tus mazos y sus fichas aparecerán aquí.'}
          </p>
        </section>
      </main>
    )
  }

  const { intervalos } = actual
  const pendientes = cola.ahora.length + cola.luego.length

  return (
    <main>
      <div className="repaso-barra">
        <a href="#/" className="volver">
          ← Salir
        </a>
        <span>
          {actual.item.nueva && <span className="etiqueta-nueva">Nueva</span>} Quedan {pendientes}
        </span>
      </div>
      <section className="tarjeta repaso-ficha" aria-live="polite">
        <p className="repaso-frente">{actual.vista.frente}</p>
        {respuestaVisible && (
          <>
            <hr />
            <p className="repaso-reverso">{actual.vista.reverso}</p>
          </>
        )}
      </section>
      {respuestaVisible ? (
        <div className="botones-calificar">
          {BOTONES.map((b) => (
            <button key={b.valor} type="button" className={b.clase} onClick={() => responder(b.valor)}>
              <span>{b.texto}</span>
              <small>{textoIntervalo(intervalos[b.valor])}</small>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="mostrar-respuesta" onClick={() => setRespuestaVisible(true)}>
          Mostrar respuesta
        </button>
      )}
    </main>
  )
}
