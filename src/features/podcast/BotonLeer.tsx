import { useEffect, useRef, useState } from 'react'
import { useAjustesAudio } from '../../core/db/ajustes'
import { callar, esperar, hablar } from '../../core/audio/vozTelefono'

// Solo suena un botón a la vez: al tocar otro, el anterior se calla.
let turno = 0

export function BotonLeer({ frases, etiqueta = '🔊 Escuchar' }: { frases: string[]; etiqueta?: string }) {
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mio = useRef(0)
  const { velocidad } = useAjustesAudio()

  useEffect(
    () => () => {
      if (mio.current === turno) callar()
    },
    [],
  )

  async function leer() {
    if (leyendo) {
      turno++
      callar()
      setLeyendo(false)
      return
    }
    // Si sonaba otro botón, hablar() lo calla antes de empezar.
    const yo = ++turno
    mio.current = yo
    setError(null)
    setLeyendo(true)
    try {
      for (const f of frases) {
        if (turno !== yo) return
        await hablar(f, velocidad)
        await esperar(0.4)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <>
      <button type="button" className={leyendo ? 'secundario' : 'boton-leer'} onClick={leer}>
        {leyendo ? '■ Detener' : etiqueta}
      </button>
      {error && <p className="texto-error">{error}</p>}
    </>
  )
}
