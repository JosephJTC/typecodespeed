/** Common words and sentences used by the exercises, by language. */
export const WORDS: Readonly<Record<'es' | 'en', readonly string[]>> = {
  es: `la las al sal ala asa da das lada falda salsa añada daña laja alas salas dadas faldas
de el en es le se si un una uno dos tres que por para con sin sobre entre desde hasta como cuando donde
casa mesa silla puerta libro papel agua fuego tierra aire cielo noche tarde hora semana mes
ser estar tener hacer poder decir ir ver dar saber querer llegar pasar deber poner parecer quedar creer hablar llevar dejar seguir
tiempo persona mundo vida mano parte lugar trabajo punto forma caso grupo problema cuenta medio palabra ejemplo
grande nuevo primero bueno mismo otro largo corto rojo verde azul blanco negro claro fuerte
teclado dedo tecla letra frase texto rapidez ritmo postura pulgar medio anular fila mirada memoria
programa codigo ciclo arreglo matriz grafo arbol nodo arista cola pila bolsa mapa clave valor rango suma resta
jugar dibujar escribir leer correr saltar cantar bailar pensar mirar escuchar aprender practicar mejorar repetir
amigo familia ciudad calle camino viaje playa monte bosque flor fruta pan leche queso arroz
zorro zapato vez voz luz paz feliz veloz exacto examen texto extra kilo koala wafle web`.split(/\s+/),
  en: `a as ad add all ask dad fad lad sad lass fall flask salad alfalfa alas flak
the of and to in is it you that he was for on are with as his they be at one have this from or had by
word but not what all were we when your can said there use an each which she do how their if will up other
about out many then them these so some her would make like him into time has look two more write go see
number no way could people my than first water been call who oil its now find long down day did get come made may part
keyboard finger key letter phrase text speed rhythm posture thumb middle ring row sight memory
program code loop array matrix graph tree node edge queue stack heap map value range sum count
play draw write read run jump sing dance think watch listen learn practice improve repeat
friend family city street road trip beach hill forest flower fruit bread milk cheese rice
quick brown fox jumps over lazy dog zebra zero size exact exam extra kilo koala waffle web`.split(/\s+/),
};

export const SENTENCES: Readonly<Record<'es' | 'en', { simple: readonly string[]; full: readonly string[] }>> = {
  es: {
    simple: [
      'la casa es grande y clara',
      'el libro nuevo llega hoy',
      'mis dedos vuelven a la fila guía',
      'practico un poco cada día',
      'no miro el teclado al escribir',
      'la calma mejora el ritmo',
      'cada tecla tiene su dedo',
      'escribo sin prisa y sin errores',
    ],
    full: [
      'Hoy practico diez minutos; mañana, quince.',
      '¿Cuántas teclas conoces ya de memoria?',
      'La precisión llega primero, la velocidad después.',
      '¡No mires el teclado! Confía en tus dedos.',
      'Vuelve siempre a la fila guía: A, S, D, F y J, K, L, Ñ.',
      'Un ritmo constante vale más que un arranque rápido.',
      'Si te equivocas, respira, corrige y sigue.',
      'El pulgar descansa sobre la barra espaciadora.',
    ],
  },
  en: {
    simple: [
      'the house is large and bright',
      'a new book comes today',
      'my fingers go back to the home row',
      'i practice a little each day',
      'i do not look at the keys',
      'a calm mind keeps the rhythm',
      'each key has its own finger',
      'i type with no rush and no errors',
    ],
    full: [
      'Today I practice ten minutes; tomorrow, fifteen.',
      'How many keys do you know by heart?',
      'Accuracy comes first, speed comes later.',
      "Don't look at the keyboard! Trust your fingers.",
      'Always return to the home row: A, S, D, F and J, K, L.',
      'A steady rhythm beats a fast start.',
      'If you slip, breathe, fix it and move on.',
      'The thumb rests on the space bar.',
    ],
  },
};
