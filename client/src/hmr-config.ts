/**
 * WebSocket configuratie voor Vite HMR
 * Dit bestand is een workaround voor de WebSocket verbindingsproblemen in Replit
 */

// Deze code wordt direct uitgevoerd om WebSocket problemen te voorkomen
{
  try {
    // Probeer de basis URL van de server te bepalen
    const getBaseURL = () => {
      const baseURL = window.location.origin;
      return baseURL;
    };

    // Als er problemen zijn met WebSocket verbindingen, log dit
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url: string, protocols?: string | string[]) {
      // Check voor verschillende patronen van ongeldige URLs
      if (url.includes(':undefined') || url.includes('localhost:undefined')) {
        console.log('Herstellen van ongeldige WebSocket URL:', url);
        
        // Voor Vite HMR, gebruik de huidige host en poort
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        
        // Extraheer query parameters als die er zijn
        const urlObj = new URL(url.replace('wss://localhost:undefined', `${wsProtocol}//${wsHost}`));
        url = urlObj.toString();
        
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