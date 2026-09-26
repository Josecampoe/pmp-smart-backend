import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import type { ApiResponse, PerfilResponse, PerfilAgricultor, PerfilTecnico } from '../types';

const router = Router();

/**
 * GET /api/perfil
 * Obtiene el perfil del usuario autenticado.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<PerfilResponse>>) => {
  try {
    const userId = req.userId!;

    const { data, error } = await supabaseAdmin
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      res.status(404).json({
        success: false,
        error: 'Perfil no encontrado.',
      });
      return;
    }

    const response: PerfilResponse = {
      rol: data.rol,
    };

    if (data.rol === 'agricultor') {
      response.agricultor = {
        nombre: data.nombre || 'Agricultor',
        fincaPrincipal: data.finca_principal || 'Mi Parcela de Papa',
        ubicacion: data.ubicacion || 'Colombia',
        telefono: data.telefono || '',
        email: data.email || '',
        notificaciones: data.notificaciones ?? true,
        modoOffline: data.modo_offline ?? true,
      };
    } else {
      response.tecnico = {
        nombre: data.nombre || 'Técnico Agrónomo',
        registroProfesional: data.registro_profesional || '',
        especialidad: data.especialidad || 'Sanidad Vegetal',
        entidad: data.entidad || '',
        telefono: data.telefono || '',
        email: data.email || '',
        notificaciones: data.notificaciones ?? true,
      };
    }

    res.json({ success: true, data: response });
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/perfil
 * Actualiza el perfil del usuario autenticado.
 * Acepta campos de agricultor o técnico según el rol.
 */
router.put('/', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.userId!;
    const body = req.body as Partial<PerfilAgricultor & PerfilTecnico>;

    // Mapear campos del frontend a columnas de la DB
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.telefono !== undefined) updateData.telefono = body.telefono;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.notificaciones !== undefined) updateData.notificaciones = body.notificaciones;

    // Campos de agricultor
    if (body.fincaPrincipal !== undefined) updateData.finca_principal = body.fincaPrincipal;
    if (body.ubicacion !== undefined) updateData.ubicacion = body.ubicacion;
    if (body.modoOffline !== undefined) updateData.modo_offline = body.modoOffline;

    // Campos de técnico
    if (body.registroProfesional !== undefined) updateData.registro_profesional = body.registroProfesional;
    if (body.especialidad !== undefined) updateData.especialidad = body.especialidad;
    if (body.entidad !== undefined) updateData.entidad = body.entidad;

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      res.status(400).json({
        success: false,
        error: `Error al actualizar perfil: ${error.message}`,
      });
      return;
    }

    res.json({ success: true, message: 'Perfil actualizado correctamente.' });
  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/perfil/rol
 * Cambia el rol activo del usuario.
 */
router.put('/rol', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.userId!;
    const { rol } = req.body as { rol: string };

    if (rol !== 'agricultor' && rol !== 'tecnico') {
      res.status(400).json({
        success: false,
        error: 'El rol debe ser "agricultor" o "tecnico".',
      });
      return;
    }

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({ rol, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      res.status(400).json({
        success: false,
        error: `Error al cambiar rol: ${error.message}`,
      });
      return;
    }

    res.json({ success: true, message: `Rol cambiado a ${rol}.` });
  } catch (err) {
    console.error('Error al cambiar rol:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

export default router;
