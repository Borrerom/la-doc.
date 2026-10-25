// Voz del sistema (Web Speech API). Inmediata, pero Android la corta al apagar la pantalla.

// Chrome en Android carga las voces tarde (evento voiceschanged): se espera hasta 1,5 s, solo la primera vez.
let vocesEsperadas: Promise<void> | null = null
function esperarVoces(): Promise<void> {
  vocesEsperadas ??= new Promise((ok) => {
    speechSynthesis.addEventListener('voiceschanged', () => ok(), { once: true })
    setTimeout(ok, 1500)
  })
  return vocesEsperadas
}

// iPhone y Android solo dejan hablar si la primera lectura nace de un toque. Al primer toque en
// cualquier parte de la app se "desbloquea" la voz con una frase muda; después ya puede leer sola.
let desbloqueada = false
let mudaEnCurso = false
export function desbloquearVozAlTocar() {
  if (typeof speechSynthesis === 'undefined') return
  const desbloquear = () => {
    if (desbloqueada) return
    desbloqueada = true
    const muda = new SpeechSynthesisUtterance(' ')
    muda.volume = 0
    mudaEnCurso = true
    muda.onend = muda.onerror = () => {
      mudaEnCurso = false
    }
    speechSynthesis.speak(muda)
    void esperarVoces()
  }
  for (const evento of ['touchend', 'click']) document.addEventListener(evento, desbloquear, { capture: true, once: true })
}

function vozEspanol(lista: SpeechSynthesisVoice[]) {
  const es = lista.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('es'))
  const local = es.filter((v) => v.localService)
  const preferida = (l: SpeechSynthesisVoice[]) =>
    l.find((v) => /VE|419|US|MX/i.test(v.lang)) ?? l.find((v) => v.default) ?? l[0]
  return preferida(local) ?? preferida(es) ?? null
}

const ES_IPHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const AYUDA_VOZ = ES_IPHONE
  ? 'En el iPhone: quita el modo silencio (botón del costado), sube el volumen y revisa en Ajustes > Accesibilidad > Contenido leído > Voces que haya una voz en Español descargada.'
  : 'En el teléfono: Ajustes > Accesibilidad > Texto a voz (o "Salida de texto a voz"). Elige "Servicios de voz de Google", toca el engranaje > Instalar datos de voz > Español, y sube el volumen multimedia.'

// Chrome olvida las frases que nadie referencia y entonces nunca avisa que terminaron.
const enCurso = new Set<SpeechSynthesisUtterance>()

export async function hablar(texto: string, velocidad = 1): Promise<void> {
  if (typeof speechSynthesis === 'undefined') throw new Error('Este navegador no puede leer en voz alta.')
  // Sin esperas si ya se puede: así la lectura sigue "dentro" del toque, que es lo que pide el iPhone.
  if (!speechSynthesis.getVoices().length) await esperarVoces()
  const lista = speechSynthesis.getVoices()
  const voz = vozEspanol(lista)
  // En Android, hablar justo después de cancelar a veces se pierde: se deja pasar un instante.
  if ((speechSynthesis.speaking || speechSynthesis.pending) && !mudaEnCurso) callar()
  const desdeCancelar = Date.now() - ultimoCancelar
  if (desdeCancelar < 200) await esperar((200 - desdeCancelar) / 1000)
  return new Promise((ok, mal) => {
    const frase = new SpeechSynthesisUtterance(texto)
    frase.lang = voz?.lang ?? 'es-ES'
    if (voz) frase.voice = voz
    frase.rate = velocidad
    enCurso.add(frase)
    let empezo = false
    const terminar = (error?: Error) => {
      clearTimeout(vigilante)
      enCurso.delete(frase)
      if (error) mal(error)
      else ok()
    }
    // Si en 5 s no empezó ni terminó, el teléfono no está leyendo: se avisa en vez de quedarse mudo.
    const vigilante = setTimeout(() => {
      if (empezo) return
      callar()
      terminar(
        new Error(
          lista.length && !voz
            ? `El teléfono no tiene una voz en español. ${AYUDA_VOZ}`
            : `El teléfono no empezó a leer. ${AYUDA_VOZ}`,
        ),
      )
    }, 5000)
    frase.onstart = () => {
      empezo = true
    }
    frase.onend = () => terminar()
    frase.onerror = (e) =>
      e.error === 'interrupted' || e.error === 'canceled'
        ? terminar()
        : terminar(
            new Error(
              e.error === 'not-allowed'
                ? 'El navegador no dejó leer en voz alta. Toca de nuevo el botón.'
                : `El teléfono no pudo leer en voz alta (${e.error}). ${AYUDA_VOZ}`,
            ),
          )
    speechSynthesis.resume()
    speechSynthesis.speak(frase)
  })
}

let ultimoCancelar = 0
export function callar() {
  ultimoCancelar = Date.now()
  speechSynthesis.cancel()
}

export const esperar = (segundos: number) => new Promise((ok) => setTimeout(ok, segundos * 1000))

// Prepara el texto de una ficha para leerlo: corchetes de completar como "espacio en blanco" y líneas como pausas.
export function textoParaLeer(texto: string) {
  return texto
    .replace(/\[…\]/g, 'espacio en blanco')
    .replace(/[[\]]/g, '')
    .replace(/\n+/g, '. ')
}
