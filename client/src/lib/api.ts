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
      
      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
}

export async function fetchEventsByRadius(lat: number, lng: number, radius: number, windowDays?: number | null) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius: radius.toString(),
  });
  if (windowDays !== undefined && windowDays !== null) {
    params.append('windowDays', windowDays.toString());
  }
  return apiRequest(`/api/events/nearby?${params.toString()}`);
}

// Fetch events for web version based on user location
// Uses 200km radius to cover all of Netherlands while being much faster than 1000km
export async function fetchAllEvents(centerLat: number = 52.1326, centerLng: number = 5.2913, windowDays?: number | null) {
  const params = new URLSearchParams({
    lat: centerLat.toString(),
    lng: centerLng.toString(),
    radius: '200', // 200km covers all of Netherlands
  });
  if (windowDays !== undefined && windowDays !== null) {
    params.append('windowDays', windowDays.toString());
  }
  return apiRequest(`/api/events/nearby?${params.toString()}`);
}

// Haversine distance calculation for client-side filtering
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
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