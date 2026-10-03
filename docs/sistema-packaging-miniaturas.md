# Sistema de Packaging y Miniaturas — Especificación para AD Investigación YouTube

## Objetivo

Añadir en una futura evolución de AD Investigación YouTube una capa de análisis visual y de packaging que permita clasificar miniaturas ganadoras, relacionarlas con títulos y detectar mecanismos repetibles.

No modificar en esta fase los módulos validados de búsqueda, competencia o patrones ganadores.

## Principio

**Título + miniatura = packaging.**

AD Investigación YouTube debe ayudar a responder:
- qué miniaturas sobreperforman;
- qué mecanismo visual utilizan;
- qué categoría representan;
- cómo se relacionan con el título;
- si el patrón se repite entre varios referentes;
- qué elementos podrían adaptarse con identidad propia.

## 13 categorías visibles

1. Números grandes
2. Shock o temor
3. Expresión facial
4. Frases / Quotes
5. Preguntas
6. Respuestas
7. Autoridad / Social Hacking
8. Contraste extremo
9. Frase relacionada + foto
10. Tiempo
11. Comparación
12. Transformación
13. Curiosidad mediante censura

## Reglas transversales

- comprensión aproximada en 1 segundo;
- legibilidad móvil;
- un elemento dominante;
- color y contraste como señales de atención;
- persona + objeto + texto cuando sea adecuado;
- la imagen debe comunicar incluso con poco texto;
- título y miniatura deben complementarse;
- preparar tres variantes A/B/C realmente distintas;
- no copiar literalmente activos o identidad de referentes.

## Regla de adaptación

Cuando exista una miniatura probada:
1. extraer mecanismo;
2. reconstruir con identidad propia;
3. aplicar un objetivo interno de mejora aproximada del 25% en claridad, contraste, jerarquía, emoción o adaptación al buyer persona;
4. validar con resultados propios.

## Campos futuros sugeridos

- categoria_miniatura
- mecanismo_visual
- texto_miniatura
- usa_rostro
- usa_objeto
- usa_numero
- usa_censura
- contraste_estimado
- relacion_titulo_miniatura
- referencia_probada
- variante_a_b_c
- ctr_observado
- impresiones
- watch_time
- fecha_observacion

## Guardrails

- El 25% es un objetivo interno de mejora, no una métrica objetiva automática.
- CTR debe interpretarse con impresiones, tráfico, antigüedad y watch time.
- No inferir que una miniatura causa por sí sola el rendimiento del video.
- No copiar miniaturas de terceros literalmente.
- Mantener separación entre observación, hipótesis y validación.
