export type EstadoAlmacenamiento = {
  persistente: boolean
  usadoMB: number | null
  disponibleMB: number | null
}

const aMB = (bytes: number | undefined) =>
  bytes === undefined ? null : Math.round(bytes / (1024 * 1024))

// Pide a Android que no borre los datos de la app cuando falte espacio.
export async function pedirAlmacenamientoPersistente(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<EstadoAlmacenamiento> {
  if (!storage) return { persistente: false, usadoMB: null, disponibleMB: null }

  let persistente = (await storage.persisted?.()) ?? false
  if (!persistente && storage.persist) persistente = await storage.persist()

  const estimado = await storage.estimate?.()
  return {
    persistente,
    usadoMB: aMB(estimado?.usage),
    disponibleMB: aMB(estimado?.quota),
  }
}
