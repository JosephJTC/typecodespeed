# Repositorios de GitHub

La sección **GitHub** es una función aparte de **Referencias**: permite abrir un repositorio público o privado, explorar solo las carpetas que contienen código y practicar sus archivos con las mismas modalidades (completa, fragmento aleatorio y por tiempo). Las referencias locales no cambian.

## Uso

1. Si el repositorio es privado, crea un token *fine-grained* en GitHub (**Settings → Developer settings → Personal access tokens → Fine-grained tokens**):
   - **Repository access:** *Only select repositories*, y elige solo los repositorios que quieras practicar.
   - **Permissions → Repository permissions → Contents:** *Read-only*. No hace falta ningún otro permiso.
   - Elige una fecha de expiración corta.
2. En **GitHub**, pega el token y pulsa **Usar token**. La aplicación lo comprueba contra GitHub antes de aceptarlo.
3. Escribe el repositorio como `usuario/repositorio`, `usuario/repositorio@rama` o pega su dirección `https://github.com/usuario/repositorio`. La rama es opcional; por defecto se usa la principal.
4. Pulsa **Abrir repositorio**, elige un archivo y practica.

Los repositorios públicos se pueden abrir sin token, pero GitHub permite solo 60 peticiones por hora sin autenticar, así que se descargan como máximo 50 archivos de código. Con token el límite es de 500 archivos.

## Qué se descarga

- Se pide la lista de archivos del repositorio y se descargan solo los de código compatibles: `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.c`, `.py`, `.java`, `.kt`, `.rs`, `.go`, `.js`, `.ts` y `.cs`.
- Se omiten `.txt`, Markdown, imágenes y cualquier otro archivo, las carpetas ocultas (`.github`, …), `node_modules`, `dist` y `build`, los archivos vacíos y los de más de 200 kB. El tamaño se revisa antes de descargar.
- Como el árbol se arma solo con archivos de código, las carpetas sin código no aparecen.
- El código se guarda solo en memoria: al recargar o cerrar la pestaña desaparece. **Cerrar repositorio** lo descarta.

## Seguridad

| Riesgo | Medida |
|---|---|
| Token con demasiados permisos | Se recomienda un token fine-grained de solo lectura limitado a ciertos repositorios; si pegas un token clásico se muestra una advertencia. La aplicación solo hace peticiones de lectura. |
| Robo del token guardado | Por defecto el token vive solo en la memoria de la pestaña y nunca se muestra en la página. Si eliges recordarlo, se cifra con AES-GCM de 256 bits y una clave derivada de tu contraseña con PBKDF2-SHA256 (310 000 iteraciones, sal aleatoria). La contraseña no se guarda. |
| Fuga del token en URLs, historial o registros | El token solo viaja en la cabecera `Authorization` hacia `https://api.github.com`. Nunca va en la URL ni en los ajustes guardados, y la aplicación no escribe nada en la consola. |
| Envío de datos a otros sitios | La política de seguridad del sitio solo permite conexiones a `https://api.github.com`. Todas las peticiones son GET sin cuerpo, sin cookies (`credentials: 'omit'`), sin `Referer` y sin seguir redirecciones. Solo `src/github/client.ts` puede usar la red; una prueba automatizada lo verifica. |
| Entradas manipuladas | El repositorio, el usuario y la rama se validan antes de armar cualquier ruta (se rechazan otros dominios, `..`, `?`, `#`, credenciales en la URL, etc.), cada parte se codifica y la URL final se comprueba contra el origen de la API. Los SHA de los archivos se validan antes de pedirlos. El token se valida para que no pueda inyectar cabeceras. |
| Repositorio privado visible tras olvidar el token | **Olvidar token** lo borra de la memoria y del navegador, cancela descargas y cierra el repositorio si es privado. Para revocarlo por completo, elimínalo también en GitHub. |
| Rutas privadas guardadas | Los ajustes nunca guardan la ruta ni los filtros del repositorio. El historial guarda, como con las referencias locales, el nombre del archivo practicado y el resultado, nunca el código. |

Errores que se distinguen: token rechazado (401), repositorio no encontrado o sin acceso (404; GitHub responde así también a los privados sin permiso), límite de peticiones (con la hora en que se libera), fallo de conexión y respuestas inesperadas.

## Límites

- Un sitio estático no puede usar el inicio de sesión OAuth de GitHub sin un servidor intermedio, por eso se usa un token personal.
- Si el repositorio es enorme, GitHub puede devolver la lista de archivos incompleta; se avisa en pantalla.
- Cualquier extensión o script con acceso a la página podría leer el token mientras está en memoria; usa un token de solo lectura, con pocos repositorios y expiración corta.
