
import L from 'leaflet';

export const getHoverDivStyle = (color: string): string => {
  return `
    width: 100%; 
    height: 100%; 
    border-radius: 50%; 
    background-color: ${color}; 
    opacity: 0.5;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
  `;
};

export const createCircleMarker = (
  latLng: L.LatLng,
  radius: number,
  color: string = '#0066FF',
  fillOpacity: number = 0.2
): L.Circle => {
  return L.circle(latLng, {
    radius,
    color,
    fillColor: color,
    fillOpacity,
    weight: 1
  });
};

export const createNotificationRadiusCircle = (
  latLng: L.LatLng,
  radiusKm: number = 2,
  color: string = '#0066FF'
): L.Circle => {
  // Convert kilometers to meters
  const radiusMeters = radiusKm * 1000;
  return createCircleMarker(latLng, radiusMeters, color);
};
