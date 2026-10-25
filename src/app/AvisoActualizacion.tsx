import { useRegisterSW } from 'virtual:pwa-register/react'

const CADA_HORA_MS = 60 * 60 * 1000

// En iPhone la app instalada casi nunca se recarga: vuelve del fondo tal cual. Por eso se busca
// versión nueva al volver a la app y cada hora, no solo al abrirla.
function buscarVersionNueva(_url: string, registro: ServiceWorkerRegistration | undefined) {
  if (!registro) return
  const buscar = () => {
    if (navigator.onLine) registro.update().catch(() => {})
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') buscar()
  })
  setInterval(buscar, CADA_HORA_MS)
}

// La versión nueva se instala solo cuando ella lo decide, para no cortar un repaso a la mitad.
export function AvisoActualizacion() {
  const {
    offlineReady: [listaSinInternet, setListaSinInternet],
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: buscarVersionNueva })

  if (hayVersionNueva) {
    return (
      <div className="aviso" role="status">
        <span>Hay una versión nueva de Doc Desi.</span>
        <button type="button" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
        <button type="button" className="secundario" onClick={() => setHayVersionNueva(false)}>
          Después
        </button>
      </div>
    )
  }

  if (listaSinInternet) {
    return (
      <div className="aviso" role="status">
        <span>Lista para usar sin internet.</span>
        <button type="button" className="secundario" onClick={() => setListaSinInternet(false)}>
          Entendido
        </button>
      </div>
    )
  }

  return null
}
