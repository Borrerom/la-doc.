import { textoParaLeer } from '../../core/audio/vozTelefono'
import { camposOrdenados } from '../../core/db/tiposNota'
import type { Nota, TipoNota } from '../../core/model/tipos'

// Frases para leer una ficha completa: el nombre y luego cada dato con su título.
export function frasesDeNota(nota: Nota, tipo: TipoNota) {
  const [primero, ...resto] = camposOrdenados(tipo.campos).filter((c) => !c.oculto)
  return [
    nota.valores[primero.id] ?? '',
    ...resto.filter((c) => nota.valores[c.id]).map((c) => `${c.nombre}: ${textoParaLeer(nota.valores[c.id])}`),
  ].filter(Boolean)
}
