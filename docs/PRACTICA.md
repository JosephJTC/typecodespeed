# Práctica de mecanografía (fase 2)

## Arquitectura

```
src/session/   TypingSession: cronómetro, pausa, política de errores, deshacer, registro de pulsaciones (sin React)
src/snippets/  Ejemplos incluidos y extracción de fragmentos (bloques { ... } con su declaración)
src/ui/practice/
  SetupPanel   configuración de la prueba
  TypingView   captura de teclado (textarea oculto) y pantalla de práctica
  CodeView     lo escrito (con sus espacios y saltos) seguido del código pendiente, cursor y desplazamiento automático
  StatsBar     progreso, WPM, precisión, tokens, línea, errores
  Results      resultados al terminar
```

`TypingSession` envuelve al `Evaluator` del motor y es la única fuente de verdad: la UI solo traduce eventos de teclado a `input()`, `backspace()`, `wordBackspace()`, `tab()` y `togglePause()`.

## Vista del código

La vista no dibuja la referencia en una posición fija: muestra lo que realmente escribiste y, a continuación, el código pendiente en gris, como la sugerencia de un autocompletado. `buildDisplay()` (`src/engine/display.ts`) la calcula a partir del `Evaluator`.

- Los espacios, saltos y líneas en blanco que escribes aparecen tal cual, y el código pendiente se desplaza después de ellos.
- Si omites un espacio o un salto opcional, el código pendiente se pega a lo escrito.
- Un salto de línea que ya escribiste no se vuelve a sugerir, y la indentación sugerida se reduce según lo que ya indentaste.
- Un carácter incorrecto se muestra en rojo con el carácter esperado; un carácter sobrante, en rojo y tachado; un espacio o salto obligatorio que omitiste, como `␣` o `↵` en rojo.

## Tipos de prueba

| Tipo | Comportamiento |
|---|---|
| Código completo | Se escribe la referencia completa; termina al escribir correctamente el último carácter. |
| Por tiempo | 15, 30, 60 o 120 s; al completar un fragmento aparece otro. Las teclas después del límite se descartan. |
| Fragmento aleatorio | Un bloque (función, struct, ciclo…) elegido al azar de la fuente. |

## Comportamiento

- **Cronómetro:** empieza con la primera tecla. Solo cuenta el tiempo activo.
- **Pausa:** Esc pausa o continúa; perder el foco pausa; la pausa por inactividad (configurable) descuenta el tiempo inactivo. Escribir mientras está en pausa reanuda y la tecla se procesa (no se pierde).
- **Errores:** *avanzar* marca el error y continúa; *bloquear* rechaza la tecla hasta que se escriba la correcta.
- **Edición libre:** el cursor se mueve dentro del código como en un editor: flechas, Inicio/Fin (Inicio va primero al primer carácter no blanco), Ctrl+Inicio/Fin, Ctrl+flechas por palabras o grupos de símbolos, y Shift para seleccionar. Se puede corregir cualquier carácter anterior; el motor vuelve a comparar desde el punto editado. Moverse no inicia el cronómetro ni cuenta como pulsación.
- **Borrar:** Retroceso y Supr borran un carácter o la selección; Ctrl+Retroceso y Ctrl+Supr, una palabra. Retroceso justo después de una indentación automática la borra junto con su salto. Cada borrado cuenta como una corrección.
- **Indentación automática:** al presionar Enter al final del texto, la línea nueva queda indentada como la línea de la referencia donde está el siguiente token; a media línea conserva la indentación de la línea y la aumenta tras `{`. Tab completa la indentación esperada en los modos donde es exacta. Se puede desactivar en Ajustes.
- **Cierre automático:** al escribir `(`, `[` o `{` se inserta su cierre de inmediato y el cursor queda en medio. Escribir ese cierre avanza sobre él sin duplicarlo. Enter entre `{}` deja la llave de cierre en su propia línea. Retroceso en un par vacío borra los dos; con contenido dentro, borra normal. No aplica dentro de cadenas, caracteres ni comentarios, ni antes de un identificador o número. Se puede desactivar en Ajustes.
- **Progreso de los cierres:** un cierre insertado que todavía no escribiste encima ni pasaste no se compara: no cuenta como progreso, pulsación ni carácter correcto, y se dibuja en su lugar dentro del código pendiente. Si escribes después de él, pasa a ser parte del texto comparado.
- **Métricas:** WPM = caracteres correctos escritos por ti / 5 por minuto; WPM bruto cuenta todas las teclas; la precisión cuenta también los errores corregidos o rechazados. Lo que inserta la aplicación (indentación y cierres) no cuenta como pulsación, acierto ni para la precisión.
- **Captura de teclado:** los caracteres llegan por el evento `input` de un textarea oculto, así que una ráfaga de teclas, las teclas muertas y los IME no pierden caracteres. Pegar está deshabilitado.

## Atajos

| Tecla | Acción |
|---|---|
| Esc | Pausar / continuar |
| Ctrl+Enter | Reiniciar |
| Ctrl+Shift+Enter | Otro fragmento |
| Flechas, Inicio, Fin | Mover el cursor |
| Ctrl+flechas | Moverse por palabras |
| Shift + movimiento | Seleccionar |
| Ctrl+A | Seleccionar todo |
| Retroceso / Supr | Borrar un carácter o la selección |
| Ctrl+Retroceso / Ctrl+Supr | Borrar una palabra |
| Tab | Completar la indentación |
