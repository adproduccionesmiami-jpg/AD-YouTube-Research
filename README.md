# AD Investigación YouTube (ADYR)

Herramienta interna para investigar videos y canales públicos de YouTube. La interfaz está en español y consulta datos reales mediante YouTube Data API v3.

> Regla de nomenclatura: nombres visibles de módulos, reportes, commits y documentación nueva en español y reconocibles para el usuario. Identificadores técnicos internos pueden mantenerse si cambiarlos rompe compatibilidad.

## Requisitos

- Node.js 20.9 o superior.
- Una clave activa de YouTube Data API v3 y la API habilitada en el proyecto de Google Cloud asociado.

## CONFIGURACIÓN LOCAL

Crear un archivo:

`.env.local`

en la raíz del proyecto y añadir:

`YOUTUBE_API_KEY=tu_clave_real`

Después ejecutar:

`npm install`

`npm run dev`

Abrir `http://localhost:3000`.

El archivo `.env.example` contiene el nombre de variable requerido, sin ningún valor. `.env.local` y los archivos `.env*.local` están excluidos de Git. No pegues la clave en el código, en el chat ni en archivos que se vayan a publicar.

## Despliegue en Vercel

En el proyecto de Vercel, abre **Settings → Environment Variables** y crea una variable llamada `YOUTUBE_API_KEY` con el valor de la clave. Selecciona los entornos donde se usará y vuelve a desplegar. El código no necesita cambios: la variable se lee exclusivamente en el servidor.

## Arquitectura de la clave y las solicitudes

El navegador envía los criterios a `/api/youtube/research`, un Route Handler del servidor de Next.js. El servidor lee `process.env.YOUTUBE_API_KEY`, consulta YouTube Data API v3 y devuelve los datos procesados. No existe una variable `NEXT_PUBLIC_*` para la clave ni una llamada del navegador directamente a YouTube.

Si falta la variable, el endpoint devuelve un error controlado en español. También traduce errores de clave inválida, API deshabilitada y cuota agotada. Las respuestas no incluyen el valor de la clave ni los mensajes sin filtrar de Google.

## Alcance de v0.01

- Búsqueda real de videos con tema, palabras clave, idioma, fecha y máximo de resultados.
- Enriquecimiento con estadísticas públicas del video y del canal.
- Relación vistas/suscriptores y clasificación de duración.
- Sin cuentas, persistencia, base de datos, exportaciones ni paginación avanzada.

## Alcance de v0.02 — Filtros de oportunidad

- Periodos de publicación: cualquier fecha, últimos 7, 30 o 90 días, últimos 12 meses o una fecha personalizada.
- Rangos opcionales de vistas, suscriptores y relación Vistas/Subs. Los datos ocultos o no disponibles no cumplen un rango activo.
- Duración por categorías: corto (<4 min), medio (4–20 min, inclusive), largo (>20 min) o rango personalizado en minutos. Las categorías describen duración y no identifican Shorts.
- Orden por relevancia, vistas, fecha de publicación o relación Vistas/Subs; los valores ausentes quedan al final en los órdenes numéricos y por fecha.
- Con filtros posteriores a la búsqueda, se recupera un máximo de 50 candidatos en una sola búsqueda, se enriquecen y filtran en el servidor y se devuelven hasta el máximo elegido. El contador refleja solo los videos válidos devueltos.

## Próxima evolución — v0.05 · Inteligencia de Oportunidad

La especificación metodológica de la siguiente capa vive en:

`docs/v0.05-inteligencia-de-oportunidad.md`

v0.05 debe añadir de forma aislada y reversible:
- Valor Económico de la Audiencia;
- Complejidad de Producción;
- Intensidad de Necesidad;
- Intención del Espectador;
- Potencial de Monetización Extendida;
- clasificación Viral Primero / Monetización Primero / Híbrida.

Estas dimensiones no reemplazan outliers, Vistas/Suscriptores, Vistas/Mediana, Vistas/Día, winners, recencia, clusters ni Patrones Ganadores.
