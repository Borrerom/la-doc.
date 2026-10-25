import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { borrarDatosLocales, esRespaldo, exportarDatos, huellaDatos, importarDatos } from './datos'
import { ErrorDrive, asegurarCarpeta, bajarRespaldo, buscarRespaldo, subirRespaldo } from './drive'
import { correoDeToken, olvidarToken, pedirToken, tokenGuardado, type Token } from './google'

// Estado del respaldo en este teléfono (no viaja dentro del respaldo).
export type EstadoRespaldo = {
  correo?: string
  carpetaId?: string
  archivoId?: string | null
  ultimo?: number
  huella?: string
  error?: string
}

const CLAVE = 'respaldo'

export async function leerEstadoRespaldo(): Promise<EstadoRespaldo> {
  return ((await db.ajustes.get(CLAVE))?.valor as EstadoRespaldo | undefined) ?? {}
}

async function guardarEstado(cambios: Partial<EstadoRespaldo>, reemplazar = false) {
  const actual = reemplazar ? {} : await leerEstadoRespaldo()
  await db.ajustes.put({ clave: CLAVE, valor: { ...actual, ...cambios } })
}

export function useEstadoRespaldo() {
  return useLiveQuery(leerEstadoRespaldo)
}

type Opciones = { hacerFetch?: typeof fetch; interactivo?: boolean }

// Con un toque se puede abrir la ventana de Google; sin toque solo sirve un permiso vigente.
async function conseguirToken(estado: EstadoRespaldo, interactivo: boolean): Promise<Token> {
  const t = tokenGuardado()
  if (t) return t
  if (!interactivo) throw new ErrorDrive('Hace falta tocar "Respaldar ahora" para renovar el permiso de Google.', 401)
  return pedirToken({ silencioso: !!estado.correo, correo: estado.correo })
}

// Paso 16: vincular la cuenta de Google y preparar la carpeta "La Doc" en su Drive.
export async function vincularCuenta({ hacerFetch = fetch }: Opciones = {}) {
  const token = await pedirToken()
  const correo = await correoDeToken(token, hacerFetch)
  const carpetaId = await asegurarCarpeta(hacerFetch, token)
  const archivoId = await buscarRespaldo(hacerFetch, token, carpetaId)
  await guardarEstado({ correo, carpetaId, archivoId }, true)
  return { correo, hayRespaldo: !!archivoId }
}

export async function respaldarAhora({ hacerFetch = fetch, interactivo = false }: Opciones = {}) {
  const estado = await leerEstadoRespaldo()
  if (!estado.carpetaId) throw new Error('Primero vincula una cuenta de Google.')
  try {
    const token = await conseguirToken(estado, interactivo)
    const huella = await huellaDatos()
    const contenido = JSON.stringify(await exportarDatos())
    let archivoId: string
    try {
      archivoId = await subirRespaldo(hacerFetch, token, { carpetaId: estado.carpetaId, archivoId: estado.archivoId ?? null, contenido })
    } catch (e) {
      // Si borraron el archivo o la carpeta en Drive, se vuelven a crear.
      if (!(e instanceof ErrorDrive) || e.estado !== 404) throw e
      const carpetaId = await asegurarCarpeta(hacerFetch, token)
      await guardarEstado({ carpetaId })
      archivoId = await subirRespaldo(hacerFetch, token, { carpetaId, archivoId: null, contenido })
    }
    await guardarEstado({ archivoId, ultimo: Date.now(), huella, error: undefined })
  } catch (e) {
    await guardarEstado({ error: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

export async function restaurarDeDrive({ hacerFetch = fetch, interactivo = true }: Opciones = {}) {
  const estado = await leerEstadoRespaldo()
  if (!estado.carpetaId) throw new Error('Primero vincula una cuenta de Google.')
  const token = await conseguirToken(estado, interactivo)
  const archivoId = estado.archivoId ?? (await buscarRespaldo(hacerFetch, token, estado.carpetaId))
  if (!archivoId) throw new Error('No hay ningún respaldo en este Drive todavía.')
  const datos = await bajarRespaldo(hacerFetch, token, archivoId)
  if (!esRespaldo(datos)) throw new Error('El archivo de Drive no es un respaldo de La Doc.')
  await importarDatos(datos)
  await guardarEstado({ archivoId, ultimo: datos.fecha, huella: await huellaDatos(), error: undefined })
  return datos.fecha
}

// Paso 17: quitar la cuenta de este teléfono. Las fichas quedan en el teléfono.
export async function desvincularCuenta() {
  await olvidarToken()
  await db.ajustes.delete(CLAVE)
}

// Paso 17: otra persona usará el teléfono. Se respalda lo de la cuenta actual en su Drive,
// se borra todo del teléfono (fichas, repasos y claves de IA) y se quita la cuenta.
export async function prepararOtraCuenta({ hacerFetch = fetch }: Opciones = {}) {
  const estado = await leerEstadoRespaldo()
  if (estado.carpetaId) await respaldarAhora({ hacerFetch, interactivo: true })
  await borrarDatosLocales()
  await desvincularCuenta()
}

// ¿Hay cambios sin respaldar?
export async function hayCambiosSinRespaldar() {
  const estado = await leerEstadoRespaldo()
  return !!estado.carpetaId && estado.huella !== (await huellaDatos())
}
