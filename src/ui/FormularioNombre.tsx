import { useState, type FormEvent } from 'react'

type Props = {
  etiqueta: string
  boton: string
  valorInicial?: string
  alGuardar: (nombre: string) => Promise<unknown> | void
  alCancelar?: () => void
}

export function FormularioNombre({ etiqueta, boton, valorInicial = '', alGuardar, alCancelar }: Props) {
  const [nombre, setNombre] = useState(valorInicial)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const enviado = nombre
    try {
      await alGuardar(enviado)
      // Si ya empezó a escribir otro nombre mientras se guardaba, no se lo borramos.
      setNombre((actual) => (actual === enviado ? '' : actual))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <input
        aria-label={etiqueta}
        placeholder={etiqueta}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        autoFocus={valorInicial !== ''}
      />
      <button type="submit">{boton}</button>
      {alCancelar && (
        <button type="button" className="secundario" onClick={alCancelar}>
          Cancelar
        </button>
      )}
      {error && <span className="texto-error">{error}</span>}
    </form>
  )
}
