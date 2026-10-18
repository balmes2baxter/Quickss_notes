---
trigger: always_on
description: Regla de desarrollo UI/UX para Notas Quickss — Minimalismo visual, cero saturación de texto y alineación estricta en grillas.
---

# Regla de Desarrollo: Minimalismo, Simplicidad y Alineación Estricta

1. **Cero Saturación de Texto (No Text Bloat):**
   - Prohibido incluir párrafos descriptivos o textos de relleno en menús de inicio, tarjetas de módulos o encabezados.
   - Cada tarjeta interactiva debe contener únicamente **3 elementos**: **Icono SVG + Título corto (1-2 palabras) + Dato/Estado puntual (1 línea)**.
2. **Alineación y Simetría Estricta:**
   - Usar grillas simétricas (`grid-cols-2`, `grid-cols-4`, `items-stretch`) donde todas las tarjetas de una misma fila tengan exactamente la misma altura (`h-full flex flex-col justify-between`) y el mismo `padding`.
   - Mantener títulos y metadatos en una sola línea (`truncate`) para evitar que una tarjeta crezca más que su vecina.
3. **Componentes 100% Tailwind & Iconos SVG:**
   - Usar exclusivamente iconos vectoriales **Lucide SVG** (cero emojis) y componentes estilizados en Tailwind CSS (cero `<select>`, `<input type="checkbox">` o `prompt()` nativos).
