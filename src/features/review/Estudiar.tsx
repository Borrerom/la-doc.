import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../../core/db/db'
import { verFicha, type FichaVista } from '../../core/db/fichas'
import { arbolDeMazos, listarMaterias, listarMazos, rutaDeMazo, type NodoMazo } from '../../core/db/organizacion'
import type { Calificacion } from '../../core/model/tipos'
import { fichasParaEstudiar, mezclar, siguiente, type OrigenEstudio } from '../../core/srs/estudio'
import { registrarRespuesta, type FichaEnCola } from '../../core/srs/repaso'
import { FichaEnPantalla } from './FichaEnPantalla'

// Estudiar un tema o una materia completa cuando ella quiera, a su ritmo, sin esperar al repaso de hoy.
const CLAVE = 'la-doc:estudio'
type Preferencias = { mezclar: boolean; contar: boolean }

function leerPreferencias(): Preferencias {
  try {
    return { mezclar: false, contar: false, ...(JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Preferencias>) }
  } catch {
    return { mezclar: false, contar: false }
  }
}

function guardarPreferencias(p: Preferencias) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p))
  } catch {
    // Sin almacenamiento del navegador, simplemente no se recuerda.
  }
}

type EnSesion = { item: FichaEnCola; vista: FichaVista }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function Estudiar({ origen }: { origen: OrigenEstudio }) {
  const clave = 'mazoId' in origen ? origen.mazoId : origen.materiaId
  const datos = useLiveQuery(async () => {
    if ('mazoId' in origen) {
      const mazo = await db.mazos.get(origen.mazoId)
      if (!mazo) return { nombre: null, volver: '#/', total: 0 }
      const nombre = rutaDeMazo(await listarMazos(mazo.materiaId), mazo.id).join(' › ')
      return { nombre, volver: `#/mazo/${mazo.id}`, total: (await fichasParaEstudiar(origen, Date.now())).length }
    }
    const materia = await db.materias.get(origen.materiaId)
    return { nombre: materia?.nombre ?? null, volver: '#/', total: (await fichasParaEstudiar(origen, Date.now())).length }
  }, [clave])
  const [prefs, setPrefs] = useState(leerPreferencias)
  const [cola, setCola] = useState<EnSesion[] | null>(null)
  const [vistas, setVistas] = useState(0)
  const [respuestaVisible, setRespuestaVisible] = useState(false)
  const inicio = useRef(0)
  const guardando = useRef(false)

  const cambiar = (p: Partial<Preferencias>) => {
    const nuevas = { ...prefs, ...p }
    setPrefs(nuevas)
    guardarPreferencias(nuevas)
  }

  async function empezar() {
    const ahora = Date.now()
    const tipos = new Map((await db.tiposNota.toArray()).map((t) => [t.id, t]))
    const items = (await fichasParaEstudiar(origen, ahora)).flatMap((item) => {
      const tipo = tipos.get(item.nota.tipoNotaId)
      return tipo ? [{ item, vista: verFicha(item.ficha, item.nota, tipo) }] : []
    })
    setCola(prefs.mezclar ? mezclar(items) : items)
    setVistas(0)
    setRespuestaVisible(false)
    inicio.current = Date.now()
  }

  async function responder(calificacion: Calificacion) {
    if (!cola?.[0] || guardando.current) return
    guardando.current = true
    try {
      const [primera, ...resto] = cola
      let actual = primera
      if (prefs.contar) {
        const ahora = Date.now()
        const estado = await registrarRespuesta(primera.item, calificacion, ahora, ahora - inicio.current)
        actual = { ...primera, item: { ...primera.item, estado, nueva: false } }
      }
      setCola(siguiente([actual, ...resto], calificacion))
      setVistas((v) => v + 1)
      setRespuestaVisible(false)
      inicio.current = Date.now()
    } finally {
      guardando.current = false
    }
  }

  if (!datos) return null
  if (datos.nombre === null) {
    return (
      <main>
        <a href="#/estudiar" className="volver">
          ← Elegir otro tema
        </a>
        <p className="tarjeta">Este tema ya no existe.</p>
      </main>
    )
  }

  if (cola && cola.length > 0) {
    const primera = cola[0]
    return (
      <FichaEnPantalla
        vista={primera.vista}
        respuestaVisible={respuestaVisible}
        alMostrar={() => setRespuestaVisible(true)}
        alResponder={(c) => void responder(c)}
        salir={{ href: datos.volver, texto: '← Salir' }}
        estado={<>Quedan {cola.length}</>}
      />
    )
  }

  return (
    <main>
      <a href={datos.volver} className="volver">
        ← Volver
      </a>
      {cola ? (
        <section className="tarjeta repaso-fin">
          <h2>¡Terminaste!</h2>
          <p>
            Estudiaste {datos.nombre}: {plural(vistas, 'respuesta', 'respuestas')}.
          </p>
          <div className="fila centrada">
            <button type="button" onClick={() => void empezar()}>
              Otra vuelta
            </button>
            <a className="boton-secundario" href="#/estudiar">
              Elegir otro tema
            </a>
          </div>
        </section>
      ) : (
        <section className="tarjeta ajustes-escucha estudiar-ajustes">
          <h2>📚 Estudiar {datos.nombre}</h2>
          <p>
            {datos.total === 0
              ? 'Todavía no hay fichas aquí. Agrega fármacos, patologías o casos a este tema.'
              : `${plural(datos.total, 'ficha', 'fichas')}, contando ${'mazoId' in origen ? 'los subtemas' : 'todos sus temas'}. Estudia a tu ritmo, cuando quieras.`}
          </p>
          <fieldset>
            <legend>Orden</legend>
            <label>
              <input type="radio" name="orden" checked={!prefs.mezclar} onChange={() => cambiar({ mezclar: false })} /> En orden
            </label>
            <label>
              <input type="radio" name="orden" checked={prefs.mezclar} onChange={() => cambiar({ mezclar: true })} /> Mezcladas
            </label>
          </fieldset>
          <label className="casilla">
            <input type="checkbox" checked={prefs.contar} onChange={(e) => cambiar({ contar: e.target.checked })} />
            <span>
              Contar para mi repaso
              <small>
                {prefs.contar
                  ? 'Tus respuestas cambian cuándo vuelve cada ficha en el Repaso de hoy.'
                  : 'Apagado: es práctica libre y tu Repaso de hoy no cambia.'}
              </small>
            </span>
          </label>
          <p className="ayuda">«Mal» la repite en un momento, «Difícil» al final, «Bien» y «Fácil» la dan por lista.</p>
          <button type="button" disabled={datos.total === 0} onClick={() => void empezar()}>
            ▶ Empezar
          </button>
        </section>
      )}
    </main>
  )
}

function RamaTemas({ nodos }: { nodos: NodoMazo[] }) {
  return (
    <ul className="lista">
      {nodos.map((n) => (
        <li key={n.id}>
          <a className="fila-enlace" href={`#/estudiar/tema/${n.id}`}>
            <span className="tema-nombre">{n.nombre}</span>
            <span aria-hidden="true">›</span>
          </a>
          {n.hijos.length > 0 && (
            <div className="subtemas">
              <RamaTemas nodos={n.hijos} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// Elegir qué estudiar: una materia completa o uno de sus temas.
export function ElegirEstudio() {
  const datos = useLiveQuery(async () => {
    const materias = await listarMaterias()
    return Promise.all(materias.map(async (m) => ({ materia: m, temas: arbolDeMazos(await listarMazos(m.id)) })))
  })
  if (!datos) return null
  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>📚 Estudiar un tema</h2>
        <p>Elige una materia o un tema y estudia todas sus fichas cuando quieras, sin esperar al repaso de hoy.</p>
      </section>
      {datos.map(({ materia, temas }) => (
        <section key={materia.id} className="tarjeta">
          <h2>
            <span className="punto" style={{ background: materia.color }} /> {materia.nombre}
          </h2>
          <a className="boton-secundario" href={`#/estudiar/materia/${materia.id}`}>
            Toda la materia
          </a>
          {temas.length === 0 ? <p className="ayuda">Sin temas todavía.</p> : <RamaTemas nodos={temas} />}
        </section>
      ))}
    </main>
  )
}
