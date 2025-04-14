import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

// Setup router
const router = Router();

// Configure environment
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Configuratie voor Hugging Face modellen
// We gebruiken SDXL voor hogere kwaliteit
const HF_MODEL_ID = 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`;

/**
 * POST /api/generate-image
 * Genereert een afbeelding met behulp van Hugging Face API zonder fallback
 * Bij fouten retourneert het een duidelijke error status
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'Prompt is vereist',
        message: 'Er is een beschrijving nodig om een afbeelding te genereren'
      });
    }

    // Check if we have a Hugging Face API key
    if (!HUGGING_FACE_API_KEY) {
      console.error('Geen Hugging Face API key gevonden');
      return res.status(503).json({ 
        error: 'Configuratiefout',
        message: 'Afbeeldingsgeneratie is tijdelijk niet beschikbaar. Configuratiefout: geen API-sleutel.'
      });
    }
    
    // Optimaliseer de prompt voor kwalitatief goede, maar niet te grote afbeeldingen
    const enhancedPrompt = `Fotorealistische afbeelding voor een Nederlands evenement: ${prompt}. Professionele fotografie stijl, hoge kwaliteit, gedetailleerd.`;
    
    console.log(`Genereren van afbeelding met Hugging Face (${HF_MODEL_ID}), prompt:`, enhancedPrompt);
    
    // Hugging Face API parameters
    const parameters = {
      inputs: enhancedPrompt,
      parameters: {
        negative_prompt: "lage kwaliteit, onscherp, wazig, vervormd, onrealistisch, cartoon, tekening, schilderij, tekst, handschrift, watermark",
        num_inference_steps: 28,  // Betere kwaliteit dan 25, maar niet zo zwaar als 30
        guidance_scale: 7.5,      // Balans tussen creativiteit en prompt-getrouwheid
        width: 768,              // Betere kwaliteit dan 512, maar niet zo groot als 1024
        height: 768,             // Betere kwaliteit dan 512, maar niet zo groot als 1024
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
      console.log('Model wordt geladen, client moet opnieuw proberen...');
      return res.status(202).json({ 
        message: 'Het AI-model wordt geladen, even geduld...',
        retry: true,
        modelLoading: true
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      // Specifiek antwoord, geen fallback image
      return res.status(500).json({ 
        error: 'Hugging Face API fout',
        message: 'Er is een probleem bij het genereren van de afbeelding. Probeer het later opnieuw.',
        statusCode: response.status
      });
    }

    // Hugging Face retourneert direct een binaire afbeelding
    // Gebruik arrayBuffer in plaats van buffer (deprecated)
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    // Base64 encoded image
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    // Stuur de gegenereerde afbeelding als base64 string terug naar de client
    res.json({ 
      imageUrl: base64Image,
      success: true
    });
  } catch (error) {
    console.error('Onverwachte fout bij het genereren van afbeelding:', error);
    
    // Geen fallback, alleen error status
    res.status(500).json({ 
      error: 'Onverwachte fout',
      message: 'Er is een onverwachte fout opgetreden bij het genereren van de afbeelding. Probeer het later opnieuw.',
      unavailable: true
    });
  }
});

export default router;