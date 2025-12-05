import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { EventInterface } from "@shared/schema";
import { getCategoryColor } from "../CategoryIcon";

interface FormattedEvent {
  id: number;
  title: string;
  coords: [number, number];
  category: string;
  expired: boolean;
  event: EventInterface;
  startTime: string | Date;
}

interface ClusterLayerProps {
  events: FormattedEvent[];
  onEventClick: (event: EventInterface) => void;
  selectedEventId?: number | null;
  userLocation: [number, number];
  isInteracting?: boolean;
}

const CLUSTER_THRESHOLD = 100;
const RADAR_COLOR = "34, 197, 94";

function createSimpleMarkerIcon(category: string, isExpired: boolean = false, isSelected: boolean = false) {
  const color = isExpired ? "#9CA3AF" : getCategoryColor(category as any);
  const size = isSelected ? 28 : 20;
  const innerSize = size - 4;
  
  return L.divIcon({
    className: "custom-cluster-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        ${isSelected ? 'transform: scale(1.2);' : ''}
      ">
        <div style="
          width: ${innerSize}px;
          height: ${innerSize}px;
          background-color: ${color};
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  let size = 40;
  let fontSize = 12;
  
  if (count > 50) {
    size = 50;
    fontSize = 14;
  } else if (count > 20) {
    size = 45;
    fontSize = 13;
  }
  
  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, rgb(${RADAR_COLOR}) 0%, rgb(22, 163, 74) 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${fontSize}px;
        box-shadow: 0 3px 10px rgba(${RADAR_COLOR}, 0.5);
        border: 3px solid white;
      ">
        ${count}
      </div>
    `,
    className: "marker-cluster-custom",
    iconSize: L.point(size, size),
  });
}

export function ClusterLayer({ 
  events, 
  onEventClick, 
  selectedEventId, 
  userLocation,
  isInteracting = false
}: ClusterLayerProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const eventsRef = useRef(events);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    if (!map) return;
    
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: createClusterIcon,
        animate: !isInteracting,
        animateAddingMarkers: false,
      });
      
      map.addLayer(clusterGroupRef.current);
    }
    
    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);
  
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    
    const clusterGroup = clusterGroupRef.current;
    const currentMarkers = markersRef.current;
    const newEventIds = new Set(events.map(e => e.id));
    
    currentMarkers.forEach((marker, id) => {
      if (!newEventIds.has(id)) {
        clusterGroup.removeLayer(marker);
        currentMarkers.delete(id);
      }
    });
    
    events.forEach((event) => {
      const isSelected = selectedEventId === event.id;
      
      if (currentMarkers.has(event.id)) {
        const existingMarker = currentMarkers.get(event.id)!;
        existingMarker.setIcon(createSimpleMarkerIcon(event.category, event.expired, isSelected));
      } else {
        const marker = L.marker(event.coords, {
          icon: createSimpleMarkerIcon(event.category, event.expired, isSelected),
        });
        
        marker.on("click", () => {
          onEventClick(event.event);
        });
        
        const popupContent = `
          <div style="min-width: 200px;">
            ${event.event.imageUrl ? `
              <img src="${event.event.imageUrl}" alt="${event.title}" 
                style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px 4px 0 0;" />
            ` : ''}
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 4px; font-size: 14px; font-weight: 600;">${event.title}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">${event.event.address || ''}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #888;">${event.category}</p>
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 250,
          className: "event-cluster-popup"
        });
        
        clusterGroup.addLayer(marker);
        currentMarkers.set(event.id, marker);
      }
    });
    
  }, [events, selectedEventId, onEventClick]);
  
  useEffect(() => {
    if (clusterGroupRef.current && selectedEventId) {
      const marker = markersRef.current.get(selectedEventId);
      if (marker) {
        clusterGroupRef.current.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }
    }
  }, [selectedEventId]);
  
  return null;
}

export function shouldUseCluster(eventCount: number, zoom: number): boolean {
  if (eventCount > CLUSTER_THRESHOLD) return true;
  if (eventCount > 50 && zoom < 12) return true;
  if (eventCount > 30 && zoom < 10) return true;
  return false;
}
