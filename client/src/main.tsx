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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker geregistreerd:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registratie mislukt:', error);
      });
  });
}
