import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Grabadora, MINUTOS_MAXIMOS } from '../../core/capture/grabadora'
import { reducirImagen } from '../../core/capture/imagen'
import { crearCarga, MAXIMO_MB } from '../../core/db/cargas'
import { db } from '../../core/db/db'
import { rutaDeMazo } from '../../core/db/organizacion'
import type { Carga } from '../../core/model/tipos'
import { AudioDe, Miniatura } from './Miniatura'

const minutos = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function Capturar({ mazoId }: { mazoId: string }) {
  const destino = useLiveQuery(async () => {
    const mazos = (await db.mazos.toArray()).filter((m) => !m.borrada)
    const mazo = mazos.find((m) => m.id === mazoId)
    if (!mazo) return null
    const materia = await db.materias.get(mazo.materiaId)
    return { ruta: `${materia?.nombre ?? ''} › ${rutaDeMazo(mazos, mazoId).join(' › ')}` }
  }, [mazoId])
  const [tipo, setTipo] = useState<Carga['tipo']>('foto')
  const [fotos, setFotos] = useState<Blob[]>([])
  const [pdf, setPdf] = useState<File | null>(null)
  const [audio, setAudio] = useState<Blob | null>(null)
  const [indicacion, setIndicacion] = useState('')
  const [segundos, setSegundos] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const grabadora = useRef<Grabadora | null>(null)

  useEffect(() => () => grabadora.current?.cancelar(), [])

  async function terminarGrabacion() {
    const g = grabadora.current
    if (!g) return
    grabadora.current = null
    setSegundos(null)
    setAudio(await g.terminar())
  }

  useEffect(() => {
    if (segundos === null) return
    if (segundos >= MINUTOS_MAXIMOS * 60) {
      void terminarGrabacion()
      return
    }
    const t = setTimeout(() => setSegundos((s) => (s === null ? null : s + 1)), 1000)
    return () => clearTimeout(t)
  }, [segundos])

  if (destino === undefined) return null
  if (destino === null) {
    return (
      <main>
        <a href="#/" className="volver">
          ← Inicio
        </a>
        <p className="tarjeta">Ese mazo ya no existe.</p>
      </main>
    )
  }

  const archivos = tipo === 'foto' ? fotos : tipo === 'pdf' ? (pdf ? [pdf] : []) : audio ? [audio] : []

  async function agregarFotos(lista: FileList | null) {
    if (!lista?.length) return
    setOcupado(true)
    try {
      const nuevas = await Promise.all([...lista].map(reducirImagen))
      setFotos((f) => [...f, ...nuevas])
    } finally {
      setOcupado(false)
    }
  }

  async function grabar() {
    setError(null)
    const g = new Grabadora()
    try {
      await g.empezar()
      grabadora.current = g
      setAudio(null)
      setSegundos(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function guardar() {
    setError(null)
    setOcupado(true)
    try {
      await crearCarga({ tipo, archivos, mazoId, indicacion })
      location.hash = '#/cargas'
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main>
      <a href={`#/mazo/${mazoId}`} className="volver">
        ← Volver al mazo
      </a>
      <section className="tarjeta">
        <h2>Cargar con IA</h2>
        <p>
          Destino: <strong>{destino.ruta}</strong>
        </p>
        <p className="ayuda">
          Se guarda en el teléfono aunque no haya internet. La IA lo procesa cuando vuelva la conexión y tú revisas
          cada fármaco, patología o caso que encuentre antes de que entre al tema.
        </p>
        <div className="selector tipos-carga" role="group" aria-label="Qué vas a cargar">
          {(
            [
              ['foto', '📷 Fotos'],
              ['pdf', '📄 PDF'],
              ['voz', '🎙 Voz'],
            ] as const
          ).map(([t, nombre]) => (
            <button key={t} type="button" className={tipo === t ? '' : 'secundario'} onClick={() => setTipo(t)}>
              {nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        {tipo === 'foto' && (
          <>
            <h2>Fotos del apunte o del libro</h2>
            <p>Puedes tomar varias: cada una es una página.</p>
            <div className="fila">
              <label className="boton">
                📷 Tomar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void agregarFotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
              <label className="boton-secundario">
                Elegir de la galería
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  aria-label="Elegir fotos de la galería"
                  onChange={(e) => {
                    void agregarFotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {fotos.length > 0 && (
              <ul className="miniaturas">
                {fotos.map((f, i) => (
                  <li key={i}>
                    <Miniatura blob={f} alt={`Página ${i + 1}`} />
                    <button
                      type="button"
                      className="secundario"
                      aria-label={`Quitar página ${i + 1}`}
                      onClick={() => setFotos((todas) => todas.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tipo === 'pdf' && (
          <>
            <h2>Un PDF</h2>
            <p>Guías, diapositivas o capítulos. Máximo {MAXIMO_MB} MB.</p>
            <label className="boton">
              Elegir PDF
              <input
                type="file"
                accept="application/pdf"
                hidden
                aria-label="Elegir PDF"
                onChange={(e) => {
                  setPdf(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
            {pdf && (
              <p>
                📄 <strong>{pdf.name}</strong> ({(pdf.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </>
        )}

        {tipo === 'voz' && (
          <>
            <h2>Nota de voz</h2>
            <p>Dicta lo que dijo el profesor o lo que leíste. Hasta {MINUTOS_MAXIMOS} minutos.</p>
            {segundos !== null ? (
              <div className="fila">
                <span className="grabando">● Grabando {minutos(segundos)}</span>
                <button type="button" onClick={() => void terminarGrabacion()}>
                  ■ Terminar
                </button>
              </div>
            ) : (
              <div className="fila">
                <button type="button" onClick={grabar}>
                  🎙 {audio ? 'Grabar de nuevo' : 'Grabar'}
                </button>
              </div>
            )}
            {audio && <AudioDe blob={audio} etiqueta="Nota de voz grabada" />}
          </>
        )}
      </section>

      <section className="tarjeta editor-nota">
        <label>
          <span>Indicaciones para la IA (opcional)</span>
          <textarea
            rows={2}
            placeholder="Ejemplo: solo el caso de la página 2"
            value={indicacion}
            onChange={(e) => setIndicacion(e.target.value)}
          />
        </label>
        {error && <p className="texto-error">{error}</p>}
        <div className="fila">
          <button type="button" disabled={archivos.length === 0 || ocupado || segundos !== null} onClick={guardar}>
            {ocupado ? 'Guardando…' : 'Guardar en la cola'}
          </button>
        </div>
      </section>
    </main>
  )
}
