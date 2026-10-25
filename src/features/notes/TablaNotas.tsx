import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { camposOrdenados } from '../../core/db/tiposNota'
import type { Id, Nota, TipoNota } from '../../core/model/tipos'

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function TablaNotas({
  notas,
  tipo,
  nombresMazo,
  mazoActual,
}: {
  notas: Nota[]
  tipo: TipoNota
  nombresMazo: Map<Id, string>
  mazoActual: Id
}) {
  const campos = useMemo(() => camposOrdenados(tipo.campos).filter((c) => !c.oculto), [tipo])
  const hayVariosMazos = notas.some((n) => n.mazoId !== mazoActual)

  const columnas = useMemo<ColumnDef<Nota>[]>(
    () => [
      ...campos.map(
        (c, i): ColumnDef<Nota> => ({
          id: c.id,
          header: c.nombre,
          accessorFn: (n) => n.valores[c.id] ?? '',
          cell: (info) =>
            i === 0 ? (
              <a href={`#/nota/${info.row.original.id}`}>{info.getValue<string>() || '(sin nombre)'}</a>
            ) : (
              <span className="celda">{info.getValue<string>()}</span>
            ),
        }),
      ),
      ...(hayVariosMazos
        ? [{ id: 'mazo', header: 'Mazo', accessorFn: (n: Nota) => nombresMazo.get(n.mazoId) ?? '' } satisfies ColumnDef<Nota>]
        : []),
    ],
    [campos, hayVariosMazos, nombresMazo],
  )

  const [orden, setOrden] = useState<SortingState>([])
  const [visibles, setVisibles] = useState<VisibilityState>({})
  const [filtro, setFiltro] = useState('')

  const tabla = useReactTable({
    data: notas,
    columns: columnas,
    state: { sorting: orden, columnVisibility: visibles, globalFilter: filtro },
    onSortingChange: setOrden,
    onColumnVisibilityChange: setVisibles,
    onGlobalFilterChange: setFiltro,
    globalFilterFn: (fila, columna, valor: string) =>
      sinAcentos(String(fila.getValue(columna) ?? '')).includes(sinAcentos(valor)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <section className="tarjeta">
      <div className="fila">
        <input
          className="filtro"
          aria-label="Filtrar la tabla"
          placeholder="Filtrar…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <details className="columnas">
          <summary>Columnas</summary>
          {tabla.getAllLeafColumns().map((col) => (
            <label key={col.id}>
              <input
                type="checkbox"
                checked={col.getIsVisible()}
                disabled={col.id === campos[0].id}
                onChange={col.getToggleVisibilityHandler()}
              />{' '}
              {String(col.columnDef.header)}
            </label>
          ))}
        </details>
      </div>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            {tabla.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()} aria-sort={ariaOrden(h.column.getIsSorted())}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {tabla.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tabla.getRowModel().rows.length === 0 && <p>Nada coincide con "{filtro}".</p>}
    </section>
  )
}

function ariaOrden(o: false | 'asc' | 'desc') {
  return o === 'asc' ? 'ascending' : o === 'desc' ? 'descending' : undefined
}
