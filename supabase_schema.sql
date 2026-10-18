-- ============================================================================
-- ESQUEMA DE BASE DE DATOS GRATUITA EN SUPABASE (PostgreSQL)
-- Proyecto: Control y Análisis de Brigadas Comerciales
-- ============================================================================

-- 1. Tabla de Sesiones / Check-in Diario de Brigada (Equipamiento inicial)
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

-- 2. Tabla de Acercamientos / Visitas a Negocios en Terreno
CREATE TABLE IF NOT EXISTS public.acercamientos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sesion_id TEXT,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    hora TEXT NOT NULL,
    brigadista_id TEXT NOT NULL,
    brigadista_nombre TEXT NOT NULL,
    
    -- Equipamiento al momento de la visita (heredado del Check-in)
    tenia_carnet BOOLEAN DEFAULT true NOT NULL,
    tenia_tarjetas BOOLEAN DEFAULT true NOT NULL,
    tenia_folletos BOOLEAN DEFAULT true NOT NULL,
    zona TEXT,

    -- Datos del Negocio y Ubicación
    negocio_nombre TEXT NOT NULL,
    negocio_rubro TEXT DEFAULT 'Comercio',
    direccion TEXT NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,

    -- Cómo se abordó el negocio
    interlocutor TEXT DEFAULT 'Encargado', -- 'Dueño / Decisor', 'Administrador / Encargado', 'Empleado / Recepción'
    material_entregado TEXT[] DEFAULT '{}', -- ['Folleto', 'Tarjeta', 'Explicación verbal', 'Demo']

    -- Resultado y Clasificación
    resultado TEXT NOT NULL, -- 'interesado', 'solo_info', 'no_interesado'
    motivo_estado TEXT,      -- Ej: 'Ya tiene sistema', 'Interesado con condiciones', 'Solo recibió info', etc.
    
    -- Condiciones específicas / Notas de lo conversado
    condiciones_notas TEXT,
    
    -- Contacto (para seguimiento comercial)
    contacto_nombre TEXT,
    contacto_telefono TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Habilitar Row Level Security (RLS) con acceso para la app
ALTER TABLE public.sesiones_brigada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acercamientos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura para acceso desde la Web App (Anon Key)
CREATE POLICY "Permitir lectura de sesiones a todos" 
    ON public.sesiones_brigada FOR SELECT USING (true);

CREATE POLICY "Permitir insertar sesiones a todos" 
    ON public.sesiones_brigada FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizar sesiones a todos" 
    ON public.sesiones_brigada FOR UPDATE USING (true);

CREATE POLICY "Permitir lectura de acercamientos a todos" 
    ON public.acercamientos FOR SELECT USING (true);

CREATE POLICY "Permitir insertar acercamientos a todos" 
    ON public.acercamientos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir eliminar acercamientos a todos" 
    ON public.acercamientos FOR DELETE USING (true);
