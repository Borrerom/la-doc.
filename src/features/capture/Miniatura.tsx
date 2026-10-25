import { useEffect, useState } from 'react'

function useUrlDe(blob: Blob) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    // oxlint-disable-next-line react/set-state-in-effect -- la URL vive lo mismo que el componente
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function Miniatura({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useUrlDe(blob)
  return url ? <img className="miniatura" src={url} alt={alt} /> : null
}

export function AudioDe({ blob, etiqueta }: { blob: Blob; etiqueta: string }) {
  const url = useUrlDe(blob)
  return url ? <audio controls src={url} aria-label={etiqueta} /> : null
}
