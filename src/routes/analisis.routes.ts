import { Router, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import type { ApiResponse, Analisis, CreateAnalisisDTO, RevisionTecnica } from '../types';

const router = Router();

// Multer para recibir imágenes en memoria (se suben directo a Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máx
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen.'));
    }
  },
});

/** Formatear fecha actual legible */
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

/** Mapear row de Supabase a interfaz Analisis */
function mapAnalisis(row: any, revision?: RevisionTecnica): Analisis {
  return {
    id: row.id,
    cultivoId: row.cultivo_id || 'lote-general',
    cultivoNombre: row.cultivo_nombre || 'Muestra de Campo',
    fecha: row.fecha || 'Fecha no registrada',
    imageUri: row.image_url || '',
    diagnostico: row.diagnostico || 'Posible PMP',
    estado: row.estado || 'alerta',
    severidad: row.severidad || 'moderada',
    confianza: Number(row.confianza) || 90,
    sintomas: Array.isArray(row.sintomas) ? row.sintomas : [],
    recomendaciones: Array.isArray(row.recomendaciones) ? row.recomendaciones : [],
    notas: row.notas || '',
    estadoRevision: row.estado_revision || 'sin_solicitar',
    revisionTecnica: revision,
  };
}

/**
 * GET /api/analisis
 * Lista todos los análisis del usuario autenticado.
 * Incluye revisiones técnicas si existen.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response<ApiResponse<Analisis[]>>) => {
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

    const { data: analisisData, error } = await supabaseAdmin
      .from('analisis')
      .select('*')
      .eq('usuario_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    if (!analisisData || analisisData.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // Cargar revisiones técnicas para análisis revisados
    const revisadosIds = analisisData
      .filter((a: any) => a.estado_revision === 'revisado')
      .map((a: any) => a.id);

    let revisionesMap: Record<string, RevisionTecnica> = {};

    if (revisadosIds.length > 0) {
      const { data: revData } = await supabaseAdmin
        .from('revisiones_tecnicas')
        .select('*')
        .in('analisis_id', revisadosIds);

      if (revData) {
        for (const rev of revData) {
          revisionesMap[rev.analisis_id] = {
            tecnicoNombre: rev.tecnico_nombre,
            registroProfesional: rev.registro_profesional,
            fechaRevision: rev.fecha_revision,
            diagnosticoValidado: rev.diagnostico_validado,
            observaciones: rev.observaciones || '',
            tratamientoRecomendado: rev.tratamiento_recomendado || '',
          };
        }
      }
    }

    const result = analisisData.map((row: any) => mapAnalisis(row, revisionesMap[row.id]));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error al listar análisis:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/analisis
 * Crea un nuevo análisis. Opcionalmente recibe imagen como archivo multipart.
 *
 * - Si se envía un campo `image` como archivo, se sube a Supabase Storage.
 * - Si se envía `imageUri` como string (URL), se usa directamente.
 */
router.post(
  '/',
  upload.single('image'),
  async (req: AuthenticatedRequest, res: Response<ApiResponse<Analisis>>) => {
    try {
      const userId = req.userId!;
      const body = req.body as CreateAnalisisDTO;

      if (!body.cultivoNombre) {
        res.status(400).json({
          success: false,
          error: 'cultivoNombre es requerido.',
        });
        return;
      }

      let imageUrl = body.imageUri || '';

      // Si se subió un archivo, guardarlo en Supabase Storage
      if (req.file) {
        const fileName = `${userId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('analisis-fotos')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype || 'image/jpeg',
          });

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from('analisis-fotos')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        } else {
          console.warn('Error al subir imagen:', uploadError.message);
        }
      }

      const fecha = formatearFecha();

      const { data, error } = await supabaseAdmin
        .from('analisis')
        .insert({
          usuario_id: userId,
          cultivo_id: body.cultivoId && !body.cultivoId.startsWith('c-') ? body.cultivoId : null,
          cultivo_nombre: body.cultivoNombre,
          fecha,
          image_url: imageUrl,
          diagnostico: body.diagnostico || 'Posible PMP',
          estado: body.estado || 'alerta',
          severidad: body.severidad || 'moderada',
          confianza: body.confianza || 90,
          sintomas: body.sintomas || [],
          recomendaciones: body.recomendaciones || [],
          notas: body.notas || null,
          estado_revision: body.estadoRevision || 'sin_solicitar',
        })
        .select()
        .single();

      if (error) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }

      // Actualizar contadores del cultivo asociado
      if (body.cultivoId && !body.cultivoId.startsWith('c-')) {
        // Actualizar directamente
        const { data: cultivoData } = await supabaseAdmin
          .from('cultivos')
          .select('analisis_count, estado_fitosanitario')
          .eq('id', body.cultivoId)
          .eq('usuario_id', userId)
          .single();

        if (cultivoData) {
          await supabaseAdmin
            .from('cultivos')
            .update({
              analisis_count: (cultivoData.analisis_count || 0) + 1,
              ultima_revision: 'Hoy',
              estado_fitosanitario:
                body.estado === 'alerta'
                  ? 'alerta'
                  : body.estado === 'observacion'
                  ? 'observacion'
                  : cultivoData.estado_fitosanitario,
              updated_at: new Date().toISOString(),
            })
            .eq('id', body.cultivoId)
            .eq('usuario_id', userId);
        }
      }

      res.status(201).json({
        success: true,
        data: mapAnalisis(data),
      });
    } catch (err) {
      console.error('Error al crear análisis:', err);
      res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
  }
);

/**
 * DELETE /api/analisis/:id
 * Elimina un análisis del usuario.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.userId!;
    const analisisId = req.params.id;

    const { error } = await supabaseAdmin
      .from('analisis')
      .delete()
      .eq('id', analisisId)
      .eq('usuario_id', userId);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Análisis eliminado.' });
  } catch (err) {
    console.error('Error al eliminar análisis:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/analisis/:id/solicitar-revision
 * Cambia el estado de revisión a "pendiente" para que un técnico lo revise.
 */
router.put('/:id/solicitar-revision', async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  try {
    const userId = req.userId!;
    const analisisId = req.params.id;

    const { error } = await supabaseAdmin
      .from('analisis')
      .update({ estado_revision: 'pendiente', updated_at: new Date().toISOString() })
      .eq('id', analisisId)
      .eq('usuario_id', userId);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Solicitud de revisión enviada.' });
  } catch (err) {
    console.error('Error al solicitar revisión:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

export default router;
