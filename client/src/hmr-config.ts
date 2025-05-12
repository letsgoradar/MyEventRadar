/**
 * WebSocket configuratie voor Vite HMR
 * Dit bestand is een workaround voor de WebSocket verbindingsproblemen in Replit
 */

// Deze code wordt alleen uitgevoerd als er een WebSocket fout optreedt
if (import.meta.hot) {
  try {
    // Probeer de basis URL van de server te bepalen
    const getBaseURL = () => {
      const baseURL = window.location.origin;
      return baseURL;
    };

    // Als er problemen zijn met WebSocket verbindingen, log dit
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url: string, protocols?: string | string[]) {
      if (url.includes('wss://localhost:undefined')) {
        console.log('Herstellen van ongeldige WebSocket URL:', url);
        
        // Vervang een ongeldige URL door een geldige die gebruikmaakt van de huidige oorsprong
        url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        console.log('Verbeterde WebSocket URL:', url);
      }
      return new originalWebSocket(url, protocols);
    } as any;
    window.WebSocket.prototype = originalWebSocket.prototype;
    
    console.log('WebSocket configuratie geladen voor betere HMR ondersteuning');
  } catch (e) {
    console.error('Fout bij configureren van WebSocket voor HMR:', e);
  }
}

export {}; // Exporteer een leeg object om TypeScript tevreden te stellen