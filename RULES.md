# Reglas de Desmoche — estado actual implementado

Este documento es la referencia viva de las reglas tal como están **implementadas**
en el motor de juego (`server/src/game/`). Cuando una regla cambia, este archivo se
actualiza en el mismo commit que el código y sus tests.

## Reparto y triunfos automáticos

- 52 cartas, sin comodines. 9 cartas por jugador (2-4 jugadores).
- Al repartir, antes de cualquier otra cosa, se evalúan **sobre la mano tal cual sale
  del reparto**:
  - **Peladía**: sin pares ni 2+ cartas consecutivas del mismo palo. Gana la mano de
    inmediato.
  - **Cuatro Cuerpos**: las 4 cartas de un mismo valor repartidas a un jugador. Gana de
    inmediato. Empate entre varios: gana el más cercano a la derecha del repartidor.
  - Si aplica cualquiera de los dos, la mano termina ahí — Cambio nunca llega a
    ocurrir esa mano.

- **Modo "sin automáticas"** (opción al crear la mesa, fija para toda la sesión de
  esa mesa): si se elige, Peladía y Cuatro Cuerpos no se evalúan nunca — toda
  mano pasa directo a Cambio y se juega completa, sin importar cómo haya
  salido el reparto. El resto de las reglas (Cambio, turnos, Mico, Patona,
  pozo acumulado) no cambia en nada.

## Cambio (obligatorio, después del reparto — solo si nadie ganó automático)

- Cada jugador entrega **1 carta** de su mano de 9 al siguiente jugador en la rotación
  (mismo sentido que el orden de turno). Con 2 jugadores es un intercambio directo;
  con 3-4, cada quien entrega a su siguiente y recibe de su anterior.
- Es **simultáneo y a ciegas**: nadie ve lo que recibió hasta que todos entregaron la
  suya. El servidor no resuelve el intercambio hasta que los N jugadores hayan
  entregado su carta.
- Recién después del intercambio se voltea/expone la mecánica de la carta inicial de
  descarte (ventana de reclamo), y arranca el turno normal.

## Turno estándar

1. Robar: del mazo (libre) o del descarte (solo si la carta se puede usar de inmediato
   en un grupo — ver "Reclamo de descarte" abajo).
   - **La carta robada del mazo nunca se mezcla con las 9 originales para elegir
     libremente qué descartar.** Se resuelve de inmediato, en el mismo momento en
     que se roba: o se usa ahí mismo en un grupo (nuevo o propio ya existente), o
     se descarta directamente — sin pasar por una elección entre las 9 cartas
     originales. Mientras esa carta no se resuelva, no se puede desmochar ni
     descartar ninguna otra carta.
2. Colocar grupos nuevos y/o agregar cartas a grupos propios ya en mesa — **siempre
   opcional**, nunca automático. El sistema únicamente ofrece el botón; el jugador
   decide cuándo y qué bajar, incluyendo guardarse grupos completos en la mano para
   bajarlos todos juntos más tarde.
3. Desmoche: mover una carta de un grupo propio ya en mesa a **otro grupo propio**
   ya en mesa, sin dejar al grupo origen en menos de 3 cartas. Esto requiere tener
   **al menos 2 grupos propios ya colocados** — si solo tienes 0 o 1, no hay a dónde
   mover la carta todavía (la interfaz lo indica en vez de fallar en silencio).
4. Descartar para terminar el turno — cualquier carta de la mano actual, incluida la
   que se acaba de robar del mazo si no sirve. Excepción: si las 10 cartas quedan
   colocadas en grupos válidos sin sobrante, se gana la mano de inmediato sin
   descartar.

## Reclamo de descarte (incluida la carta inicial)

- Todo descarte — incluida la carta que se voltea al inicio de la mano — se ofrece a
  reclamo. Quien reclama debe poder usar la carta de inmediato en un grupo.
- Si varios reclaman la misma carta, tiene prioridad el más cercano en la rotación
  (hacia adelante, mismo sentido que el orden de turno) al jugador de referencia
  (quien descartó, o el repartidor para la carta inicial).
- **Si nadie reclama la carta inicial**, el mismo jugador designado (el siguiente al
  repartidor) revela **una carta del mazo a la vez** — nunca dos para elegir. Esa
  carta se ofrece a todos de la misma forma (ventana de reclamo); si tampoco la
  reclama nadie, se entierra en el descarte y se revela la siguiente, una por una,
  hasta que alguien reclame una o el mazo (y el descarte reciclado) se agoten por
  completo — en cuyo caso la mano termina sin ganador (ver "Pozo acumulado" abajo).
- Cuando alguien reclama fuera de turno, el turno salta a esa persona; al terminar su
  turno, la rotación normal continúa desde el jugador siguiente a ella (se saltan los
  que quedaron en medio).

## Jugador solitario, desconexión y retiro voluntario ("Retirarme de la mano")

- **Un asiento queda "inactivo para esta mano"** de dos formas: se desconecta a
  mitad de mano y no vuelve a conectarse dentro del minuto siguiente (ver más
  abajo), o usa el botón rojo "Retirarme de la mano" (inmediato, sin espera). Ambos
  casos se tratan igual en el motor de juego una vez que se aplican: el asiento
  queda excluido del resto de la rotación de turnos, de las ventanas de reclamo y
  de Cambio por lo que queda de esa mano — nunca se lo salta el juego en silencio
  dejándolo trabado esperando una acción que nadie va a mandar.
- **Desconexión: un minuto de gracia antes de excluir.** Al desconectarse (se
  recarga la página, se corta el internet un momento), el asiento se marca
  "Desconectado" en la interfaz de inmediato, pero **sigue formando parte normal de la
  rotación de esa mano hasta que pasa 1 minuto sin que vuelva a conectarse** — una
  recarga de página o un corte breve no le cuesta el turno. Si se reconecta dentro
  de ese minuto (recargando o con el internet de vuelta), sigue jugando exactamente
  donde estaba, sin ninguna penalidad. Si el minuto se cumple sin reconexión, recién
  ahí se excluye del resto de la mano — igual que el retiro voluntario a partir de
  ese momento.
- **Retirarse** solo está disponible después de Cambio (ventana de reclamo o turno
  normal) — Cambio es obligatorio, a ciegas y simultáneo, así que retirarse antes de
  entregar la carta no tendría sentido. Un jugador retirado no puede volver a robar
  del mazo, no participa en los turnos restantes, y queda fuera de la posibilidad de
  ganar esa mano específica — pero sigue debiendo su ante (y Patona, si no bajó
  ningún grupo) como cualquier otro perdedor cuando la mano finalmente se liquida.
- **Reconectarse a mitad de mano NO restaura la elegibilidad** para lo que queda de
  esa mano — el asiento sigue excluido hasta la mano siguiente. El estado de
  inactividad se reconstruye desde cero en cada reparto nuevo, a partir de quién
  está conectado en ese momento: un jugador que se desconectó pero para la mano
  siguiente ya se reconectó vuelve a jugar y a apostar con normalidad; uno que se
  retiró voluntariamente también vuelve fresco la mano siguiente (el retiro solo
  afecta la mano específica en la que se usó).
- **Si solo queda un asiento activo** (todos los demás desconectados y/o retirados),
  ese jugador sigue jugando SOLO contra el mazo — el juego nunca le da la victoria
  automática por ser el único que queda. Si completa su mano normalmente, gana y se
  lleva el pozo (incluyendo los antes de los inactivos). Si no la completa (el mazo
  se agota), la mano termina sin ganador y aplica el pozo acumulado de la sección
  siguiente — no hay premio por quedar solo en la mesa.
- Si al repartir una mano nueva ya hay ≤1 asiento conectado, Cambio se salta por
  completo (no hay con quién intercambiar) y se va directo al ritual de apertura.

## Bots (para practicar o completar mesa)

- Solo quien creó la mesa puede agregar o quitar bots, y solo antes de que
  empiece la mano (en la sala de espera). Cada bot ocupa un asiento normal —
  cuenta para el mínimo/máximo de jugadores (2 a 4) igual que un humano.
- Un bot siempre figura "Listo" — la mesa solo espera a los humanos
  sentados. Nunca se desconecta ni se retira por su cuenta; juega la mano
  completa siempre que esté sentado.
- **Participa exactamente por las mismas reglas que un humano**, sin ningún
  camino especial que se salte validaciones: entrega carta en Cambio,
  declara Peladía/Cuatro Cuerpos automático si le toca (misma lógica que ya
  evalúa a todos los asientos al repartir), reclama un descarte solo cuando
  de verdad le sirve de inmediato, baja grupos y desmocha cuando eso
  claramente lo ayuda (nunca al azar, pero tampoco con búsqueda exhaustiva —
  ver más abajo), y descarta al terminar su turno.
- **Nivel de juego**: razonable, no experto. En Cambio y al descartar, entrega
  siempre la carta que menos encaja con el resto de su mano (la más aislada,
  sin pareja de rango ni vecinos cercanos del mismo palo). Baja cualquier
  grupo nuevo o extensión que pueda formar. Desmocha únicamente si mover una
  carta entre dos de sus propios grupos en mesa libera de inmediato otra
  carta de su mano para bajarla — nunca reordena sus grupos "porque puede".
- **Modo Fichas**: los bots juegan con fichas reales, igual que cualquier
  jugador — ganarle o perderle a un bot mueve el saldo normalmente. Cada bot
  es una cuenta fija de la base de datos con saldo alto que se recarga solo
  si baja demasiado, así nunca es un obstáculo para que una mano se liquide.

## Modo espectador

- Cualquiera con el código (o el enlace/QR) de una mesa **que ya empezó a
  jugar** puede entrar a mirarla sin ocupar un asiento — no cuenta para el
  mínimo/máximo de jugadores, nunca recibe cartas, nunca mueve fichas, y no
  puede ejecutar ninguna acción de juego.
- Ve la mesa exactamente igual que vería otro jugador a un rival: los grupos
  ya bajados están completamente visibles, la mano de cada jugador se reduce
  a una cantidad de cartas (nunca cuáles son) hasta que las baje.
- No se puede espectar una mesa que todavía está en la sala de espera (no ha
  empezado la primera mano) — hay que esperar a que arranque.

## Bonos de pago (modo Fichas y Dinero real)

- **Mico abajo**: escalera A-2-3 del mismo palo en la jugada ganadora → cada perdedor
  paga un ante extra.
- **Mico arriba**: escalera Q-K-A del mismo palo en la jugada ganadora → cada perdedor
  paga un ante extra (acumulable con Mico abajo si ambos aplican).
- **Patona**: si un perdedor no bajó **ningún** grupo válido en toda la mano, le debe
  al ganador un ante extra adicional (mismo monto que un Mico, motivo distinto),
  evaluado individualmente por jugador y acumulable con los Micos. Solo aplica cuando
  la mano se jugó de verdad (terminó por "se fue con toda la mano" o por descarte) —
  no aplica sobre una Peladía/Cuatro Cuerpos, porque ahí nadie llegó a tener turno.
  **No aplica en Modo Retos.**

## Mano sin ganador y pozo acumulado ("se va doble")

- **Único caso de "mano sin ganador"**: el mazo (y el descarte reciclado) se agotan
  por completo sin que ningún jugador complete su mano ni gane por otra vía. Esto
  puede pasar durante el ritual de apertura (revelado uno a uno sin que nadie
  reclame) o en cualquier turno normal al intentar robar del mazo. No hay otro
  camino posible bajo las reglas actuales — Peladía, Cuatro Cuerpos y "se fue con
  toda la mano" siempre tienen un ganador.
- **Modo Fichas/Dinero real**: el pozo de esa mano (ante × cantidad de jugadores) no
  se reparte — se acumula (`accumulatedPot`) para la mano siguiente. Cada jugador
  vuelve a poner su ante completo en la mano nueva, que se suma al acumulado. Esto
  se repite sin límite mientras sigan pasando manos sin ganador — no hay tope de
  manos consecutivas.
- Cuando finalmente alguien gana una mano (con pozo acumulado de una o más manos
  previas), se paga todo normal: el ganador se lleva el pozo completo de esa mano
  **más** todo lo acumulado, y los bonos de Mico/Patona se calculan exactamente
  igual que siempre sobre esa mano específica. El acumulado vuelve a 0 en cuanto se
  paga.
- **Modo Retos**: no hay pozo que acumular (no existe una apuesta en fichas). Si el
  mazo se agota, esa mano simplemente termina sin que nadie deba cumplir un reto.
- Estas manos sí quedan registradas en el historial persistente (`winnerUserId` nulo
  para esa mano), y cuentan como "mano jugada" en las estadísticas del jugador.

## Pendiente de definir (ideas registradas — sin implementar)

Estas son ideas que el usuario pidió dejar anotadas para diseñar con calma más
adelante. Ninguna tiene mecánica ni código todavía.

- **Fichas diarias gratis**: dar a cada jugador una cantidad de fichas gratis
  periódicamente. Sin definir: cuántas fichas, cada cuánto tiempo, si hay un tope
  máximo de fichas acumulables.
- **Modo un jugador contra bots**: para practicar o jugar sin depender de tener 3
  oponentes humanos disponibles. Sin definir: qué tan "inteligente" debe ser el bot,
  si aplica a los 3 modos de apuesta o solo a Fichas/Retos.
- **Recarga de fichas con dinero real**: se conecta directamente con el Modo Dinero
  real, que ya estaba marcado como pendiente en la especificación original por el
  tema legal — Nicaragua no tiene ley específica de apuestas online, y operar desde
  EE.UU. implica posible exposición legal. **No avanzar en esto sin retomar
  primero esa conversación legal.**
