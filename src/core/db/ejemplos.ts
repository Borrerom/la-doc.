import { ulid } from 'ulid'
import type { Fuente, Id } from '../model/tipos'
import { db } from './db'
import { borrarNota, guardarNota } from './notas'
import { borrarMazo, crearMazo } from './organizacion'
import { TIPO_FARMACO } from './tiposNota'

// Tres fármacos de ejemplo para probar fichas y repaso sin cargar material.
// Cada dato sale de la página de MedlinePlus en español citada (consultadas el 2026-10-25).
// Los campos que la fuente no cubre (la dosis) quedan vacíos.
export const ETIQUETA_EJEMPLO = 'ejemplo'
export const NOMBRE_MAZO_EJEMPLO = 'Ejemplos (MedlinePlus)'
const CONSULTA = new Date(2026, 9, 25).getTime()

type Ejemplo = { titulo: string; url: string; valores: Record<Id, string> }

export const EJEMPLOS: Ejemplo[] = [
  {
    titulo: 'Amoxicilina: MedlinePlus medicinas',
    url: 'https://medlineplus.gov/spanish/druginfo/meds/a685001-es.html',
    valores: {
      'farmaco-nombre': 'Amoxicilina',
      'farmaco-grupo': 'Antibióticos similares a la penicilina',
      'farmaco-mecanismo': 'Detiene el crecimiento de las bacterias.',
      'farmaco-indicaciones':
        'Neumonía\nInfecciones de la piel\nInfecciones del tracto urinario\nEliminación de H. pylori, en combinación con otros medicamentos',
      'farmaco-contraindicaciones':
        'Alergia a la amoxicilina o a sus componentes\nPrecaución: mononucleosis, enfermedad hepática o renal, asma',
      'farmaco-efectos':
        'Náuseas, vómitos o diarrea\nDecoloración temporal de los dientes\nGraves: sarpullido, ampollas, dificultad para respirar, diarrea intensa con sangre',
      'farmaco-interacciones': 'Puede reducir la eficacia de los anticonceptivos hormonales',
    },
  },
  {
    titulo: 'Enalapril: MedlinePlus medicinas',
    url: 'https://medlineplus.gov/spanish/druginfo/meds/a686022-es.html',
    valores: {
      'farmaco-nombre': 'Enalapril',
      'farmaco-grupo': 'Inhibidores de la enzima convertidora de la angiotensina (IECA)',
      'farmaco-mecanismo':
        'Disminuye ciertos productos químicos que oprimen los vasos sanguíneos, para que la sangre fluya y el corazón bombee de manera más eficiente.',
      'farmaco-indicaciones': 'Presión arterial alta\nInsuficiencia cardíaca, en combinación con otros medicamentos',
      'farmaco-contraindicaciones':
        'Embarazo\nAlergia al enalapril o a otros IECA\nJunto con aliskiren en pacientes con diabetes',
      'farmaco-efectos':
        'Tos\nMareos\nSarpullido\nDebilidad\nGraves: inflamación de la cara, lengua o garganta; dificultad para respirar o tragar',
      'farmaco-interacciones':
        'Valsartán y sacubitrilo\nAliskiren, en pacientes con diabetes\nAspirina y AINE como ibuprofeno y naproxeno\nSustitutos de sal con potasio',
    },
  },
  {
    titulo: 'Metformina: MedlinePlus medicinas',
    url: 'https://medlineplus.gov/spanish/druginfo/meds/a696005-es.html',
    valores: {
      'farmaco-nombre': 'Metformina',
      'farmaco-grupo': 'Biguanidas',
      'farmaco-mecanismo':
        'Disminuye la glucosa que el cuerpo absorbe de los alimentos y la que produce el hígado, y aumenta la respuesta del organismo a la insulina.',
      'farmaco-indicaciones': 'Diabetes tipo 2, sola o con otros medicamentos, incluida la insulina',
      'farmaco-contraindicaciones':
        'Enfermedad renal (riesgo de acidosis láctica)\nAlergia a la metformina\nNo se usa en la diabetes tipo 1',
      'farmaco-efectos':
        'Diarrea\nNáuseas\nMalestar estomacal\nGases\nCambio en el sentido del gusto\nRara pero grave: acidosis láctica',
      'farmaco-interacciones':
        'Acetazolamida, diclorfenamida, metazolamida, topiramato y zonisamida: más riesgo de acidosis láctica\nAlcohol\nMedios de contraste de rayos X: suspender antes del estudio',
    },
  },
]

export async function hayEjemplos(materiaId: Id) {
  return (await db.mazos.where('materiaId').equals(materiaId).toArray()).some(
    (m) => !m.borrada && m.nombre === NOMBRE_MAZO_EJEMPLO,
  )
}

export async function cargarEjemplos(materiaId: Id) {
  if (await hayEjemplos(materiaId)) return
  const mazo = await crearMazo(NOMBRE_MAZO_EJEMPLO, materiaId)
  for (const e of EJEMPLOS) {
    const nota = await guardarNota({ tipoNotaId: TIPO_FARMACO, mazoId: mazo.id, valores: e.valores, etiquetas: [ETIQUETA_EJEMPLO] })
    const fuente: Fuente = {
      id: ulid(),
      creada: CONSULTA,
      editada: CONSULTA,
      tipo: 'web',
      titulo: e.titulo,
      url: e.url,
      proveedor: 'MedlinePlus en español',
      fechaConsulta: CONSULTA,
    }
    await db.fuentes.add(fuente)
    await db.citas.bulkAdd(
      Object.keys(e.valores).map((campoId) => ({
        id: ulid(),
        creada: CONSULTA,
        editada: CONSULTA,
        notaId: nota.id,
        campoId,
        fuenteId: fuente.id,
      })),
    )
  }
}

// Borra de una vez los fármacos de ejemplo y su mazo.
export async function borrarEjemplos(materiaId: Id) {
  const notas = (await db.notas.where('etiquetas').equals(ETIQUETA_EJEMPLO).toArray()).filter(
    (n) => !n.borrada && n.materiaId === materiaId,
  )
  for (const n of notas) await borrarNota(n.id)
  const mazos = (await db.mazos.where('materiaId').equals(materiaId).toArray()).filter(
    (m) => !m.borrada && m.nombre === NOMBRE_MAZO_EJEMPLO,
  )
  for (const m of mazos) await borrarMazo(m.id)
}

// Fuentes citadas por una nota, sin repetir.
export async function fuentesDeNota(notaId: Id) {
  const citas = await db.citas.where('notaId').equals(notaId).toArray()
  const ids = [...new Set(citas.map((c) => c.fuenteId))]
  return (await db.fuentes.bulkGet(ids)).filter((f): f is Fuente => !!f)
}
