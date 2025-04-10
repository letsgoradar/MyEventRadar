import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
  const headers = {
    ...(options.data && !options.headers?.['Content-Type'] ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: options.data ? 
      (options.headers?.['Content-Type'] === 'multipart/form-data' ? options.data as FormData : JSON.stringify(options.data)) 
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
      // Redirect to login if we get a 401
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        console.log('Redirecting to login due to auth failure');
        window.location.href = '/admin/login';
      }
      return null;
    }

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        console.log('Redirecting to login due to auth failure');
        window.location.href = '/admin/login';
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
