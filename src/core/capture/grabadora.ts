// Graba notas de voz con el micrófono del teléfono.
export const MINUTOS_MAXIMOS = 5

function formatoPreferido() {
  for (const tipo of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(tipo)) return tipo
  }
  return ''
}

export class Grabadora {
  private grabador: MediaRecorder | null = null
  private trozos: Blob[] = []
  private flujo: MediaStream | null = null

  async empezar() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite grabar audio.')
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new Error('No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.')
    }
    const tipo = formatoPreferido()
    this.grabador = new MediaRecorder(this.flujo, tipo ? { mimeType: tipo } : undefined)
    this.trozos = []
    this.grabador.ondataavailable = (e) => e.data.size > 0 && this.trozos.push(e.data)
    this.grabador.start(1000)
  }

  terminar(): Promise<Blob> {
    return new Promise((ok, mal) => {
      const grabador = this.grabador
      if (!grabador) return mal(new Error('No se está grabando'))
      grabador.onstop = () => {
        this.flujo?.getTracks().forEach((t) => t.stop())
        this.grabador = null
        ok(new Blob(this.trozos, { type: (grabador.mimeType || 'audio/webm').split(';')[0] }))
      }
      grabador.stop()
    })
  }

  cancelar() {
    this.grabador?.stop()
    this.flujo?.getTracks().forEach((t) => t.stop())
    this.grabador = null
  }
}
