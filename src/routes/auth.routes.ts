import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import type { LoginDTO, RegisterDTO, ApiResponse, AuthResponse } from '../types';

const router = Router();

/**
 * POST /api/auth/login
 * Inicia sesión con email y contraseña.
 */
router.post('/login', async (req, res: Response<ApiResponse<AuthResponse>>) => {
  try {
    const { email, password } = req.body as LoginDTO;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos.',
      });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let msg = 'No se pudo iniciar sesión.';
      if (error.message.includes('Invalid login credentials')) {
        msg = 'Correo o contraseña incorrectos.';
      } else if (error.message.includes('Email not confirmed')) {
        msg = 'Confirma tu correo electrónico antes de iniciar sesión.';
      }
      res.status(401).json({ success: false, error: msg });
      return;
    }

    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email || '',
        },
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/auth/register
 * Registra un nuevo usuario con rol (agricultor o técnico).
 */
router.post('/register', async (req, res: Response<ApiResponse<AuthResponse>>) => {
  try {
    const { email, password, nombre, rol } = req.body as RegisterDTO;

    if (!email || !password || !nombre || !rol) {
      res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos: email, password, nombre, rol.',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }

    if (rol !== 'agricultor' && rol !== 'tecnico') {
      res.status(400).json({
        success: false,
        error: 'El rol debe ser "agricultor" o "tecnico".',
      });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, rol },
      },
    });

    if (error) {
      console.error('❌ Error de Supabase al registrar:', error);
      let msg = 'No se pudo crear la cuenta.';
      if (error.message.includes('already registered')) {
        msg = 'Este correo ya está registrado. Intenta iniciar sesión.';
      }
      res.status(400).json({ success: false, error: msg });
      return;
    }

    console.log('✅ Registro exitoso en Supabase:', data);

    if (!data.session) {
      // Requiere confirmación de email
      res.json({
        success: true,
        message: 'Cuenta creada. Revisa tu correo para confirmar el registro.',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user!.id,
          email: data.user!.email || '',
        },
      },
    });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/auth/refresh
 * Renueva el access token usando el refresh token.
 */
router.post('/refresh', async (req, res: Response<ApiResponse<AuthResponse>>) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token es requerido.',
      });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      res.status(401).json({
        success: false,
        error: 'No se pudo renovar la sesión. Inicia sesión nuevamente.',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user!.id,
          email: data.user!.email || '',
        },
      },
    });
  } catch (err) {
    console.error('Error en refresh:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

export default router;
