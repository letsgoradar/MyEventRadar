import { QueryClient, QueryFunction } from "@tanstack/react-query";

class ApiError extends Error {
  status: number;
  data: any;
  
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Try to parse as JSON to preserve structured error data
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON, use as plain text
    }
    
    const message = data?.message || text;
    const error = new ApiError(res.status, message, data);
    
    // Copy structured data to error object for easy access
    if (data) {
      Object.assign(error, data);
    }
    
    throw error;
  }
}

export async function apiRequest<T = any>(
  url: string,
  options: {
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
    responseType?: 'json' | 'blob' | 'text';
  } = {},
): Promise<T> {
  const method = options.method || 'GET';
  const responseType = options.responseType || 'json';
  
  // FormData behandeling: verwijder de Content-Type header bij FormData requests
  // zodat de browser deze automatisch kan instellen met de juiste boundary
  let headers = { ...options.headers };
  
  if (options.data instanceof FormData) {
    // Bij FormData explixiet GEEN Content-Type instellen, zodat de browser dit automatisch doet
    delete headers['Content-Type'];
  } else if (options.data && !headers['Content-Type']) {
    // Bij niet-FormData requests, standaard application/json gebruiken
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.data ? 
      (options.data instanceof FormData ? options.data : JSON.stringify(options.data)) 
      : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  try {
    if (responseType === 'blob') {
      return await res.blob() as unknown as T;
    } else if (responseType === 'text') {
      return await res.text() as unknown as T;
    } else {
      // Default to JSON
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return res as unknown as T;
    }
  } catch (e) {
    return res as unknown as T;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors',
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.warn('Authentication required for', queryKey[0]);
      // Redirect to appropriate login page based on current path
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        console.log('Authentication required, but continuing without redirect for most endpoints');
        // Alleen redirecten voor admin pagina's, niet voor app2
        if (window.location.pathname.includes('/admin')) {
          console.log('Redirecting to admin login due to auth failure');
          window.location.href = '/admin/login';
        }
      }
      return null;
    }

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        // Alleen redirecten voor admin pagina's, niet voor app2
        if (window.location.pathname.includes('/admin')) {
          console.log('Redirecting to admin login due to auth failure');
          window.location.href = '/admin/login';
        } else {
          console.log('Authentication required, but continuing without redirect');
        }
      }
      await throwIfResNotOk(res);
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
