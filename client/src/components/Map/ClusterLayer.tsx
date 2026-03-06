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
  isPromoted?: boolean;
}

interface ClusterLayerProps {
  events: FormattedEvent[];
  onEventClick: (event: EventInterface) => void;
  selectedEventId?: number | null;
  userLocation: [number, number];
  isInteracting?: boolean;
  isWebView?: boolean;
}

const CLUSTER_THRESHOLD = 200;
const CLUSTER_COLOR = "107, 114, 128";

const CATEGORY_SVG_PATHS: Record<string, string> = {
  'Sport en spel': 'M6.5 6.5h11M6.5 17.5h11M4.5 12h15M12 4.5v15M8 8l8 8M16 8l-8 8',
  'Kunst en Cultuur': 'M12 4v16m-8-8h16',
  'Gezellig en Sociaal': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'Leren en Ontdekken': 'M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5',
  'Vrijwilligerswerk en hulp': 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'
};

function createImageMarkerIcon(
  imageUrl: string | null | undefined, 
  category: string, 
  isExpired: boolean = false, 
  isSelected: boolean = false,
  isPromoted: boolean = false
) {
  const size = isPromoted ? 52 : (isSelected ? 52 : 44);
  const borderWidth = 3;
  const innerSize = size - (borderWidth * 2);
  const fallbackColor = `rgb(${CLUSTER_COLOR})`;
  const primaryColor = isExpired ? "#9CA3AF" : fallbackColor;
  const iconPath = CATEGORY_SVG_PATHS[category] || CATEGORY_SVG_PATHS['Gezellig en Sociaal'];
  
  if (imageUrl) {
    return L.divIcon({
      className: "image-marker",
      html: `
        <div class="img-marker-wrapper" style="
          width: ${size}px;
          height: ${size}px;
          position: relative;
        ">
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: white;
            border-radius: 50%;
            padding: ${borderWidth}px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ${isPromoted ? 'box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5); border: 2px solid #f59e0b;' : ''}
            ${isSelected && !isPromoted ? 'box-shadow: 0 4px 12px rgba(20, 184, 166, 0.5);' : ''}
          ">
            <img 
              src="${imageUrl}" 
              alt="" 
              style="
                width: ${innerSize}px;
                height: ${innerSize}px;
                border-radius: 50%;
                object-fit: cover;
                display: block;
              "
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div style="
              display: none;
              width: ${innerSize}px;
              height: ${innerSize}px;
              border-radius: 50%;
              background-color: ${primaryColor};
              align-items: center;
              justify-content: center;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="${iconPath}"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  
  return L.divIcon({
    className: "fallback-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: white;
        border-radius: 50%;
        padding: ${borderWidth}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${isPromoted ? 'box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5); border: 2px solid #f59e0b;' : ''}
        ${isSelected && !isPromoted ? 'box-shadow: 0 4px 12px rgba(20, 184, 166, 0.5);' : ''}
      ">
        <div style="
          width: ${innerSize}px;
          height: ${innerSize}px;
          border-radius: 50%;
          background-color: ${primaryColor};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="${iconPath}"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  let size = 42;
  let fontSize = 13;
  
  if (count > 50) {
    size = 52;
    fontSize = 15;
  } else if (count > 20) {
    size = 47;
    fontSize = 14;
  }
  
  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: rgb(${CLUSTER_COLOR});
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${fontSize}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
  isInteracting = false,
  isWebView = false
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
        maxClusterRadius: 30,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyDistanceMultiplier: 1.5,
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
      const imageUrl = event.event.imageUrl;
      
      if (currentMarkers.has(event.id)) {
        const existingMarker = currentMarkers.get(event.id)!;
        existingMarker.setIcon(createImageMarkerIcon(imageUrl, event.category, event.expired, isSelected, event.isPromoted));
      } else {
        const marker = L.marker(event.coords, {
          icon: createImageMarkerIcon(imageUrl, event.category, event.expired, isSelected, event.isPromoted),
        });
        
        const createPopupElement = () => {
          const container = document.createElement('div');
          container.style.minWidth = '200px';
          container.className = 'cluster-popup-content';
          container.dataset.eventId = String(event.id);
          
          if (event.event.imageUrl) {
            const img = document.createElement('img');
            img.src = event.event.imageUrl;
            img.alt = event.title;
            img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 4px 4px 0 0;';
            container.appendChild(img);
          }
          
          const info = document.createElement('div');
          info.style.padding = '8px';
          
          const title = document.createElement('h3');
          title.style.cssText = 'margin: 0 0 4px; font-size: 14px; font-weight: 600;';
          title.textContent = event.title;
          info.appendChild(title);
          
          const address = document.createElement('p');
          address.style.cssText = 'margin: 0; font-size: 12px; color: #666;';
          address.textContent = event.event.address || '';
          info.appendChild(address);
          
          const category = document.createElement('p');
          category.style.cssText = 'margin: 4px 0 0; font-size: 11px; color: #888;';
          category.textContent = event.category;
          info.appendChild(category);
          
          if (!isWebView) {
            const btn = document.createElement('button');
            btn.className = 'cluster-popup-details-btn';
            btn.style.cssText = 'width: 100%; margin-top: 8px; padding: 6px 12px; background-color: hsl(var(--primary)); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;';
            btn.textContent = 'Bekijk details';
            L.DomEvent.on(btn, 'click', (e) => {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
              marker.closePopup();
              onEventClick(event.event);
            });
            info.appendChild(btn);
          }
          
          container.appendChild(info);
          return container;
        };
        
        marker.bindPopup(createPopupElement, {
          maxWidth: 250,
          className: "event-cluster-popup",
          autoPan: !isWebView,
        });
        
        if (isWebView) {
          let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
          
          marker.on("mouseover", () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            marker.openPopup();
          });
          
          marker.on("mouseout", () => {
            hoverTimeout = setTimeout(() => {
              marker.closePopup();
            }, 300);
          });
          
          marker.on("click", () => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            marker.closePopup();
            onEventClick(event.event);
          });
          
          marker.on("popupopen", () => {
            const popupEl = marker.getPopup()?.getElement();
            if (popupEl) {
              popupEl.addEventListener("mouseenter", () => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
              });
              popupEl.addEventListener("mouseleave", () => {
                hoverTimeout = setTimeout(() => {
                  marker.closePopup();
                }, 300);
              });
              popupEl.addEventListener("click", () => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                marker.closePopup();
                onEventClick(event.event);
              });
            }
          });
        } else {
          marker.on("click", () => {
            marker.openPopup();
          });
        }
        
        clusterGroup.addLayer(marker);
        currentMarkers.set(event.id, marker);
      }
    });
    
  }, [events, selectedEventId, onEventClick, isWebView]);
  
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
  return true;
}
