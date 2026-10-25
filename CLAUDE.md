# La Doc — Brief para Claude Code

## 1. Contexto

Aplicación para la hija de Manuel, estudiante de medicina en Venezuela. El proyecto se definió conversando y ahora pasa a desarrollo en Claude Code.

## 2. Usuaria

- Usa sobre todo el teléfono; la computadora, poco.
- Estilo de aprendizaje: auditivo y visual.
- Manuel aporta el enfoque de estudio por asociación y por repetición.
- Hoy no usa ninguna app de estudio.

## 3. Necesidades

1. Funcionar con y sin internet (en Venezuela la conexión es intermitente). Todo lo esencial tiene que funcionar sin conexión.
2. Cargar información desde PDF, fotos y apuntes a mano. Ella tiene que poder tomar una foto desde la app y subirla.
3. Ordenar y presentar la información en tablas (estilo Excel) y en fichas.
4. Vincular las materias entre sí: lo que estudia hoy tiene que conectarse con las materias futuras, que profundizan el mismo conocimiento, para poder cotejarlo al tomar decisiones más adelante.

## 4. Materias actuales

- Morfofisiopatología 2
- Práctica Médica 1
- Farmacología 1

## 5. Requisitos por materia

### Farmacología

- Ficha por fármaco: nombre, para qué enfermedad sirve y contraindicaciones.
- Cotejar el fármaco con el paciente según sus enfermedades, para que no lo perjudique.
- Valorar el beneficio frente al daño de los efectos secundarios.

### Patología (casos clínicos)

- Recrear el juego de roles de los profesores: paciente con edad, peso y patologías.
- Ella razona qué puede tener y qué fármaco le puede prescribir.
- Enlazar los casos con las fichas de patologías y de fármacos.

## 6. Métodos de estudio elegidos

- **Repetición espaciada al estilo Anki:** el punto de partida que decidimos. Se replica dentro de la app.
- **Recuerdo activo:** la app pregunta en vez de mostrar para releer.
- **Asociación y mapas de relaciones:** vínculos entre fármacos, patologías y materias.
- **Casos clínicos:** práctica de diagnóstico y tratamiento.
- **Audio:** lectura en voz alta de las fichas, para su perfil auditivo.

## 7. Decisiones tomadas

- La app la construimos nosotros mismos.
- Se replica el modelo de Anki.
- Notion gratis solo si de verdad hiciera falta. Hoy no es necesario, porque depende de internet.
- Formato propuesto: app web instalable en el teléfono (PWA) con almacenamiento local, para que funcione sin conexión.

## 7b. Diseño acordado de La Doc

### Estructura de la información (base Anki, mejorada)

- **Mazos:** uno por materia, con submazos por tema (ej.: Farmacología 1 > Antibióticos).
- **Notas con campos:** se carga una vez (fármaco, indicación, contraindicaciones, efectos secundarios) y de cada nota salen varias fichas de pregunta.
- **Etiquetas** que cruzan materias (ej.: "hipertensión").
- **Mejora sobre Anki:** enlaces reales entre elementos, como "este fármaco trata esta patología" o "está contraindicado en esta otra", para ver todo conectado entre materias.

### Práctica (copia de lo que funciona en Anki)

- Fichas de pregunta y respuesta, y fichas de completar el espacio.
- Autocalificación: mal, difícil, bien, fácil.
- Repetición espaciada según esa calificación.
- Repaso del día armado automáticamente.

### Carga de información con IA

- Tres formas de cargar: foto, archivo PDF o dictado por voz.
- **Flujo:** ella carga y elige la materia → la IA detecta si es fármaco, patología o caso, y llena los campos → la IA propone enlaces con lo ya cargado → ella revisa, aprueba o corrige → se generan las fichas.
- **Sin internet:** lo cargado queda en cola y se procesa al volver la conexión; el repaso sigue funcionando.

### Audio en el repaso

- La app lee en voz alta las preguntas, las respuestas y las fichas completas, con la voz del teléfono (funciona sin internet).
- Modo solo escuchar, estilo podcast, con la pantalla apagada (ella ya estudia así).
- Dos modos de avance, intercambiables: **automático** (carrusel con pausa ajustable) o **manual** (espera a que ella toque continuar, sin límite de tiempo).

### Ficha de fármaco (campos propuestos)

1. Nombre genérico y comercial
2. Grupo o familia
3. Mecanismo de acción
4. Indicaciones
5. Contraindicaciones
6. Efectos secundarios
7. Interacciones con otros fármacos
8. Dosis, y ajustes por edad o peso

> **Pregunta abierta:** confirmar con ella si sus profesores piden algún otro dato.

### Ficha de patología (campos propuestos)

1. Nombre
2. Definición breve
3. Causas y factores de riesgo
4. Fisiopatología (enlace con Morfofisiopatología)
5. Signos y síntomas
6. Diagnóstico: exámenes y hallazgos
7. Tratamiento, enlazado a las fichas de fármacos
8. Complicaciones

### Campos flexibles (requisito de diseño)

- Los campos de cada tipo de ficha no van fijos en el código: ella puede agregar, renombrar u ocultar campos desde la app.
- La IA usa los campos nuevos al procesar cargas futuras.
- Las mejoras a las fichas se irán sumando en el camino.

### Casos clínicos

- **Cada caso:** datos del paciente (edad, sexo, peso, antecedentes), motivo de consulta y síntomas, hallazgos (examen físico y laboratorio), preguntas (qué puede ser y qué fármaco prescribir) y respuesta razonada enlazada a las fichas de patología y de fármacos.
- **Flujo:** la app presenta el caso, también en audio → ella responde por voz o escribiendo → la IA corrige y señala riesgos (ej.: fármaco contraindicado por una condición del paciente).
- **Dos fuentes de casos:** los que ella carga de sus clases y los que la IA arma con lo que ya estudió.

### Fuentes bibliográficas

- La app consulta fuentes abiertas cuando hay internet, guarda lo encontrado en el teléfono para leerlo sin conexión y cita la fuente de cada dato.
- Los libros de texto con derechos de autor no se descargan.
- Fuentes base:
  - **CIMA** (base oficial de medicamentos de España): fichas técnicas en español.
  - **MedlinePlus en español:** patologías.
  - **PubMed y StatPearls:** profundización.
  - **SciELO:** revistas médicas latinoamericanas en español.
  - **BVS y LILACS (OPS):** literatura médica de la región.
  - **Guías de la OPS y la OMS**, incluida la Lista de Medicamentos Esenciales.
  - **Resúmenes de Cochrane en español:** evidencia sobre tratamientos.

### Cuenta y respaldo en Google Drive

- Inicio de sesión con Google (OAuth): la app nunca pide ni ve la contraseña.
- La app crea una carpeta de estudio en su Drive y respalda ahí todo automáticamente cuando hay internet.
- Permiso limitado solo a esa carpeta (sin acceso al resto del Drive).

### IA gratuita y multi-proveedor

- Se usan niveles gratuitos de APIs para desarrolladores (las apps de chat gratis no se pueden conectar).
- **Principal:** Gemini (Google), activado con su misma cuenta de Gmail.
- **Respaldo:** Groq u OpenRouter, con modelos gratuitos.
- Ella elige el proveedor; si se agota la cuota gratis de uno, la app cambia sola al siguiente.
- El contenido es solo material de estudio (ella aún no ve pacientes), así que el uso de datos del nivel gratuito no es un problema.

### Otras mejoras propuestas (por confirmar)

- Mapa visual de conexiones entre fármacos, patologías y materias.
- Fichas de imagen tapada para anatomía (Morfofisiopatología).
- Calendario de exámenes que prioriza el repaso.
- Modo ahorro de datos: procesar con IA solo con wifi.

### Decisiones de la auditoría

- **Teléfono:** Android. La app web instalable (PWA) funciona bien ahí, incluido el audio con la pantalla apagada.
- **Sustento bibliográfico obligatorio:** todo dato que da la IA lleva el link de la fuente que lo justifica. Si no hay fuente, se muestra el nombre de la IA que lo generó, para que ella lo valide.
- **Semestre por ficha:** la app pregunta la materia y el semestre al crear cada ficha.
- **Buscador sin internet** sobre todas las fichas.
- **Importar mazos de Anki** (archivos .apkg) ya hechos por otros estudiantes de medicina.
- **Por confirmar:** algoritmo de repaso FSRS (el moderno de Anki) y arrancar con una primera versión solo de Farmacología 1.

### Manual: cómo generar la clave de Gemini

Alternativa: Manuel genera la clave con su propia cuenta y se la carga en la app; en ese caso la cuota gratis es la de su cuenta.

1. Entrar desde el navegador del teléfono a aistudio.google.com.
2. Iniciar sesión con su cuenta de Gmail.
3. Aceptar los términos de uso la primera vez.
4. Tocar "Get API key" (Obtener clave de API) y luego "Create API key" (Crear clave).
5. Copiar la clave que aparece.
6. Abrir La Doc, ir a Ajustes > IA y pegar la clave.
7. No compartir la clave con nadie.

> **Nota:** Google cambia a veces los nombres de los botones; La Doc mostrará esta guía en su primer uso.

**Decisión sobre la clave de Gemini:** la genera Manuel con su cuenta de Gmail, en el nivel gratuito y sin activar facturación, y la deja cargada en La Doc. Se hace una sola vez; la cuota gratis se renueva sola cada día.

**Piloto y cambio de cuenta:** el piloto usa la cuenta de Google de Manuel. La app debe tener en Ajustes una opción para desvincular la cuenta y vincular otra, pensando en que otros estudiantes la usen. Al cambiar de cuenta, el nuevo estudiante entra con su propio correo, carga su propia clave de Gemini y respalda en su propio Drive. Las fichas y la clave de la cuenta anterior no quedan a la vista del nuevo usuario.

### Hoja de ruta por etapas

En cada etapa ella prueba la app con material real antes de pasar a la siguiente.

1. **Farmacología 1:** carga con IA, fichas de fármaco, repaso del día, audio estilo podcast, buscador sin internet y respaldo en Drive.
2. **Morfofisiopatología 2:** fichas de patología y enlaces reales tipados (por ejemplo, "este fármaco trata esta patología").
3. **Práctica Médica 1 y casos clínicos:** casos cargados de clase y generados por IA, con respuesta por voz o escrita y corrección.
4. **Fuentes bibliográficas:** consulta a CIMA, MedlinePlus, PubMed/StatPearls, SciELO, BVS/LILACS, OPS/OMS y Cochrane, con guardado para uso sin internet.
5. **Importar mazos de Anki y mejoras por confirmar:** mapa visual de conexiones, calendario de exámenes, fichas de imagen tapada y modo ahorro de datos.
   - **Mapas mentales** (pedido de Manuel, 2026-10-25): una técnica de estudio más, junto a las fichas y el audio. Desi arma mapas para asociar contenido, y puede crear, editar y mover nodos y conexiones con el dedo. Va unido al mapa visual de conexiones: cada nodo puede apuntar a una nota real (fármaco, patología o caso), y cada línea puede ser un enlace tipado del modelo (`enlaces`, `tiposEnlace`). Debe funcionar sin internet y entrar en el respaldo. Antes de construirlo hay que investigar el enfoque (librería de lienzo táctil o hecho a mano, cómo se guarda, si el mapa sugiere nodos a partir de los enlaces) y proponerlo a Manuel como Opción 1/2/3. No se construye todavía.
6. **Crecer con la carrera:** cada semestre se suman materias nuevas, todas conectadas entre sí.

Después de la etapa 6 queda el mantenimiento: ajustes de uso y cambios de Google (clave de Gemini, Drive).

**Algoritmo de repaso:** FSRS (el moderno de Anki) — confirmado.
**Primera versión:** Farmacología 1 — confirmado.

## 8. Punto en que vamos

- **Definidos:** la usuaria, las necesidades, las materias, las fuentes de material y los métodos de estudio.
- **Decidido:** las fichas se generan con IA a partir de los PDF, las fotos y los apuntes, para optimizar su tiempo de estudio.

## 9. A dónde queremos llegar

Una app en el teléfono de su hija, que funcione sin internet, donde ella cargue su material, estudie con repetición espaciada, practique casos clínicos y tenga todo su conocimiento médico conectado a lo largo de la carrera.

## 10. Proceso

1. Investigar las estrategias de estudio más usadas en medicina. (Hecho a nivel general.)
2. Evaluar en qué plataformas apoyarnos. (Decidido: construcción propia.)
3. Definir la carga del material y su procesamiento con IA para generar las fichas. (Decidido: con IA.)
4. Diseñar el modelo de datos: materias, fármacos, patologías, casos, fichas y vínculos.
5. Construir la PWA sin conexión: carga, fichas, repetición espaciada, tablas y audio.
6. Probarla con ella, con material real de Farmacología 1.
7. Iterar y sumar las materias siguientes.

## 11. Desarrollo (para Claude Code)

- Propuesta técnica aprobada el 2026-10-25: https://claude.ai/artifact/5Q5nUdbjB67bR4V5USvsJV
- Stack: Vite + React + TypeScript, vite-plugin-pwa, Dexie (IndexedDB), ts-fsrs, MiniSearch, Google Identity Services + Drive (`drive.file`). Sin servidor propio.
- GitHub es solo para desarrollo. La app instalada no depende de GitHub ni de ningún servidor para funcionar.
- Todo el texto visible está en español. Nombres de código en español cuando describen el dominio (nota, ficha, mazo).
- Cada paso del plan de la etapa 1 termina con algo que se prueba en el teléfono.
- Comandos: `npm run dev`, `npm test` (unitarias), `npm run build && npm run test:e2e` (flujos en un Android simulado, incluso sin internet), `npm run lint`.
- **Formato único para toda nota** (pedido de Manuel, 2026-10-25): cada nota que Desi cree, de cualquier tipo (fármaco, patología, caso o uno nuevo), se ve con el mismo componente `src/features/notes/FichaNota.tsx` y lleva el botón 🔊 Escuchar. La vista y la lectura se arman con los campos del tipo (`camposOrdenados` + `frasesDeNota`). No escribir vistas ni audio por tipo: un tipo o campo nuevo debe heredar formato y audio sin código extra. Cada mazo tiene además 🎧 Escuchar el mazo.
- **Contenido de prueba visible sin pasos extra**: los 3 fármacos de ejemplo se cargan solos una vez (`asegurarEjemplosIniciales`). Las pruebas e2e que necesitan empezar vacías ponen `localStorage['la-doc:sin-ejemplos']`.
- **Navegación por desplegables** (pedido de Manuel, 2026-10-25, eligió la Opción 3 "mixta"): el Inicio es un tablero (`src/features/decks/Materias.tsx`). Arriba "Repaso de hoy" y 🎧 Escuchar; luego cada semestre con una franja desplegable por materia, titulada con su nombre y su color, que al abrirse muestra sus temas (mazos de primer nivel) con cuántos fármacos tienen. Al tocar un tema se abre su pantalla (`Mazo.tsx`) con sus subtemas y sus notas, cada una desplegable con `FichaNota`. "← Inicio" vuelve al tablero con la materia como quedó (abierta o cerrada se recuerda en el teléfono). Ajustes y herramientas van plegados en "⚙ Más opciones". Es genérico: cualquier materia o tipo de nota nuevo usa el mismo patrón sin código extra.
- **Interacciones sugeridas** (paso 15): `src/core/db/enlaces.ts` busca, cada vez que se guarda un fármaco, si en "Interacciones" aparece el nombre (genérico o comercial) o el grupo de otro fármaco cargado, y crea un enlace `propuesto`. La ficha lo muestra con 💡 para ✓ Confirmar o ✕ Descartar. Lo descartado queda borrado y no se vuelve a proponer, y lo confirmado se ve como 🔗 Interactúa con. Funciona sin internet y sin IA.
- **Respaldo en Google Drive** (pasos 16 y 17, `src/core/respaldo/`):
  - El ID de cliente OAuth de Manuel está en `google.ts`. Es público, no es un secreto. Origen autorizado: `https://borrerom.github.io`.
  - Permiso solo `drive.file` (más `openid email` para mostrar la cuenta). La app crea la carpeta "La Doc" y el archivo `la-doc-respaldo.json`, que se reemplaza en cada respaldo.
  - Qué entra: todas las tablas menos los audios generados y los archivos originales de las cargas. Ajuste `respaldo` y lo propio del teléfono quedan fuera.
  - Automático con internet: cada 2 minutos si cambió la huella y al salir de la app.
  - Google Identity Services (modelo de token) da permisos de 1 hora sin renovación en segundo plano. Cuando vence, la tarjeta del Inicio muestra "Respaldar ahora". Toda ventana de Google se abre al principio de un toque, sin esperas antes, porque el iPhone la bloquea si no.
  - Paso 17: "Desvincular cuenta" deja las fichas en el teléfono. "Preparar el teléfono para otra persona" respalda, borra fichas, repaso y claves de IA, y quita la cuenta. Al entrar, si el Drive ya tiene respaldo, se ofrece recuperarlo.
  - Lección del primer uso real (2026-10-25): Drive respondía 403 porque la Google Drive API estaba activada en otro proyecto ("My First Project") y no en el del ID de cliente (número `225851611784`). La API tiene que estar activada en el mismo proyecto que el ID de cliente. Desde la versión 0.18.1 la app explica el motivo del 403 (API sin activar o casilla de Drive desmarcada) con el enlace para resolverlo. Funcionó en el iPhone de Manuel con la versión 0.18.1.
  - El proyecto de Google está en modo de prueba: solo entran los usuarios de prueba agregados, y Google muestra "Google no verificó esta app" (hay que tocar Continuar).
- **Colores para estudiar de día y de noche** (pedido de Manuel, 2026-10-25, eligió la Opción 2): selector en Más opciones → "🌙 Colores de la pantalla" con Modo Desi (automático: sigue al teléfono), Día (lila claro), Noche (gris violeta oscuro, nunca negro puro, letra blanco roto) y Estudiando con todo en la noche (`noche-calida`: letra crema y acento ámbar, sin azules). Nombres elegidos por Manuel; la estudiante se llama Desiree y en la app se le dice Desi. Los colores salen solo de las variables de `src/index.css`; un color nuevo debe definirse para los cuatro modos y cumplir contraste 4,5:1.

