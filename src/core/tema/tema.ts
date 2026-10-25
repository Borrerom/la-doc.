// Colores de la pantalla. "auto" sigue el modo claro u oscuro del teléfono; los demás lo fijan.
// Se guarda en este teléfono y se aplica con data-tema en <html>, antes de pintar la app.
export type Tema = 'auto' | 'dia' | 'noche' | 'noche-calida'

export const TEMAS: { id: Tema; nombre: string; detalle: string }[] = [
  { id: 'auto', nombre: 'Automático', detalle: 'Claro u oscuro según el teléfono' },
  { id: 'dia', nombre: 'Día', detalle: 'Fondo lila muy claro' },
  { id: 'noche', nombre: 'Noche', detalle: 'Gris violeta oscuro, letra blanco roto' },
  { id: 'noche-calida', nombre: 'Noche cálida', detalle: 'Letra crema y ámbar, con menos luz azul' },
]

const CLAVE = 'la-doc:tema'
// Color de la barra del sistema para cada tema fijo.
const BARRA: Record<Exclude<Tema, 'auto'>, string> = { dia: '#7c3aed', noche: '#15121a', 'noche-calida': '#17130f' }

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    return TEMAS.some((x) => x.id === t) ? (t as Tema) : 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'auto') delete raiz.dataset.tema
  else raiz.dataset.tema = tema
  const oscuro = tema === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : tema !== 'dia'
  const barra = tema === 'auto' ? (oscuro ? BARRA.noche : BARRA.dia) : BARRA[tema]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barra)
}

export function guardarTema(tema: Tema) {
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // Sin almacenamiento del navegador, el tema vale solo hasta cerrar la app.
  }
  aplicarTema(tema)
}
