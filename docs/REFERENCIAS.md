# Referencias locales, privacidad y despliegue (fase 4)

## Importación

`src/library/` no depende de React. Todas las entradas se reducen a una lista de `RawFile` (ruta, tamaño y una función para leer el texto) y pasan por `buildLibrary()`:

| Origen | Función | API del navegador |
|---|---|---|
| Carpeta (nativo) | `libraryFromDirectory()` | File System Access API (`showDirectoryPicker`, solo lectura) |
| Carpeta (clásico) | `libraryFromFiles()` | `<input type="file" webkitdirectory>` |
| Archivos sueltos | `libraryFromFiles()` | `<input type="file" multiple>` |
| ZIP | `libraryFromZip()` | lector propio (`zip.ts`) + `DecompressionStream` |

`buildLibrary()`:

- no asume ninguna estructura: conserva la ruta relativa de cada archivo y con ella se arma el árbol (`buildTree()`);
- quita la carpeta raíz común (la que el usuario eligió) y la usa como nombre de la biblioteca;
- solo lee archivos con extensión de código conocida y de hasta 200 kB; los demás no se abren;
- omite carpetas ocultas, `node_modules` y similares, archivos binarios y vacíos, y cuenta cuántos omitió;
- normaliza los saltos de línea.

`filterFiles()` busca por palabras en la ruta (sin distinguir acentos ni mayúsculas) y filtra por lenguaje, carpeta y longitud.

## Persistencia

La biblioteca importada se guarda en IndexedDB (`typecodespeed-referencias`) para no tener que volver a elegir la carpeta en cada visita. Con el selector nativo también se guarda el identificador de la carpeta; **Actualizar desde la carpeta** vuelve a pedir permiso de lectura y relee los archivos.

Cada resultado guarda `sourceId = "ref:<ruta>"`, de modo que el historial y la tabla «Rendimiento por referencia» conservan la relación con el archivo de origen. El historial no guarda el código.

## Privacidad

Garantías verificables:

1. **Sin API de red en el código.** `tests/privacy.test.ts` falla si algún archivo de `src/` usa `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, service workers o URL externas.
2. **Bloqueo en el navegador.** La compilación inserta en `index.html` una política de seguridad de contenido con `default-src 'self'` y `connect-src 'none'` (ver `vite.config.ts`). Aunque una dependencia intentara conectarse, el navegador lo impediría.
3. **Sin dependencias de producción** aparte de React; la misma prueba lo comprueba.
4. **Nada de referencias en el repositorio.** `referencias/` y `referencias*.zip` están en `.gitignore`; los ejemplos incluidos (`src/snippets/samples.ts`) son código genérico escrito para el proyecto.

## Despliegue

`.github/workflows/deploy.yml` ejecuta las pruebas, compila con `npm run build` y publica `dist/` con las acciones oficiales de GitHub Pages. Requiere elegir **GitHub Actions** como origen en **Settings → Pages**. `base: './'` hace que los recursos se carguen con rutas relativas, por lo que el sitio funciona en `https://<usuario>.github.io/<repo>/` sin configurar el nombre del repositorio.
