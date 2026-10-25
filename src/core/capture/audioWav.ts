import { escribirWav } from '../audio/wav'

// Las notas de voz se graban en WebM, que no todos los proveedores aceptan.
// Antes de mandarlas se pasan a WAV mono de 16 kHz, suficiente para la voz.
const MUESTRAS_POR_SEGUNDO = 16000

export async function audioAWav(blob: Blob): Promise<Blob> {
  const contexto = new AudioContext()
  let audio: AudioBuffer
  try {
    audio = await contexto.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void contexto.close()
  }
  const fuera = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * MUESTRAS_POR_SEGUNDO)), MUESTRAS_POR_SEGUNDO)
  const origen = fuera.createBufferSource()
  origen.buffer = audio
  origen.connect(fuera.destination)
  origen.start()
  const muestras = (await fuera.startRendering()).getChannelData(0)
  const data = new Uint8Array(muestras.length * 2)
  const vista = new DataView(data.buffer)
  muestras.forEach((x, i) => vista.setInt16(i * 2, Math.max(-1, Math.min(1, x)) * 0x7fff, true))
  return new Blob([escribirWav({ sampleRate: MUESTRAS_POR_SEGUNDO, channels: 1, bitsPerSample: 16, data })], {
    type: 'audio/wav',
  })
}
