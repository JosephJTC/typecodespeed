# Estadísticas y análisis de rendimiento (fase 3)

## Arquitectura

```
src/stats/          sin React ni DOM
  types.ts          TestRecord: lo que se guarda de cada prueba
  compute.ts        buildRecord(): registro a partir del log de pulsaciones; timeline(): puntos de las gráficas
  analysis.ts       resumen, caracteres difíciles, comparaciones, progreso, tendencia y observaciones
  store.ts          historial local (IndexedDB; memoria como respaldo), exportar/importar
src/ui/charts/      gráficas SVG propias (líneas y barras), sin dependencias
src/ui/stats/       página «Estadísticas», detalle de una prueba, comparación
```

Todas las gráficas salen de datos registrados: `TypingSession` anota cada pulsación (tiempo activo, carácter escrito, carácter esperado, tipo de token, resultado) y `buildRecord()` deriva de ese log el registro que se guarda. No se guarda el código ni el log completo, solo los agregados.

## Métricas de cada prueba

| Métrica | Cálculo |
|---|---|
| WPM | caracteres correctos al terminar ÷ 5 ÷ minutos activos |
| WPM bruto | todas las pulsaciones aceptadas ÷ 5 ÷ minutos |
| Caracteres por segundo | caracteres correctos al terminar ÷ segundos activos |
| Precisión | pulsaciones correctas ÷ pulsaciones evaluadas; los errores corregidos y las teclas rechazadas (modo bloquear) cuentan como error |
| Avance | 100 % si se completó; si no, fracción del código escrito (o del tiempo, en pruebas por tiempo) |
| Consistencia | 1 − coeficiente de variación de la velocidad por intervalo (100 % = ritmo constante) |
| Errores cometidos / sin corregir / correcciones | del motor de sesión |
| Tokens sin errores | tokens cuyo texto final quedó correcto |

Métricas específicas de código:

- **Errores por tipo:** carácter incorrecto, carácter de más, separador faltante, espacio no permitido, salto faltante o no permitido, espacio de formato faltante.
- **Por tipo de token:** identificadores, palabras clave, números, cadenas, operadores, puntuación, preprocesador, etc. Los errores de espacios se atribuyen a «Espacios y saltos».
- **Por clase de carácter:** letras, dígitos, símbolos, espacios.
- **Por carácter esperado:** intentos, errores y demora media antes de pulsarlo.
- **Confusiones:** qué tecla se pulsó en lugar de cuál.

Notas de cálculo:

- El tiempo es **activo**: las pausas no cuentan ni aparecen en las gráficas.
- La demora de una tecla es el tiempo desde la pulsación anterior; las mayores de 5 s se descartan como titubeos.
- La indentación automática no cuenta como pulsación.
- La línea de tiempo usa intervalos de 1 s (más largos en pruebas de más de un minuto, para tener 60 puntos como máximo). Dentro de cada intervalo se cuentan las pulsaciones correctas en el momento en que se escriben.

## Gráficas

Por prueba: caracteres por segundo, velocidad (WPM, WPM bruto y promedio acumulado) y precisión (por intervalo y acumulada) a lo largo del tiempo; distribución de errores; caracteres difíciles; caracteres más lentos; confusiones; errores por tipo de token y por clase de carácter.

Entre pruebas: velocidad y precisión en cada prueba con media móvil de 5; los mismos desgloses sumando todo el historial filtrado.

## Comparaciones

- Cada resultado se compara con el promedio de tus pruebas anteriores **del mismo tipo, modo y duración**, y con tu mejor velocidad.
- En el historial se pueden marcar dos pruebas y compararlas métrica por métrica, con sus curvas de velocidad y precisión superpuestas.

## «Qué practicar»

`insights()` convierte los agregados en observaciones concretas: caracteres con tasa de error ≥ 10 % (con al menos 8 intentos), caracteres lentos (≥ 1,6× tu demora media), confusiones repetidas, un tipo de error dominante, tipos de token o clases de carácter con error claramente mayor al promedio, exceso de correcciones, ritmo irregular y tendencia de las últimas pruebas. Los umbrales son conservadores para no reportar ruido.

## Historial y privacidad

El historial se guarda en IndexedDB (`typecodespeed` → `tests`) del navegador. Nada se envía a ningún servidor. Se puede eliminar una prueba, borrar todo, exportar a JSON e importar. Si el navegador no ofrece IndexedDB, el historial vive en memoria y la página lo avisa. Las pruebas en las que no se escribió nada no se guardan.
