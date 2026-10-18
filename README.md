# 🚀 BrigadaPro — Aplicación Web de Brigadas Comerciales (100% Gratuita)

Aplicación web diseñada para equipos en calle (Mobile-First) que reemplaza el Excel tradicional por un flujo de **Check-in de Equipamiento** + **Registro Relámpago (< 10 segundos por local)** y **Panel de Análisis de Datos**.

## ✨ Cómo funciona el flujo
1. **Selección / Creación de Cuenta:** Cada brigadista entra con su nombre una sola vez y queda guardado en su celular (la fecha y hora se registran automáticamente en cada visita).
2. **Paso 1 — Check-in Antes de Iniciar la Brigada:**
   * Antes de empezar a anotar locales, la app pregunta una sola vez:
     * 🪪 **¿Tienes el carnet puesto?**
     * 📇 **¿Tienes tarjetas de presentación?**
     * 📄 **¿Tienes folletos / volantes?**
     * 📍 **Zona / Sector** y **Meta del día (12 acercamientos por defecto)**.
3. **Paso 2 — Anotación Súper Rápida en Calle:**
   * **Negocio y Dirección** (con botón de **GPS automático** y detector inteligente que avisa si ese negocio o dirección ya fue abordado antes).
   * **3 caminos rápidos con 1 toque:**
     * 🔥 **¡Muy Interesado!:** Permite marcar o escribir enseguida si el cliente puso **condiciones específicas** (*"Me interesa, pero si tienen estas condiciones..."*) y guardar su WhatsApp/contacto.
     * 🌤️ **Solo Info / "Ya tiene sistema":** Con un toque marca *"Ya tiene sistema, no quiere cambiar"* o *"Solo se entregó información"*, dejando constancia de que a ese negocio y dirección ya se le entregó material.
     * ❄️ **No interesado:** Registro rápido para sumar al objetivo de las 12 visitas del día.
4. **Paso 3 — Análisis Gerencial y Exportación a Excel:**
   * Cruza automáticamente los datos (impacto de hablar con el dueño vs empleado, impacto de llevar el kit completo de carnet + folleto + tarjeta, conteo de negocios que ya tienen sistema vs interesados con condiciones) y descarga todo a **Excel (`.CSV`)**.

---

## ☁️ Cómo ponerla en Producción 100% Gratis ($0)

### Paso A: Base de Datos Gratuita en Supabase (Toma 3 minutos)
1. Entra a [supabase.com](https://supabase.com) y crea una cuenta y proyecto en el plan **Free ($0/mes)**.
2. En el menú izquierdo ve a **SQL Editor**, haz clic en **New Query**, pega todo el contenido del archivo [`supabase_schema.sql`](./supabase_schema.sql) y presiona **Run**.
3. Ve a **Project Settings → API** y copia:
   * `Project URL`
   * `anon public` key
4. Dentro de la app web, toca el botón superior **Modo Local / Nube** y pega ambos datos.

### Paso B: Publicar la Web Gratis en Vercel o Netlify (Toma 2 minutos)
* **Opción más rápida (Drag & Drop):** Entra a [app.netlify.com/drop](https://app.netlify.com/drop) o [vercel.com](https://vercel.com) y arrastra la carpeta `brigada-app`. Te dará un enlace `https://tu-brigada.netlify.app` o `.vercel.app` 100% gratuito para enviar por WhatsApp a todo tu equipo.
