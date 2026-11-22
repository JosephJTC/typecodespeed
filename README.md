# TypeCodeSpeed

Entrenador de mecanografía de código para programación competitiva. Practica escribiendo tus propias referencias (Segment Tree, DSU, Dynamic Programming, etc.) y mide velocidad y precisión con un motor que entiende C++: tolera diferencias de formato que no cambian el significado y detecta las que sí lo cambian.

> **Estado: fase 3.** Ya funcionan el motor de comparación consciente del código, la práctica de mecanografía (código completo, por tiempo y fragmentos aleatorios) y las estadísticas: métricas detalladas por prueba, gráficas, historial local y comparaciones. La importación de tu colección de referencias llegará en la siguiente fase (ver [`docs/PLAN.md`](docs/PLAN.md)).

## Documentación

- [`docs/PLAN.md`](docs/PLAN.md): plan general, arquitectura y fases.
- [`docs/MOTOR.md`](docs/MOTOR.md): diseño del motor de comparación, estrategia y pruebas.
- [`docs/PRACTICA.md`](docs/PRACTICA.md): sesión de práctica, captura de teclado y atajos.
- [`docs/ESTADISTICAS.md`](docs/ESTADISTICAS.md): métricas, gráficas, historial local y comparaciones.

## Requisitos

- Node.js 20 o superior y npm.

## Instalación y uso

```bash
npm install
npm run dev        # aplicación en http://localhost:5173
npm test           # pruebas automatizadas (Vitest)
npm run typecheck  # verificación de tipos
npm run lint       # análisis estático (oxlint)
npm run build      # compilación estática en dist/
```

## Privacidad

TypeCodeSpeed funciona por completo en tu navegador, sin servidor. Tus referencias nunca se suben a ningún lado.
