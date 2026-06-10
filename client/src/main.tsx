// WebSocket fix moet als eerste worden geladen
// Patch WebSocket voordat Vite het gebruikt
const originalWebSocket = window.WebSocket;
window.WebSocket = function(url: string, protocols?: string | string[]) {
  // Fix ongeldige URLs met undefined poort
  if (url.includes(':undefined')) {
    console.log('Herstellen van ongeldige WebSocket URL:', url);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    url = url.replace(/wss?:\/\/localhost:undefined/, `${wsProtocol}//${wsHost}`);
    console.log('Verbeterde WebSocket URL:', url);
  }
  return new originalWebSocket(url, protocols);
} as any;
window.WebSocket.prototype = originalWebSocket.prototype;

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Importeer de WebSocket fix
import "./hmr-config";

createRoot(document.getElementById("root")!).render(<App />);

// PWA/offline-cache is voorlopig uitgeschakeld. Deregistreer bestaande service
// workers en wis hun caches zodat vastgemaakte apps altijd de actuele webversie
// laden (lost het "Er ging iets mis"-scherm op na een nieuwe deploy).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    })
    .catch(() => {});
  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

if (window.matchMedia('(display-mode: standalone)').matches && screen.orientation && 'lock' in screen.orientation) {
  (screen.orientation as any).lock('portrait-primary').catch(() => {});
}
