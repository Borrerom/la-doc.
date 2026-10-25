import { useEffect, useRef, useState } from 'react'
import { Reproductor, type EstadoReproductor, type Pista } from '../../core/audio/reproductor'
import { descargarVozLocal, sintetizar, vozLocalDescargada, type Progreso } from '../../core/audio/vozLocal'
import { callar, esperar, hablar } from '../../core/audio/vozTelefono'
import { unirWav, type Parte, type Pcm } from '../../core/audio/wav'
import { FICHAS_DE_PRUEBA } from './fichasDePrueba'

type Fragmentos = { pregunta: Pcm; respuesta: Pcm }[]

export function PruebaAudio() {
  const [pausa, setPausa] = useState(4)
  const [telefonoSonando, setTelefonoSonando] = useState(false)
  const [vozLista, setVozLista] = useState<boolean | null>(null)
  const [descarga, setDescarga] = useState<Progreso | null>(null)
  const [preparando, setPreparando] = useState<string | null>(null)
  const [fragmentos, setFragmentos] = useState<Fragmentos | null>(null)
  const [estado, setEstado] = useState<EstadoReproductor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reproductor = useRef<Reproductor | null>(null)
  const cancelarTelefono = useRef(false)

  useEffect(() => {
    vozLocalDescargada().then(setVozLista, () => setVozLista(false))
    return () => {
      callar()
      reproductor.current?.detener()
    }
  }, [])

  const fallar = (e: unknown) => setError(e instanceof Error ? e.message : String(e))

  async function escucharConVozDelTelefono() {
    setError(null)
    cancelarTelefono.current = false
    setTelefonoSonando(true)
    try {
      for (const ficha of FICHAS_DE_PRUEBA) {
        if (cancelarTelefono.current) break
        await hablar(ficha.pregunta)
        await esperar(pausa)
        if (cancelarTelefono.current) break
        await hablar(ficha.respuesta)
        await esperar(1.5)
      }
    } catch (e) {
      fallar(e)
    } finally {
      setTelefonoSonando(false)
    }
  }

  function pararVozDelTelefono() {
    cancelarTelefono.current = true
    callar()
  }

  async function descargar() {
    setError(null)
    try {
      await descargarVozLocal(setDescarga)
      setVozLista(true)
    } catch (e) {
      fallar(e)
    } finally {
      setDescarga(null)
    }
  }

  async function prepararAudio() {
    setError(null)
    try {
      const listos: Fragmentos = []
      for (const [i, ficha] of FICHAS_DE_PRUEBA.entries()) {
        setPreparando(`Generando ficha ${i + 1} de ${FICHAS_DE_PRUEBA.length}…`)
        listos.push({ pregunta: await sintetizar(ficha.pregunta), respuesta: await sintetizar(ficha.respuesta) })
      }
      setFragmentos(listos)
    } catch (e) {
      fallar(e)
    } finally {
      setPreparando(null)
    }
  }

  async function reproducir(manual: boolean) {
    if (!fragmentos) return
    setError(null)
    reproductor.current?.detener()
    let pistas: Pista[]
    if (manual) {
      pistas = fragmentos.flatMap((f, i) => [
        { titulo: `Pregunta ${i + 1}`, audio: f.pregunta },
        { titulo: `Respuesta ${i + 1}`, audio: f.respuesta },
      ])
    } else {
      const partes: Parte[] = fragmentos.flatMap((f) => [
        f.pregunta,
        { silencioSegundos: pausa },
        f.respuesta,
        { silencioSegundos: 1.5 },
      ])
      pistas = [{ titulo: 'Repaso de prueba', audio: unirWav(partes) }]
    }
    reproductor.current = new Reproductor(pistas, manual, setEstado)
    try {
      await reproductor.current.empezar()
    } catch (e) {
      fallar(e)
    }
  }

  return (
    <main>
      <section className="tarjeta">
        <h2>Prueba de audio con pantalla apagada</h2>
        <p>
          Esta pantalla sirve para comprobar en tu teléfono qué voz sigue sonando con la pantalla apagada. Prueba cada
          opción: dale a reproducir, espera a que empiece y apaga la pantalla con el botón de encendido.
        </p>
      </section>

      <section className="tarjeta">
        <h2>Pausa antes de la respuesta</h2>
        <div className="fila">
          {[2, 4, 8].map((s) => (
            <button key={s} type="button" className={pausa === s ? '' : 'secundario'} onClick={() => setPausa(s)}>
              {s} s
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        <h2>Opción A · Voz del teléfono</h2>
        <p>No necesita descarga. Esperamos que se corte al apagar la pantalla.</p>
        <div className="fila">
          {telefonoSonando ? (
            <button type="button" onClick={pararVozDelTelefono}>
              Detener
            </button>
          ) : (
            <button type="button" onClick={escucharConVozDelTelefono}>
              Escuchar 5 fichas
            </button>
          )}
        </div>
      </section>

      <section className="tarjeta">
        <h2>Opción B · Voz neuronal en el teléfono</h2>
        <p>Se descarga una vez (unos 63 MB, mejor con wifi) y después funciona sin internet.</p>
        <div className="fila">
          {vozLista !== true && !descarga && (
            <button type="button" onClick={descargar}>
              Descargar voz
            </button>
          )}
          {descarga && (
            <span>
              Descargando… {Math.round(descarga.cargadoMB)} de {Math.round(descarga.totalMB)} MB
            </span>
          )}
          {vozLista && !fragmentos && !preparando && (
            <button type="button" onClick={prepararAudio}>
              Preparar audio de 5 fichas
            </button>
          )}
          {preparando && <span>{preparando}</span>}
          {fragmentos && (
            <>
              <button type="button" onClick={() => reproducir(false)}>
                Automático
              </button>
              <button type="button" onClick={() => reproducir(true)}>
                Manual
              </button>
            </>
          )}
        </div>
        {estado && estado.total > 0 && (
          <div className="fila">
            <span>
              {estado.esperando
                ? 'Esperando: toca Continuar (o reproducir en la pantalla de bloqueo o los audífonos)'
                : estado.sonando
                  ? `Sonando ${estado.indice + 1} de ${estado.total}`
                  : 'En pausa'}
            </span>
            <button type="button" onClick={() => reproductor.current?.continuar()}>
              Continuar
            </button>
            <button type="button" className="secundario" onClick={() => reproductor.current?.pausar()}>
              Pausar
            </button>
            <button type="button" className="secundario" onClick={() => reproductor.current?.detener()}>
              Detener
            </button>
          </div>
        )}
      </section>

      {error && (
        <section className="tarjeta error" role="alert">
          <h2>Algo falló</h2>
          <p>{error}</p>
        </section>
      )}

      <section className="tarjeta">
        <h2>Qué contarme</h2>
        <ul className="datos">
          <li>¿La opción A siguió sonando con la pantalla apagada?</li>
          <li>¿La opción B siguió sonando en automático y en manual?</li>
          <li>En manual, ¿pudiste continuar desde la pantalla de bloqueo o los audífonos?</li>
          <li>¿Cuál voz te gusta más?</li>
        </ul>
      </section>
    </main>
  )
}
