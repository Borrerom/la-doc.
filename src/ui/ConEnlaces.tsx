// Muestra un texto con sus direcciones web como enlaces que se pueden tocar.
export function ConEnlaces({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(https:\/\/\S+)/).map((parte, i) =>
        parte.startsWith('https://') ? (
          <a key={i} href={parte} target="_blank" rel="noreferrer">
            {parte.includes('drive.googleapis.com') ? 'activar la API de Google Drive' : parte}
          </a>
        ) : (
          parte
        ),
      )}
    </>
  )
}
