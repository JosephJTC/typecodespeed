# Motor de comparación consciente del código (fase 1)

Este documento describe la arquitectura y la estrategia del motor que decide si lo que escribiste equivale al código de referencia. El motor vive en `src/engine/`, no depende de React ni del navegador y se puede usar desde la interfaz, desde pruebas o desde cualquier otro programa TypeScript.

## Problema

Al practicar código no queremos castigar diferencias de formato que no cambian el significado (`for(int i=0;i<n;i++)` contra `for (int i = 0; i < n; i++)`), pero tampoco podemos eliminar todos los espacios, porque algunos separan tokens:

| Referencia | Escrito | ¿Equivalente? | Motivo |
|---|---|---|---|
| `int x;` | `intx;` | No | `intx` es un solo identificador |
| `a + +b` | `a++b` | No | `++` es otro operador |
| `a - -b` | `a--b` | No | `--` es otro operador |
| `x = y / *p;` | `x = y /*p;` | No | `/*` abre un comentario |
| `vector<vector<int> > v;` | `vector<vector<int>> v;` | No (léxicamente) | `>>` es un solo token para el lexer |
| `return 0;` | `return0;` | No | `return0` es un identificador |
| `#define F(x) x` | `#define F (x) x` | No | cambia de macro con parámetros a macro de objeto |
| `#include <x>`<br>`int a;` | `#include <x> int a;` | No | una directiva termina en el salto de línea |
| `"a b"` | `"ab"` | No | el contenido de strings siempre es exacto |
| `a+b` | `a + b` | Sí | el espacio es opcional |
| `v[i]=x;` | `v [ i ] = x ;` | Sí | ningún token se fusiona |

## Arquitectura

```
src/engine/
  types.ts         Contratos: Token, LanguageProfile, WhitespaceRules, Target, resultados
  languages/
    cpp.ts         Lexer de C++ (perfil principal)
    plaintext.ts   Perfil de respaldo para texto sin lenguaje
    index.ts       Registro de lenguajes (getLanguage, languageForFile, registerLanguage)
  separation.ts    needsSeparator(a, b): ¿hace falta un espacio entre dos tokens?
  normalize.ts     Normalización de la fuente (BOM, CRLF, espacios finales) y eliminación de comentarios
  rules.ts         Reglas de cada modo (tolerante, exacto, personalizado)
  target.ts        buildTarget(): convierte la referencia en una secuencia de caracteres y huecos
  evaluator.ts     Evaluator incremental (push/pop/peek) y evaluate() para textos completos
  index.ts         API pública + isEquivalent()
```

Flujo:

```
fuente ─► normalizeSource ─► (stripComments) ─► lexer ─► buildTarget ─► Target
                                                                      │
                                     pulsaciones ─► Evaluator ◄───────┘ ─► estados, errores, conteos
```

Agregar un lenguaje consiste en implementar un `LanguageProfile` (un lexer que devuelva tokens con sus offsets) y registrarlo; el resto del motor no cambia.

## Lexer de C++

`lexCpp()` produce todos los tokens, incluidos los espacios, y conserva los offsets: concatenar el texto de los tokens reconstruye la fuente exacta (lo verifican las pruebas). Reconoce:

- **Identificadores y keywords**: conjunto completo de keywords de C++20 (incluye `constexpr`, `co_await`, `requires`, etc.) e identificadores Unicode.
- **Números** como *pp-number*: `0x1F`, `1'000'000`, `1e-9`, `.5`, `0b1010`, `1LL`, `3.14f`, `1_km` (sufijos definidos por el usuario).
- **Strings y caracteres** con prefijos `L`, `u`, `U`, `u8`, escapes (`'\''`, `"\""`, `'\\'`) y *raw strings* `R"delim(...)delim"`.
- **Comentarios** `//` (incluida la continuación con `\` al final de línea) y `/* */`.
- **Operadores y puntuación** con *maximal munch* (siempre el token más largo): `<=>`, `<<=`, `>>=`, `->*`, `...`, `::`, `->`, `++`, `&&`, `##`, dígrafos (`<:`, `<%`, `%:`), etc.
- **Directivas de preprocesador**: `#` al inicio de línea (también `%:`), nombre de la directiva, cabeceras `<...>` y `"..."` tras `#include`, continuaciones de línea, nombre de macro y si la macro tiene parámetros (`#define F(x)` contra `#define F (x)`).

## Estrategia de comparación

La referencia se convierte en un **objetivo** (`Target`): una secuencia de elementos de dos tipos.

- `CharItem`: un carácter que hay que escribir (todo carácter que no sea espacio, y los espacios dentro de strings, caracteres y, si se incluyen, comentarios).
- `GapItem`: un hueco entre tokens con un rango permitido de espacios (`min`, `max`), si admite saltos de línea (`newlines`) y si exige uno (`requireNewline`), más el motivo (`reason`).

Para cada par de tokens consecutivos se decide el hueco según el modo:

1. **¿Hace falta un separador?** `needsSeparator(a, b)` vuelve a lexear `a.text + b.text`; si el resultado no son exactamente los mismos dos tokens, el espacio es obligatorio (`min = 1`). No hay listas a mano: la regla sale del propio lexer, así que cubre `int x`, `a + +b`, `/ *`, `> >`, `. . .`, `1 .x`, etc. Hay una comprobación adicional para fusiones de tres tokens (`. . .` → `...`).
2. **¿Hace falta un salto de línea?** Al final de una directiva o de un comentario `//`, el salto es obligatorio en cualquier modo.
3. **Casos especiales del preprocesador**: entre el nombre de una macro y `(` no se permite espacio si la macro tiene parámetros, y es obligatorio si no los tiene.
4. **Reglas del modo** (`WhitespaceRules`) para el resto de huecos.

| Regla | Tolerante | Exacto | Personalizado |
|---|---|---|---|
| Indentación | ignorar | exacta | `exact` / `ignore` |
| Espacios dentro de la línea | solo los léxicos | exactos | `exact` / `collapse` / `lexical` |
| Saltos de línea | flexibles | exactos | `exact` / `flexible` |
| Líneas en blanco | ignorar | exactas | `exact` / `ignore` |

Los **comentarios** se configuran aparte: `omit` los elimina antes de construir el objetivo (dejando un espacio solo si hace falta para no fusionar tokens) e `include` los convierte en texto que hay que escribir.

## Evaluación incremental

`Evaluator` procesa una pulsación a la vez, como lo hará la interfaz de práctica:

- `push(ch)`: aplica la pulsación y devuelve si fue correcta, incorrecta, un espacio libre o un error de formato (`missingSeparator`, `missingNewline`, `forbiddenWhitespace`, `unexpectedNewline`, `missingWhitespace`, `substitution`, `insertion`).
- `pop()`: deshace la última pulsación (retroceso) restaurando el estado exacto.
- `peek(ch)`: evalúa sin modificar el estado; permite implementar el modo “bloquear hasta corregir”.
- `complete`, `getCounts()`: progreso y conteo de correctos, incorrectos, omitidos y sobrantes.

`evaluate(target, typed)` evalúa un texto completo e `isEquivalent(source, typed, lang, options)` responde si es completo y sin errores.

```ts
import { isEquivalent, buildTarget, Evaluator } from './engine';

isEquivalent('int x = a+b;', 'int  x=a + b;');            // true
isEquivalent('int x = a+b;', 'intx=a+b;');                // false: falta separador
isEquivalent('if (x) {\n  y();\n}', 'if(x){y();}', 'cpp', { mode: 'exact' }); // false

const ev = new Evaluator(buildTarget(source, 'cpp', { mode: 'tolerant', comments: 'omit' }));
ev.push('i'); ev.pop(); ev.peek('x');
```

## Pruebas

Las pruebas están en `src/engine/__tests__/` y se ejecutan con `npm test` (Vitest).

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `lexer.test.ts` | 65 | Tipos de token, maximal munch, números, strings, raw strings, escapes, comentarios, directivas, reconstrucción exacta |
| `separation.test.ts` | 47 | Pares de tokens donde el espacio es obligatorio u opcional |
| `tolerant.test.ts` | 61 | Modo tolerante: formato opcional aceptado, separadores necesarios, directivas, errores |
| `exact.test.ts` | 18 | Indentación, espacios, saltos y líneas en blanco significativos |
| `custom.test.ts` | 16 | Combinaciones de reglas personalizadas |
| `comments.test.ts` | 10 | Comentarios incluidos y omitidos |
| `evaluator.test.ts` | 5 | `push`/`pop`/`peek`, modo bloquear, espacios libres, objetivo vacío |
| `property.test.ts` | 20 | Propiedades con generador determinista sobre código real (Segment Tree, DSU, macros, Bitmask DP, templates y raw strings): miles de reformateos y mutaciones aleatorias comparados contra un oráculo independiente basado en la secuencia de tokens |
| `i18n.test.ts` | 2 | Interpolación y plurales del diccionario español |
| **Total** | **244** | |

La prueba de propiedades compara el motor contra un oráculo simple: un texto es equivalente en modo tolerante si y solo si, al lexearlo, produce la misma secuencia de tokens, agrupados en las mismas directivas de preprocesador. Así se detectan casos que nadie pensó en escribir a mano.

## Limitaciones conocidas

- El motor es léxico, no sintáctico: `vector<vector<int> >` y `vector<vector<int>>` se tratan como distintos porque producen tokens distintos, aunque un compilador moderno los acepte igual.
- No se expanden macros ni se evalúa el preprocesador; las directivas se comparan token a token.
- Los trigraphs (`??=`) no se reconocen (se eliminaron en C++17).
