import { useRegisterSW } from 'virtual:pwa-register/react'

// La versión nueva se instala solo cuando ella lo decide, para no cortar un repaso a la mitad.
export function AvisoActualizacion() {
  const {
    offlineReady: [listaSinInternet, setListaSinInternet],
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (hayVersionNueva) {
    return (
      <div className="aviso" role="status">
        <span>Hay una versión nueva de La Doc.</span>
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
