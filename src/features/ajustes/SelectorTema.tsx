import { useState } from 'react'
import { TEMAS, guardarTema, leerTema } from '../../core/tema/tema'

export function SelectorTema() {
  const [tema, setTema] = useState(leerTema)
  return (
    <section className="tarjeta">
      <h2>🌙 Colores de la pantalla</h2>
      <fieldset className="temas">
        <legend>Para estudiar de día o de noche</legend>
        {TEMAS.map((t) => (
          <label key={t.id} className={`tema-opcion tema-${t.id}`}>
            <input
              type="radio"
              name="tema"
              checked={tema === t.id}
              onChange={() => {
                setTema(t.id)
                guardarTema(t.id)
              }}
            />
            <span>
              <strong>{t.nombre}</strong>
              <small>{t.detalle}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="ayuda">De noche ayuda también bajar el brillo y activar la luz nocturna del teléfono.</p>
    </section>
  )
}
