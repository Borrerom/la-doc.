import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { ProveedorIA } from '../model/tipos'
import { ErrorIA, pedirIA, type PedidoIA } from './clientes'

export type IdProveedor = ProveedorIA['id']

export type InfoProveedor = {
  nombre: string
  urlClave: string
  modeloPorDefecto: string
  pasos: string[]
}

// Modelos gratuitos con lectura de imágenes. Se pueden cambiar en la pantalla de ajustes.
export const PROVEEDORES: Record<IdProveedor, InfoProveedor> = {
  gemini: {
    nombre: 'Google Gemini',
    urlClave: 'https://aistudio.google.com/apikey',
    // Alias que Google mueve solo al Flash más nuevo, así no se rompe cuando retira un modelo.
    modeloPorDefecto: 'gemini-flash-latest',
    pasos: [
      'Abre aistudio.google.com/apikey e inicia sesión con tu cuenta de Google.',
      'Acepta las condiciones si te las pide.',
      'Toca "Create API key" (Crear clave de API).',
      'Copia la clave (empieza por "AIza") y pégala aquí. Es gratis y no pide tarjeta.',
    ],
  },
  groq: {
    nombre: 'Groq',
    urlClave: 'https://console.groq.com/keys',
    modeloPorDefecto: 'meta-llama/llama-4-scout-17b-16e-instruct',
    pasos: [
      'Abre console.groq.com/keys y crea una cuenta gratis.',
      'Toca "Create API Key", ponle un nombre (por ejemplo La Doc).',
      'Copia la clave (empieza por "gsk_") y pégala aquí.',
    ],
  },
  openrouter: {
    nombre: 'OpenRouter',
    urlClave: 'https://openrouter.ai/keys',
    modeloPorDefecto: 'google/gemma-3-27b-it:free',
    pasos: [
      'Abre openrouter.ai/keys y crea una cuenta gratis.',
      'Toca "Create Key".',
      'Copia la clave (empieza por "sk-or-") y pégala aquí. Usa solo modelos que terminen en ":free".',
    ],
  },
}

const ORDEN_INICIAL: IdProveedor[] = ['gemini', 'groq', 'openrouter']

// Si el modelo de Gemini elegido desaparece, se prueban estos en orden y se guarda el que funcione.
export const MODELOS_RESPALDO_GEMINI = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
// Valores por defecto de versiones anteriores que se pasan al alias.
const MODELOS_VIEJOS_POR_DEFECTO: Partial<Record<IdProveedor, string[]>> = { gemini: ['gemini-2.5-flash'] }

export async function asegurarProveedores() {
  await db.transaction('rw', db.proveedoresIA, async () => {
    for (const [i, id] of ORDEN_INICIAL.entries()) {
      const actual = await db.proveedoresIA.get(id)
      if (!actual) {
        await db.proveedoresIA.add({ id, clave: '', modelo: PROVEEDORES[id].modeloPorDefecto, orden: i, activo: true })
      } else if (MODELOS_VIEJOS_POR_DEFECTO[id]?.includes(actual.modelo)) {
        await db.proveedoresIA.update(id, { modelo: PROVEEDORES[id].modeloPorDefecto })
      }
    }
  })
}

export async function listarProveedores(): Promise<ProveedorIA[]> {
  return (await db.proveedoresIA.toArray()).sort((a, b) => a.orden - b.orden)
}

export function useProveedores() {
  return useLiveQuery(listarProveedores)
}

export async function guardarProveedor(id: IdProveedor, cambios: Partial<Omit<ProveedorIA, 'id' | 'orden'>>) {
  const limpio = { ...cambios }
  if (limpio.clave !== undefined) limpio.clave = limpio.clave.trim()
  if (limpio.modelo !== undefined) limpio.modelo = limpio.modelo.trim() || PROVEEDORES[id].modeloPorDefecto
  // Una clave o un modelo nuevos merecen otra oportunidad aunque el anterior se haya agotado.
  if (limpio.clave !== undefined || limpio.modelo !== undefined) {
    limpio.agotadoHasta = undefined
    limpio.prueba = undefined
  }
  await db.proveedoresIA.update(id, limpio)
}

export async function moverProveedor(id: IdProveedor, direccion: -1 | 1) {
  await db.transaction('rw', db.proveedoresIA, async () => {
    const lista = await listarProveedores()
    const i = lista.findIndex((p) => p.id === id)
    const j = i + direccion
    if (i < 0 || j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    await Promise.all(lista.map((p, orden) => db.proveedoresIA.update(p.id, { orden })))
  })
}

// Proveedores que se pueden usar ahora, en el orden elegido.
export async function proveedoresDisponibles(ahora = Date.now()): Promise<ProveedorIA[]> {
  return (await listarProveedores()).filter(
    (p) => p.activo && p.clave && !(p.agotadoHasta && p.agotadoHasta > ahora),
  )
}

// Pide a la IA y, si el modelo de Gemini ya no existe, prueba los de respaldo y se queda con el que responda.
export async function pedirConRespaldoDeModelo(proveedor: ProveedorIA, pedido: PedidoIA, hacerFetch: typeof fetch = fetch) {
  try {
    return { texto: await pedirIA(proveedor, pedido, hacerFetch), modelo: proveedor.modelo }
  } catch (e) {
    if (!(e instanceof ErrorIA) || e.tipo !== 'modelo' || proveedor.id !== 'gemini') throw e
    for (const modelo of MODELOS_RESPALDO_GEMINI.filter((m) => m !== proveedor.modelo)) {
      try {
        const texto = await pedirIA({ ...proveedor, modelo }, pedido, hacerFetch)
        await db.proveedoresIA.update(proveedor.id, { modelo })
        return { texto, modelo }
      } catch (otro) {
        if (!(otro instanceof ErrorIA) || otro.tipo !== 'modelo') throw otro
      }
    }
    throw e
  }
}

export async function probarProveedor(id: IdProveedor, hacerFetch: typeof fetch = fetch) {
  const proveedor = await db.proveedoresIA.get(id)
  if (!proveedor) return
  let prueba: NonNullable<ProveedorIA['prueba']>
  try {
    const { texto, modelo } = await pedirConRespaldoDeModelo(
      proveedor,
      { instrucciones: 'Eres una prueba de conexión.', partes: [{ texto: 'Responde solo con la palabra: listo' }] },
      hacerFetch,
    )
    const cambio = modelo !== proveedor.modelo ? ` El modelo "${proveedor.modelo}" ya no existe; ahora usa "${modelo}".` : ''
    prueba = { fecha: Date.now(), ok: true, mensaje: `Funciona. Respondió: "${texto.trim().slice(0, 40)}".${cambio}` }
  } catch (e) {
    prueba = { fecha: Date.now(), ok: false, mensaje: e instanceof ErrorIA ? e.message : String(e) }
  }
  await db.proveedoresIA.update(id, { prueba })
  return prueba
}
