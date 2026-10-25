import type { ParteIA } from '../ai/clientes'

// Para proveedores que no leen PDF: se saca el texto y, si el PDF es escaneado (casi sin texto),
// se convierten las primeras páginas en imágenes.
export const PAGINAS_COMO_IMAGEN = 8
const TEXTO_MINIMO = 200

async function abrirPdf(blob: Blob) {
  const pdfjs = await import('pdfjs-dist')
  const { default: trabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador
  return pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
}

async function enBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

export async function pdfAPartes(blob: Blob): Promise<ParteIA[]> {
  const tarea = await abrirPdf(blob)
  const pdf = await tarea.promise
  try {
    const paginas: string[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const contenido = await (await pdf.getPage(n)).getTextContent()
      const texto = contenido.items.map((i) => ('str' in i ? i.str : '')).join(' ').replace(/\s+/g, ' ').trim()
      paginas.push(texto)
    }
    if (paginas.join('').length >= TEXTO_MINIMO) {
      return paginas.map((texto, i) => ({ texto: `Página ${i + 1}:\n${texto}` }))
    }
    const partes: ParteIA[] = []
    for (let n = 1; n <= Math.min(pdf.numPages, PAGINAS_COMO_IMAGEN); n++) {
      const pagina = await pdf.getPage(n)
      const vista = pagina.getViewport({ scale: 1.5 })
      const lienzo = document.createElement('canvas')
      lienzo.width = vista.width
      lienzo.height = vista.height
      await pagina.render({ canvas: lienzo, canvasContext: lienzo.getContext('2d')!, viewport: vista }).promise
      const imagen = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.8))
      if (!imagen) continue
      partes.push({ texto: `Página ${n}:` }, { datos: await enBase64(imagen), mime: 'image/jpeg' })
    }
    return partes
  } finally {
    void tarea.destroy()
  }
}
