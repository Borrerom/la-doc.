// Utilidades para unir audios WAV (PCM) en una sola pista, con silencios entre partes.
// Una sola pista larga es lo más confiable para seguir sonando con la pantalla apagada.

export type Pcm = {
  sampleRate: number
  channels: number
  bitsPerSample: number
  data: Uint8Array
}

function leerTexto(v: DataView, offset: number, largo: number) {
  let s = ''
  for (let i = 0; i < largo; i++) s += String.fromCharCode(v.getUint8(offset + i))
  return s
}

export function leerWav(buffer: ArrayBuffer): Pcm {
  const v = new DataView(buffer)
  if (leerTexto(v, 0, 4) !== 'RIFF' || leerTexto(v, 8, 4) !== 'WAVE') throw new Error('No es un WAV')

  let formato: Omit<Pcm, 'data'> | null = null
  let offset = 12
  while (offset + 8 <= v.byteLength) {
    const id = leerTexto(v, offset, 4)
    const largo = v.getUint32(offset + 4, true)
    const inicio = offset + 8
    if (id === 'fmt ') {
      if (v.getUint16(inicio, true) !== 1) throw new Error('Solo se admite WAV PCM')
      formato = {
        channels: v.getUint16(inicio + 2, true),
        sampleRate: v.getUint32(inicio + 4, true),
        bitsPerSample: v.getUint16(inicio + 14, true),
      }
    } else if (id === 'data') {
      if (!formato) throw new Error('WAV sin formato')
      const fin = Math.min(inicio + largo, v.byteLength)
      return { ...formato, data: new Uint8Array(buffer.slice(inicio, fin)) }
    }
    offset = inicio + largo + (largo % 2)
  }
  throw new Error('WAV sin datos')
}

export function escribirWav(pcm: Pcm): ArrayBuffer {
  const bytesPorMuestra = (pcm.bitsPerSample / 8) * pcm.channels
  const buffer = new ArrayBuffer(44 + pcm.data.byteLength)
  const v = new DataView(buffer)
  const texto = (offset: number, s: string) => [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)))
  texto(0, 'RIFF')
  v.setUint32(4, 36 + pcm.data.byteLength, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, pcm.channels, true)
  v.setUint32(24, pcm.sampleRate, true)
  v.setUint32(28, pcm.sampleRate * bytesPorMuestra, true)
  v.setUint16(32, bytesPorMuestra, true)
  v.setUint16(34, pcm.bitsPerSample, true)
  texto(36, 'data')
  v.setUint32(40, pcm.data.byteLength, true)
  new Uint8Array(buffer, 44).set(pcm.data)
  return buffer
}

export type Parte = Pcm | { silencioSegundos: number }

// Une las partes en una pista; los silencios toman el formato de la primera parte con audio.
export function unirWav(partes: Parte[]): Pcm {
  const conAudio = partes.filter((p): p is Pcm => 'data' in p)
  if (conAudio.length === 0) throw new Error('No hay audio para unir')
  const { sampleRate, channels, bitsPerSample } = conAudio[0]
  for (const p of conAudio) {
    if (p.sampleRate !== sampleRate || p.channels !== channels || p.bitsPerSample !== bitsPerSample) {
      throw new Error('Los audios tienen formatos distintos')
    }
  }
  const bytesPorSegundo = sampleRate * channels * (bitsPerSample / 8)
  const alinear = channels * (bitsPerSample / 8)
  const largos = partes.map((p) =>
    'data' in p ? p.data.byteLength : Math.round((p.silencioSegundos * bytesPorSegundo) / alinear) * alinear,
  )
  const data = new Uint8Array(largos.reduce((a, b) => a + b, 0))
  let offset = 0
  partes.forEach((p, i) => {
    if ('data' in p) data.set(p.data, offset)
    offset += largos[i]
  })
  return { sampleRate, channels, bitsPerSample, data }
}

export const duracionSegundos = (pcm: Pcm) =>
  pcm.data.byteLength / (pcm.sampleRate * pcm.channels * (pcm.bitsPerSample / 8))
