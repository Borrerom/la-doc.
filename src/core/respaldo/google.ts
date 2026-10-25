// Inicio de sesión con Google (Google Identity Services, modelo de token) solo con el permiso
// drive.file: la app ve únicamente lo que ella misma crea en el Drive, nunca el resto.
export const ID_CLIENTE_GOOGLE = '225851611784-naubgddfh1q9ui9ompoq9fs5d3jp0qkj.apps.googleusercontent.com'
const PERMISOS = 'https://www.googleapis.com/auth/drive.file openid email'
const CLAVE_TOKEN = 'la-doc:google-token'

export type Token = { valor: string; vence: number }

type RespuestaToken = { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
type ClienteToken = { requestAccessToken: (o?: { prompt?: string; login_hint?: string }) => void }
type GoogleGis = {
  accounts: {
    oauth2: {
      initTokenClient: (c: {
        client_id: string
        scope: string
        callback: (r: RespuestaToken) => void
        error_callback?: (e: { type?: string; message?: string }) => void
      }) => ClienteToken
      revoke: (token: string, listo?: () => void) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleGis
  }
}

let cargando: Promise<GoogleGis> | null = null
function cargarGis(): Promise<GoogleGis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  cargando ??= new Promise((ok, mal) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google ? ok(window.google) : mal(new Error('No cargó el inicio de sesión de Google.')))
    s.onerror = () => {
      cargando = null
      mal(new Error('Sin internet no se puede entrar con Google.'))
    }
    document.head.appendChild(s)
  })
  return cargando
}

export function tokenGuardado(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE_TOKEN) ?? 'null') as Token | null
    return t && t.vence > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}

function guardarToken(t: Token | null) {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, JSON.stringify(t))
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    // Sin almacenamiento, el permiso dura hasta cerrar la app.
  }
}

// Carga por adelantado el script de Google, para que al tocar la ventana se abra al instante.
export function precargarGoogle() {
  void cargarGis().catch(() => {})
}

// Abre la ventana de Google. Debe llamarse al principio de un toque, sin esperas antes: el iPhone
// bloquea la ventana si el toque ya "pasó". Por eso, si el script ya cargó, se abre en el acto.
// Con `silencioso`, si ya dio permiso antes, Google lo renueva sin preguntar de nuevo.
export function pedirToken(opciones: { silencioso?: boolean; correo?: string } = {}): Promise<Token> {
  const cargado = window.google?.accounts?.oauth2 ? window.google : null
  return cargado ? solicitar(cargado, opciones) : cargarGis().then((g) => solicitar(g, opciones))
}

function solicitar(google: GoogleGis, { silencioso = false, correo }: { silencioso?: boolean; correo?: string }): Promise<Token> {
  return new Promise((ok, mal) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: ID_CLIENTE_GOOGLE,
      scope: PERMISOS,
      callback: (r) => {
        if (!r.access_token) return mal(new Error(r.error_description ?? r.error ?? 'Google no dio permiso.'))
        // Google deja desmarcar permisos: sin el de Drive no hay respaldo.
        if (r.scope && !r.scope.includes('drive.file')) {
          return mal(new Error('Falta el permiso de Google Drive. Toca de nuevo "Entrar con Google" y marca la casilla de Google Drive.'))
        }
        const t = { valor: r.access_token, vence: Date.now() + (r.expires_in ?? 3600) * 1000 }
        guardarToken(t)
        ok(t)
      },
      error_callback: (e) =>
        mal(new Error(e.type === 'popup_closed' ? 'Se cerró la ventana de Google sin terminar.' : (e.message ?? 'No se pudo entrar con Google.'))),
    })
    cliente.requestAccessToken(silencioso ? { prompt: '', login_hint: correo } : { prompt: 'select_account consent' })
  })
}

// Si el permiso venció, lo renueva (con un toque). Si sigue vigente, no abre nada.
export function asegurarPermiso(correo?: string): Promise<Token> {
  const t = tokenGuardado()
  return t ? Promise.resolve(t) : pedirToken({ silencioso: !!correo, correo })
}

export async function correoDeToken(token: Token, hacerFetch: typeof fetch = fetch): Promise<string> {
  const r = await hacerFetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token.valor}` } })
  if (!r.ok) throw new Error('No se pudo leer el correo de la cuenta.')
  return ((await r.json()) as { email?: string }).email ?? ''
}

export async function olvidarToken() {
  const t = tokenGuardado()
  guardarToken(null)
  if (t && typeof window !== 'undefined' && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.valor)
}
