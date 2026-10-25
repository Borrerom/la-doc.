import { archivosDeCarga } from '../db/cargas'
import { db } from '../db/db'
import { rutaDeMazo } from '../db/organizacion'
import { TIPO_FARMACO } from '../db/tiposNota'
import type { Carga, Id, ProveedorIA } from '../model/tipos'
import { ErrorIA, pedirIA, type ParteIA } from './clientes'
import { armarInstrucciones, interpretarRespuesta, type Borrador } from './extraer'
import { PROVEEDORES, proveedoresDisponibles } from './proveedores'

export const INTENTOS_MAXIMOS = 3
// Si el proveedor no dice cuánto esperar tras agotar la cuota, se descansa este tiempo.
export const DESCANSO_CUOTA_MS = 15 * 60 * 1000

export type Herramientas = {
  hacerFetch?: typeof fetch
  convertirAudio?: (blob: Blob) => Promise<Blob>
}

// Gemini lee fotos, PDF y audio. Los demás, por ahora, solo fotos.
export function puedeLeer(proveedor: ProveedorIA['id'], tipo: Carga['tipo']) {
  return proveedor === 'gemini' || tipo === 'foto'
}

async function enBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

async function partesDeCarga(carga: Carga, herramientas: Herramientas): Promise<ParteIA[]> {
  const archivos = await archivosDeCarga(carga)
  if (archivos.length === 0) throw new Error('Los archivos de esta carga ya no están en el teléfono.')
  const partes: ParteIA[] = []
  if (carga.indicacion) partes.push({ texto: `Indicación de la estudiante: ${carga.indicacion}` })
  for (const [i, a] of archivos.entries()) {
    let blob = a.blob
    if (carga.tipo === 'voz' && herramientas.convertirAudio) blob = await herramientas.convertirAudio(blob)
    if (carga.tipo === 'foto') partes.push({ texto: `Página ${i + 1}:` })
    partes.push({ datos: await enBase64(blob), mime: blob.type || a.tipoMime })
  }
  return partes
}

async function contexto(carga: Carga) {
  const mazos = await db.mazos.where('materiaId').equals(carga.materiaId).toArray()
  const materia = await db.materias.get(carga.materiaId)
  return { materia: materia?.nombre ?? '', tema: rutaDeMazo(mazos, carga.mazoId).join(' › ') }
}

export type Resultado = 'listo' | 'sin_red' | 'sin_proveedor' | 'error'

export async function procesarCarga(id: Id, herramientas: Herramientas = {}): Promise<Resultado> {
  const carga = await db.cargas.get(id)
  if (!carga || carga.borrada || carga.estado !== 'en_cola') return 'error'
  const tipo = await db.tiposNota.get(TIPO_FARMACO)
  if (!tipo) return 'error'

  const proveedores = (await proveedoresDisponibles()).filter((p) => puedeLeer(p.id, carga.tipo))
  if (proveedores.length === 0) {
    const mensaje =
      carga.tipo === 'foto'
        ? 'Falta una clave de IA. Agrégala en Inicio › Inteligencia artificial.'
        : 'Para PDF y voz hace falta la clave de Gemini (o esperar a que se recupere su cuota).'
    await db.cargas.update(id, { error: mensaje })
    return 'sin_proveedor'
  }

  await db.cargas.update(id, { estado: 'procesando', error: undefined })
  const errores: string[] = []
  try {
    const instrucciones = armarInstrucciones(tipo, { ...(await contexto(carga)), tipoCarga: carga.tipo })
    const partes = await partesDeCarga(carga, herramientas)
    for (const p of proveedores) {
      try {
        const texto = await pedirIA(p, { instrucciones, partes, json: true }, herramientas.hacerFetch)
        const farmacos = interpretarRespuesta(texto, tipo)
        if (farmacos.length === 0) {
          errores.push(`${PROVEEDORES[p.id].nombre}: no encontró fármacos en este material.`)
          continue
        }
        const borrador: Borrador = { farmacos, proveedor: PROVEEDORES[p.id].nombre, modelo: p.modelo, fecha: Date.now() }
        await db.cargas.update(id, {
          estado: 'por_revisar',
          borrador,
          proveedorUsado: p.id,
          error: undefined,
          editada: Date.now(),
        })
        return 'listo'
      } catch (e) {
        if (e instanceof ErrorIA && e.tipo === 'red') {
          await db.cargas.update(id, { estado: 'en_cola', error: undefined })
          return 'sin_red'
        }
        if (e instanceof ErrorIA && e.tipo === 'cuota') {
          await db.proveedoresIA.update(p.id, { agotadoHasta: Date.now() + (e.esperarMs ?? DESCANSO_CUOTA_MS) })
        }
        errores.push(`${PROVEEDORES[p.id].nombre}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } catch (e) {
    errores.push(e instanceof Error ? e.message : String(e))
  }

  const intentos = carga.intentos + 1
  await db.cargas.update(id, {
    intentos,
    estado: intentos >= INTENTOS_MAXIMOS ? 'error' : 'en_cola',
    error: errores.join(' '),
    editada: Date.now(),
  })
  return 'error'
}

let enMarcha: Promise<void> | null = null
let recuperadas = false

// Procesa, de la más vieja a la más nueva, las cargas que esperan en la cola.
export function procesarCola(herramientas: Herramientas = {}): Promise<void> {
  enMarcha ??= (async () => {
    try {
      if (!recuperadas) {
        await recuperarInterrumpidas()
        recuperadas = true
      }
      const pendientes = (await db.cargas.where('estado').equals('en_cola').sortBy('creada')).filter((c) => !c.borrada)
      for (const c of pendientes) {
        const r = await procesarCarga(c.id, herramientas)
        if (r === 'sin_red') break
      }
    } finally {
      enMarcha = null
    }
  })()
  return enMarcha
}

// Si la app se cerró a mitad de un proceso, esa carga vuelve a la cola (al empezar la primera vez).
export async function recuperarInterrumpidas() {
  await db.cargas.where('estado').equals('procesando').modify({ estado: 'en_cola' })
}
