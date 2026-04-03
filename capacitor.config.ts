import type { CapacitorConfig } from '@capacitor/cli';

const productionUrl = process.env.PRODUCTION_URL;

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
