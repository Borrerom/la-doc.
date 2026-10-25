import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export type AjustesAudio = {
  leerEnRepaso: boolean
  velocidad: number
  pausaSegundos: number
  modo: 'automatico' | 'manual'
  voz: 'telefono' | 'neuronal'
}

export const AUDIO_POR_DEFECTO: AjustesAudio = {
  leerEnRepaso: false,
  velocidad: 1,
  pausaSegundos: 4,
  modo: 'automatico',
  voz: 'telefono',
}

export async function leerAjustesAudio(): Promise<AjustesAudio> {
  const guardado = (await db.ajustes.get('audio'))?.valor as Partial<AjustesAudio> | undefined
  return { ...AUDIO_POR_DEFECTO, ...guardado }
}

export async function guardarAjustesAudio(cambios: Partial<AjustesAudio>) {
  const actual = await leerAjustesAudio()
  await db.ajustes.put({ clave: 'audio', valor: { ...actual, ...cambios } })
}

export function useAjustesAudio() {
  return useLiveQuery(leerAjustesAudio) ?? AUDIO_POR_DEFECTO
}
