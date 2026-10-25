// Voz del sistema (Web Speech API). Inmediata, pero Android la corta al apagar la pantalla.

function vozEspanol() {
  const voces = speechSynthesis.getVoices()
  return voces.find((v) => v.lang === 'es-VE') ?? voces.find((v) => v.lang.startsWith('es')) ?? null
}

export function hablar(texto: string, velocidad = 1): Promise<void> {
  return new Promise((ok, mal) => {
    const frase = new SpeechSynthesisUtterance(texto)
    frase.lang = 'es-VE'
    frase.rate = velocidad
    const voz = vozEspanol()
    if (voz) frase.voice = voz
    frase.onend = () => ok()
    frase.onerror = (e) =>
      e.error === 'interrupted' || e.error === 'canceled'
        ? ok()
        : mal(
            new Error(
              'El teléfono no pudo leer en voz alta. Revisa en Ajustes de Android > Accesibilidad > Texto a voz que haya una voz en español instalada.',
            ),
          )
    speechSynthesis.speak(frase)
  })
}

export const callar = () => speechSynthesis.cancel()

export const esperar = (segundos: number) => new Promise((ok) => setTimeout(ok, segundos * 1000))

// Prepara el texto de una ficha para leerlo: corchetes de completar como "espacio en blanco" y líneas como pausas.
export function textoParaLeer(texto: string) {
  return texto
    .replace(/\[…\]/g, 'espacio en blanco')
    .replace(/[[\]]/g, '')
    .replace(/\n+/g, '. ')
}
