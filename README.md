# TypeCodeSpeed

Entrenador de mecanografía de código para programación competitiva. Practica escribiendo tus propias referencias (Segment Tree, DSU, Dynamic Programming, etc.) y mide velocidad y precisión con un motor que entiende C++: tolera diferencias de formato que no cambian el significado y detecta las que sí lo cambian.

Es un sitio estático: funciona por completo en tu navegador, sin servidor ni cuentas.

## Funciones

- **Referencias locales:** elige tu carpeta `referencias` (o un ZIP, o archivos sueltos), explora carpetas y subcarpetas, busca, filtra por lenguaje y longitud, y practica un archivo concreto o uno al azar.
- **Repositorios de GitHub:** sección aparte para abrir un repositorio público o privado, ver solo las carpetas que contienen código y practicar sus archivos. Ver [`docs/GITHUB.md`](docs/GITHUB.md).
- **Práctica:** código completo, por tiempo o fragmento aleatorio (función, struct, ciclo…), con pausa, corrección con Retroceso y progreso por caracteres y tokens.
- **Comparación consciente del código:** modo tolerante (solo importan los espacios que separan tokens), formato exacto y personalizado.
- **Estadísticas:** WPM, caracteres por segundo, precisión, consistencia, errores por tipo, caracteres difíciles y lentos, confusiones, rendimiento por referencia y gráficas a lo largo del tiempo.
- **Historial local:** revisa pruebas anteriores, compara dos pruebas, exporta e importa en JSON.
- **Ajustes:** modo de comparación, comentarios, política de errores, pausa automática, indentación automática, cierre automático de paréntesis, corchetes, llaves y comillas, modo sin guía (oculta el código pendiente al escribir, para practicar de memoria), tamaño del código y tema (oscuro, claro o según el sistema). Se guardan en el navegador.
- **Interfaz:** menú lateral compacto que se puede contraer; en el celular pasa a una barra inferior.

## Uso

1. Abre la aplicación y ve a **Referencias**.
2. Pulsa **Elegir carpeta…** y selecciona tu carpeta de referencias. El navegador pedirá permiso de lectura.
3. Selecciona un archivo y pulsa **Practicar completa**, **Fragmento aleatorio** o **Por tiempo**. También puedes usar **Practicar una al azar** con los filtros activos.
4. Escribe. Al terminar verás el análisis de la prueba; el resultado se guarda en **Estadísticas**.

Para practicar con un repositorio de GitHub, ve a **GitHub**, pega un token de solo lectura si el repositorio es privado, escribe `usuario/repositorio` y pulsa **Abrir repositorio**.

Sin referencias propias puedes practicar con los ejemplos incluidos o pegar código.

Atajos durante la práctica: `Esc` pausa o reanuda, `Tab` completa la indentación, `Ctrl+Retroceso` borra una palabra, `Ctrl+Enter` reinicia y `Ctrl+Shift+Enter` pasa a otro fragmento.

### Formas de importar según el navegador

| Método | Navegadores | Notas |
|---|---|---|
| Elegir carpeta (selector nativo) | Chrome, Edge y otros basados en Chromium, en escritorio | Permite **Actualizar desde la carpeta** sin volver a elegirla |
| Elegir carpeta (selector clásico) | Firefox, Safari | El navegador pide confirmar la lectura de los archivos |
| Importar ZIP | Todos los navegadores actuales | No admite ZIP64 ni ZIP cifrados |
| Elegir archivos | Todos | Sin estructura de carpetas |

Se importan archivos `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.c`, `.py`, `.java`, `.kt`, `.rs`, `.go`, `.js`, `.ts`, `.cs` y `.txt` de hasta 200 kB. Se omiten las carpetas ocultas y `node_modules`.

## Privacidad

Tus referencias nunca se suben a GitHub ni a ningún servidor:

- La aplicación no tiene backend. El único módulo que usa la red es el cliente de la sección **GitHub** (`src/github/client.ts`), que solo hace peticiones GET de lectura a `https://api.github.com`; una prueba automatizada lo verifica.
- El sitio publicado incluye una política de seguridad de contenido con `connect-src https://api.github.com`: el propio navegador bloquea cualquier otra conexión desde la página.
- La sección **GitHub** descarga código a tu navegador, nunca envía tus referencias locales. El token se guarda solo en memoria salvo que pidas recordarlo, y entonces se guarda cifrado con tu contraseña. Detalles en [`docs/GITHUB.md`](docs/GITHUB.md).
- Las referencias importadas, el historial y los ajustes se guardan solo en el almacenamiento local de tu navegador (IndexedDB y localStorage). **Quitar referencias** las borra; tus archivos originales nunca se modifican (el acceso es de solo lectura).
- `referencias/` está en `.gitignore`, por si guardas tu carpeta dentro de una copia del repositorio.

## Desarrollo

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev        # aplicación en http://localhost:5173
npm test           # pruebas automatizadas (Vitest)
npm run typecheck  # verificación de tipos
npm run lint       # análisis estático (oxlint)
npm run build      # compilación estática en dist/
npm run preview    # sirve dist/ para probar la compilación
```

Estructura:

```
src/engine/    motor de comparación (lexer de C++, modos, evaluador); sin React
src/session/   sesión de tecleo: entrada, correcciones, pausa, tiempo
src/snippets/  extracción de fragmentos y ejemplos incluidos
src/library/   referencias locales: carpeta, archivos, ZIP, filtros, almacén local
src/stats/     métricas, análisis e historial (IndexedDB)
src/i18n/      textos de la interfaz (español)
src/ui/        interfaz en React: práctica, referencias, estadísticas, ajustes, laboratorio
tests/         pruebas del proyecto (privacidad)
```

Documentación técnica:

- [`docs/PLAN.md`](docs/PLAN.md): plan general, arquitectura y fases.
- [`docs/MOTOR.md`](docs/MOTOR.md): motor de comparación, estrategia y pruebas.
- [`docs/PRACTICA.md`](docs/PRACTICA.md): sesión de práctica, captura de teclado y atajos.
- [`docs/ESTADISTICAS.md`](docs/ESTADISTICAS.md): métricas, gráficas, historial y comparaciones.
- [`docs/REFERENCIAS.md`](docs/REFERENCIAS.md): importación de referencias, privacidad y despliegue.
- [`docs/GITHUB.md`](docs/GITHUB.md): repositorios de GitHub, tokens y seguridad.

## Despliegue en GitHub Pages

El flujo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila y publica el sitio en cada push a `main` (o manualmente desde la pestaña **Actions**).

Configuración, una sola vez: en GitHub ve a **Settings → Pages** y en **Build and deployment → Source** elige **GitHub Actions**.

El sitio queda en `https://<usuario>.github.io/typecodespeed/`. La compilación usa rutas relativas (`base: './'`), así que funciona bajo cualquier subruta o dominio sin cambios, y también en cualquier otro alojamiento estático: basta con subir el contenido de `dist/`.

## Limitaciones

- Solo C++ (y C) tiene analizador léxico. Los demás lenguajes se comparan como texto: en modo tolerante se ignoran la indentación y los espacios repetidos, pero no se distingue qué espacios son opcionales.
- La comparación es léxica: `vector<vector<int> >` y `vector<vector<int>>` cuentan como distintos.
- La biblioteca importada es una copia local: si cambias tus archivos, usa **Actualizar desde la carpeta** (Chromium) o vuelve a importarlos.
- Los datos viven en un navegador y un dispositivo. Para moverlos, exporta el historial en JSON e impórtalo en el otro.
- Los filtros usan la ruta, el lenguaje y la longitud; todavía no se leen etiquetas ni metadatos del gestor de referencias.
- Un repositorio de GitHub se descarga cada vez que lo abres y desaparece al recargar. Sin token se descargan como máximo 50 archivos de código; con token, 500.
- Está pensada para teclado físico; en móviles la experiencia es limitada.
