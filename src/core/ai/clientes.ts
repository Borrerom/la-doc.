import type { ProveedorIA } from '../model/tipos'

// Lo que se le manda a la IA: texto y, opcionalmente, imágenes o PDF en base64.
export type ParteIA = { texto: string } | { datos: string; mime: string }

export type PedidoIA = {
  instrucciones: string
  partes: ParteIA[]
  // Pide la respuesta como JSON (para llenar campos).
  json?: boolean
}

export type TipoErrorIA = 'clave' | 'cuota' | 'red' | 'respuesta' | 'otro'

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

async function errorDeRespuesta(respuesta: Response): Promise<ErrorIA> {
  const texto = await respuesta.text().catch(() => '')
  if (respuesta.status === 429) {
    return new ErrorIA('cuota', 'Se acabó la cuota gratis por ahora.', segundosDeEspera(respuesta))
  }
  if (respuesta.status === 401 || respuesta.status === 403 || /api[_ ]?key/i.test(texto)) {
    return new ErrorIA('clave', 'La clave no es válida o no tiene permiso.')
  }
  return new ErrorIA('otro', `El proveedor respondió con un error (${respuesta.status}).`)
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
          ...(proveedor.id === 'openrouter' ? { 'X-Title': 'La Doc' } : {}),
        },
        body: JSON.stringify(cuerpoCompatible(proveedor.modelo, pedido)),
      })
    }
  } catch {
    throw new ErrorIA('red', 'No hay conexión con el proveedor.')
  }

  if (!respuesta.ok) throw await errorDeRespuesta(respuesta)

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
