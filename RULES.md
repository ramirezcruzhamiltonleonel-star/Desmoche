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
- Si nadie reclama la carta inicial, el primer jugador (siguiente al repartidor)
  roba **2 cartas del mazo** en vez de 1 — se queda con la que le sirva y la otra se
  descarta.
- Cuando alguien reclama fuera de turno, el turno salta a esa persona; al terminar su
  turno, la rotación normal continúa desde el jugador siguiente a ella (se saltan los
  que quedaron en medio).

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

## Pendiente de definir (no implementado todavía)

- **Robo del mazo ofrecido a todos + re-robo por la misma persona hasta que a alguien
  le sirva**: mecánica nueva en discusión, todavía sin implementar. Ver conversación
  para el detalle exacto antes de construirla.
- **Carta del mazo revelada con pantalla de confirmación** (privada vs. pública para
  toda la mesa): decisión de diseño pendiente de confirmar.
