import type { Token } from './google'

// Llamadas a la API de Drive v3. Con drive.file solo se ven la carpeta y el archivo que crea la app.
const API = 'https://www.googleapis.com/drive/v3/files'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files'
export const NOMBRE_CARPETA = 'La Doc'
export const NOMBRE_ARCHIVO = 'la-doc-respaldo.json'

export class ErrorDrive extends Error {
  estado: number
  constructor(mensaje: string, estado: number) {
    super(mensaje)
    this.estado = estado
  }
}

export const ENLACE_ACTIVAR_DRIVE = 'https://console.cloud.google.com/apis/library/drive.googleapis.com?project=225851611784'

// Traduce el motivo que da Google a algo que se pueda resolver.
async function explicarError(r: Response) {
  let motivo = ''
  let mensaje = ''
  try {
    const { error } = (await r.json()) as {
      error?: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }
    }
    motivo = [error?.status, ...(error?.errors ?? []).map((e) => e.reason), ...(error?.details ?? []).map((d) => d.reason)].join(' ')
    mensaje = error?.message ?? ''
  } catch {
    // Sin detalle en la respuesta.
  }
  if (/accessNotConfigured|SERVICE_DISABLED/.test(motivo) || /has not been used|is disabled/.test(mensaje)) {
    return `La API de Google Drive no está activada en el proyecto "La Doc" de Google Cloud. Actívala aquí y vuelve a intentar en unos minutos: ${ENLACE_ACTIVAR_DRIVE}`
  }
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|PERMISSION_DENIED/.test(motivo)) {
    return 'Google no dio permiso para usar Drive. Toca de nuevo "Entrar con Google" y, en la pantalla de permisos, marca la casilla de Google Drive.'
  }
  if (/rateLimitExceeded|userRateLimitExceeded|RESOURCE_EXHAUSTED/.test(motivo)) {
    return 'Google Drive pidió esperar un momento. El respaldo se reintentará solo.'
  }
  return `Google Drive respondió con un error (${r.status})${mensaje ? `: ${mensaje}` : ''}.`
}

async function pedir(hacerFetch: typeof fetch, token: Token, url: string, init: RequestInit = {}) {
  let r: Response
  try {
    r = await hacerFetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token.valor}` } })
  } catch {
    throw new ErrorDrive('Sin internet: el respaldo se hará cuando vuelva la conexión.', 0)
  }
  if (r.status === 401) throw new ErrorDrive('El permiso de Google venció. Toca "Respaldar ahora" para renovarlo.', 401)
  if (!r.ok) throw new ErrorDrive(await explicarError(r), r.status)
  return r
}

async function buscar(hacerFetch: typeof fetch, token: Token, q: string): Promise<string | null> {
  const url = `${API}?q=${encodeURIComponent(q + ' and trashed = false')}&fields=files(id)&spaces=drive&orderBy=modifiedTime desc`
  const { files } = (await (await pedir(hacerFetch, token, url)).json()) as { files: { id: string }[] }
  return files[0]?.id ?? null
}

export async function asegurarCarpeta(hacerFetch: typeof fetch, token: Token): Promise<string> {
  const existente = await buscar(hacerFetch, token, `name = '${NOMBRE_CARPETA}' and mimeType = 'application/vnd.google-apps.folder'`)
  if (existente) return existente
  const r = await pedir(hacerFetch, token, `${API}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return ((await r.json()) as { id: string }).id
}

export function buscarRespaldo(hacerFetch: typeof fetch, token: Token, carpetaId: string) {
  return buscar(hacerFetch, token, `name = '${NOMBRE_ARCHIVO}' and '${carpetaId}' in parents`)
}

// Crea el archivo o lo reemplaza (Drive guarda las versiones anteriores unos días).
export async function subirRespaldo(
  hacerFetch: typeof fetch,
  token: Token,
  { carpetaId, archivoId, contenido }: { carpetaId: string; archivoId: string | null; contenido: string },
): Promise<string> {
  const limite = 'la-doc-' + Math.random().toString(36).slice(2)
  const meta = archivoId ? {} : { name: NOMBRE_ARCHIVO, parents: [carpetaId], mimeType: 'application/json' }
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`
  const url = archivoId ? `${SUBIDA}/${archivoId}?uploadType=multipart&fields=id` : `${SUBIDA}?uploadType=multipart&fields=id`
  const r = await pedir(hacerFetch, token, url, {
    method: archivoId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  })
  return ((await r.json()) as { id: string }).id
}

export async function bajarRespaldo(hacerFetch: typeof fetch, token: Token, archivoId: string): Promise<unknown> {
  return (await pedir(hacerFetch, token, `${API}/${archivoId}?alt=media`)).json()
}
