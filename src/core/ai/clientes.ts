import type { ProveedorIA } from '../model/tipos'

// Lo que se le manda a la IA: texto y, opcionalmente, imágenes o PDF en base64.
export type ParteIA = { texto: string } | { datos: string; mime: string }

export type PedidoIA = {
  instrucciones: string
  partes: ParteIA[]
  // Pide la respuesta como JSON (para llenar campos).
  json?: boolean
}

export type TipoErrorIA = 'clave' | 'cuota' | 'red' | 'respuesta' | 'modelo' | 'saturado' | 'otro'

export class ErrorIA extends Error {
  tipo: TipoErrorIA
  // Si el proveedor dijo cuánto esperar antes de reintentar.
  esperarMs?: number

  constructor(tipo: TipoErrorIA, mensaje: string, esperarMs?: number) {
    super(mensaje)
    this.tipo = tipo
    this.esperarMs = esperarMs
  }
}

type Fetch = typeof fetch

const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models'
const URL_COMPATIBLE: Record<'groq' | 'openrouter', string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
}

function cuerpoGemini(pedido: PedidoIA) {
  return {
    systemInstruction: { parts: [{ text: pedido.instrucciones }] },
    contents: [
      {
        role: 'user',
        parts: pedido.partes.map((p) =>
          'texto' in p ? { text: p.texto } : { inline_data: { mime_type: p.mime, data: p.datos } },
        ),
      },
    ],
    ...(pedido.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  }
}

function cuerpoCompatible(modelo: string, pedido: PedidoIA) {
  return {
    model: modelo,
    messages: [
      { role: 'system', content: pedido.instrucciones },
      {
        role: 'user',
        content: pedido.partes.map((p) =>
          'texto' in p
            ? { type: 'text', text: p.texto }
            : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.datos}` } },
        ),
      },
    ],
    ...(pedido.json ? { response_format: { type: 'json_object' } } : {}),
  }
}

function segundosDeEspera(respuesta: Response): number | undefined {
  const s = Number(respuesta.headers.get('retry-after'))
  return Number.isFinite(s) && s > 0 ? s * 1000 : undefined
}

// Lo que el proveedor explicó del error, corto, para poder mandarlo en una captura.
function detalleDelError(texto: string): string {
  let mensaje = texto
  try {
    const datos = JSON.parse(texto)
    mensaje = datos?.error?.message ?? (typeof datos?.error === 'string' ? datos.error : texto)
  } catch {
    // No era JSON: se usa el texto tal cual.
  }
  mensaje = String(mensaje).replace(/\s+/g, ' ').trim()
  return mensaje ? ` Detalle: "${mensaje.slice(0, 160)}"` : ''
}

async function errorDeRespuesta(respuesta: Response, servicio = 'El servicio de IA'): Promise<ErrorIA> {
  const texto = await respuesta.text().catch(() => '')
  const detalle = detalleDelError(texto)
  if (respuesta.status === 429) {
    return new ErrorIA('cuota', 'Se acabó la cuota gratis por ahora.', segundosDeEspera(respuesta))
  }
  // El modelo ya no existe o cambió de nombre (Google retira modelos viejos cada tanto).
  if (respuesta.status === 404 || (respuesta.status === 400 && /model.*(not found|not supported|no longer|deprecated)/i.test(texto))) {
    return new ErrorIA('modelo', 'Ese modelo ya no está disponible. Cambia el modelo en Ajustes de IA.')
  }
  // 500/502/503/504: el servicio está sobrecargado o caído un rato. No es culpa de la clave.
  if (respuesta.status >= 500) {
    return new ErrorIA(
      'saturado',
      `${servicio} está saturado ahora mismo (error ${respuesta.status}). No es tu clave: intenta de nuevo en unos minutos.${detalle}`,
    )
  }
  if (respuesta.status === 401 || respuesta.status === 403 || /api[_ ]?key/i.test(texto)) {
    return new ErrorIA('clave', 'La clave no es válida o no tiene permiso.')
  }
  return new ErrorIA('otro', `El proveedor respondió con un error (${respuesta.status}).${detalle}`)
}

// Manda un pedido a un proveedor y devuelve el texto de la respuesta.
export async function pedirIA(proveedor: ProveedorIA, pedido: PedidoIA, hacerFetch: Fetch = fetch): Promise<string> {
  if (!proveedor.clave.trim()) throw new ErrorIA('clave', 'Falta la clave.')

  let respuesta: Response
  try {
    if (proveedor.id === 'gemini') {
      respuesta = await hacerFetch(`${URL_GEMINI}/${encodeURIComponent(proveedor.modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': proveedor.clave.trim() },
        body: JSON.stringify(cuerpoGemini(pedido)),
      })
    } else {
      respuesta = await hacerFetch(URL_COMPATIBLE[proveedor.id], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${proveedor.clave.trim()}`,
          ...(proveedor.id === 'openrouter' ? { 'X-Title': 'Doc Desi' } : {}),
        },
        body: JSON.stringify(cuerpoCompatible(proveedor.modelo, pedido)),
      })
    }
  } catch {
    throw new ErrorIA('red', 'No hay conexión con el proveedor.')
  }

  if (!respuesta.ok) throw await errorDeRespuesta(respuesta, proveedor.id === 'gemini' ? 'Google' : undefined)

  const datos = await respuesta.json().catch(() => null)
  const texto =
    proveedor.id === 'gemini'
      ? datos?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
      : datos?.choices?.[0]?.message?.content
  if (typeof texto !== 'string' || !texto.trim()) {
    throw new ErrorIA('respuesta', 'El proveedor respondió vacío.')
  }
  return texto
}

const URL_TRANSCRIBIR_GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions'
export const MODELO_TRANSCRIBIR_GROQ = 'whisper-large-v3-turbo'

// Groq pasa la nota de voz a texto con Whisper (gratis), para que cualquier proveedor la lea.
export async function transcribirConGroq(proveedor: ProveedorIA, audio: Blob, hacerFetch: Fetch = fetch): Promise<string> {
  const formulario = new FormData()
  const extension = (audio.type.split('/')[1] ?? 'webm').split(';')[0]
  formulario.append('file', audio, `nota.${extension}`)
  formulario.append('model', MODELO_TRANSCRIBIR_GROQ)
  formulario.append('language', 'es')
  formulario.append('response_format', 'json')
  let respuesta: Response
  try {
    respuesta = await hacerFetch(URL_TRANSCRIBIR_GROQ, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proveedor.clave.trim()}` },
      body: formulario,
    })
  } catch {
    throw new ErrorIA('red', 'No hay conexión con el proveedor.')
  }
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta)
  const texto = (await respuesta.json().catch(() => null))?.text
  if (typeof texto !== 'string' || !texto.trim()) throw new ErrorIA('respuesta', 'No se entendió la nota de voz.')
  return texto.trim()
}
