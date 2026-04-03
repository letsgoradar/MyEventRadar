import type { CapacitorConfig } from '@capacitor/cli';

const productionUrl = process.env.PRODUCTION_URL;

if (!productionUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    '[Capacitor] PRODUCTION_URL is not set. ' +
    'Set PRODUCTION_URL=https://jouw-app.replit.app before running: npx cap sync android'
  );
}

const config: CapacitorConfig = {
  appId: 'nl.letsgoradar.app',
  appName: "let's go Radar",
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    ...(productionUrl ? { url: productionUrl } : {}),
    cleartext: false,
    allowNavigation: [
      '*.google.com',
      '*.googleapis.com',
      '*.replit.app',
      '*.replit.dev',
    ],
  },
};

export default config;
