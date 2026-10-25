import { useEffect, useState } from 'react'

const rutaActual = () => location.hash.replace(/^#/, '') || '/'

// Rutas con # para que funcionen sin servidor y en cualquier subcarpeta.
export function useRuta() {
  const [ruta, setRuta] = useState(rutaActual)

  useEffect(() => {
    const actualizar = () => setRuta(rutaActual())
    window.addEventListener('hashchange', actualizar)
    return () => window.removeEventListener('hashchange', actualizar)
  }, [])

  return ruta
}
