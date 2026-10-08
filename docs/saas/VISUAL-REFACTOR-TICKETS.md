# ADYTR v0.06 — Backlog de refactor visual

Cada ticket debe ejecutarse de forma independiente y reversible.

## Ticket 01 — Limpieza global de lenguaje interno
Estado: **completado localmente / integración remota pendiente al crear este documento**.

Eliminar o sustituir copy visible sobre:
- ESPACIO PRIVADO
- API v3
- protección de claves
- procesamiento en servidor
- costes/unidades API
- consultas agrupadas
- /c/
- fase posterior
- reutilización de análisis
- versiones visibles tipo V0.02
- notas de desarrollo/arquitectura

No tocar layout general ni lógica.

---

## Ticket 02 — Research / estado inicial
Objetivo: convertir la búsqueda principal en una experiencia de exploración de oportunidad.

Cambios:
- mantener el concepto del hero;
- eyebrow orientado a inteligencia de oportunidad;
- “Configura tu búsqueda” → “Explora una oportunidad”;
- CTA orientado a “Analizar oportunidad”;
- conservar todos los filtros y defaults;
- estado vacío que explique Demanda / Competencia / Patrones.

No cambiar request shape, filtros ni número de resultados.

---

## Ticket 03 — Competencia / estado inicial
Objetivo: que el usuario comprenda qué obtendrá antes de analizar.

Cambios:
- mantener “Analizar competencia”;
- “Canal de referencia” → “Canal a analizar”;
- simplificar placeholder;
- eliminar notas técnicas;
- estado vacío con Rendimiento / Videos ganadores / Patrones detectados.

---

## Ticket 04 — Competencia / cabecera + overview
Objetivo: primera capa de lectura antes de la tabla.

Añadir:
- cabecera compacta con avatar/nombre/canal;
- overview con 4–6 métricas ya existentes.

No inventar scores ni fórmulas.

---

## Ticket 05 — Competencia / videos ganadores
Objetivo: convertir winners en una pieza visual protagonista.

Mantener:
- thumbnail;
- título;
- views;
- evidencia de winner.

Mejorar:
- badges cortos;
- tooltip/detalle con cifra exacta;
- hover con fecha/duración/Views-Median/enlace.

No crear Winner Score si no existe legítimamente.

---

## Ticket 06 — Competencia / tabla de videos
Objetivo: reducir densidad inicial sin perder datos.

Cambios:
- “Todos los videos”;
- mostrar 10–15 inicialmente;
- “Ver los 50”;
- filtros de presentación.

La muestra analizada no cambia.

---

## Ticket 07 — Competencia / navegación interna
Objetivo: eliminar sensación de reporte infinito.

Navegación sugerida:
Overview | Videos | Winners | Patterns | Signals

Agrupar profundidad en tabs/acordeones sin eliminar métricas.

---

## Ticket 08 — Competencia / conclusiones
Objetivo: cerrar el análisis con interpretación basada únicamente en evidencia existente.

Secciones:
- qué funciona;
- patrones recurrentes;
- señal fuerte;
- riesgos/limitaciones;
- siguiente acción.

No añadir IA generativa nueva.

---

## Ticket 09 — Patrones / estado inicial
Objetivo: explicar la promesa del módulo sin lenguaje técnico.

Mantener:
- Patrones ganadores;
- Inteligencia de patrones.

Cambiar:
- “Canal de referencia” → “Canal a analizar”;
- retirar notas de costes/reutilización/arquitectura;
- estado vacío con Temas / Intenciones / Estructuras / Duración / Señales repetidas.

---

## Ticket 10 — Patrones / resumen de resultados
Objetivo: responder primero “¿qué se repite cuando este canal gana?”.

Mostrar resumen derivado de datos reales:
- X patrones;
- Y winners.

Priorizar cards sobre tabla plana.

---

## Ticket 11 — Patrones / cards y estados
Cada card puede incluir:
- nombre corto;
- consolidated / promising / emerging;
- supporting videos;
- winners;
- Views/Median;
- Lift;
- duración.

No cambiar clasificación ni thresholds.

---

## Ticket 12 — Patrones / evidencia progresiva
Añadir “Ver evidencia”.

Expandir:
- topics;
- intents;
- pains;
- benefits;
- contexts;
- entities;
- title structures;
- recurring phrases;
- supporting videos;
- métricas.

No confundir correlación con causalidad.

---

## Ticket 13 — Header / navegación SaaS provisional
Preparar estructura para:
Research | Competitors | Patterns | Projects

Zona futura:
cuenta / créditos

No inventar logo final ni auth falsa.

---

## Ticket 14 — Responsive + accesibilidad
Revisar desktop/tablet/mobile.

Mantener:
- focus visible;
- labels;
- teclado;
- aria;
- contraste;
- scroll controlado para tablas;
- acceso a información crítica en móvil.

---

## Ticket 15 — Gate de regresión
Sin cambios de UI.

Ejecutar:
- typecheck;
- build;
- competitor regression;
- winning patterns regression.

Bloquear avance si cambia inteligencia sin aprobación.

---

## Orden recomendado
01 → 02 → 03 → 09 → 04 → 05 → 06 → 07 → 08 → 10 → 11 → 12 → 13 → 14 → 15

## Regla de ejecución
**Un ticket = un objetivo principal = un commit reversible.**
