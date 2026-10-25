import { ulid } from 'ulid'
import type { Fuente, Id } from '../model/tipos'
import { db } from './db'
import { borrarNota, guardarNota } from './notas'
import { normalizar } from '../search/buscador'
import { borrarMazo, crearMateria, crearMazo } from './organizacion'
import { aprobarEnlace, enlacesDeNota } from './enlaces'
import { MATERIAS_INICIALES } from './materiasIniciales'
import { TIPO_CASO, TIPO_FARMACO, TIPO_PATOLOGIA } from './tiposNota'

// Tres fármacos de ejemplo para probar fichas y repaso sin cargar material.
// Cada dato sale de la página de MedlinePlus en español citada, y la dosis de la ficha técnica
// de la AEMPS (CIMA), sección 4.2. Todas consultadas el 2026-10-25.
export const ETIQUETA_EJEMPLO = 'ejemplo'
export const NOMBRE_MAZO_EJEMPLO = 'Ejemplos (MedlinePlus)'
const CONSULTA = new Date(2026, 9, 25).getTime()

type FuenteDosis = { valor: string; titulo: string; url: string }
// via y adme salen de la misma ficha técnica que la dosis (secciones 4.2 y 5.2).
type Ejemplo = { titulo: string; url: string; valores: Record<Id, string>; dosis: FuenteDosis; via: string; adme: string }

const CAMPO_DOSIS = 'farmaco-dosis'
const CAMPO_VIA = 'farmaco-via'
const CAMPO_ADME = 'farmaco-adme'
// En estas dos fichas la sección 5.2 no se pudo leer entera: Desi debe confirmarla.
const VALIDAR = 'Por validar con la sección 5.2 de la ficha técnica'

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
    via: 'Oral, en cápsulas. Se traga con agua sin abrirla; los alimentos no afectan su absorción.',
    adme:
      'Absorción: biodisponibilidad cercana al 70 %, pico en 1 hora\nDistribución: se une poco a proteínas (18 %); atraviesa la placenta y pasa a la leche\nMetabolismo: 10 a 25 % sale como ácido peniciloico, inactivo\nExcreción: renal, 60 a 70 % sin cambios en 6 horas; vida media cercana a 1 hora\n' + VALIDAR,
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
    via: 'Oral, en comprimidos que se pueden dividir. Los alimentos no afectan su absorción.',
    adme:
      'Absorción: rápida, pico en 1 hora; se absorbe cerca del 60 %\nDistribución: el enalaprilato se une a proteínas en no más del 60 %\nMetabolismo: profármaco; se convierte en enalaprilato, el inhibidor de la ECA activo\nExcreción: renal, en orina 40 % como enalaprilato y 20 % sin cambios\n' + VALIDAR,
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
    via: 'Oral, en comprimidos recubiertos, durante o después de las comidas.',
    adme:
      'Absorción: biodisponibilidad de 50 a 60 %, pico en 2,5 horas; los alimentos la reducen y retrasan un poco\nDistribución: casi no se une a proteínas; volumen de 63 a 276 litros; pasa a la leche materna\nMetabolismo: no se metaboliza, sin metabolitos conocidos en humanos\nExcreción: renal, sin cambios, por filtración y secreción tubular; vida media cercana a 6,5 horas',
  },
]

const esMazoEjemplo = (nombre: string) => nombre === NOMBRE_MAZO_EJEMPLO || nombre === NOMBRE_MAZO_CASOS_EJEMPLO

export async function hayEjemplos(materiaId: Id) {
  return (await db.mazos.where('materiaId').equals(materiaId).toArray()).some((m) => !m.borrada && esMazoEjemplo(m.nombre))
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
      valores: { ...e.valores, [CAMPO_DOSIS]: e.dosis.valor, [CAMPO_VIA]: e.via, [CAMPO_ADME]: e.adme },
      etiquetas: [ETIQUETA_EJEMPLO],
    })
    await citar(nota.id, Object.keys(e.valores), { titulo: e.titulo, url: e.url, proveedor: 'MedlinePlus en español' })
    await citar(nota.id, [CAMPO_DOSIS, CAMPO_VIA, CAMPO_ADME], { titulo: e.dosis.titulo, url: e.dosis.url, proveedor: 'CIMA, AEMPS' })
  }
}

// Los ejemplos de versiones anteriores venían sin dosis (0.10) o sin vía y farmacocinética (0.20):
// se completan los campos que sigan vacíos.
async function completarEjemplos() {
  const notas = (await db.notas.where('etiquetas').equals(ETIQUETA_EJEMPLO).toArray()).filter((n) => !n.borrada)
  for (const n of notas) {
    const e = EJEMPLOS.find((x) => x.valores['farmaco-nombre'] === n.valores['farmaco-nombre'])
    if (!e) continue
    // Solo se llenan los campos vacíos, para no pisar lo que Desi haya corregido.
    const faltan = (
      [
        [CAMPO_DOSIS, e.dosis.valor],
        [CAMPO_VIA, e.via],
        [CAMPO_ADME, e.adme],
      ] as const
    ).filter(([campo]) => !n.valores[campo])
    if (faltan.length === 0) continue
    await guardarNota({ ...n, valores: { ...n.valores, ...Object.fromEntries(faltan) } })
    await citar(
      n.id,
      faltan.map(([campo]) => campo),
      { titulo: e.dosis.titulo, url: e.dosis.url, proveedor: 'CIMA, AEMPS' },
    )
  }
}

// Borra de una vez las notas de ejemplo de la materia y su mazo.
export async function borrarEjemplos(materiaId: Id) {
  const notas = (await db.notas.where('etiquetas').equals(ETIQUETA_EJEMPLO).toArray()).filter(
    (n) => !n.borrada && n.materiaId === materiaId,
  )
  for (const n of notas) await borrarNota(n.id)
  const mazos = (await db.mazos.where('materiaId').equals(materiaId).toArray()).filter(
    (m) => !m.borrada && esMazoEjemplo(m.nombre),
  )
  // El mazo se borra solo si quedó vacío: Desi pudo haber guardado algo suyo ahí.
  for (const m of mazos) {
    const quedan = await db.notas.where('mazoId').equals(m.id).filter((n) => !n.borrada).count()
    if (quedan === 0) await borrarMazo(m.id)
  }
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
// Se hace una sola vez: si Desi los borra, no vuelven.
export function asegurarEjemplosIniciales(): Promise<void> {
  enCurso ??= (async () => {
    try {
      await completarEjemplos()
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

// --- Ejemplos de las otras dos materias (v0.20) ---
// Dos patologías de MedlinePlus en español (consultadas el 2026-10-25) que se enlazan con
// enalapril y metformina, y dos casos de práctica armados por La Doc con esas mismas fichas.
export const NOMBRE_MAZO_CASOS_EJEMPLO = 'Ejemplos'

type EjemploPatologia = { fuentes: { titulo: string; url: string }[]; valores: Record<Id, string> }

export const EJEMPLOS_PATOLOGIA: EjemploPatologia[] = [
  {
    fuentes: [
      { titulo: 'Presión arterial alta: MedlinePlus en español', url: 'https://medlineplus.gov/spanish/highbloodpressure.html' },
      { titulo: 'Presión arterial alta en adultos - hipertensión: MedlinePlus enciclopedia médica', url: 'https://medlineplus.gov/spanish/ency/article/000468.htm' },
    ],
    valores: {
      'patologia-nombre': 'Presión arterial alta (hipertensión)',
      'patologia-definicion': 'La sangre fluye por las arterias con una fuerza mayor de lo normal.',
      'patologia-causas':
        'Primaria o esencial: la más común, se desarrolla con la edad y sin causa identificable\nSecundaria: enfermedad renal crónica, trastornos suprarrenales, apnea del sueño, embarazo o medicamentos\nFactores de riesgo: obesidad, mucha sal, alcohol, tabaco, estrés, antecedente familiar, diabetes',
      'patologia-fisiopatologia':
        'Los vasos sanguíneos se vuelven más rígidos con la edad y la presión se eleva; si se mantiene alta, el corazón bombea con más fuerza y trabaja demasiado.',
      'patologia-signos':
        'En la mayoría de los casos no hay síntomas: se detecta en los chequeos\nHipertensión maligna: dolor de cabeza fuerte, náuseas o vómitos, confusión, cambios en la visión, sangrado nasal',
      'patologia-diagnostico':
        'Dos o más mediciones en citas distintas\nNormal: menos de 120/80 mm Hg\nElevada: 120 a 129 y menos de 80\nGrado 1: 130 a 139 o 80 a 89\nGrado 2: 140 o más o 90 o más\nCrisis hipertensiva: más de 180 y más de 120\nBuscar complicaciones: colesterol, electrocardiograma, examen de orina y función renal',
      'patologia-tratamiento':
        'Cambios de estilo de vida: menos de 1.500 mg de sodio al día, 150 minutos de ejercicio por semana, peso saludable, dejar de fumar, poco alcohol\nMedicamentos: hay muchos y a menudo se combinan; en grado 2 siempre van con los cambios de estilo de vida',
      'patologia-complicaciones':
        'Ataque cardíaco e insuficiencia cardíaca\nAccidente cerebrovascular\nInsuficiencia renal\nProblemas en los ojos\nMala circulación en las piernas',
    },
  },
  {
    fuentes: [
      { titulo: 'Diabetes tipo 2: MedlinePlus en español', url: 'https://medlineplus.gov/spanish/diabetestype2.html' },
      { titulo: 'Diabetes tipo 2: MedlinePlus enciclopedia médica', url: 'https://medlineplus.gov/spanish/ency/article/000313.htm' },
    ],
    valores: {
      'patologia-nombre': 'Diabetes tipo 2',
      'patologia-definicion':
        'Enfermedad crónica con un nivel alto de azúcar (glucosa) en la sangre, porque el cuerpo no produce suficiente insulina o no la usa bien. Es la forma más común de diabetes.',
      'patologia-causas':
        'Sobrepeso u obesidad, sobre todo alrededor de la cintura\nPoca actividad física\nGenética e historia familiar\nMás de 45 años, prediabetes o diabetes en el embarazo',
      'patologia-fisiopatologia':
        'Resistencia a la insulina: las células del músculo, el hígado y la grasa no responden bien a ella. Al inicio el páncreas produce más insulina para compensar; con el tiempo no alcanza y la glucosa se acumula en la sangre (hiperglucemia).',
      'patologia-signos':
        'Al principio muchas personas no tienen síntomas\nMucha sed y orinar con frecuencia\nMás hambre y cansancio\nVisión borrosa\nHormigueo en pies o manos\nLlagas que no cicatrizan e infecciones frecuentes',
      'patologia-diagnostico':
        'Glucosa en ayunas de 126 mg/dL o más en dos momentos distintos\nHemoglobina A1C de 6,5 % o más\nTolerancia oral a la glucosa: 200 mg/dL o más a las 2 horas',
      'patologia-tratamiento':
        'Alimentación saludable y actividad física\nBiguanidas (metformina)\nInhibidores de la DPP-4, de SGLT2 y agonistas del GLP-1\nSulfonilureas, meglitinidas y tiazolidinedionas\nInsulina cuando lo anterior no basta',
      'patologia-complicaciones':
        'Problemas en los ojos, hasta la ceguera\nÚlceras en los pies y amputación\nDaño de los nervios\nDaño renal hasta diálisis\nAtaque cardíaco y accidente cerebrovascular',
    },
  },
]

// Casos de práctica armados por La Doc: cada dato clínico sale de las fichas de ejemplo de arriba.
export const EJEMPLOS_CASO: Record<Id, string>[] = [
  {
    'caso-titulo': 'Hombre de 56 años en control de rutina',
    'caso-paciente': '56 años, masculino, 92 kg. Antecedente: diabetes tipo 2, tratado con metformina.',
    'caso-consulta': 'Control de rutina. Refiere dolor de cabeza ocasional, sin otros síntomas.',
    'caso-hallazgos':
      'Presión arterial de 148/94 mm Hg en dos consultas distintas\nGlucosa en ayunas de 132 mg/dL\nHemoglobina A1C de 7,1 %\nFunción renal normal',
    'caso-preguntas':
      '¿Qué diagnóstico nuevo tiene?\n¿Qué fármaco de los que tienes cargados indicarías y por qué?\n¿Qué vigilarías con su tratamiento?',
    'caso-respuesta':
      'Presión arterial alta grado 2 (140/90 o más en dos consultas), además de su diabetes tipo 2. Se indican cambios de estilo de vida (menos sal, ejercicio, bajar de peso) y un fármaco como enalapril, un IECA indicado en la presión arterial alta; en personas con diabetes la meta es menos de 130/80. Vigilar tos o hinchazón de cara y labios con enalapril, evitar sustitutos de sal con potasio y AINE, y con metformina controlar la función renal.',
  },
  {
    'caso-titulo': 'Mujer de 50 años con mucha sed',
    'caso-paciente': '50 años, femenina, 84 kg. Madre con diabetes. Sin medicamentos.',
    'caso-consulta': 'Desde hace meses tiene mucha sed, orina con frecuencia, se cansa y ve borroso a ratos.',
    'caso-hallazgos': 'Glucosa en ayunas de 138 y 141 mg/dL en dos días distintos\nHemoglobina A1C de 7,4 %\nFunción renal normal',
    'caso-preguntas': '¿Cuál es el diagnóstico y con qué criterios?\n¿Qué fármaco de primera opción tienes cargado?\n¿Qué revisarías antes de indicarlo y cómo se toma?',
    'caso-respuesta':
      'Diabetes tipo 2: glucosa en ayunas de 126 mg/dL o más en dos momentos distintos y A1C de 6,5 % o más, con síntomas típicos y factores de riesgo (sobrepeso, madre con diabetes). Además de alimentación saludable y actividad física, se puede indicar metformina, una biguanida. Antes, revisar la función renal, porque la enfermedad renal la contraindica por riesgo de acidosis láctica. Se toma por vía oral, durante o después de las comidas.',
  },
]

async function mazoEjemplo(materiaNombre: string, mazoNombre: string): Promise<Id | null> {
  const materias = (await db.materias.toArray()).filter((m) => !m.borrada)
  const materia = materias.find((m) => normalizar(m.nombre) === normalizar(materiaNombre))
  if (!materia) return null
  const existente = (await db.mazos.where('materiaId').equals(materia.id).toArray()).find((m) => !m.borrada && m.nombre === mazoNombre)
  return existente?.id ?? (await crearMazo(mazoNombre, materia.id)).id
}

// Una sola vez: las patologías en Morfofisiopatología 2 y el caso en Práctica Médica 1, con sus
// enlaces ya confirmados (Enalapril trata la presión arterial alta, el caso nombra a ambas…).
const AJUSTE_EJEMPLOS_ESTRUCTURA = 'ejemplos-estructura'
let estructuraEnCurso: Promise<void> | null = null
export function asegurarEjemplosEstructura(): Promise<void> {
  estructuraEnCurso ??= crearEjemplosEstructura().finally(() => {
    estructuraEnCurso = null
  })
  return estructuraEnCurso
}

async function crearEjemplosEstructura() {
  if (await db.ajustes.get(AJUSTE_EJEMPLOS_ESTRUCTURA)) return
  if (typeof localStorage !== 'undefined' && localStorage.getItem(SIN_EJEMPLOS)) return
  const [, morfo, practica] = MATERIAS_INICIALES
  const mazoPatologias = await mazoEjemplo(morfo.nombre, NOMBRE_MAZO_EJEMPLO)
  const mazoCasos = await mazoEjemplo(practica.nombre, NOMBRE_MAZO_CASOS_EJEMPLO)
  // Primero se marca, para que dos llamadas seguidas no dupliquen los ejemplos.
  await db.ajustes.put({ clave: AJUSTE_EJEMPLOS_ESTRUCTURA, valor: Date.now() })
  const creadas: Id[] = []
  if (mazoPatologias) {
    for (const e of EJEMPLOS_PATOLOGIA) {
      const nota = await guardarNota({ tipoNotaId: TIPO_PATOLOGIA, mazoId: mazoPatologias, valores: e.valores, etiquetas: [ETIQUETA_EJEMPLO] })
      for (const f of e.fuentes) await citar(nota.id, Object.keys(e.valores), { ...f, proveedor: 'MedlinePlus en español' })
      creadas.push(nota.id)
    }
  }
  if (mazoCasos) {
    for (const valores of EJEMPLOS_CASO) {
      creadas.push((await guardarNota({ tipoNotaId: TIPO_CASO, mazoId: mazoCasos, valores, etiquetas: [ETIQUETA_EJEMPLO] })).id)
    }
  }
  // Entre ejemplos, los enlaces sugeridos ya vienen confirmados.
  const ejemplos = new Set((await db.notas.where('etiquetas').equals(ETIQUETA_EJEMPLO).toArray()).map((n) => n.id))
  for (const id of creadas) {
    for (const e of await enlacesDeNota(id)) if (e.estado === 'propuesto' && ejemplos.has(e.otra.id)) await aprobarEnlace(e.id)
  }
}
