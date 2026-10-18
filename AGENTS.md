# Reglas del Proyecto — Notas Quickss

## 1. Minimalismo Visual y Cero Ruido de Texto
- **Menú de Inicio y Tarjetas Limpias**: Nunca saturar las vistas con párrafos explicativos ni subtítulos largos.
- **Fórmula por Tarjeta**: `Icono SVG` + `Título corto` + `Métrica / Estado en 1 línea`.
- **Alineación Estricta**: Todas las tarjetas dentro de un `grid` deben usar alturas uniformes (`h-full flex flex-col justify-between`), espaciados idénticos y `truncate` en textos dinámicos para que nunca se descuadre la cuadrícula en móvil ni en escritorio.

## 2. Estándares UI/UX
- **Diseño**: Glassmorphism-Minimalism en paleta morada oscura (`#09070f`, `#7c3aed`, `#8b5cf6`).
- **Cero Emojis en la UI**: Usar únicamente iconos vectoriales **Lucide SVG** (excepto en el texto copiable de **Daily Chat** que lleva `✅ Ayer:`, `🎯 Hoy:`, `🚧 Bloqueante:` para pegar en mensajería).
- **Cero Controles Nativos del Navegador**: Usar siempre dropdowns, switches y steppers personalizados en Tailwind CSS.


## Git Branching & Environments

| Branch | Purpose | Data |
|---|---|---|
| `development` | Active development and testing (run locally on `localhost`) | Mock/demo data + `DEV` badge |
| `main` | Production, deployed to GitHub Pages (`https://balmes2baxter.github.io/Quickss_notes/`) | Clean start, no mock data, demo buttons hidden |

- All new work is committed to `development` first.
- Only merge `development` → `main` when a feature is tested and ready for users.
- The environment is detected automatically in `app.js` (`APP_ENV`): `localhost` = development, any other host = production. Force it with `?env=development` or `?env=production`.
- Production uses its own localStorage namespace (`quickss_prod_*`) and Supabase workspace row (`main_workspace`); development uses `quickss_*` and `dev_workspace`, so test data never leaks into production.
