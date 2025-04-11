import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

// Define the OpenAI API response type
interface OpenAIImageResponse {
  data: Array<{
    url: string;
  }>;
}

// Setup router
const router = Router();

// Configure environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Default image URL als er geen API key is of als de generatie faalt
const DEFAULT_IMAGE_URL = '/images/event-logo.svg';

/**
 * POST /api/generate-image
 * Genereert een afbeelding met behulp van OpenAI DALL-E API
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is vereist' });
    }

    // Check if we have an OpenAI API key
    if (!OPENAI_API_KEY) {
      console.warn('Geen OpenAI API key gevonden, standaard afbeelding wordt geretourneerd');
      return res.json({ 
        imageUrl: DEFAULT_IMAGE_URL,
        message: 'Standaard afbeelding geretourneerd omdat er geen OpenAI API key is geconfigureerd.'
      });
    }
    
    // Optimaliseer de prompt voor betere resultaten met DALL-E
    const enhancedPrompt = `Een fotorealistische afbeelding voor een Nederlands evenement: ${prompt}. Stijl: professionele fotografie, levendige kleuren, realistische weergave.`;
    
    // Maak een API-verzoek naar OpenAI
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        model: "dall-e-3", // of een ander beschikbaar model
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      
      // Controleer op specifieke fouten zoals billing limiet
      if (errorData && typeof errorData === 'object' && 'error' in errorData && 
          errorData.error && typeof errorData.error === 'object' && 'code' in errorData.error && 
          errorData.error.code === 'billing_hard_limit_reached') {
        console.warn('OpenAI API billing limit reached, returning default image');
        return res.json({ 
          imageUrl: DEFAULT_IMAGE_URL,
          message: 'OpenAI API billing limiet bereikt. Standaard afbeelding gebruikt.'
        });
      }
      
      throw new Error(`OpenAI API responded with status ${response.status}`);
    }

    const data = await response.json() as OpenAIImageResponse;
    const imageUrl = data.data[0].url;

    // Stuur de gegenereerde afbeelding URL terug naar de client
    res.json({ imageUrl });
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