import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { audioDe } from '../../core/audio/cacheAudio'
import { Reproductor, type EstadoReproductor, type Pista } from '../../core/audio/reproductor'
import { descargarVozLocal, vozLocalDescargada, type Progreso } from '../../core/audio/vozLocal'
import { callar, esperar, hablar, textoParaLeer } from '../../core/audio/vozTelefono'
import { duracionSegundos, unirWav, type Parte } from '../../core/audio/wav'
import { guardarAjustesAudio, useAjustesAudio } from '../../core/db/ajustes'
import { db } from '../../core/db/db'
import { rutaDeMazo } from '../../core/db/organizacion'
import { fichasParaEscuchar, type FichaTexto } from './fuentesEscucha'

const PAUSA_ENTRE_FICHAS = 1.5

type Sesion = {
  fichas: FichaTexto[]
  // Para el modo automático: segundo en que empieza cada ficha dentro de la pista única.
  inicios: number[]
  manual: boolean
}

export function Escuchar() {
  const ajustes = useAjustesAudio()
  const mazos = useLiveQuery(async () => {
    const todos = (await db.mazos.toArray()).filter((m) => !m.borrada)
    const materias = new Map((await db.materias.toArray()).map((m) => [m.id, m.nombre]))
    return todos
      .map((m) => ({ id: m.id, nombre: `${materias.get(m.materiaId) ?? ''} › ${rutaDeMazo(todos, m.id).join(' › ')}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  })
  const [origen, setOrigen] = useState<'hoy' | string>('hoy')
  const [vozLista, setVozLista] = useState<boolean | null>(null)
  const [descarga, setDescarga] = useState<Progreso | null>(null)
  const [preparando, setPreparando] = useState<string | null>(null)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [estado, setEstado] = useState<EstadoReproductor | null>(null)
  const [actualTelefono, setActualTelefono] = useState<{ indice: number; lado: 'frente' | 'reverso' } | null>(null)
  const [esperandoToque, setEsperandoToque] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reproductor = useRef<Reproductor | null>(null)
  const detenerTelefono = useRef(false)
  const continuarTelefono = useRef<(() => void) | null>(null)

  useEffect(() => {
    vozLocalDescargada().then(setVozLista, () => setVozLista(false))
    return () => {
      callar()
      detenerTelefono.current = true
      reproductor.current?.detener()
    }
  }, [])

  const fallar = (e: unknown) => setError(e instanceof Error ? e.message : String(e))

  function detener() {
    detenerTelefono.current = true
    continuarTelefono.current?.()
    callar()
    reproductor.current?.detener()
    reproductor.current = null
    setSesion(null)
    setEstado(null)
    setActualTelefono(null)
    setEsperandoToque(false)
  }

  async function empezar() {
    setError(null)
    detener()
    const fichas = await fichasParaEscuchar(origen)
    if (fichas.length === 0) return setError('No hay fichas para escuchar aquí.')
    const manual = ajustes.modo === 'manual'
    if (ajustes.voz === 'telefono') return void escucharConTelefono(fichas, manual)

    try {
      const partes: Parte[] = []
      const pistas: Pista[] = []
      const inicios: number[] = []
      let segundo = 0
      for (const [i, f] of fichas.entries()) {
        setPreparando(`Preparando audio ${i + 1} de ${fichas.length}…`)
        const frente = await audioDe(f.fichaId, 'frente', textoParaLeer(f.frente))
        const reverso = await audioDe(f.fichaId, 'reverso', textoParaLeer(f.reverso))
        inicios.push(segundo)
        segundo += duracionSegundos(frente) + ajustes.pausaSegundos + duracionSegundos(reverso) + PAUSA_ENTRE_FICHAS
        partes.push(frente, { silencioSegundos: ajustes.pausaSegundos }, reverso, { silencioSegundos: PAUSA_ENTRE_FICHAS })
        pistas.push({ titulo: f.titulo, audio: frente }, { titulo: `Respuesta: ${f.titulo}`, audio: reverso })
      }
      setPreparando(null)
      const lista = manual ? pistas : [{ titulo: `La Doc · ${fichas.length} fichas`, audio: unirWav(partes) }]
      setSesion({ fichas, inicios, manual })
      reproductor.current = new Reproductor(lista, manual, setEstado)
      await reproductor.current.empezar()
    } catch (e) {
      setPreparando(null)
      fallar(e)
    }
  }

  // Voz del teléfono: inmediata, pero solo con la pantalla encendida.
  async function escucharConTelefono(fichas: FichaTexto[], manual: boolean) {
    detenerTelefono.current = false
    setSesion({ fichas, inicios: [], manual })
    const tocar = () =>
      new Promise<void>((ok) => {
        setEsperandoToque(true)
        continuarTelefono.current = () => {
          setEsperandoToque(false)
          continuarTelefono.current = null
          ok()
        }
      })
    try {
      for (const [i, f] of fichas.entries()) {
        if (detenerTelefono.current) break
        setActualTelefono({ indice: i, lado: 'frente' })
        await hablar(textoParaLeer(f.frente), ajustes.velocidad)
        if (manual) await tocar()
        else await esperar(ajustes.pausaSegundos)
        if (detenerTelefono.current) break
        setActualTelefono({ indice: i, lado: 'reverso' })
        await hablar(textoParaLeer(f.reverso), ajustes.velocidad)
        if (manual) await tocar()
        else await esperar(PAUSA_ENTRE_FICHAS)
      }
    } catch (e) {
      fallar(e)
    }
    if (!detenerTelefono.current) detener()
  }

  // Qué ficha se está escuchando, para mostrarla en pantalla.
  let indiceActual: number | null = null
  let ladoActual: 'frente' | 'reverso' = 'frente'
  if (sesion && actualTelefono) {
    indiceActual = actualTelefono.indice
    ladoActual = actualTelefono.lado
  } else if (sesion && estado) {
    if (sesion.manual) {
      indiceActual = Math.floor(estado.indice / 2)
      ladoActual = estado.indice % 2 === 0 ? 'frente' : 'reverso'
    } else {
      const s = estado.segundo
      indiceActual = Math.max(0, sesion.inicios.findLastIndex((inicio) => inicio <= s))
      ladoActual = 'frente'
    }
  }
  const fichaActual = indiceActual !== null ? sesion?.fichas[indiceActual] : undefined

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>Modo escuchar</h2>
        <p>
          Escucha tus fichas como un podcast. No cambia tu repaso: solo es para reforzar de oído. Con la voz neuronal
          sigue sonando con la pantalla apagada.
        </p>
      </section>

      {!sesion && (
        <section className="tarjeta ajustes-escucha">
          <label>
            <span>Qué escuchar</span>
            <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="hoy">Repaso de hoy</option>
              {mazos?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Voz</legend>
            <label>
              <input type="radio" checked={ajustes.voz === 'telefono'} onChange={() => guardarAjustesAudio({ voz: 'telefono' })} /> Del
              teléfono (solo con pantalla encendida)
            </label>
            <label>
              <input type="radio" checked={ajustes.voz === 'neuronal'} onChange={() => guardarAjustesAudio({ voz: 'neuronal' })} />{' '}
              Neuronal (sigue con pantalla apagada)
            </label>
          </fieldset>
          <fieldset>
            <legend>Avance</legend>
            <label>
              <input type="radio" checked={ajustes.modo === 'automatico'} onChange={() => guardarAjustesAudio({ modo: 'automatico' })} />{' '}
              Automático, con pausa
            </label>
            <label>
              <input type="radio" checked={ajustes.modo === 'manual'} onChange={() => guardarAjustesAudio({ modo: 'manual' })} /> Manual,
              espera tu toque
            </label>
          </fieldset>
          {ajustes.modo === 'automatico' && (
            <label>
              <span>Pausa antes de la respuesta: {ajustes.pausaSegundos} s</span>
              <input
                type="range"
                min={1}
                max={15}
                value={ajustes.pausaSegundos}
                onChange={(e) => guardarAjustesAudio({ pausaSegundos: Number(e.target.value) })}
              />
            </label>
          )}
          {ajustes.voz === 'telefono' && (
            <label>
              <span>Velocidad: {ajustes.velocidad.toFixed(1).replace('.', ',')}×</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.1}
                value={ajustes.velocidad}
                onChange={(e) => guardarAjustesAudio({ velocidad: Number(e.target.value) })}
              />
            </label>
          )}

          {ajustes.voz === 'neuronal' && vozLista !== true ? (
            descarga ? (
              <p>
                Descargando voz… {Math.round(descarga.cargadoMB)} de {Math.round(descarga.totalMB)} MB
              </p>
            ) : (
              <div className="fila">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await descargarVozLocal(setDescarga)
                      setVozLista(true)
                    } catch (e) {
                      fallar(e)
                    } finally {
                      setDescarga(null)
                    }
                  }}
                >
                  Descargar voz (63 MB, una sola vez)
                </button>
              </div>
            )
          ) : preparando ? (
            <p>{preparando}</p>
          ) : (
            <div className="fila">
              <button type="button" onClick={empezar}>
                ▶ Empezar
              </button>
            </div>
          )}
        </section>
      )}

      {sesion && (
        <section className="tarjeta repaso-ficha escuchando">
          {fichaActual ? (
            <>
              <p className="ayuda">
                Ficha {(indiceActual ?? 0) + 1} de {sesion.fichas.length}
              </p>
              <p className="repaso-frente">{fichaActual.frente}</p>
              {(ladoActual === 'reverso' || !sesion.manual) && (
                <>
                  <hr />
                  <p className="repaso-reverso">{fichaActual.reverso}</p>
                </>
              )}
            </>
          ) : (
            <p>Empezando…</p>
          )}
        </section>
      )}

      {sesion && (
        <div className="fila controles-escucha">
          {(esperandoToque || estado?.esperando) && (
            <button
              type="button"
              onClick={() => (continuarTelefono.current ? continuarTelefono.current() : reproductor.current?.continuar())}
            >
              Continuar
            </button>
          )}
          {estado && !estado.esperando && (
            <button type="button" className="secundario" onClick={() => (estado.sonando ? reproductor.current?.pausar() : reproductor.current?.continuar())}>
              {estado.sonando ? 'Pausar' : 'Reanudar'}
            </button>
          )}
          <button type="button" className="secundario peligro" onClick={detener}>
            Detener
          </button>
        </div>
      )}

      {error && (
        <section className="tarjeta error" role="alert">
          <p>{error}</p>
        </section>
      )}
    </main>
  )
}
