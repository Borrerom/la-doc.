import { db } from '../db/db'
import type { Id } from '../model/tipos'
import { sintetizar } from './vozLocal'
import { escribirWav, leerWav, type Pcm } from './wav'

// Huella corta del texto: si la ficha cambia, el audio se vuelve a generar.
export function huella(texto: string) {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Audio de un lado de la ficha con la voz neuronal, guardado en el teléfono para no regenerarlo.
export async function audioDe(fichaId: Id, lado: 'frente' | 'reverso', texto: string): Promise<Pcm> {
  const clave = `${fichaId}:${lado}`
  const h = huella(texto)
  const guardado = await db.audiosFicha.get(clave)
  if (guardado?.huella === h) return leerWav(await guardado.blob.arrayBuffer())
  const pcm = await sintetizar(texto)
  await db.audiosFicha.put({ fichaId: clave, huella: h, blob: new Blob([escribirWav(pcm)], { type: 'audio/wav' }) })
  return pcm
}
