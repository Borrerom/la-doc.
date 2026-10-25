import { useEffect, useState } from 'react'
import { buscar, type Resultado } from '../../core/search/buscador'

export function Buscar() {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState<Resultado[] | null>(null)

  useEffect(() => {
    let vigente = true
    const espera = setTimeout(() => {
      buscar(consulta).then((r) => vigente && setResultados(consulta.trim() ? r : null))
    }, 150)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [consulta])

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <input
          className="filtro buscador"
          type="search"
          aria-label="Buscar"
          placeholder="Buscar fármaco, efecto, etiqueta…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          autoFocus
        />
        <p className="ayuda">Funciona sin internet y tolera errores de tipeo y acentos.</p>
      </section>

      {resultados && resultados.length === 0 && (
        <section className="tarjeta">
          <p>No encontré nada con "{consulta}".</p>
        </section>
      )}

      {resultados && resultados.length > 0 && (
        <section className="tarjeta">
          <ul className="lista resultados">
            {resultados.map((r) => (
              <li key={r.notaId}>
                <a href={`#/nota/${r.notaId}`}>
                  <strong>{r.titulo}</strong>
                  {r.campo && (
                    <span>
                      <em>{r.campo}:</em> {r.fragmento}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
