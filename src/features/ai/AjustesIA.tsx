import { useEffect, useState } from 'react'
import { useConexion } from '../../app/useConexion'
import {
  asegurarProveedores,
  guardarProveedor,
  moverProveedor,
  probarProveedor,
  PROVEEDORES,
  useProveedores,
} from '../../core/ai/proveedores'
import type { ProveedorIA } from '../../core/model/tipos'

function ocultar(clave: string) {
  return clave.length <= 8 ? '••••' : `${clave.slice(0, 4)}••••${clave.slice(-4)}`
}

function TarjetaProveedor({ p, posicion, total }: { p: ProveedorIA; posicion: number; total: number }) {
  const info = PROVEEDORES[p.id]
  const enLinea = useConexion()
  const [clave, setClave] = useState('')
  const [modelo, setModelo] = useState(p.modelo)
  const [probando, setProbando] = useState(false)

  const [ahora] = useState(() => Date.now())
  const agotado = p.agotadoHasta && p.agotadoHasta > ahora

  return (
    <section className="tarjeta proveedor" data-testid={`proveedor-${p.id}`}>
      <div className="campo-cabecera">
        <h2>
          {posicion + 1}. {info.nombre}
        </h2>
        <span className="mazo-acciones">
          <button
            type="button"
            className="secundario"
            aria-label={`Subir ${info.nombre}`}
            disabled={posicion === 0}
            onClick={() => moverProveedor(p.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="secundario"
            aria-label={`Bajar ${info.nombre}`}
            disabled={posicion === total - 1}
            onClick={() => moverProveedor(p.id, 1)}
          >
            ↓
          </button>
        </span>
      </div>

      <label className="interruptor">
        <input type="checkbox" checked={p.activo} onChange={(e) => guardarProveedor(p.id, { activo: e.target.checked })} />
        Usar este proveedor
      </label>

      <p>
        Clave: <strong>{p.clave ? ocultar(p.clave) : 'sin clave'}</strong>
        {agotado && <span className="texto-error"> · cuota agotada por ahora</span>}
      </p>

      <form
        className="formulario"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!clave.trim()) return
          await guardarProveedor(p.id, { clave })
          setClave('')
        }}
      >
        <input
          type="password"
          autoComplete="off"
          placeholder={p.clave ? 'Pegar otra clave' : 'Pegar la clave aquí'}
          aria-label={`Clave de ${info.nombre}`}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        <button type="submit" disabled={!clave.trim()}>
          Guardar
        </button>
      </form>

      <details>
        <summary>Cómo sacar la clave gratis</summary>
        <ol>
          {info.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <p>
          <a href={info.urlClave} target="_blank" rel="noreferrer">
            Abrir {info.urlClave.replace('https://', '')}
          </a>
        </p>
      </details>

      <details>
        <summary>Modelo</summary>
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault()
            void guardarProveedor(p.id, { modelo })
          }}
        >
          <input aria-label={`Modelo de ${info.nombre}`} value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <button type="submit" className="secundario" disabled={modelo.trim() === p.modelo}>
            Cambiar
          </button>
        </form>
        <p className="ayuda">Por defecto: {info.modeloPorDefecto}</p>
      </details>

      <div className="fila">
        <button
          type="button"
          disabled={!p.clave || !enLinea || probando}
          onClick={async () => {
            setProbando(true)
            try {
              await probarProveedor(p.id)
            } finally {
              setProbando(false)
            }
          }}
        >
          {probando ? 'Probando…' : 'Probar'}
        </button>
        {!enLinea && p.clave && <span className="ayuda">Necesitas internet para probar.</span>}
      </div>
      {p.prueba && (
        <p className={p.prueba.ok ? 'prueba-ok' : 'texto-error'} role="status">
          {p.prueba.ok ? '✓ ' : '✗ '}
          {p.prueba.mensaje}
          {/* La versión ayuda a saber por la captura si el teléfono tenía la app vieja guardada. */}
          {!p.prueba.ok && <small> (Versión {__APP_VERSION__})</small>}
        </p>
      )}
    </section>
  )
}

export function AjustesIA() {
  const proveedores = useProveedores()

  useEffect(() => {
    void asegurarProveedores()
  }, [])

  return (
    <main>
      <a href="#/" className="volver">
        ← Inicio
      </a>
      <section className="tarjeta">
        <h2>Inteligencia artificial</h2>
        <p>
          La IA lee tus fotos, PDF y notas de voz y llena los campos de cada fármaco para que tú los revises. Se usa el
          primer proveedor de la lista; si se le acaba la cuota gratis, pasa al siguiente.
        </p>
        <p className="ayuda">
          Las claves se guardan solo en este teléfono. Tu material se envía al proveedor solo cuando tú mandas a
          procesar algo y hay internet.
        </p>
      </section>
      {proveedores?.map((p, i) => <TarjetaProveedor key={p.id} p={p} posicion={i} total={proveedores.length} />)}
    </main>
  )
}
