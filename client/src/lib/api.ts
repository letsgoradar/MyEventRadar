import { QueryClient } from "@tanstack/react-query";

// Define baseUrl based on environment
// In Replit environment, we need to use the same origin for development to avoid CORS issues
const baseUrl = window.location.origin.includes('replit.dev') 
  ? window.location.origin
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
    // Don't add '/api' prefix if path already starts with it
    const url = path.startsWith('http') || path.startsWith('/api') 
      ? path 
      : `/api${path}`;

    try {
      console.log(`Making API request to: ${url}`);
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        // Try to get error details from response
        const text = await response.text();
        console.error(`Response content:`, text.substring(0, 200)); // Log first 200 chars
        throw new Error(`API request failed: ${response.status} - ${text.substring(0, 100)}`);
      }

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn('Response is not JSON:', text.substring(0, 200));
        throw new Error('Invalid response format: Expected JSON');
      }
      
      console.log(`API response data:`, data);
      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
}

export async function fetchEventsByRadius(lat: number, lng: number, radius: number) {
  console.log('Fetching events with params:', { lat, lng, radius });
  return apiRequest(`/api/events/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
}

// Create a new queryClient instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 30000), // Exponential backoff
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnReconnect: true, // Refetch when reconnecting after disconnect
    },
  },
});