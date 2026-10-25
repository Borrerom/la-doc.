import type { Herramientas } from '../ai/procesar'
import { audioAWav } from './audioWav'
import { pdfAPartes } from './pdf'

// Conversiones que solo existen en el navegador (no en las pruebas unitarias).
export const HERRAMIENTAS_NAVEGADOR: Herramientas = { convertirAudio: audioAWav, convertirPdf: pdfAPartes }
