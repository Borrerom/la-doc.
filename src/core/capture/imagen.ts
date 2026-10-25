// Achica las fotos antes de guardarlas: ocupan menos en el teléfono y se mandan más rápido,
// pero con resolución suficiente para leer letra pequeña.
export const LADO_MAXIMO = 2000

export async function reducirImagen(archivo: Blob): Promise<Blob> {
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
    const ancho = Math.round(imagen.width * escala)
    const alto = Math.round(imagen.height * escala)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto)
    imagen.close()
    const reducida = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.85))
    return reducida && reducida.size < archivo.size ? reducida : archivo
  } catch {
    // Formatos que el navegador no sabe abrir: se guardan tal cual.
    return archivo
  }
}
