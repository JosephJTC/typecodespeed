# Aprender (tutor de mecanografía)

La sección **Aprender** enseña a escribir sin mirar el teclado: dónde descansa cada dedo y qué dedo pulsa cada tecla. Es independiente de la práctica con código y no cambia su historial.

## Mi teclado

- **Distribución:** Español (Latinoamérica), Español (España), Inglés (EE. UU.) e Inglés (Reino Unido). Cada una define qué caracteres produce cada tecla física, incluidos Shift, AltGr y los acentos (tecla muerta + letra).
- **Forma:** ANSI (Enter horizontal) o ISO (Enter alto y una tecla extra junto al Shift izquierdo). Al elegir una distribución se selecciona su forma habitual, y se puede cambiar.
- **Tamaño:** completo, TKL, 75 %, 65 %, 60 % y laptop. Si un carácter no tiene tecla en ese tamaño (por ejemplo `|` en un 60 % latinoamericano), las lecciones lo omiten.
- **Pulgar para el espacio:** izquierdo o derecho.
- **Detección guiada:** pide presionar tres teclas y propone la distribución y la forma más probables. El navegador solo informa la posición y el carácter de cada tecla, no el modelo del teclado: si las respuestas no encajan con una sola distribución, lo avisa. El tamaño no se puede detectar.

## Dedos

La asignación es la estándar por columnas y se define por posición física de la tecla, con ajustes por forma (ISO/ANSI), un punto de extensión por distribución y la preferencia de pulgar. Las mayúsculas se enseñan con el Shift de la mano contraria.

El navegador no puede saber qué dedo usas. La aplicación muestra el dedo recomendado y solo comprueba que la tecla sea la correcta; las estadísticas «por dedo» agrupan las teclas asignadas a cada dedo.

## Guía visual

- Teclado en pantalla con la tecla objetivo y, si se quiere, todas las teclas coloreadas por dedo.
- Dos manos con el dedo recomendado resaltado; opcionalmente el dedo se mueve hacia la tecla. Con «reducir movimiento» activado en el sistema no hay animación.
- **Posición de las manos:** sobre el teclado (cada dedo apoyado en su tecla de la fila guía), al lado o debajo.
- Niveles: **principiante** (toda la guía), **intermedio** (solo tecla y dedo) y **avanzado** (sin guía). Cada opción se puede cambiar por separado desde el menú «Guía».

## En la práctica con código

La opción «Guía de dedos» (en la configuración de la prueba o en Ajustes) muestra debajo del código el mismo teclado y las manos, con la tecla y el dedo del siguiente carácter, incluidos espacios y saltos de línea. Usa la configuración de teclado y de guía de esta sección. No cambia la evaluación, las métricas ni el historial.

## Lecciones

Ocho etapas: fila guía, combinaciones de la fila guía, fila superior, fila inferior, teclado completo (mayúsculas, números, acentos, puntuación y símbolos), palabras, frases, y velocidad y precisión (por tiempo). Las lecciones se definen por posición de tecla, así que se adaptan a la distribución: en español la fila guía termina en `Ñ` y hay lección de acentos; en inglés termina en `;`.

Los ejercicios solo usan teclas ya aprendidas, siempre incluyen las teclas nuevas, repiten más las que fallas o escribes lento, y se alargan o acortan según tu mejor precisión en la lección. Una tecla incorrecta no avanza: hay que encontrar la correcta. Una lección se completa con 90 % de precisión.

## Progreso

Lecciones completadas, ejercicios, tiempo, WPM y precisión promedio, mapa de calor de teclas difíciles, precisión por dedo, caracteres que más fallas y evolución por ejercicio. Se guarda en `localStorage` de este navegador; la configuración del teclado se guarda con los demás ajustes.

## Código

- `src/learn/`: distribuciones (`layouts.ts`), tamaños y formas (`geometry.ts`), dedos (`fingers.ts`), lecciones (`curriculum.ts`), generador (`generator.ts`), ejercicio (`exercise.ts`), detección (`detect.ts`) y progreso (`progress.ts`). No depende de React.
- `src/ui/learn/`: página, ejercicio, teclado, manos, configuración y progreso.
- Para agregar una distribución: una entrada en `LAYOUTS` y sus textos en `learn.config.layouts`.
