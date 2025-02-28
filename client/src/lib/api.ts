
import { QueryClient } from "@tanstack/react-query";

// Define baseUrl based on environment
const baseUrl = import.meta.env.PROD 
  ? window.location.origin
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export async function apiRequest(path: string, options?: RequestInit) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      // Add timeout for fetch requests
      signal: options?.signal || AbortSignal.timeout(10000), // 10 seconds timeout
    });

    if (!response.ok) {
      console.error(`API error: ${response.status} for URL: ${url}`);
      throw new Error(`API error: ${response.status}`);
    }

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    throw error; // Re-throw so React Query can handle retries
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
