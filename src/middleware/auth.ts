import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * Extiende Request para incluir datos del usuario autenticado.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/**
 * Middleware que verifica el JWT de Supabase Auth enviado por el frontend.
 *
 * Espera el header: Authorization: Bearer <access_token>
 * Extrae userId y userEmail del token validado.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido. Envía el header Authorization: Bearer <token>',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verificar el token con Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        success: false,
        error: 'Token inválido o expirado. Inicia sesión nuevamente.',
      });
      return;
    }

    // Adjuntar datos del usuario al request
    req.userId = data.user.id;
    req.userEmail = data.user.email;

    next();
  } catch (err) {
    console.error('Error en auth middleware:', err);
    res.status(500).json({
      success: false,
      error: 'Error interno al verificar autenticación.',
    });
  }
}
