import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, MapPin, AlertCircle, CheckCircle, Pause, RefreshCw, Plus, Link2, Unlink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { Layer, PathOptions, LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MunicipalityStatus {
  name: string;
  feeds: Array<{
    id: number;
    name: string;
    status: string;
    lastFetchedAt: string | null;
    itemsImported: number;
    lastErrorMessage: string | null;
  }>;
  activeCount: number;
  errorCount: number;
  totalImported: number;
}

interface UnlinkedFeed {
  id: number;
  name: string;
  url: string;
  feedType: string;
}

interface MunicipalityMapProps {
  onSelectMunicipality?: (name: string) => void;
  onAddFeed?: (municipality: string) => void;
}

function MapBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds);
  }, [map, bounds]);
  return null;
}

export default function MunicipalityMap({ onSelectMunicipality, onAddFeed }: MunicipalityMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [hoveredMunicipality, setHoveredMunicipality] = useState<string | null>(null);
  const [selectedUnlinkedFeedId, setSelectedUnlinkedFeedId] = useState<string>('');

  const selectedRef = useRef<string | null>(null);
  const layersRef = useRef<Map<string, Layer>>(new Map());
  const municipalityStatusRef = useRef<Record<string, MunicipalityStatus>>({});

  const { toast } = useToast();

  const { data: municipalityStatus = {} } = useQuery<Record<string, MunicipalityStatus>>({
    queryKey: ['/api/admin/rss-feeds/municipalities'],
  });

  const { data: unlinkedFeeds = [] } = useQuery<UnlinkedFeed[]>({
    queryKey: ['/api/admin/rss-feeds/unlinked'],
  });

  useEffect(() => {
    municipalityStatusRef.current = municipalityStatus;
  }, [municipalityStatus]);

  useEffect(() => {
    fetch('/assets/gemeenten-simplified.json')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error('Failed to load municipality GeoJSON:', err));
  }, []);

  const municipalityMutation = useMutation({
    mutationFn: ({ feedId, municipality }: { feedId: number; municipality: string | null }) =>
      apiRequest(`/api/admin/rss-feeds/${feedId}`, { method: 'PATCH', data: { municipality } }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/municipalities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/unlinked'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      setSelectedUnlinkedFeedId('');
      if (variables.municipality) {
        toast({ title: 'Feed gekoppeld', description: `Feed is gekoppeld aan ${variables.municipality}.` });
      } else {
        toast({ title: 'Feed ontkoppeld', description: 'De gemeente-koppeling is verwijderd.' });
      }
    },
    onError: () => {
      toast({ title: 'Fout', description: 'Kon de koppeling niet bijwerken.', variant: 'destructive' });
    },
  });

  const normalizeKey = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^['']/, '') // Remove leading apostrophe ('s-Hertogenbosch -> s-Hertogenbosch)
      .replace(/\s+/g, '-')
      .replace(/['']/g, ''); // Remove any remaining apostrophes
  };

  const getStatusForMunicipality = (name: string): 'active' | 'error' | 'paused' | 'none' => {
    const key = normalizeKey(name);
    const status = municipalityStatus[key];
    if (!status) return 'none';
    if (status.errorCount > 0) return 'error';
    if (status.activeCount > 0) return 'active';
    return 'paused';
  };

  const getStyleForStatus = (status: 'active' | 'error' | 'paused' | 'none', isHovered: boolean, isSelected: boolean): PathOptions => {
    const baseStyles: Record<string, PathOptions> = {
      active: { fillColor: '#22c55e', fillOpacity: 0.6, color: '#16a34a', weight: 1 },
      error: { fillColor: '#ef4444', fillOpacity: 0.6, color: '#dc2626', weight: 1 },
      paused: { fillColor: '#f59e0b', fillOpacity: 0.5, color: '#d97706', weight: 1 },
      none: { fillColor: '#e5e7eb', fillOpacity: 0.3, color: '#9ca3af', weight: 1 },
    };

    const style = { ...baseStyles[status] };

    if (isHovered) {
      style.fillOpacity = 0.8;
      style.weight = 2;
    }

    if (isSelected) {
      style.weight = 3;
      style.color = '#3b82f6';
      style.fillOpacity = 0.9;
    }

    return style;
  };

  const style = (feature: Feature<Geometry, { naam: string; code: string; provincie: string }> | undefined) => {
    if (!feature) return {};
    const name = feature.properties.naam;
    const status = getStatusForMunicipality(name);
    const isHovered = hoveredMunicipality === name;
    const isSelected = selectedMunicipality === name;
    return getStyleForStatus(status, isHovered, isSelected);
  };

  const onEachFeature = useCallback((feature: Feature<Geometry, { naam: string; code: string; provincie: string }>, layer: Layer) => {
    const name = feature.properties.naam;
    const provincie = feature.properties.provincie;

    layersRef.current.set(name, layer);

    const getStatusFromRef = (n: string): 'active' | 'error' | 'paused' | 'none' => {
      const key = n.toLowerCase().replace(/^['']/, '').replace(/\s+/g, '-').replace(/['']/g, '');
      const status = municipalityStatusRef.current[key];
      if (!status) return 'none';
      if (status.errorCount > 0) return 'error';
      if (status.activeCount > 0) return 'active';
      return 'paused';
    };

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        setHoveredMunicipality(name);
        const target = e.target;
        const isSelected = selectedRef.current === name;
        target.setStyle(getStyleForStatus(getStatusFromRef(name), true, isSelected));
        target.bringToFront();
      },
      mouseout: (e: LeafletMouseEvent) => {
        setHoveredMunicipality(null);
        const target = e.target;
        const isSelected = selectedRef.current === name;
        target.setStyle(getStyleForStatus(getStatusFromRef(name), false, isSelected));
      },
      click: (e: LeafletMouseEvent) => {
        const prevSelected = selectedRef.current;
        if (prevSelected && prevSelected !== name) {
          const prevLayer = layersRef.current.get(prevSelected);
          if (prevLayer && 'setStyle' in prevLayer) {
            (prevLayer as { setStyle: (style: PathOptions) => void }).setStyle(
              getStyleForStatus(getStatusFromRef(prevSelected), false, false)
            );
          }
        }

        selectedRef.current = name;
        setSelectedMunicipality(name);
        setSelectedUnlinkedFeedId('');
        onSelectMunicipality?.(name);

        const target = e.target;
        target.setStyle(getStyleForStatus(getStatusFromRef(name), false, true));
        target.bringToFront();
      },
    });

    layer.bindTooltip(`<strong>${name}</strong><br/>${provincie}`, {
      permanent: false,
      direction: 'top',
      className: 'municipality-tooltip',
    });
  }, [onSelectMunicipality]);

  const clearSelection = useCallback(() => {
    const prevSelected = selectedRef.current;
    if (prevSelected) {
      const getStatusFromRef = (n: string): 'active' | 'error' | 'paused' | 'none' => {
        const key = n.toLowerCase().replace(/^['']/, '').replace(/\s+/g, '-').replace(/['']/g, '');
        const status = municipalityStatusRef.current[key];
        if (!status) return 'none';
        if (status.errorCount > 0) return 'error';
        if (status.activeCount > 0) return 'active';
        return 'paused';
      };

      const prevLayer = layersRef.current.get(prevSelected);
      if (prevLayer && 'setStyle' in prevLayer) {
        (prevLayer as { setStyle: (style: PathOptions) => void }).setStyle(
          getStyleForStatus(getStatusFromRef(prevSelected), false, false)
        );
      }
    }
    selectedRef.current = null;
    setSelectedMunicipality(null);
    setSelectedUnlinkedFeedId('');
  }, []);

  const selectedStatus = useMemo(() => {
    if (!selectedMunicipality) return null;
    const key = selectedMunicipality.toLowerCase().replace(/^['']/, '').replace(/\s+/g, '-').replace(/['']/g, '');
    return municipalityStatus[key] || null;
  }, [selectedMunicipality, municipalityStatus]);

  const stats = useMemo(() => {
    const municipalities = Object.values(municipalityStatus);
    return {
      total: 342,
      connected: municipalities.length,
      active: municipalities.filter(m => m.activeCount > 0).length,
      errors: municipalities.filter(m => m.errorCount > 0).length,
    };
  }, [municipalityStatus]);

  const netherlandsBounds: [[number, number], [number, number]] = [[50.75, 3.37], [53.47, 7.21]];

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Gemeentekaart Nederland</CardTitle>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Actief ({stats.active})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Fout ({stats.errors})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span>Gepauzeerd</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                  <span>Geen feed ({342 - stats.connected})</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[600px] rounded-b-lg overflow-hidden">
              <MapContainer
                className="h-full w-full"
                center={[52.1326, 5.2913]}
                zoom={7}
                scrollWheelZoom={true}
                style={{ background: '#f0f0f0' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  opacity={0.3}
                />
                <MapBounds bounds={netherlandsBounds} />
                <GeoJSON
                  key="municipality-geojson"
                  data={geoData}
                  style={style}
                  onEachFeature={onEachFeature}
                />
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="h-[680px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {selectedMunicipality || 'Selecteer gemeente'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {!selectedMunicipality ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MapPin className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-center">Klik op een gemeente om details te bekijken</p>
              </div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge variant={selectedStatus ? (selectedStatus.errorCount > 0 ? 'destructive' : 'default') : 'secondary'}>
                      {selectedStatus ? (
                        selectedStatus.errorCount > 0 ? (
                          <><AlertCircle className="w-3 h-3 mr-1" />Fout</>
                        ) : selectedStatus.activeCount > 0 ? (
                          <><CheckCircle className="w-3 h-3 mr-1" />Actief</>
                        ) : (
                          <><Pause className="w-3 h-3 mr-1" />Gepauzeerd</>
                        )
                      ) : 'Geen feed'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearSelection}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedStatus ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted rounded p-2">
                          <div className="text-muted-foreground">Feeds</div>
                          <div className="font-bold">{selectedStatus.feeds.length}</div>
                        </div>
                        <div className="bg-muted rounded p-2">
                          <div className="text-muted-foreground">Events</div>
                          <div className="font-bold">{selectedStatus.totalImported}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Gekoppelde feeds</h4>
                        {selectedStatus.feeds.map(feed => (
                          <Card key={feed.id} className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{feed.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {feed.lastFetchedAt
                                    ? format(new Date(feed.lastFetchedAt), 'dd MMM HH:mm', { locale: nl })
                                    : 'Nog niet opgehaald'}
                                </div>
                                <div className="text-xs">{feed.itemsImported} events</div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <Badge
                                  variant={feed.status === 'active' ? 'default' : feed.status === 'error' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {feed.status === 'active' ? 'Actief' : feed.status === 'error' ? 'Fout' : 'Pauze'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  disabled={municipalityMutation.isPending}
                                  onClick={() => municipalityMutation.mutate({ feedId: feed.id, municipality: null })}
                                >
                                  <Unlink className="w-3 h-3 mr-1" />
                                  Ontkoppelen
                                </Button>
                              </div>
                            </div>
                            {feed.lastErrorMessage && (
                              <p className="text-xs text-red-500 mt-1 truncate" title={feed.lastErrorMessage}>
                                {feed.lastErrorMessage}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <p className="text-muted-foreground text-sm mb-3">
                          Nog geen feeds gekoppeld aan {selectedMunicipality}
                        </p>
                        <Button size="sm" onClick={() => onAddFeed?.(selectedMunicipality)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Nieuwe feed toevoegen
                        </Button>
                      </div>

                      {unlinkedFeeds.length > 0 && (
                        <div className="border rounded-lg p-3 space-y-3">
                          <h4 className="font-medium text-sm flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" />
                            Bestaande feed koppelen
                          </h4>
                          <Select
                            value={selectedUnlinkedFeedId}
                            onValueChange={setSelectedUnlinkedFeedId}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Kies een feed..." />
                            </SelectTrigger>
                            <SelectContent>
                              {unlinkedFeeds.map(feed => (
                                <SelectItem key={feed.id} value={String(feed.id)}>
                                  {feed.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!selectedUnlinkedFeedId || municipalityMutation.isPending}
                            onClick={() => {
                              if (selectedUnlinkedFeedId && selectedMunicipality) {
                                municipalityMutation.mutate({
                                  feedId: parseInt(selectedUnlinkedFeedId),
                                  municipality: selectedMunicipality,
                                });
                              }
                            }}
                          >
                            {municipalityMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Link2 className="w-4 h-4 mr-2" />
                            )}
                            Koppelen
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
