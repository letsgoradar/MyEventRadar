import React, { useState, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import MapView from '@/components/Map/MapView';
import { EventList } from '@/components/EventList';
import { useIsMobile } from '@/hooks/use-mobile';
import { MoveHorizontal, Map, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { Event } from '@shared/schema';

interface SplitViewProps {
  searchQuery: string;
  radius: number;
  filteredEvents: Event[];
  onEventClick?: (event: Event) => void;
  onRadiusChange?: (radius: number) => void;
}

export default function SplitView({
  searchQuery,
  radius,
  filteredEvents,
  onEventClick,
  onRadiusChange
}: SplitViewProps) {
  const isMobile = useIsMobile();
  const [layout, setLayout] = useLocalStorage<'horizontal' | 'vertical'>(
    'split-layout',
    'horizontal'
  );
  const [defaultSizes, setDefaultSizes] = useLocalStorage<number[]>(
    'split-sizes',
    [40, 60]
  );
  const [isCollapsed, setIsCollapsed] = useState<'left' | 'right' | null>(null);
  const [activePanel, setActivePanel] = useState<'map' | 'list' | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);

  // Handle event hover/selection for highlighting on map
  const handleEventHover = (eventId: number | null) => {
    setHoveredEvent(eventId);
  };

  // On mobile, we show either the map or the list with a toggle button
  const togglePanel = () => {
    if (isMobile) {
      setActivePanel(activePanel === 'map' ? 'list' : 'map');
    }
  };

  // Handle collapsing panels with double-click on handle
  const handleCollapsePanel = (panel: 'left' | 'right') => {
    if (isCollapsed === panel) {
      // Restore to default
      setIsCollapsed(null);
    } else {
      setIsCollapsed(panel);
    }
  };

  // Calculate panel sizes based on collapse state
  const getPanelSizes = (): number[] => {
    if (isCollapsed === 'left') {
      return [10, 90];
    } else if (isCollapsed === 'right') {
      return [90, 10];
    }
    return defaultSizes;
  };

  // Layout switch
  const toggleLayout = () => {
    setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal');
  };

  // Handle panel resize end
  const handleResizeEnd = (sizes: number[]) => {
    if (!isCollapsed) {
      setDefaultSizes(sizes);
    }
  };

  // For mobile view, set an active panel
  useEffect(() => {
    if (isMobile && !activePanel) {
      setActivePanel('map');
    }
  }, [isMobile, activePanel]);

  if (isMobile) {
    return (
      <div className="relative h-full">
        {/* Mobile toggle button */}
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 z-50"
          onClick={togglePanel}
        >
          {activePanel === 'map' ? <List className="w-4 h-4" /> : <Map className="w-4 h-4" />}
        </Button>

        <div className="h-full">
          {(activePanel === 'map') && (
            <div className="h-full">
              <MapView 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents}
                onEventClick={onEventClick}
                onRadiusChange={onRadiusChange}
                highlightedEventId={hoveredEvent}
              />
            </div>
          )}
          
          {(activePanel === 'list') && (
            <div className="h-full overflow-auto">
              <EventList 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents}
                onEventHover={handleEventHover}
                onEventClick={onEventClick}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* Layout toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 z-50"
        onClick={toggleLayout}
      >
        <MoveHorizontal className="w-4 h-4" />
      </Button>

      <ResizablePanelGroup
        direction={layout === 'horizontal' ? 'horizontal' : 'vertical'}
        onLayout={(sizes) => handleResizeEnd(sizes)}
        className="h-full"
      >
        <ResizablePanel defaultSize={getPanelSizes()[0]} minSize={10}>
          <div className="h-full overflow-auto">
            <EventList 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents} 
              onEventHover={handleEventHover}
              onEventClick={onEventClick}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle onDoubleClick={() => handleCollapsePanel('right')} />

        <ResizablePanel defaultSize={getPanelSizes()[1]} minSize={10}>
          <div className="h-full">
            <MapView 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents}
              onEventClick={onEventClick}
              onRadiusChange={onRadiusChange}
              highlightedEventId={hoveredEvent}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}