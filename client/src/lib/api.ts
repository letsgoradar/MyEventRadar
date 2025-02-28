
import { QueryClient } from "@tanstack/react-query";

// Define baseUrl based on environment
// In Replit environment, we need to use the same origin for development to avoid CORS issues
const baseUrl = window.location.origin.includes('replit.dev') 
  ? window.location.origin
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export async function apiRequest(path: string, options?: RequestInit) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  
  try {
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
      signal: options?.signal || controller.signal,
      // Ensure credentials are included for same-origin requests
      credentials: 'same-origin',
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`API error: ${response.status} for URL: ${url}`);
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout for ${url}`);
    } else if (error.message && error.message.includes('NetworkError')) {
      throw new Error(`Network error when connecting to ${url} - Check if the server is running`);
    } else if (error.message && error.message.includes('CORS')) {
      throw new Error(`CORS error when connecting to ${url} - Check server CORS configuration`);
    }
    
    // Re-throw for React Query to handle retries
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
