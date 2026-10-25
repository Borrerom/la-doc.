import { escribirWav, type Pcm } from './wav'

// Reproduce pistas con un <audio> normal y controles en la pantalla de bloqueo (Media Session).
// En modo manual, al terminar cada pista espera a que ella toque reproducir o "siguiente".

export type Pista = { titulo: string; audio: Pcm }
export type EstadoReproductor = { indice: number; total: number; sonando: boolean; esperando: boolean; segundo: number }

export class Reproductor {
  private elemento = new Audio()
  private url: string | null = null
  private indice = 0
  private esperando = false
  private pistas: Pista[]
  private manual: boolean
  private alCambiar: (estado: EstadoReproductor) => void

  constructor(pistas: Pista[], manual: boolean, alCambiar: (estado: EstadoReproductor) => void) {
    this.pistas = pistas
    this.manual = manual
    this.alCambiar = alCambiar
    this.elemento.preload = 'auto'
    this.elemento.addEventListener('ended', () => this.alTerminar())
    this.elemento.addEventListener('play', () => this.avisar())
    this.elemento.addEventListener('pause', () => this.avisar())
    this.elemento.addEventListener('timeupdate', () => this.avisar())
    this.registrarControles()
  }

  async empezar() {
    this.cargar(0)
    await this.elemento.play()
  }

  async continuar() {
    if (this.esperando) return this.siguiente()
    await this.elemento.play()
  }

  pausar() {
    this.elemento.pause()
  }

  async siguiente() {
    if (this.indice + 1 >= this.pistas.length) return this.detener()
    this.cargar(this.indice + 1)
    await this.elemento.play()
  }

  async anterior() {
    this.cargar(Math.max(0, this.indice - 1))
    await this.elemento.play()
  }

  detener() {
    this.elemento.pause()
    this.esperando = false
    this.liberar()
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'
    this.avisar()
  }

  private cargar(indice: number) {
    this.indice = indice
    this.esperando = false
    this.liberar()
    this.url = URL.createObjectURL(new Blob([escribirWav(this.pistas[indice].audio)], { type: 'audio/wav' }))
    this.elemento.src = this.url
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.pistas[indice].titulo,
        artist: 'La Doc',
        album: `Ficha ${indice + 1} de ${this.pistas.length}`,
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      })
    }
  }

  private alTerminar() {
    if (this.manual && this.indice + 1 < this.pistas.length) {
      this.esperando = true
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
      this.avisar()
      return
    }
    void this.siguiente()
  }

  private registrarControles() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => void this.continuar())
    ms.setActionHandler('pause', () => this.pausar())
    ms.setActionHandler('nexttrack', () => void this.siguiente())
    ms.setActionHandler('previoustrack', () => void this.anterior())
    ms.setActionHandler('stop', () => this.detener())
  }

  private liberar() {
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }

  private avisar() {
    this.alCambiar({
      indice: this.indice,
      total: this.pistas.length,
      sonando: !this.elemento.paused,
      esperando: this.esperando,
      segundo: this.elemento.currentTime,
    })
  }
}
