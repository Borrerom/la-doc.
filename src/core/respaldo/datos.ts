import { db } from '../db/db'

// Qué entra al respaldo: todo lo que Desi creó o estudió. Quedan fuera los audios generados
// (se rehacen solos) y los archivos originales de las cargas (fotos, PDF y voz), que pesan mucho.
export const TABLAS_RESPALDO = [
  'semestres',
  'materias',
  'mazos',
  'tiposNota',
  'notas',
  'fichas',
  'estadosRepaso',
  'registrosRepaso',
  'tiposEnlace',
  'enlaces',
  'fuentes',
  'citas',
  'cargas',
  'proveedoresIA',
  'ajustes',
] as const

// Ajustes que pertenecen al teléfono y no a la cuenta.
const AJUSTES_LOCALES = new Set(['respaldo'])

export type Respaldo = {
  app: 'la-doc'
  formato: 1
  fecha: number
  version: string
  tablas: Record<string, unknown[]>
}

export async function exportarDatos(): Promise<Respaldo> {
  const tablas: Record<string, unknown[]> = {}
  for (const t of TABLAS_RESPALDO) {
    let filas: unknown[] = await db.table(t).toArray()
    if (t === 'ajustes') filas = filas.filter((a) => !AJUSTES_LOCALES.has((a as { clave: string }).clave))
    // Las cargas viajan sin sus archivos: solo las que ya tienen borrador de la IA, para terminar de revisarlas.
    if (t === 'cargas') {
      filas = filas
        .filter((c) => ['por_revisar', 'aprobada'].includes((c as { estado: string }).estado))
        .map((c) => ({ ...(c as object), archivoIds: [] }))
    }
    tablas[t] = filas
  }
  return { app: 'la-doc', formato: 1, fecha: Date.now(), version: __APP_VERSION__, tablas }
}

export function esRespaldo(x: unknown): x is Respaldo {
  const r = x as Respaldo
  return !!r && r.app === 'la-doc' && r.formato === 1 && typeof r.tablas === 'object'
}

// Reemplaza todo lo del teléfono por el respaldo (menos los ajustes propios del teléfono).
export async function importarDatos(respaldo: Respaldo) {
  if (!esRespaldo(respaldo)) throw new Error('El archivo no es un respaldo de La Doc.')
  const tablas = [...TABLAS_RESPALDO.map((t) => db.table(t)), db.table('archivos'), db.table('audiosFicha')]
  await db.transaction('rw', tablas, async () => {
    for (const t of TABLAS_RESPALDO) {
      const tabla = db.table(t)
      if (t === 'ajustes') await tabla.where('clave').noneOf([...AJUSTES_LOCALES]).delete()
      else await tabla.clear()
      const filas = (respaldo.tablas[t] ?? []).filter((f) => t !== 'ajustes' || !AJUSTES_LOCALES.has((f as { clave: string }).clave))
      await tabla.bulkPut(filas)
    }
    await db.table('archivos').clear()
    await db.table('audiosFicha').clear()
  })
}

// Deja el teléfono vacío para otra cuenta (paso 17). Los ajustes del teléfono se conservan.
export async function borrarDatosLocales() {
  await importarDatos({ app: 'la-doc', formato: 1, fecha: Date.now(), version: __APP_VERSION__, tablas: {} })
}

// Huella barata para saber si algo cambió desde el último respaldo.
export async function huellaDatos() {
  const partes: (string | number)[] = []
  for (const t of TABLAS_RESPALDO) {
    if (t === 'ajustes') continue
    const tabla = db.table(t)
    partes.push(await tabla.count())
  }
  const ultimaNota = await db.notas.orderBy('editada').last()
  const ultimoRepaso = await db.registrosRepaso.orderBy('fecha').last()
  partes.push(ultimaNota?.editada ?? 0, ultimoRepaso?.fecha ?? 0)
  return partes.join('.')
}
