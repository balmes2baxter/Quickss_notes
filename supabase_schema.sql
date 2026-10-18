-- ============================================================================
-- ESQUEMA DE PRODUCCIÓN EN SUPABASE (PostgreSQL + Realtime)
-- Proyecto: Notas Quickss — Centro Operativo (Brigadas, Daily Chat, Tareas, Bitácora)
-- ============================================================================

-- 1. Tabla Unificada de Sincronización en Tiempo Real (Todos los módulos)
CREATE TABLE IF NOT EXISTS public.quickss_workspace_state (
    id TEXT PRIMARY KEY DEFAULT 'main_workspace',
    users JSONB DEFAULT '[]'::jsonb NOT NULL,
    visits JSONB DEFAULT '[]'::jsonb NOT NULL,
    dailies JSONB DEFAULT '[]'::jsonb NOT NULL,
    tasks JSONB DEFAULT '[]'::jsonb NOT NULL,
    warnings JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.quickss_workspace_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura global workspace" ON public.quickss_workspace_state;
CREATE POLICY "Permitir lectura global workspace"
    ON public.quickss_workspace_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion global workspace" ON public.quickss_workspace_state;
CREATE POLICY "Permitir insercion global workspace"
    ON public.quickss_workspace_state FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion global workspace" ON public.quickss_workspace_state;
CREATE POLICY "Permitir actualizacion global workspace"
    ON public.quickss_workspace_state FOR UPDATE USING (true);

-- 2. Tabla de Sesiones / Check-in Diario de Brigada
CREATE TABLE IF NOT EXISTS public.sesiones_brigada (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    brigadista_id TEXT NOT NULL,
    brigadista_nombre TEXT NOT NULL,
    zona TEXT DEFAULT 'General',
    tiene_carnet BOOLEAN DEFAULT true NOT NULL,
    tiene_tarjetas BOOLEAN DEFAULT true NOT NULL,
    tiene_folletos BOOLEAN DEFAULT true NOT NULL,
    meta_diaria INTEGER DEFAULT 12 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Tabla Analítica de Acercamientos / Visitas a Negocios en Terreno
CREATE TABLE IF NOT EXISTS public.acercamientos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sesion_id TEXT,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    hora TEXT NOT NULL,
    brigadista_id TEXT NOT NULL,
    brigadista_nombre TEXT NOT NULL,
    tenia_carnet BOOLEAN DEFAULT true NOT NULL,
    tenia_tarjetas BOOLEAN DEFAULT true NOT NULL,
    tenia_folletos BOOLEAN DEFAULT true NOT NULL,
    zona TEXT,
    negocio_nombre TEXT NOT NULL,
    negocio_rubro TEXT DEFAULT 'Comercio',
    direccion TEXT NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    interlocutor TEXT DEFAULT 'Encargado',
    material_entregado TEXT[] DEFAULT '{}',
    resultado TEXT NOT NULL,
    motivo_estado TEXT,
    condiciones_notas TEXT,
    contacto_nombre TEXT,
    contacto_telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.sesiones_brigada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acercamientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de sesiones a todos" ON public.sesiones_brigada;
CREATE POLICY "Permitir lectura de sesiones a todos" ON public.sesiones_brigada FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insertar sesiones a todos" ON public.sesiones_brigada;
CREATE POLICY "Permitir insertar sesiones a todos" ON public.sesiones_brigada FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar sesiones a todos" ON public.sesiones_brigada;
CREATE POLICY "Permitir actualizar sesiones a todos" ON public.sesiones_brigada FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir lectura de acercamientos a todos" ON public.acercamientos;
CREATE POLICY "Permitir lectura de acercamientos a todos" ON public.acercamientos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insertar acercamientos a todos" ON public.acercamientos;
CREATE POLICY "Permitir insertar acercamientos a todos" ON public.acercamientos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminar acercamientos a todos" ON public.acercamientos;
CREATE POLICY "Permitir eliminar acercamientos a todos" ON public.acercamientos FOR DELETE USING (true);
