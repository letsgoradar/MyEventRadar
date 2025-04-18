import L from "leaflet";
import { getCategoryColor } from "../CategoryIcon";

// Functie om categorie-specifieke markers te maken - alleen stippen, geen overlay tekst
export function createEventIcon(category: string, isExpired: boolean = false) {
  const color = isExpired ? "#9CA3AF" : getCategoryColor(category as any);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Functie om een eenvoudige marker-icoon te maken
export function createSimpleIcon(color: string) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}