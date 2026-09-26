import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import type { ApiResponse, Cultivo, CreateCultivoDTO, UpdateCultivoDTO } from '../types';

const router = Router();

/** Mapear row de Supabase a interfaz Cultivo */
function mapCultivo(row: any): Cultivo {
  return {
    id: row.id,
    nombre: row.nombre,
    variedad: row.variedad,
    hectareas: Number(row.hectareas),
    ubicacion: row.ubicacion || '',
    fechaSiembra: row.fecha_siembra || '',
    estadoFitosanitario: row.estado_fitosanitario || 'optimo',
    analisisCount: row.analisis_count || 0,
    ultimaRevision: row.ultima_revision || 'Sin revisar',
  };
}

/**
 * GET /api/cultivos
 * Lista todos los cultivos del usuario autenticado.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<Cultivo[]>>) => {
  try {
    const userId = req.userId!;
    const agricultorId = req.query.agricultor_id as string;
    let targetId = userId;

    if (agricultorId) {
      // Verificar vinculación
      const { data: link } = await supabaseAdmin
        .from('vinculos_tecnico_agricultor')
        .select('*')
        .eq('tecnico_id', userId)
        .eq('agricultor_id', agricultorId)
        .eq('estado', 'activo')
        .single();
      
      if (!link) {
        res.status(403).json({ success: false, error: 'No tienes acceso a este agricultor.' });
        return;
      }
      targetId = agricultorId;
    }

    const { data, error } = await supabaseAdmin
      .from('cultivos')
      .select('*')
      .eq('usuario_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({
      success: true,
      data: (data || []).map(mapCultivo),
    });
  } catch (err) {
    console.error('Error al listar cultivos:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/cultivos
 * Crea un nuevo cultivo/parcela.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<Cultivo>>) => {
  try {
    const userId = req.userId!;
    const body = req.body as CreateCultivoDTO;

    if (!body.nombre || !body.variedad) {
      res.status(400).json({
        success: false,
        error: 'Nombre y variedad son requeridos.',
      });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('cultivos')
      .insert({
        usuario_id: userId,
        nombre: body.nombre,
        variedad: body.variedad,
        hectareas: body.hectareas || 1.0,
        ubicacion: body.ubicacion || '',
        fecha_siembra: body.fechaSiembra || '',
        estado_fitosanitario: body.estadoFitosanitario || 'optimo',
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.status(201).json({
      success: true,
      data: mapCultivo(data),
    });
  } catch (err) {
    console.error('Error al crear cultivo:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/cultivos/:id
 * Actualiza un cultivo existente.
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response<ApiResponse<Cultivo>>) => {
  try {
    const userId = req.userId!;
    const cultivoId = req.params.id;
    const body = req.body as UpdateCultivoDTO;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.variedad !== undefined) updateData.variedad = body.variedad;
    if (body.hectareas !== undefined) updateData.hectareas = body.hectareas;
    if (body.ubicacion !== undefined) updateData.ubicacion = body.ubicacion;
    if (body.fechaSiembra !== undefined) updateData.fecha_siembra = body.fechaSiembra;
    if (body.estadoFitosanitario !== undefined) updateData.estado_fitosanitario = body.estadoFitosanitario;
    if (body.analisisCount !== undefined) updateData.analisis_count = body.analisisCount;
    if (body.ultimaRevision !== undefined) updateData.ultima_revision = body.ultimaRevision;

    const { data, error } = await supabaseAdmin
      .from('cultivos')
      .update(updateData)
      .eq('id', cultivoId)
      .eq('usuario_id', userId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({
      success: true,
      data: mapCultivo(data),
    });
  } catch (err) {
    console.error('Error al actualizar cultivo:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/cultivos/:id
 * Elimina un cultivo del usuario.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.userId!;
    const cultivoId = req.params.id;

    const { error } = await supabaseAdmin
      .from('cultivos')
      .delete()
      .eq('id', cultivoId)
      .eq('usuario_id', userId);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Cultivo eliminado.' });
  } catch (err) {
    console.error('Error al eliminar cultivo:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

export default router;
