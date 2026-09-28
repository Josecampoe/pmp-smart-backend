import { Router, Response } from 'express';
import multer from 'multer';
import { AuthenticatedRequest } from '../middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Multer para recibir imágenes en memoria
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

router.post('/procesar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ success: false, error: 'No se envió ninguna imagen (base64) para analizar.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY no encontrada. Devolviendo error.');
      res.status(500).json({ success: false, error: 'GEMINI_API_KEY no configurada. Por favor, configura la clave de API para procesar imágenes.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let cleanBase64 = imageBase64;
    let mimeType = 'image/jpeg';
    
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType
      },
    };

    const prompt = `
    Eres un agrónomo experto en patología vegetal de la papa. Analiza la siguiente imagen.
    Busca signos visuales de "Punta Morada de la Papa" (PMP).
    Devuelve estrictamente un JSON válido con esta estructura exacta (no uses markdown ni texto adicional):
    {
      "diagnostico": "Posible PMP" o "Sano" o "PMP Severo" o "Deficiencia Nutricional",
      "estado": "alerta" o "sano" o "observacion",
      "severidad": "baja" o "moderada" o "alta" o "ninguna",
      "confianza": 95,
      "sintomas": ["sintoma 1", "sintoma 2"],
      "recomendaciones": ["recomendacion 1", "recomendacion 2"]
    }`;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No se pudo extraer JSON de la respuesta de IA.");
    
    const parsedData = JSON.parse(jsonMatch[0]);

    res.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error('Error procesando imagen con IA:', err.message);
    res.status(500).json({ success: false, error: 'Error procesando la imagen con IA.' });
  }
});

export default router;
