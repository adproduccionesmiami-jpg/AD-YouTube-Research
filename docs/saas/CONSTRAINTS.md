# ADYTR v0.06 — Contrato de no regresión

## Regla absoluta
Esta fase cambia presentación, jerarquía, copy y experiencia de usuario. No redefine la inteligencia.

## NO TOCAR
- algoritmos;
- fórmulas;
- rankings;
- winner detection;
- thresholds;
- Views/Median;
- Views/Subs;
- Views/Day;
- Lift;
- winner share;
- `supportingVideoCount`;
- `winnerCount`;
- lógica semántica;
- clusters;
- taxonomía;
- patrones ganadores;
- filtros de oportunidad;
- lógica de idioma;
- comportamiento funcional de API;
- número real de resultados;
- secretos;
- `YOUTUBE_API_KEY`;
- endpoints existentes salvo adaptación estrictamente necesaria de presentación.

## Archivos lógicamente congelados
No alterar cálculos en:
- `src/lib/competitor-analysis.ts`
- `src/lib/winning-patterns.ts`
- `src/lib/opportunity-filters.ts`
- `src/lib/language-filter.ts`
- `src/lib/winning-pattern-presentation.ts`

No redefinir métricas en:
- `src/types/competitor.ts`
- `src/types/winning-patterns.ts`
- `src/types/research.ts`

Si un ticket parece requerir tocar uno de estos archivos, detenerse y reportarlo antes de modificarlo.

## Principios visuales congelados
Mantener:
- blanco / gris muy claro;
- negro / gris oscuro;
- rojo como acento principal;
- cards limpias;
- bordes suaves;
- sombras discretas;
- thumbnails reales de YouTube;
- avatars y datos de canal;
- asociación visual con YouTube sin copiar su UI ni su branding oficial.

## No inventar todavía
- logo definitivo;
- nueva métrica;
- nuevo score;
- nuevos thresholds;
- nuevo algoritmo;
- recomendaciones generativas;
- billing;
- créditos comerciales definitivos;
- Hotmart;
- equipos/agencias.

## Regresión obligatoria
Antes de aprobar cambios relevantes:
- `npm run typecheck`
- `npm run test:competitor-analysis`
- `npm run test:winning-patterns`
- `npm run build` o, si Turbopack falla por entorno, `npm run build -- --webpack` documentando la limitación.

Un cambio visual no se aprueba si altera resultados analíticos.
