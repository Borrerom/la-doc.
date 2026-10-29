import { useEffect, useState, type ReactNode } from 'react'
import { callar, hablar, textoParaLeer } from '../../core/audio/vozTelefono'
import { guardarAjustesAudio, useAjustesAudio } from '../../core/db/ajustes'
import type { FichaVista } from '../../core/db/fichas'
import type { Calificacion } from '../../core/model/tipos'
import { textoIntervalo } from '../../core/srs/fsrs'

const BOTONES: { valor: Calificacion; texto: string; clase: string; libre: string }[] = [
  { valor: 1, texto: 'Mal', clase: 'mal', libre: 'otra vez' },
  { valor: 2, texto: 'Difícil', clase: 'dificil', libre: 'al final' },
  { valor: 3, texto: 'Bien', clase: 'bien', libre: 'lista' },
  { valor: 4, texto: 'Fácil', clase: 'facil', libre: 'lista' },
]

type Props = {
  vista: FichaVista
  respuestaVisible: boolean
  alMostrar: () => void
  alResponder: (c: Calificacion) => void
  // Con intervalos (repaso), cada botón dice cuándo vuelve la ficha; sin ellos (estudio libre), qué pasa en esta sesión.
  intervalos?: Record<Calificacion, number>
  salir: { href: string; texto: string }
  estado: ReactNode
}

// La misma ficha, botones y lectura en voz alta para el repaso de hoy y para estudiar un tema.
export function FichaEnPantalla({ vista, respuestaVisible, alMostrar, alResponder, intervalos, salir, estado }: Props) {
  const ajustes = useAjustesAudio()
  const leer = ajustes.leerEnRepaso
  const [errorVoz, setErrorVoz] = useState<string | null>(null)

  // Lectura en voz alta: la pregunta al aparecer y la respuesta al mostrarla.
  useEffect(() => {
    if (!leer) return
    callar()
    const texto = respuestaVisible ? vista.reverso : vista.frente
    hablar(textoParaLeer(texto), ajustes.velocidad).then(
      () => setErrorVoz(null),
      (e: unknown) => setErrorVoz(e instanceof Error ? e.message : String(e)),
    )
  }, [leer, vista, respuestaVisible, ajustes.velocidad])

  useEffect(() => () => callar(), [])

  return (
    <main>
      <div className="repaso-barra">
        <a href={salir.href} className="volver">
          {salir.texto}
        </a>
        <span className="barra-derecha">
          <button
            type="button"
            className={leer ? 'icono activo' : 'icono'}
            aria-pressed={leer}
            aria-label="Leer en voz alta"
            onClick={() => {
              if (leer) callar()
              void guardarAjustesAudio({ leerEnRepaso: !leer })
            }}
          >
            {leer ? '🔊' : '🔈'}
          </button>
          {leer && errorVoz && <span className="texto-error">{errorVoz}</span>}
          {estado}
        </span>
      </div>
      <section className="tarjeta repaso-ficha" aria-live="polite">
        <p className="repaso-frente">{vista.frente}</p>
        {respuestaVisible && (
          <>
            <hr />
            <p className="repaso-reverso">{vista.reverso}</p>
          </>
        )}
      </section>
      {respuestaVisible ? (
        <div className="botones-calificar">
          {BOTONES.map((b) => (
            <button key={b.valor} type="button" className={b.clase} onClick={() => alResponder(b.valor)}>
              <span>{b.texto}</span>
              <small>{intervalos ? textoIntervalo(intervalos[b.valor]) : b.libre}</small>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="mostrar-respuesta" onClick={alMostrar}>
          Mostrar respuesta
        </button>
      )}
    </main>
  )
}
