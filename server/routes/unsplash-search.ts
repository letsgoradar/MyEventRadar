import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Unsplash API configuratie
const UNSPLASH_API_URL = 'https://api.unsplash.com';

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  description: string;
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

/**
 * Zoek foto's op Unsplash gebaseerd op event titel
 * GET /api/unsplash/search?query=basketbal&count=3
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, count = '3' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is verplicht' });
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!accessKey) {
      console.warn('UNSPLASH_ACCESS_KEY niet gevonden, gebruik fallback systeem');
      return res.status(503).json({ 
        error: 'Unsplash API niet geconfigureerd',
        fallback: true 
      });
    }

    // Zoek foto's via Unsplash API
    const searchUrl = `${UNSPLASH_API_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
    
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      },
      signal: controller.signal,
    });
    clearTimeout(fetchTimeout);

    if (!response.ok) {
      console.error('Unsplash API error:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: 'Fout bij ophalen van foto\'s',
        fallback: true 
      });
    }

    const data = await response.json() as UnsplashSearchResponse;

    // Converteer naar simpel formaat voor frontend
    const photos = data.results.map(photo => ({
      id: photo.id,
      url: `${photo.urls.regular}&q=80&w=1000`,
      alt: photo.alt_description || photo.description || query,
    }));

    res.json({ photos });

  } catch (error) {
    console.error('Error in Unsplash search:', error);
    res.status(500).json({ 
      error: 'Server fout bij zoeken van foto\'s',
      fallback: true 
    });
  }
});

export default router;
