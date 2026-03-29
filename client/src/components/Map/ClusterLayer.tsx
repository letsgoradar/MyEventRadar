import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { EventInterface } from "@shared/schema";
import { getCategoryColor, CATEGORY_PATHS } from "../CategoryIcon";
import { isImageFailed, markImageFailed } from "@/lib/imageCache";
import { getBestCategoryImage } from "@/lib/categoryImages";

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

const DEFAULT_SVG_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';

let markerIdCounter = 0;

function createImageMarkerIcon(
  imageUrl: string | null | undefined,
  category: string,
  isExpired: boolean = false,
  isSelected: boolean = false,
  isPromoted: boolean = false,
  eventId?: number
) {
  const isLarge = isPromoted || isSelected;
  const imgW   = isLarge ? 48 : 40;
  const tipH   = 12;
  const imgH   = isLarge ? 48 : 38;  // totalH = imgH + tipH → 60 or 50
  const tipW   = isLarge ? 11 : 9;   // half-width of the CSS triangle
  const totalH = imgH + tipH;

  const categoryColor = getCategoryColor(category);
  const primaryColor  = isExpired ? "#9CA3AF" : categoryColor;
  const iconPath = CATEGORY_PATHS[category] || DEFAULT_SVG_PATH;

  const dropShadow = isPromoted
    ? 'filter:drop-shadow(0 3px 8px rgba(245,158,11,0.65));'
    : isSelected
      ? 'filter:drop-shadow(0 3px 8px rgba(20,184,166,0.65));'
      : 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.38));';

  const borderColor = isPromoted ? '#f59e0b' : isSelected ? '#14b8a6' : 'white';

  const imgBoxStyle = [
    'position:absolute;top:0;left:0;right:0;',
    `height:${imgH}px;`,
    'border-radius:10px 10px 3px 3px;',
    'overflow:hidden;',
    `border:2.5px solid ${borderColor};`,
    `background:${primaryColor};`,
  ].join('');

  const tipStyle = [
    'position:absolute;bottom:0;left:50%;transform:translateX(-50%);',
    'width:0;height:0;',
    `border-left:${tipW}px solid transparent;`,
    `border-right:${tipW}px solid transparent;`,
    `border-top:${tipH}px solid ${borderColor};`,
  ].join('');

  const wrapperStyle = [
    'position:relative;',
    `width:${imgW}px;height:${totalH}px;`,
    'cursor:pointer;',
    dropShadow,
  ].join('');

  if (imageUrl && !isImageFailed(imageUrl)) {
    const markerId = `marker-img-${markerIdCounter++}`;
    const icon = L.divIcon({
      className: "pin-marker-container",
      html: `
        <div style="${wrapperStyle}">
          <div style="${imgBoxStyle}">
            <img
              id="${markerId}"
              src="${imageUrl}"
              alt=""
              loading="lazy"
              style="width:100%;height:100%;object-fit:cover;display:block;"
            />
            <div id="${markerId}-fallback" style="
              display:none;width:100%;height:100%;
              align-items:center;justify-content:center;
              background:${primaryColor};
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                   fill="none" stroke="white" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="${iconPath}"/>
              </svg>
            </div>
          </div>
          <div style="${tipStyle}"></div>
        </div>
      `,
      iconSize: [imgW, totalH],
      iconAnchor: [imgW / 2, totalH],
    });

    requestAnimationFrame(() => {
      const img = document.getElementById(markerId) as HTMLImageElement | null;
      if (!img) return;
      const handleError = () => {
        img.style.display = 'none';
        const fb = document.getElementById(`${markerId}-fallback`);
        if (fb) fb.style.display = 'flex';
        markImageFailed(imageUrl, eventId);
      };
      if (img.complete && img.naturalWidth === 0) {
        handleError();
      } else {
        img.addEventListener('error', handleError, { once: true });
      }
    });

    return icon;
  }

  // Fallback (no image): solid-color pin with category icon
  return L.divIcon({
    className: "pin-marker-container",
    html: `
      <div style="${wrapperStyle}">
        <div style="${imgBoxStyle}display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
               fill="none" stroke="white" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="${iconPath}"/>
          </svg>
        </div>
        <div style="${tipStyle}"></div>
      </div>
    `,
    iconSize: [imgW, totalH],
    iconAnchor: [imgW / 2, totalH],
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
  // Tracks icon parameters per marker so we can skip setIcon when nothing changed
  const markerIconStateRef = useRef<Map<number, {
    imageUrl: string | null; isSelected: boolean; isPromoted: boolean; isExpired: boolean;
  }>>(new Map());
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    if (!map) return;
    
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 15,
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
        markerIconStateRef.current.delete(id);
      }
    });
    
    events.forEach((event) => {
      const isSelected = selectedEventId === event.id;
      const rawImageUrl = event.event.imageUrl ?? null;
      // Always show a photo: use event image, fall back to category stock photo
      const imageUrl = (rawImageUrl && !isImageFailed(rawImageUrl))
        ? rawImageUrl
        : getBestCategoryImage(event.category, event.title, event.event.description || '');
      
      if (currentMarkers.has(event.id)) {
        const existingMarker = currentMarkers.get(event.id)!;
        const prev = markerIconStateRef.current.get(event.id);
        // Only rebuild the icon if something visible actually changed
        if (!prev ||
            prev.imageUrl !== imageUrl ||
            prev.isSelected !== isSelected ||
            prev.isPromoted !== !!event.isPromoted ||
            prev.isExpired !== event.expired) {
          existingMarker.setIcon(createImageMarkerIcon(imageUrl, event.category, event.expired, isSelected, event.isPromoted, event.id));
          markerIconStateRef.current.set(event.id, { imageUrl, isSelected, isPromoted: !!event.isPromoted, isExpired: event.expired });
        }
      } else {
        const marker = L.marker(event.coords, {
          icon: createImageMarkerIcon(imageUrl, event.category, event.expired, isSelected, event.isPromoted, event.id),
        });
        markerIconStateRef.current.set(event.id, { imageUrl, isSelected, isPromoted: !!event.isPromoted, isExpired: event.expired });
        
        const createPopupElement = () => {
          const container = document.createElement('div');
          container.style.minWidth = '200px';
          container.className = 'cluster-popup-content';
          container.dataset.eventId = String(event.id);
          
          if (event.event.imageUrl && !isImageFailed(event.event.imageUrl)) {
            const img = document.createElement('img');
            img.src = event.event.imageUrl;
            img.alt = event.title;
            img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 4px 4px 0 0;';
            img.addEventListener('error', () => {
              img.style.display = 'none';
              markImageFailed(event.event.imageUrl, event.id);
            }, { once: true });
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
