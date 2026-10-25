import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs'
import type { Calificacion, EstadoRepaso, Id } from '../model/tipos'

// Valores por defecto de Anki: retención deseada del 90 %, sin intervalos mayores a 100 años.
export const RETENCION_DESEADA = 0.9

const planificador = fsrs(generatorParameters({ request_retention: RETENCION_DESEADA, enable_fuzz: true }))

export function estadoNuevo(fichaId: Id, ahora: number): EstadoRepaso {
  return deCard(fichaId, createEmptyCard(new Date(ahora)))
}

function aCard(e: EstadoRepaso): Card {
  return {
    due: new Date(e.vence),
    stability: e.estabilidad,
    difficulty: e.dificultad,
    elapsed_days: e.diasTranscurridos,
    scheduled_days: e.diasProgramados,
    learning_steps: e.pasosAprendizaje,
    reps: e.repeticiones,
    lapses: e.fallos,
    state: e.estado,
    last_review: e.ultimoRepaso === undefined ? undefined : new Date(e.ultimoRepaso),
  }
}

function deCard(fichaId: Id, c: Card): EstadoRepaso {
  return {
    fichaId,
    vence: c.due.getTime(),
    estabilidad: c.stability,
    dificultad: c.difficulty,
    diasTranscurridos: c.elapsed_days,
    diasProgramados: c.scheduled_days,
    pasosAprendizaje: c.learning_steps,
    repeticiones: c.reps,
    fallos: c.lapses,
    estado: c.state as EstadoRepaso['estado'],
    ...(c.last_review ? { ultimoRepaso: c.last_review.getTime() } : {}),
  }
}

export function calificar(estado: EstadoRepaso, calificacion: Calificacion, ahora: number): EstadoRepaso {
  return deCard(estado.fichaId, planificador.next(aCard(estado), new Date(ahora), calificacion as Grade).card)
}

// Cuándo volvería la ficha con cada botón, para mostrarlo debajo de cada uno como en Anki.
export function previsualizar(estado: EstadoRepaso, ahora: number): Record<Calificacion, number> {
  const p = planificador.repeat(aCard(estado), new Date(ahora))
  return {
    1: p[1].card.due.getTime() - ahora,
    2: p[2].card.due.getTime() - ahora,
    3: p[3].card.due.getTime() - ahora,
    4: p[4].card.due.getTime() - ahora,
  }
}

export function textoIntervalo(ms: number) {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} d`
  const meses = Math.round(d / 30)
  if (meses < 12) return `${meses} m`
  return `${(d / 365).toFixed(1).replace('.', ',')} a`
}
