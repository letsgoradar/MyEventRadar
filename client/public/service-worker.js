// Service worker kill switch.
// De PWA/offline-cache wordt voorlopig uitgeschakeld: zolang er nog geen
// native apps live zijn, gebruikt iedereen de gewone webversie. Deze worker
// verwijdert alle oude caches en deregistreert zichzelf, zodat reeds op het
// beginscherm vastgemaakte apps niet meer op een verouderde cache draaien
// (oorzaak van het "Er ging iets mis"-scherm na een nieuwe deploy).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.navigate(client.url));
      } catch (e) {
        // stil falen — niets cachen is altijd veilig
      }
    })()
  );
});

// Geen fetch-handler: alle verzoeken gaan rechtstreeks naar het netwerk.
