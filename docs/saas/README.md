# ADYTR SaaS — Estado y mapa de trabajo

## Objetivo
Convertir ADYTR de herramienta interna a SaaS comercial sin modificar la inteligencia validada.

## Secuencia de versiones
- v0.04.1 — motor interno estable / patrones ganadores.
- v0.05 — inteligencia de oportunidad.
- v0.06 — Accounts & SaaS Foundation + transición visual comercial.
- v0.07 — billing / Hotmart.
- v0.08 — private beta hardening.
- v1.0 — commercial launch candidate.

## Ramas relevantes
- `feature/v0.04-patrones-ganadores` — congelada.
- `feature/v0.05-inteligencia-oportunidad` — baseline funcional previa al SaaS.
- `feature/v0.06-saas-foundation` — rama de implementación SaaS.
- `docs/v0.06-saas-spec` — especificación y control documental de esta fase.

## SHA relevantes
- v0.04.1 estable: `3815444993efb39f5b8e9a99aa09616f8a04d3c5`
- v0.05 baseline: `0fe23d88013168be2a9ffe49d49df0fc1962ff32`
- v0.06 foundation remoto actual al crear esta documentación: `2e83479a7d85140204a482fb536ba65a30917f36`
- Ticket 01 reaplicado localmente por Codex: `5d7c07ee7db332e86e9ba590429a52256ed50863` (push pendiente en el momento de esta documentación).

## Principio rector
**No simplificar el producto. Simplificar la comprensión del producto.**

## Estado actual
- Base SaaS preparada con contrato de variables Supabase.
- Ticket 01 de limpieza de copy interno completado localmente y validado por Codex.
- Validaciones reportadas por Codex: typecheck OK; competitor-analysis OK; winning-patterns OK; build webpack OK.
- Build Turbopack no concluyente por limitación de proceso auxiliar del entorno.
- No se debe iniciar Ticket 02 hasta que el Ticket 01 quede integrado de forma segura en la rama remota.

## Orden general de trabajo
1. Cerrar e integrar Ticket 01.
2. Research — estado inicial.
3. Competencia — estado inicial.
4. Patrones — estado inicial.
5. Competencia — resultados.
6. Patrones — resultados.
7. Navegación interna y progressive disclosure.
8. Responsive y accesibilidad.
9. Auth: Sign Up / Login / Reset / Verify.
10. Dashboard / Projects / Usage.
11. Branding definitivo ADYTR.
12. Landing pública.
13. Billing / Hotmart.
