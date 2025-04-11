import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

// Setup router
const router = Router();

// Configure environment
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;
// Default image URL als er geen API key is of als de generatie faalt
const DEFAULT_IMAGE_URL = '/images/event-logo.svg';

// Configuratie voor Hugging Face modellen
const HF_MODEL_ID = 'stabilityai/stable-diffusion-xl-base-1.0'; // Goed algemeen model voor evenementen
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`;

/**
 * POST /api/generate-image
 * Genereert een afbeelding met behulp van Hugging Face API
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is vereist' });
    }

    // Check if we have a Hugging Face API key
    if (!HUGGING_FACE_API_KEY) {
      console.warn('Geen Hugging Face API key gevonden, standaard afbeelding wordt geretourneerd');
      return res.json({ 
        imageUrl: DEFAULT_IMAGE_URL,
        message: 'Standaard afbeelding geretourneerd omdat er geen Hugging Face API key is geconfigureerd.'
      });
    }
    
    // Optimaliseer de prompt voor betere resultaten met Stable Diffusion
    const enhancedPrompt = `Fotorealistische afbeelding voor een Nederlands evenement: ${prompt}. Professionele fotografie stijl, levendige kleuren, hoge kwaliteit, gedetailleerd, realistische weergave.`;
    
    console.log('Genereren van afbeelding met Hugging Face, prompt:', enhancedPrompt);
    
    // Hugging Face API parameters
    const parameters = {
      inputs: enhancedPrompt,
      parameters: {
        negative_prompt: "lage kwaliteit, onscherp, wazig, vervormd, onrealistisch, cartoon, tekening, schilderij",
        num_inference_steps: 30,  // Voor betere kwaliteit
        guidance_scale: 7.5,      // Balans tussen creativiteit en prompt-getrouwheid
      },
      options: {
        use_cache: true,
        wait_for_model: true
      }
    };
    
    // Maak API-verzoek naar Hugging Face Inference API
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parameters),
    });
    
    // Als het model nog aan het laden is, geeft Hugging Face een 503 terug
    if (response.status === 503) {
      console.log('Model wordt geladen, probeer opnieuw...');
      return res.status(202).json({ 
        message: 'Het AI-model wordt geladen, probeer het over enkele seconden opnieuw.',
        retry: true
      });
    }

    if (!response.ok) {
      console.error('Hugging Face API error:', response.status, await response.text());
      throw new Error(`Hugging Face API responded with status ${response.status}`);
    }

    // Hugging Face retourneert direct een binaire afbeelding
    const imageBuffer = await response.buffer();
    
    // Base64 encoded image
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    // Stuur de gegenereerde afbeelding als base64 string terug naar de client
    res.json({ imageUrl: base64Image });
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Stuur een fallback afbeelding terug als er een fout optreedt
    res.status(500).json({ 
      error: 'Fout bij het genereren van de afbeelding',
      imageUrl: DEFAULT_IMAGE_URL
    });
  }
});

export default router;