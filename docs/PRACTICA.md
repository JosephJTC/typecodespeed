# Práctica de mecanografía (fase 2)

## Arquitectura

```
src/session/   TypingSession: cronómetro, pausa, política de errores, deshacer, registro de pulsaciones (sin React)
src/snippets/  Ejemplos incluidos y extracción de fragmentos (bloques { ... } con su declaración)
src/ui/practice/
  SetupPanel   configuración de la prueba
  TypingView   captura de teclado (textarea oculto) y pantalla de práctica
  CodeView     código con estado por carácter, cursor y desplazamiento automático
  StatsBar     progreso, WPM, precisión, tokens, línea, errores
  Results      resultados al terminar
```

`TypingSession` envuelve al `Evaluator` del motor y es la única fuente de verdad: la UI solo traduce eventos de teclado a `input()`, `backspace()`, `wordBackspace()`, `tab()` y `togglePause()`.

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
- **Retroceso:** deshace la última acción (Enter + indentación automática se deshacen juntas). Ctrl+Retroceso borra el token actual.
- **Indentación:** opcional automática al presionar Enter; Tab completa la indentación esperada. Solo importa en modos donde la indentación es exacta.
- **Métricas:** WPM = caracteres correctos / 5 por minuto; WPM bruto cuenta todas las teclas; la precisión cuenta también los errores corregidos o rechazados. Las teclas automáticas no cuentan.
- **Captura de teclado:** los caracteres llegan por el evento `input` de un textarea oculto, así que una ráfaga de teclas, las teclas muertas y los IME no pierden caracteres. Pegar está deshabilitado.

## Atajos

| Tecla | Acción |
|---|---|
| Esc | Pausar / continuar |
| Ctrl+Enter | Reiniciar |
| Ctrl+Shift+Enter | Otro fragmento |
| Ctrl+Retroceso | Borrar el token actual |
| Tab | Completar la indentación |
