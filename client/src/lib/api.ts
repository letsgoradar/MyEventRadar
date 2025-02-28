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
    const baseUrl = '/api';
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

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
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
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