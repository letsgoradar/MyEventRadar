const OPTIMAL_EVENT_COUNT = {
  MIN: 30,
  TARGET: 50,
  MAX: 100,
};

const RADIUS_LIMITS = {
  MIN: 2, // km - minimum om altijd iets te tonen
  MAX: 100, // km - maximum praktisch bereik
  DEFAULT: 10, // km - standaard startwaarde
};

export interface AdaptiveRadiusResult {
  radius: number; // km
  eventCount: number;
  isOptimal: boolean;
  suggestion: 'increase' | 'decrease' | 'optimal';
}

export function calculateOptimalRadius(
  currentRadius: number,
  currentEventCount: number
): AdaptiveRadiusResult {
  let suggestion: 'increase' | 'decrease' | 'optimal' = 'optimal';
  let isOptimal = true;
  let newRadius = currentRadius;

  if (currentEventCount < OPTIMAL_EVENT_COUNT.MIN) {
    suggestion = 'increase';
    isOptimal = false;
    const factor = Math.min(2, OPTIMAL_EVENT_COUNT.TARGET / Math.max(currentEventCount, 1));
    newRadius = Math.min(currentRadius * factor, RADIUS_LIMITS.MAX);
  } else if (currentEventCount > OPTIMAL_EVENT_COUNT.MAX) {
    suggestion = 'decrease';
    isOptimal = false;
    const factor = Math.max(0.5, OPTIMAL_EVENT_COUNT.TARGET / currentEventCount);
    newRadius = Math.max(currentRadius * factor, RADIUS_LIMITS.MIN);
  }

  return {
    radius: Math.round(newRadius * 10) / 10,
    eventCount: currentEventCount,
    isOptimal,
    suggestion,
  };
}

export function getRadiusForZoomLevel(zoomLevel: number): number {
  const radiusMap: Record<number, number> = {
    6: 100,
    7: 75,
    8: 50,
    9: 30,
    10: 20,
    11: 15,
    12: 10,
    13: 7,
    14: 5,
    15: 3,
    16: 2,
    17: 1,
    18: 0.5,
  };
  
  const nearestZoom = Math.round(Math.max(6, Math.min(18, zoomLevel)));
  return radiusMap[nearestZoom] || RADIUS_LIMITS.DEFAULT;
}

export function getPixelRadiusForZoom(
  radiusKm: number,
  zoomLevel: number,
  latitude: number
): number {
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoomLevel);
  const radiusMeters = radiusKm * 1000;
  return radiusMeters / metersPerPixel;
}
