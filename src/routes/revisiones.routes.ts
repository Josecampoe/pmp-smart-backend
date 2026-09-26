import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import type { ApiResponse, Analisis, CreateRevisionDTO, RevisionTecnica } from '../types';

const router = Router();

/** Formatear fecha actual */
function formatearFecha(): string {
  const now = new Date();
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const dia = String(now.getDate()).padStart(2, '0');
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();
  const horas = now.getHours();
  const minutos = String(now.getMinutes()).padStart(2, '0');
  const ampm = horas >= 12 ? 'PM' : 'AM';
  const hora12 = horas % 12 || 12;
  return `${dia} ${mes} ${anio} - ${hora12}:${minutos} ${ampm}`;
}

/**
 * GET /api/revisiones/pendientes
 * Lista los análisis con estado "pendiente" para que un técnico los revise.
 * Solo accesible para usuarios con rol "tecnico".
 */
router.get('/pendientes', async (req: AuthenticatedRequest, res: Response<ApiResponse<Analisis[]>>) => {
  try {
    const userId = req.userId!;

    // Verificar que el usuario es técnico
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (!perfil || perfil.rol !== 'tecnico') {
      res.status(403).json({
        success: false,
        error: 'Solo los técnicos pueden ver análisis pendientes de revisión.',
      });
      return;
    }

    // Obtener agricultores vinculados al técnico
    const { data: links } = await supabaseAdmin
      .from('vinculos_tecnico_agricultor')
      .select('agricultor_id')
      .eq('tecnico_id', userId)
      .eq('estado', 'activo');

    const linkedIds = links?.map((l: any) => l.agricultor_id) || [];

    if (linkedIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // Buscar análisis pendientes solo de esos agricultores
    const { data, error } = await supabaseAdmin
      .from('analisis')
      .select('*')
      .in('usuario_id', linkedIds)
      .eq('estado_revision', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    const result = (data || []).map((row: any) => ({
      id: row.id,
      cultivoId: row.cultivo_id || 'lote-general',
      cultivoNombre: row.cultivo_nombre || 'Muestra de Campo',
      fecha: row.fecha || '',
      imageUri: row.image_url || '',
      diagnostico: row.diagnostico || 'Posible PMP',
      estado: row.estado || 'alerta',
      severidad: row.severidad || 'moderada',
      confianza: Number(row.confianza) || 90,
      sintomas: Array.isArray(row.sintomas) ? row.sintomas : [],
      recomendaciones: Array.isArray(row.recomendaciones) ? row.recomendaciones : [],
      notas: row.notas || '',
      estadoRevision: row.estado_revision,
    }));

    res.json({ success: true, data: result as Analisis[] });
  } catch (err) {
    console.error('Error al listar análisis pendientes:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/revisiones/:analisisId
 * Guarda el dictamen técnico de un análisis.
 * Solo accesible para usuarios con rol "tecnico".
 */
router.post('/:analisisId', async (req: AuthenticatedRequest, res: Response<ApiResponse<RevisionTecnica>>) => {
  try {
    const userId = req.userId!;
    const analisisId = req.params.analisisId;
    const body = req.body as CreateRevisionDTO;

    // Verificar que el usuario es técnico
    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .single();

    if (!perfil || perfil.rol !== 'tecnico') {
      res.status(403).json({
        success: false,
        error: 'Solo los técnicos pueden emitir dictámenes.',
      });
      return;
    }

    if (!body.tecnicoNombre || !body.diagnosticoValidado) {
      res.status(400).json({
        success: false,
        error: 'tecnicoNombre y diagnosticoValidado son requeridos.',
      });
      return;
    }

    const fechaRevision = formatearFecha();

    // Insertar revisión técnica
    const { error: revError } = await supabaseAdmin
      .from('revisiones_tecnicas')
      .insert({
        analisis_id: analisisId,
        tecnico_id: userId,
        tecnico_nombre: body.tecnicoNombre,
        registro_profesional: body.registroProfesional || null,
        fecha_revision: fechaRevision,
        diagnostico_validado: body.diagnosticoValidado,
        observaciones: body.observaciones || '',
        tratamiento_recomendado: body.tratamientoRecomendado || '',
      });

    if (revError) {
      res.status(400).json({ success: false, error: revError.message });
      return;
    }

    // Actualizar estado del análisis
    const esAlerta =
      body.diagnosticoValidado === 'PMP Confirmado' ||
      body.diagnosticoValidado === 'Sospecha Moderada';

    await supabaseAdmin
      .from('analisis')
      .update({
        estado_revision: 'revisado',
        estado: esAlerta ? 'alerta' : 'sano',
        updated_at: new Date().toISOString(),
      })
      .eq('id', analisisId);

    const revision: RevisionTecnica = {
      tecnicoNombre: body.tecnicoNombre,
      registroProfesional: body.registroProfesional,
      fechaRevision,
      diagnosticoValidado: body.diagnosticoValidado,
      observaciones: body.observaciones || '',
      tratamientoRecomendado: body.tratamientoRecomendado || '',
    };

    res.status(201).json({ success: true, data: revision });
  } catch (err) {
    console.error('Error al guardar revisión técnica:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

export default router;
