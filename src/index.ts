import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar rutas
import analisisRoutes from './routes/analisis.routes';

// Importar middleware
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// Middlewares globales
// ============================================================

// Seguridad HTTP
app.use(helmet());

// CORS — permite orígenes de Expo dev y producción
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (apps mobile, Postman, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} no permitido por CORS`));
    },
    credentials: true,
  })
);

// Parsear JSON (límite de 15MB para soportar imágenes base64 si es necesario)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Logging de peticiones
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================================
// Health check (público)
// ============================================================

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: '🥔 PMP Smart API funcionando correctamente.',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ============================================================
// Rutas
// ============================================================

app.use('/api/analisis', authMiddleware, analisisRoutes);

// ============================================================
// Manejo de errores global
// ============================================================

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error no manejado:', err.message);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor.',
  });
});

// Ruta 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada.',
  });
});

// ============================================================
// Iniciar servidor
// ============================================================

app.listen(PORT, () => {
  console.log('');
  console.log('🥔 ═══════════════════════════════════════════');
  console.log(`   PMP Smart API v1.0.0`);
  console.log(`   Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log('═══════════════════════════════════════════ 🥔');
  console.log('');
});

export default app;
