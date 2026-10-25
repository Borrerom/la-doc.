import { ulid } from 'ulid'
import type { Fuente, Id } from '../model/tipos'
import { db } from './db'
import { borrarNota, guardarNota } from './notas'
import { normalizar } from '../search/buscador'
import { borrarMazo, crearMateria, crearMazo } from './organizacion'
import { TIPO_FARMACO } from './tiposNota'

// Tres fármacos de ejemplo para probar fichas y repaso sin cargar material.
// Cada dato sale de la página de MedlinePlus en español citada, y la dosis de la ficha técnica
// de la AEMPS (CIMA), sección 4.2. Todas consultadas el 2026-10-25.
export const ETIQUETA_EJEMPLO = 'ejemplo'
export const NOMBRE_MAZO_EJEMPLO = 'Ejemplos (MedlinePlus)'
const CONSULTA = new Date(2026, 9, 25).getTime()

type FuenteDosis = { valor: string; titulo: string; url: string }
type Ejemplo = { titulo: string; url: string; valores: Record<Id, string>; dosis: FuenteDosis }

const CAMPO_DOSIS = 'farmaco-dosis'

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
    dosis: {
      valor:
        'Adultos y niños de 40 kg o más: de 250 a 500 mg cada 8 horas o de 750 mg a 1 g cada 12 horas, según la infección.\nFunción renal reducida (filtrado 10 a 30 ml/min): máximo 500 mg dos veces al día.\nEdad avanzada: no se considera necesario ajustar la dosis.',
      titulo: 'Amoxicilina Cinfa 500 mg cápsulas: ficha técnica (CIMA, AEMPS)',
      url: 'https://cima.aemps.es/cima/dochtml/ft/62586/FT_62586.html',
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
    dosis: {
      valor:
        'Hipertensión: dosis inicial de 5 a 20 mg una vez al día; mantenimiento habitual 20 mg al día, máximo 40 mg al día.\nFunción renal reducida: aclaramiento 30 a 80 ml/min, 5 a 10 mg al día; 10 a 30 ml/min, 2,5 mg al día.\nEdad avanzada: adecuar la dosis a la función renal.',
      titulo: 'Enalapril Cinfa 20 mg comprimidos: ficha técnica (CIMA, AEMPS)',
      url: 'https://cima.aemps.es/cima/dochtml/ft/63355/FT_63355.html',
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
    dosis: {
      valor:
        'Adultos con función renal normal: inicio 500 u 850 mg 2 o 3 veces al día, con las comidas; máximo 3 g al día en 3 tomas.\nFunción renal (TFG): 60 a 89, máximo 3.000 mg al día; 45 a 59, máximo 2.000 mg; 30 a 44, máximo 1.000 mg; menos de 30, contraindicada.\nEdad avanzada: ajustar según la función renal.',
      titulo: 'Metformina Cinfa 850 mg comprimidos: ficha técnica (CIMA, AEMPS)',
      url: 'https://cima.aemps.es/cima/dochtml/ft/68167/FT_68167.html',
    },
  },
]

export async function hayEjemplos(materiaId: Id) {
  return (await db.mazos.where('materiaId').equals(materiaId).toArray()).some(
    (m) => !m.borrada && m.nombre === NOMBRE_MAZO_EJEMPLO,
  )
}

async function citar(notaId: Id, campoIds: Id[], fuente: Omit<Fuente, 'id' | 'creada' | 'editada' | 'tipo' | 'fechaConsulta'>) {
  const f: Fuente = { id: ulid(), creada: CONSULTA, editada: CONSULTA, tipo: 'web', fechaConsulta: CONSULTA, ...fuente }
  await db.fuentes.add(f)
  await db.citas.bulkAdd(
    campoIds.map((campoId) => ({ id: ulid(), creada: CONSULTA, editada: CONSULTA, notaId, campoId, fuenteId: f.id })),
  )
}

export async function cargarEjemplos(materiaId: Id) {
  if (await hayEjemplos(materiaId)) return
  const mazo = await crearMazo(NOMBRE_MAZO_EJEMPLO, materiaId)
  for (const e of EJEMPLOS) {
    const nota = await guardarNota({
      tipoNotaId: TIPO_FARMACO,
      mazoId: mazo.id,
      valores: { ...e.valores, [CAMPO_DOSIS]: e.dosis.valor },
      etiquetas: [ETIQUETA_EJEMPLO],
    })
    await citar(nota.id, Object.keys(e.valores), { titulo: e.titulo, url: e.url, proveedor: 'MedlinePlus en español' })
    await citar(nota.id, [CAMPO_DOSIS], { titulo: e.dosis.titulo, url: e.dosis.url, proveedor: 'CIMA, AEMPS' })
  }
}

// Los ejemplos cargados con la versión 0.10 venían sin dosis: se completa si sigue vacía.
async function completarDosis() {
  const notas = (await db.notas.where('etiquetas').equals(ETIQUETA_EJEMPLO).toArray()).filter((n) => !n.borrada)
  for (const n of notas) {
    const e = EJEMPLOS.find((x) => x.valores['farmaco-nombre'] === n.valores['farmaco-nombre'])
    if (!e || n.valores[CAMPO_DOSIS]) continue
    await guardarNota({ ...n, valores: { ...n.valores, [CAMPO_DOSIS]: e.dosis.valor } })
    await citar(n.id, [CAMPO_DOSIS], { titulo: e.dosis.titulo, url: e.dosis.url, proveedor: 'CIMA, AEMPS' })
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

const AJUSTE_EJEMPLOS = 'ejemplos-iniciales'
// Solo para pruebas automáticas que necesitan empezar sin ejemplos.
export const SIN_EJEMPLOS = 'la-doc:sin-ejemplos'

let enCurso: Promise<void> | null = null

// La primera vez que hay un semestre, deja Farmacología 1 con los 3 ejemplos ya cargados.
// Se hace una sola vez: si Kiko los borra, no vuelven.
export function asegurarEjemplosIniciales(): Promise<void> {
  enCurso ??= (async () => {
    try {
      await completarDosis()
      if (await db.ajustes.get(AJUSTE_EJEMPLOS)) return
      if (typeof localStorage !== 'undefined' && localStorage.getItem(SIN_EJEMPLOS)) return
      const semestres = (await db.semestres.orderBy('orden').toArray()).filter((s) => !s.borrada)
      if (semestres.length === 0) return
      const materias = (await db.materias.toArray()).filter((m) => !m.borrada)
      const farmaco =
        materias.find((m) => normalizar(m.nombre) === 'farmacologia 1') ??
        materias.find((m) => normalizar(m.nombre).startsWith('farmacologia')) ??
        (await crearMateria('Farmacología 1', semestres[0].id))
      await cargarEjemplos(farmaco.id)
      await db.ajustes.put({ clave: AJUSTE_EJEMPLOS, valor: Date.now() })
    } finally {
      enCurso = null
    }
  })()
  return enCurso
}
