# Plan de implementación — TypeCodeSpeed

Aplicación web para practicar mecanografía con código real de tu colección de referencias de programación competitiva. Todo corre en el navegador: no hay backend y tus archivos nunca salen de tu equipo.

## 1. Análisis de requisitos

| Área | Requisito clave | Decisión |
|---|---|---|
| Plataforma | Accesible desde cualquier computadora, sin instalar nada | SPA estática desplegada en GitHub Pages |
| Privacidad | Las referencias no se suben a ningún servidor | Lectura local con APIs del navegador; caché opcional en IndexedDB del propio navegador |
| Fuente de práctica | Carpeta `referencias` con estructura libre | Exploración recursiva; una "referencia" es cualquier carpeta que contiene archivos de código |
| Motor de comparación | Tolerar espacios que no cambian el significado, respetar los que sí | Tokenización léxica (lexer de C++), no reemplazo de cadenas |
| Métricas | Claras y no engañosas | Métricas específicas para código (caracteres de código/min, tokens/min) y WPM solo como referencia, con su fórmula |
| Idioma | Todo en español latinoamericano | Diccionario tipado `es` como idioma predeterminado; arquitectura i18n lista para más idiomas |

## 2. Retos técnicos (mayor riesgo primero)

1. **Motor de comparación consciente del código** (riesgo alto): decidir en tiempo real qué espacios son opcionales, obligatorios o prohibidos (por ejemplo `int x` vs `intx`, `a - -b` vs `a--b`, `#define f(x)` vs `#define f (x)`).
2. **Captura de teclado fiable** (riesgo alto): teclados latinoamericanos/españoles con teclas muertas (`^`, `` ` ``, `¨`), AltGr, Tab y Enter dentro de una zona de escritura que no debe interferir con atajos.
3. **Acceso a carpetas locales** (riesgo medio): la File System Access API solo existe en navegadores basados en Chromium.
4. **Rendimiento con fragmentos largos** (riesgo medio): resaltar miles de caracteres en cada pulsación sin retrasos.
5. **Métricas honestas** (riesgo medio): definir cada métrica de forma explícita y documentada.

## 3. Stack recomendado

| Capa | Elección | Motivo |
|---|---|---|
| Build | Vite + TypeScript | Rápido, salida estática ideal para GitHub Pages |
| UI | React | Ecosistema maduro, componentes reutilizables |
| Gráficas | Recharts | Gráficas declarativas (líneas, barras, dispersión) |
| Persistencia | IndexedDB (`idb`) + `localStorage` para ajustes | Capacidad para historial grande y caché de referencias |
| ZIP | `fflate` | Descompresión rápida y ligera en el navegador |
| Pruebas | Vitest | Pruebas unitarias del motor independientes de la UI |
| i18n | Diccionario tipado propio (`src/i18n`) | Sin dependencias; TypeScript obliga a que cada idioma tenga todas las claves |

## 4. Diseño del motor de comparación

El motor vive en `src/engine/` y no depende de React.

1. **Lexer** (`lexer.ts`): convierte el código en tokens con tipo (`identificador`, `palabra clave`, `número`, `cadena`, `carácter`, `comentario`, `preprocesador`, `operador`, `puntuación`, `espacio`). Soporta operadores multicarácter (`<<=`, `->*`, `::`, `...`), literales con prefijo (`u8""`, `L''`), raw strings (`R"(...)"`), escapes, separadores de dígitos (`1'000'000`), comentarios de línea y de bloque, y directivas de preprocesador con `<header>`.
2. **Construcción del objetivo** (`target.ts`): transforma el código en una secuencia de *ítems*:
   - `char`: un carácter que debe escribirse exactamente.
   - `ws` (hueco de espacio): con reglas `min` (0 o 1), `max` (0 = prohibido), `allowNewline` y `requireNewline`.
   Un espacio es **obligatorio** si al pegar los dos tokens el lexer produce algo distinto (`int`+`x` → `intx`). Es **prohibido** cuando insertarlo cambia el significado (nombre de macro con parámetros y `(`). Tras un comentario `//` o una directiva `#` se **exige salto de línea**.
3. **Evaluación** (`evaluate.ts`): función pura `evaluate(objetivo, textoEscrito)` que devuelve el estado de cada carácter, la posición del cursor y los errores. Se recalcula en cada pulsación (O(n)), lo que hace trivial el retroceso y facilita las pruebas.
4. **Modos**:
   - **A. Tolerante (consciente del código)**: indentación, espacios repetidos, espacios alrededor de símbolos, saltos de línea opcionales y líneas en blanco no penalizan; los espacios que separan tokens sí.
   - **B. Formato exacto**: hay que reproducir espacios, indentación y saltos de línea (con autoindentación opcional).
   - **C. Personalizado**: indentación (exacta/ignorar), espacios dentro de la línea (exactos/colapsar/según tokens), saltos de línea (exactos/flexibles), líneas en blanco (exactas/ignorar).
   - **Comentarios**: configurables (incluir u omitir). Por defecto se omiten, porque no afectan la compilación y en concurso no se escriben; puedes activarlos para practicar también su contenido.
5. **Política de errores**: *avanzar* (el error se marca y el cursor sigue) o *bloquear* (no avanzas hasta escribir el carácter correcto).
6. **Lenguajes**: perfil por lenguaje (`languages/`). C++ es el principal; C, Java, Kotlin, Rust, Go, JS/TS usan un lexer tipo C configurable; Python tiene indentación significativa, así que en modo tolerante la indentación sí se respeta.

## 5. Importación de referencias

| Método | Navegadores | Persistencia |
|---|---|---|
| `showDirectoryPicker()` (File System Access API) | Chrome, Edge, Opera, Brave | Se guarda el *handle* en IndexedDB y se pide permiso de nuevo con un clic |
| `<input webkitdirectory>` | Firefox, Safari y todos los anteriores | Contenido cacheado localmente en IndexedDB |
| Archivo ZIP | Todos | Contenido cacheado localmente en IndexedDB |
| Pegar código | Todos | Práctica rápida sin colección |

Se ignoran `.git`, `node_modules`, binarios y archivos de más de 512 KB. Los metadatos se leen si existen (`meta.json`, `metadata.json`, `info.json`, `reference.json`, `*.yml`/`*.yaml` o *front matter* de `README.md`): título, etiquetas, categoría, dificultad, descripción. Si no existen, se infieren de la ruta (la carpeta de primer nivel es la categoría) y de la extensión (lenguaje).

## 6. Modelo de datos

- `ReferenceFile { path, name, language, content, size }`
- `Reference { id (ruta de la carpeta), title, path, category, tags[], difficulty?, description?, files[] }`
- `Attempt { id, fecha, referencia, archivo, lenguaje, categoría, etiquetas, modo de prueba, modo de comparación, duración, métricas, línea de tiempo por segundo, estadísticas por símbolo, posiciones de error, fragmentos con errores, registro compacto de pulsaciones }`
- `Settings` en `localStorage`; `attempts`, `collection` y `handles` en IndexedDB.

## 7. Arquitectura

```
src/
  engine/      lexer, objetivo, evaluación, lenguajes (sin React, con pruebas)
  stats/       métricas, línea de tiempo, análisis de errores, recomendaciones, récords
  references/  importación (carpeta, ZIP), metadatos, filtros, generación de fragmentos
  storage/     IndexedDB, exportar/importar
  i18n/        diccionario `es`, función `t()`, formato de números y fechas
  ui/          páginas y componentes React
```

## 8. Interfaz

Inicio (panel), Referencias (explorador con búsqueda y filtros), Práctica (configuración y área de escritura), Resultados, Estadísticas (historial, gráficas, análisis de errores, récords), Ajustes y Ayuda. Tema oscuro/claro, temas de editor, fuente y tamaño configurables, números de línea, modo sin distracciones y atajos de teclado.

## 9. Compatibilidad

- `showDirectoryPicker` no existe en Firefox ni Safari: se usa `webkitdirectory` o ZIP automáticamente.
- Pantalla completa depende de la API Fullscreen (disponible en navegadores de escritorio modernos).
- Pensado para escritorio; en móvil se puede consultar el historial, pero escribir código no es práctico.

## 10. Fases de desarrollo

1. Configuración del proyecto, arquitectura e i18n.
2. Selección y exploración de la carpeta de referencias.
3. Análisis léxico y normalización.
4. Motor de escritura.
5. Modos de prueba.
6. Estadísticas.
7. Gráficas.
8. Historial y persistencia.
9. Pulido de la interfaz.
10. Despliegue en GitHub Pages.
11. Pruebas y documentación.
