import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../core/db/db'
import { asegurarEjemplosEstructura, asegurarEjemplosIniciales } from '../../core/db/ejemplos'
import { asegurarMateriasIniciales } from '../../core/db/materiasIniciales'
import { crearMateria, crearMazo, crearSemestre, descendientes, listarMaterias, listarSemestres } from '../../core/db/organizacion'
import { listarTiposNota, nombresDeTipo, TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from '../../core/db/tiposNota'
import type { Id, Materia, TipoNota } from '../../core/model/tipos'
import { FormularioNombre } from '../../ui/FormularioNombre'

// Tablero del Inicio: cada materia es un desplegable con sus temas. Al tocar un tema se abre su
// pantalla con los fármacos. Qué materias quedaron abiertas se recuerda en este teléfono.
const CLAVE_ABIERTAS = 'la-doc:materias-abiertas'

function leerAbiertas(): Set<Id> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_ABIERTAS) ?? '[]') as Id[])
  } catch {
    return new Set()
  }
}

function guardarAbiertas(abiertas: Set<Id>) {
  try {
    localStorage.setItem(CLAVE_ABIERTAS, JSON.stringify([...abiertas]))
  } catch {
    // Sin almacenamiento del navegador, simplemente no se recuerda.
  }
}

const EJEMPLO_TEMA: Record<Id, string> = { [TIPO_FARMACO]: 'Antibióticos', [TIPO_PATOLOGIA]: 'Cardiovascular', [TIPO_CASO]: 'Casos de la semana 1' }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

type Conteo = Map<Id, number>

function sumar(a: Conteo, b: Conteo | undefined) {
  for (const [k, v] of b ?? []) a.set(k, (a.get(k) ?? 0) + v)
  return a
}

// "3 fármacos · 1 patología", en el orden de los tipos.
function describir(conteo: Conteo, tipos: TipoNota[], vacio: string) {
  const partes = tipos.filter((t) => conteo.get(t.id)).map((t) => {
    const n = nombresDeTipo(t)
    return plural(conteo.get(t.id)!, n.uno, n.varios)
  })
  return partes.length ? partes.join(' · ') : vacio
}

function MateriaDesplegable({ materia, abierta, alCambiar }: { materia: Materia; abierta: boolean; alCambiar: (a: boolean) => void }) {
  const datos = useLiveQuery(async () => {
    const [mazos, tipos] = await Promise.all([
      db.mazos.where('materiaId').equals(materia.id).filter((m) => !m.borrada).toArray(),
      listarTiposNota(),
    ])
    const notas = await db.notas
      .where('mazoId')
      .anyOf(mazos.map((m) => m.id))
      .filter((n) => n.borrada === undefined)
      .toArray()
    const porMazo = new Map<Id, Conteo>()
    for (const n of notas) {
      const c = porMazo.get(n.mazoId) ?? new Map()
      c.set(n.tipoNotaId, (c.get(n.tipoNotaId) ?? 0) + 1)
      porMazo.set(n.mazoId, c)
    }
    const temas = mazos
      .filter((m) => !m.padreId)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((m) => {
        const subtemas = descendientes(mazos, m.id)
        const conteo = [m, ...subtemas].reduce((c, x) => sumar(c, porMazo.get(x.id)), new Map() as Conteo)
        return { id: m.id, nombre: m.nombre, conteo, subtemas: subtemas.length }
      })
    const total = temas.reduce((c, t) => sumar(c, t.conteo), new Map() as Conteo)
    return { temas, tipos, total }
  }, [materia.id])
  const temas = datos?.temas
  const [agregando, setAgregando] = useState(false)

  return (
    <details className="tarjeta materia" open={abierta} onToggle={(e) => alCambiar(e.currentTarget.open)}>
      <summary>
        <span className="punto" style={{ background: materia.color }} />
        <span className="materia-nombre">{materia.nombre}</span>
        {datos && (
          <small>
            {datos.temas.length === 0
              ? 'Sin temas todavía'
              : `${plural(datos.temas.length, 'tema', 'temas')} · ${describir(datos.total, datos.tipos, 'vacía')}`}
          </small>
        )}
      </summary>
      {temas?.length === 0 && <p>Todavía no hay temas. Crea el primero, por ejemplo "{EJEMPLO_TEMA[materia.tipoPrincipal ?? ''] ?? 'Unidad 1'}".</p>}
      <ul className="lista">
        {temas?.map((t) => (
          <li key={t.id}>
            <a className="fila-enlace" href={`#/mazo/${t.id}`}>
              <span className="tema-nombre">{t.nombre}</span>
              <small>
                {describir(t.conteo, datos!.tipos, 'vacío')}
                {t.subtemas > 0 && ` · ${plural(t.subtemas, 'subtema', 'subtemas')}`}
              </small>
              <span aria-hidden="true">›</span>
            </a>
          </li>
        ))}
      </ul>
      {agregando ? (
        <FormularioNombre
          etiqueta="Nombre del tema"
          boton="Agregar"
          alGuardar={async (n) => {
            await crearMazo(n, materia.id)
            setAgregando(false)
          }}
          alCancelar={() => setAgregando(false)}
        />
      ) : (
        <div className="fila">
          <button type="button" className="secundario" onClick={() => setAgregando(true)}>
            + Nuevo tema
          </button>
          {temas && temas.length > 0 && (
            <a className="boton-secundario" href={`#/estudiar/materia/${materia.id}`}>
              📚 Estudiar la materia
            </a>
          )}
          <a className="boton-secundario" href={`#/materia/${materia.id}`}>
            ⚙ Organizar temas
          </a>
        </div>
      )}
    </details>
  )
}

export function Materias() {
  const semestres = useLiveQuery(listarSemestres)
  const materias = useLiveQuery(listarMaterias)
  const [agregandoEn, setAgregandoEn] = useState<string | null>(null)
  const [abiertas, setAbiertas] = useState(leerAbiertas)
  const haySemestre = (semestres?.length ?? 0) > 0

  useEffect(() => {
    // Primero Farmacología con sus ejemplos, después las otras materias (sin duplicarla) y sus ejemplos.
    if (haySemestre) void asegurarEjemplosIniciales().then(asegurarMateriasIniciales).then(asegurarEjemplosEstructura)
  }, [haySemestre])

  if (!semestres || !materias) return null

  if (semestres.length === 0) {
    return (
      <section className="tarjeta">
        <h2>Bienvenida a Doc Desi</h2>
        <p>Para empezar, dime en qué semestre estás. Por ejemplo: "Semestre 5".</p>
        <FormularioNombre etiqueta="Nombre del semestre" boton="Crear" alGuardar={crearSemestre} />
      </section>
    )
  }

  const cambiar = (id: Id, abierta: boolean) => {
    if (abiertas.has(id) === abierta) return
    const nuevas = new Set(abiertas)
    if (abierta) nuevas.add(id)
    else nuevas.delete(id)
    setAbiertas(nuevas)
    guardarAbiertas(nuevas)
  }

  return (
    <>
      {semestres.map((s) => {
        const deEste = materias.filter((m) => m.semestreId === s.id)
        return (
          <section className="semestre" key={s.id}>
            <h2 className="semestre-titulo">{s.nombre}</h2>
            {deEste.length === 0 && (
              <p className="ayuda">Todavía no hay materias. Empieza con Farmacología 1.</p>
            )}
            {deEste.map((m) => (
              <MateriaDesplegable key={m.id} materia={m} abierta={abiertas.has(m.id)} alCambiar={(a) => cambiar(m.id, a)} />
            ))}
            {agregandoEn === s.id ? (
              <section className="tarjeta">
                <FormularioNombre
                  etiqueta="Nombre de la materia"
                  boton="Agregar"
                  valorInicial={deEste.length === 0 ? 'Farmacología 1' : ''}
                  alGuardar={async (nombre) => {
                    await crearMateria(nombre, s.id)
                    setAgregandoEn(null)
                  }}
                  alCancelar={() => setAgregandoEn(null)}
                />
              </section>
            ) : (
              <button type="button" className="secundario" onClick={() => setAgregandoEn(s.id)}>
                + Agregar materia
              </button>
            )}
          </section>
        )
      })}
    </>
  )
}

// Solo cuando ya hay uno: el primero se crea en la bienvenida.
export function AgregarSemestre() {
  const cuantos = useLiveQuery(() => db.semestres.count())
  if (!cuantos) return null
  return (
    <section className="tarjeta">
      <h2>Agregar otro semestre</h2>
      <FormularioNombre etiqueta="Nombre del semestre" boton="Crear" alGuardar={crearSemestre} />
    </section>
  )
}
