import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { procesarCola } from '../core/ai/procesar'
import { audioAWav } from '../core/capture/audioWav'
import { db } from '../core/db/db'
import { useConexion } from './useConexion'

const CADA_MS = 60 * 1000

// Mientras la app está abierta y hay internet, la cola se procesa sola,
// enseguida al guardar una carga nueva y luego cada minuto.
export function useProcesadorCola() {
  const enLinea = useConexion()
  const enCola = useLiveQuery(() => db.cargas.where('estado').anyOf(['en_cola', 'procesando']).count()) ?? 0

  useEffect(() => {
    if (!enLinea || enCola === 0) return
    const revisar = () => void procesarCola({ convertirAudio: audioAWav })
    revisar()
    const intervalo = setInterval(revisar, CADA_MS)
    return () => clearInterval(intervalo)
  }, [enLinea, enCola])
}
