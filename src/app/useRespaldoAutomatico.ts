import { useEffect } from 'react'
import { hayCambiosSinRespaldar, respaldarAhora } from '../core/respaldo/respaldo'
import { useConexion } from './useConexion'

const CADA_MS = 2 * 60 * 1000

// Con internet y una cuenta vinculada, lo nuevo se respalda solo: cada 2 minutos si hubo cambios
// y también al salir de la app. Si el permiso de Google venció, espera a que Desi toque "Respaldar ahora".
export function useRespaldoAutomatico() {
  const enLinea = useConexion()

  useEffect(() => {
    if (!enLinea) return
    let ocupado = false
    const revisar = async () => {
      if (ocupado || !(await hayCambiosSinRespaldar())) return
      ocupado = true
      try {
        await respaldarAhora()
      } catch {
        // El error queda guardado y se muestra en la tarjeta de respaldo.
      } finally {
        ocupado = false
      }
    }
    const alOcultar = () => document.visibilityState === 'hidden' && void revisar()
    void revisar()
    const intervalo = setInterval(revisar, CADA_MS)
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alOcultar)
    }
  }, [enLinea])
}
