import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import type { ApiResponse } from '../types';

const router = Router();

/**
 * Función auxiliar para generar un código alfanumérico aleatorio
 */
function generarCodigoHex(lenght: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < lenght; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * POST /api/vinculos/generar-codigo
 * Genera un código de acceso para un agricultor
 */
router.post('/generar-codigo', async (req: AuthenticatedRequest, res: Response<ApiResponse<{codigo: string}>>) => {
  try {
    const userId = req.userId!;

    // Verificar que sea agricultor
    const { data: perfil } = await supabaseAdmin.from('perfiles').select('rol').eq('id', userId).single();
    if (perfil?.rol !== 'agricultor') {
      res.status(403).json({ success: false, error: 'Solo los agricultores pueden generar códigos de acceso.' });
      return;
    }

    const codigo = generarCodigoHex(6);
    // Expira en 24 horas
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error } = await supabaseAdmin.from('codigos_acceso').insert({
      agricultor_id: userId,
      codigo,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      res.status(500).json({ success: false, error: 'No se pudo generar el código.' });
      return;
    }

    res.json({ success: true, data: { codigo } });
  } catch (err) {
    console.error('Error al generar código:', err);
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
});

/**
 * POST /api/vinculos/vincular
 * Un técnico introduce un código para vincular a un agricultor
 */
router.post('/vincular', async (req: AuthenticatedRequest, res: Response<ApiResponse<{agricultorNombre: string}>>) => {
  try {
    const tecnicoId = req.userId!;
    const { codigo } = req.body;

    if (!codigo) {
      res.status(400).json({ success: false, error: 'Código requerido.' });
      return;
    }

    // Verificar que sea técnico
    const { data: perfilTec } = await supabaseAdmin.from('perfiles').select('rol').eq('id', tecnicoId).single();
    if (perfilTec?.rol !== 'tecnico') {
      res.status(403).json({ success: false, error: 'Solo los técnicos pueden vincular agricultores.' });
      return;
    }

    // Buscar código
    const { data: codigoData, error: codigoErr } = await supabaseAdmin
      .from('codigos_acceso')
      .select('*, perfiles(nombre)')
      .eq('codigo', codigo.toUpperCase())
      .eq('is_used', false)
      .single();

    if (codigoErr || !codigoData) {
      res.status(400).json({ success: false, error: 'Código inválido o ya utilizado.' });
      return;
    }

    if (new Date(codigoData.expires_at) < new Date()) {
      res.status(400).json({ success: false, error: 'El código ha expirado.' });
      return;
    }

    const agricultorId = codigoData.agricultor_id;

    // Crear vinculación
    const { error: vinculoErr } = await supabaseAdmin.from('vinculos_tecnico_agricultor').upsert({
      tecnico_id: tecnicoId,
      agricultor_id: agricultorId,
      estado: 'activo'
    }, { onConflict: 'tecnico_id, agricultor_id' });

    if (vinculoErr) {
      res.status(500).json({ success: false, error: 'Error al crear la vinculación.' });
      return;
    }

    // Marcar código como usado
    await supabaseAdmin.from('codigos_acceso').update({ is_used: true }).eq('id', codigoData.id);

    res.json({ success: true, data: { agricultorNombre: codigoData.perfiles?.nombre || 'Agricultor' } });
  } catch (err) {
    console.error('Error al vincular:', err);
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
});

/**
 * GET /api/vinculos/agricultores
 * Un técnico obtiene la lista de sus agricultores vinculados
 */
router.get('/agricultores', async (req: AuthenticatedRequest, res: Response<ApiResponse<any[]>>) => {
  try {
    const tecnicoId = req.userId!;
    
    const { data, error } = await supabaseAdmin
      .from('vinculos_tecnico_agricultor')
      .select('agricultor_id, perfiles(nombre, email, finca_principal, ubicacion)')
      .eq('tecnico_id', tecnicoId)
      .eq('estado', 'activo');

    if (error) {
      res.status(500).json({ success: false, error: 'Error al obtener agricultores.' });
      return;
    }

    const agricultores = data.map((v: any) => ({
      id: v.agricultor_id,
      nombre: v.perfiles?.nombre,
      email: v.perfiles?.email,
      finca: v.perfiles?.finca_principal,
      ubicacion: v.perfiles?.ubicacion,
    }));

    res.json({ success: true, data: agricultores });
  } catch (err) {
    console.error('Error al obtener vinculados:', err);
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
});

/**
 * DELETE /api/vinculos/revocar/:agricultorId
 * Revoca el acceso a un técnico (puede hacerlo el agricultor o el técnico)
 */
router.delete('/revocar/:id', async (req: AuthenticatedRequest, res: Response<ApiResponse<void>>) => {
  try {
    const userId = req.userId!;
    const targetId = req.params.id; // Puede ser el agricultor o el tecnico

    // Buscamos si hay un vinculo donde el usuario actual sea o tecnico o agricultor
    const { error } = await supabaseAdmin
      .from('vinculos_tecnico_agricultor')
      .update({ estado: 'revocado' })
      .or(`and(tecnico_id.eq.${userId},agricultor_id.eq.${targetId}),and(agricultor_id.eq.${userId},tecnico_id.eq.${targetId})`);

    if (error) {
      res.status(500).json({ success: false, error: 'No se pudo revocar la vinculación.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
});

export default router;
