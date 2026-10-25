import * as piper from '@mintplex-labs/piper-tts-web'
import { leerWav, type Pcm } from './wav'

// Voz neuronal en español que corre en el teléfono. Se descarga una vez (~63 MB) y queda guardada.
export const VOZ_LOCAL = 'es_MX-claude-high'

export type Progreso = { cargadoMB: number; totalMB: number }

export async function vozLocalDescargada() {
  return (await piper.stored()).includes(VOZ_LOCAL)
}

export async function descargarVozLocal(alAvanzar?: (p: Progreso) => void) {
  await piper.download(VOZ_LOCAL, (p) => {
    if (p.url.endsWith('.onnx')) {
      alAvanzar?.({ cargadoMB: p.loaded / 1048576, totalMB: p.total / 1048576 })
    }
  })
}

let sesion: Promise<piper.TtsSession> | null = null

export async function sintetizar(texto: string): Promise<Pcm> {
  sesion ??= piper.TtsSession.create({
    voiceId: VOZ_LOCAL,
    wasmPaths: {
      onnxWasm: new URL('ort/', document.baseURI).href,
      piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
      piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
    },
  }).catch((e: unknown) => {
    sesion = null
    throw e
  })
  const wav = await (await sesion).predict(texto)
  return leerWav(await wav.arrayBuffer())
}
