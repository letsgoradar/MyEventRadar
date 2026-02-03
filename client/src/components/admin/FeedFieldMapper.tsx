import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  AlertCircle, 
  Check,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  Type,
  FileText,
  Tag,
  ChevronRight,
  ChevronDown,
  Info,
  HelpCircle,
  Sparkles,
  CircleDot,
} from 'lucide-react';

interface DiscoveredField {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'unknown';
  sampleValue: any;
  allSamples: any[];
  occurrenceCount: number;
  suggestedMapping?: string;
}

interface FeedDiscoveryResult {
  url: string;
  feedType: 'rss' | 'atom' | 'json' | 'unknown';
  totalItems: number;
  discoveredFields: DiscoveredField[];
  sampleItems: any[];
  previewEvent: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    image?: string;
    link?: string;
  } | null;
  errors: string[];
}

interface FieldMapping {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  image?: string;
  link?: string;
  category?: string;
}

interface FeedFieldMapperProps {
  feedUrl: string;
  onMappingComplete: (mapping: FieldMapping, discoveryResult: FeedDiscoveryResult) => void;
  onValidationChange?: (isValid: boolean, missingFields: string[]) => void;
  initialMapping?: FieldMapping;
}

const MAPPING_OPTIONS = [
  { value: 'title', label: 'Titel', description: 'De naam van het event', icon: Type, required: true },
  { value: 'description', label: 'Beschrijving', description: 'Uitleg over het event', icon: FileText, required: false },
  { value: 'startTime', label: 'Startdatum', description: 'Wanneer het event begint', icon: Calendar, required: true },
  { value: 'endTime', label: 'Einddatum', description: 'Wanneer het event eindigt', icon: Clock, required: false },
  { value: 'location', label: 'Locatie', description: 'Waar het event plaatsvindt', icon: MapPin, required: true },
  { value: 'image', label: 'Afbeelding', description: 'Foto of banner van het event', icon: ImageIcon, required: false },
  { value: 'link', label: 'Link', description: 'URL naar meer informatie', icon: ExternalLink, required: false },
  { value: 'category', label: 'Categorie', description: 'Type event (muziek, sport, etc.)', icon: Tag, required: false },
];

const TYPE_LEGEND = [
  { type: 'string', label: 'Tekst', description: 'Gewone tekst zoals titels en beschrijvingen', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { type: 'date', label: 'Datum', description: 'Datum en/of tijd (bijv. 2025-01-15)', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { type: 'number', label: 'Getal', description: 'Numerieke waarde', color: 'bg-green-100 text-green-800 border-green-200' },
  { type: 'array', label: 'Lijst', description: 'Meerdere items (bijv. tags)', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { type: 'object', label: 'Genest', description: 'Bevat meerdere sub-velden', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

function getTypeInfo(type: DiscoveredField['type']) {
  return TYPE_LEGEND.find(t => t.type === type) || { 
    type: 'unknown', 
    label: 'Onbekend', 
    description: 'Type niet herkend',
    color: 'bg-gray-100 text-gray-600 border-gray-200' 
  };
}

function formatSampleValue(value: any, maxLength: number = 100): string {
  if (value === null || value === undefined) return '(leeg)';
  if (typeof value === 'object') {
    const str = JSON.stringify(value, null, 0);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function getReadableFieldName(path: string): string {
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  
  const translations: Record<string, string> = {
    'title': 'Titel',
    'name': 'Naam',
    'description': 'Beschrijving',
    'content': 'Inhoud',
    'excerpt': 'Samenvatting',
    'start_date': 'Startdatum',
    'end_date': 'Einddatum',
    'startdatum': 'Startdatum',
    'einddatum': 'Einddatum',
    'date': 'Datum',
    'location': 'Locatie',
    'venue': 'Locatie',
    'address': 'Adres',
    'city': 'Stad',
    'image': 'Afbeelding',
    'featured_image': 'Afbeelding',
    'thumbnail': 'Thumbnail',
    'link': 'Link',
    'url': 'URL',
    'permalink': 'Link',
    'category': 'Categorie',
    'categories': 'Categorieën',
    'tags': 'Tags',
    'geo_lat': 'Breedtegraad',
    'geo_lng': 'Lengtegraad',
    'price': 'Prijs',
    'cost': 'Kosten',
  };
  
  return translations[lastPart.toLowerCase()] || lastPart;
}

export function FeedFieldMapper({ feedUrl, onMappingComplete, onValidationChange, initialMapping }: FeedFieldMapperProps) {
  const [discoveryResult, setDiscoveryResult] = useState<FeedDiscoveryResult | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(initialMapping || {});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [showLegend, setShowLegend] = useState(false);

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/admin/rss-feeds/discover-fields', {
        method: 'POST',
        data: { url: feedUrl },
      });
      return response as FeedDiscoveryResult;
    },
    onSuccess: (data) => {
      setDiscoveryResult(data);
      
      const autoMapping: FieldMapping = {};
      for (const field of data.discoveredFields) {
        if (field.suggestedMapping && !mapping[field.suggestedMapping as keyof FieldMapping]) {
          autoMapping[field.suggestedMapping as keyof FieldMapping] = field.path;
        }
      }
      setMapping(prev => ({ ...prev, ...autoMapping }));
    },
  });

  useEffect(() => {
    if (feedUrl) {
      discoverMutation.mutate();
    }
  }, [feedUrl]);

  useEffect(() => {
    if (onValidationChange) {
      const requiredFields = MAPPING_OPTIONS.filter(opt => opt.required);
      const missingFields = requiredFields
        .filter(opt => !mapping[opt.value as keyof FieldMapping])
        .map(opt => opt.label);
      const isValid = missingFields.length === 0;
      onValidationChange(isValid, missingFields);
    }
  }, [mapping, onValidationChange]);

  const handleMappingChange = (fieldPath: string, mappingType: string) => {
    if (mappingType === 'none') {
      const newMapping = { ...mapping };
      for (const [key, value] of Object.entries(newMapping)) {
        if (value === fieldPath) {
          delete newMapping[key as keyof FieldMapping];
        }
      }
      setMapping(newMapping);
    } else {
      const newMapping = { ...mapping };
      for (const [key] of Object.entries(newMapping)) {
        if (key === mappingType) {
          delete newMapping[key as keyof FieldMapping];
        }
      }
      newMapping[mappingType as keyof FieldMapping] = fieldPath;
      setMapping(newMapping);
    }
  };

  const getCurrentMapping = (fieldPath: string): string => {
    for (const [key, value] of Object.entries(mapping)) {
      if (value === fieldPath) return key;
    }
    return 'none';
  };

  const getMappingStatus = () => {
    const status: { field: typeof MAPPING_OPTIONS[0], mapped: boolean, path?: string }[] = [];
    for (const opt of MAPPING_OPTIONS) {
      const path = mapping[opt.value as keyof FieldMapping];
      status.push({
        field: opt,
        mapped: Boolean(path),
        path,
      });
    }
    return status;
  };

  const toggleFieldExpanded = (path: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFields(newExpanded);
  };

  const generatePreview = () => {
    if (!discoveryResult || discoveryResult.sampleItems.length === 0) return null;
    
    const sampleItem = discoveryResult.sampleItems[0];
    const preview: Record<string, any> = {};
    
    for (const [key, path] of Object.entries(mapping)) {
      if (path) {
        const value = getValueByPath(sampleItem, path);
        if (value !== undefined) {
          preview[key] = value;
        }
      }
    }
    
    return preview;
  };

  const getValueByPath = (obj: any, path: string): any => {
    const parts = path.split('.').flatMap(p => {
      const match = p.match(/^(.+)\[(\d+)\]$/);
      if (match) return [match[1], parseInt(match[2])];
      return [p];
    });
    
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    if (current && typeof current === 'object' && current._ !== undefined) {
      return current._;
    }
    
    return current;
  };

  const groupFields = () => {
    if (!discoveryResult) return { suggested: [], other: [] };
    
    const suggested: DiscoveredField[] = [];
    const other: DiscoveredField[] = [];
    
    for (const field of discoveryResult.discoveredFields) {
      if (field.suggestedMapping || getCurrentMapping(field.path) !== 'none') {
        suggested.push(field);
      } else {
        other.push(field);
      }
    }
    
    return { suggested, other };
  };

  if (discoverMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-base font-medium">Feed wordt geanalyseerd...</p>
          <p className="text-sm text-muted-foreground mt-1">Dit kan even duren bij grote feeds</p>
        </div>
      </div>
    );
  }

  if (discoverMutation.isError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-5 w-5" />
        <AlertDescription className="ml-2">
          <span className="font-medium">Fout bij analyseren van de feed.</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-4"
            onClick={() => discoverMutation.mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Opnieuw proberen
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!discoveryResult) {
    return null;
  }

  if (discoveryResult.errors.length > 0) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-5 w-5" />
        <AlertDescription className="ml-2">
          {discoveryResult.errors.join(', ')}
        </AlertDescription>
      </Alert>
    );
  }

  const preview = generatePreview();
  const mappingStatus = getMappingStatus();
  const { suggested, other } = groupFields();
  const requiredMapped = mappingStatus.filter(s => s.field.required && s.mapped).length;
  const requiredTotal = mappingStatus.filter(s => s.field.required).length;
  const optionalMapped = mappingStatus.filter(s => !s.field.required && s.mapped).length;

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Veld Toewijzing
            </h2>
            <p className="text-muted-foreground mt-1">
              Er zijn <strong>{discoveryResult.discoveredFields.length} velden</strong> gevonden in {discoveryResult.totalItems} {discoveryResult.feedType.toUpperCase()} items.
              Wijs hieronder de juiste velden toe aan event eigenschappen.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => discoverMutation.mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Opnieuw analyseren
          </Button>
        </div>
      </div>

      {/* Mapping Status Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDot className="h-4 w-4" />
            Toewijzing Status
          </CardTitle>
          <CardDescription>
            {requiredMapped === requiredTotal ? (
              <span className="text-green-600 font-medium">Alle verplichte velden zijn toegewezen!</span>
            ) : (
              <span className="text-amber-600 font-medium">{requiredTotal - requiredMapped} verplichte veld(en) moeten nog worden toegewezen</span>
            )}
            {optionalMapped > 0 && <span className="text-muted-foreground"> • {optionalMapped} optionele velden toegewezen</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mappingStatus.map(({ field, mapped, path }) => {
              const Icon = field.icon;
              return (
                <div 
                  key={field.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                    mapped 
                      ? 'bg-green-50 border-green-200' 
                      : field.required 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    mapped 
                      ? 'bg-green-100 text-green-700' 
                      : field.required 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm">{field.label}</span>
                      {field.required && <span className="text-red-500 text-xs">*</span>}
                    </div>
                    {mapped ? (
                      <div className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="truncate">{getReadableFieldName(path!)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="h-3 w-3" />
                        <span>Niet toegewezen</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend Toggle */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowLegend(!showLegend)}
          className="text-muted-foreground"
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          {showLegend ? 'Verberg' : 'Toon'} veldtype uitleg
        </Button>
      </div>

      {/* Legend */}
      {showLegend && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">Veldtypes uitleg:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TYPE_LEGEND.map((item) => (
                <div key={item.type} className="flex items-start gap-2">
                  <Badge className={`${item.color} border shrink-0`}>
                    {item.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Field list (3 columns) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Suggested / Auto-detected fields */}
          {suggested.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-700">
                  <Sparkles className="h-4 w-4" />
                  Automatisch Herkende Velden ({suggested.length})
                </CardTitle>
                <CardDescription>
                  Deze velden zijn automatisch herkend op basis van hun naam. Controleer of de toewijzing klopt.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2 p-4">
                    {suggested.map((field) => (
                      <FieldRow 
                        key={field.path} 
                        field={field} 
                        mapping={mapping}
                        expandedFields={expandedFields}
                        getCurrentMapping={getCurrentMapping}
                        handleMappingChange={handleMappingChange}
                        toggleFieldExpanded={toggleFieldExpanded}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Other fields */}
          {other.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Overige Velden ({other.length})
                </CardTitle>
                <CardDescription>
                  Deze velden zijn niet automatisch herkend. Je kunt ze handmatig toewijzen indien nodig.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-2 p-4">
                    {other.map((field) => (
                      <FieldRow 
                        key={field.path} 
                        field={field} 
                        mapping={mapping}
                        expandedFields={expandedFields}
                        getCurrentMapping={getCurrentMapping}
                        handleMappingChange={handleMappingChange}
                        toggleFieldExpanded={toggleFieldExpanded}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview (2 columns) */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Voorbeeld Event</CardTitle>
              <CardDescription>
                Zo ziet een geïmporteerd event eruit met de huidige toewijzingen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview && Object.keys(preview).length > 0 ? (
                <div className="space-y-4">
                  {preview.image && (
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img 
                        src={typeof preview.image === 'string' ? preview.image : preview.image?.url || ''} 
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  {preview.title && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Titel</Label>
                      <p className="text-lg font-semibold mt-1">{formatSampleValue(preview.title, 120)}</p>
                    </div>
                  )}
                  
                  {preview.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Beschrijving</Label>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-4">
                        {String(preview.description).replace(/<[^>]*>/g, '').substring(0, 300)}
                      </p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    {preview.startTime && (
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Startdatum
                        </Label>
                        <p className="text-sm font-medium mt-1">{formatSampleValue(preview.startTime, 50)}</p>
                      </div>
                    )}
                    
                    {preview.endTime && (
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Einddatum
                        </Label>
                        <p className="text-sm font-medium mt-1">{formatSampleValue(preview.endTime, 50)}</p>
                      </div>
                    )}
                  </div>
                  
                  {preview.location && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Locatie
                      </Label>
                      <p className="text-sm font-medium mt-1">{formatSampleValue(preview.location, 80)}</p>
                    </div>
                  )}
                  
                  {preview.link && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Link
                      </Label>
                      <p className="text-sm text-blue-600 truncate mt-1">{formatSampleValue(preview.link, 60)}</p>
                    </div>
                  )}
                  
                  {preview.category && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Categorie
                      </Label>
                      <Badge variant="secondary" className="mt-1">{formatSampleValue(preview.category, 30)}</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-muted/30 rounded-lg">
                  <Info className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Geen preview beschikbaar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Wijs velden toe om een voorbeeld te zien
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Validation Warning */}
      {requiredMapped < requiredTotal && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <span className="font-medium">Verplichte velden ontbreken:</span>{' '}
            {mappingStatus.filter(s => s.field.required && !s.mapped).map(s => s.field.label).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          size="lg"
          onClick={() => onMappingComplete(mapping, discoveryResult)}
          disabled={requiredMapped < requiredTotal}
        >
          <Check className="h-5 w-5 mr-2" />
          Toewijzing Opslaan
        </Button>
      </div>
    </div>
  );
}

// Separate component for field rows
function FieldRow({ 
  field, 
  mapping, 
  expandedFields, 
  getCurrentMapping, 
  handleMappingChange, 
  toggleFieldExpanded 
}: {
  field: DiscoveredField;
  mapping: FieldMapping;
  expandedFields: Set<string>;
  getCurrentMapping: (path: string) => string;
  handleMappingChange: (path: string, type: string) => void;
  toggleFieldExpanded: (path: string) => void;
}) {
  const currentMapping = getCurrentMapping(field.path);
  const isExpanded = expandedFields.has(field.path);
  const typeInfo = getTypeInfo(field.type);
  const readableName = getReadableFieldName(field.path);
  
  return (
    <div 
      className={`border-2 rounded-lg p-4 transition-all ${
        currentMapping !== 'none' 
          ? 'border-green-300 bg-green-50/50' 
          : field.suggestedMapping 
            ? 'border-amber-200 bg-amber-50/30'
            : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Field name and path */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => toggleFieldExpanded(field.path)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            
            <span className="font-medium text-base">{readableName}</span>
            
            <Badge className={`${typeInfo.color} border text-xs`}>
              {typeInfo.label}
            </Badge>
            
            {field.suggestedMapping && currentMapping === 'none' && (
              <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800">
                Suggestie: {MAPPING_OPTIONS.find(o => o.value === field.suggestedMapping)?.label}
              </Badge>
            )}
            
            {currentMapping !== 'none' && (
              <Badge className="text-xs bg-green-100 border-green-300 text-green-800">
                ✓ Toegewezen als {MAPPING_OPTIONS.find(o => o.value === currentMapping)?.label}
              </Badge>
            )}
          </div>
          
          {/* Technical path */}
          <code className="text-xs text-muted-foreground block mt-1 pl-7 font-mono">
            {field.path}
          </code>
          
          {/* Sample value */}
          <div className="mt-2 pl-7">
            <p className="text-sm text-gray-700 bg-gray-100 rounded px-2 py-1 inline-block max-w-full">
              <span className="text-xs text-muted-foreground mr-1">Voorbeeld:</span>
              {formatSampleValue(field.sampleValue, 150)}
            </p>
          </div>
          
          {/* More samples when expanded */}
          {isExpanded && field.allSamples.length > 1 && (
            <div className="mt-3 pl-7 space-y-1.5 border-l-2 border-gray-200 ml-2 py-1">
              <p className="text-xs font-medium text-muted-foreground">Meer voorbeelden uit de feed:</p>
              {field.allSamples.slice(1, 5).map((sample, i) => (
                <p key={i} className="text-sm text-gray-600 pl-3">
                  {formatSampleValue(sample, 120)}
                </p>
              ))}
              {field.allSamples.length > 5 && (
                <p className="text-xs text-muted-foreground pl-3">
                  ...en {field.allSamples.length - 5} meer
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Mapping selector */}
        <Select
          value={currentMapping}
          onValueChange={(value) => handleMappingChange(field.path, value)}
        >
          <SelectTrigger className="w-44 h-10">
            <SelectValue placeholder="Toewijzen aan..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Niet toewijzen</span>
            </SelectItem>
            {MAPPING_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isUsed = Boolean(mapping[opt.value as keyof FieldMapping] && 
                             mapping[opt.value as keyof FieldMapping] !== field.path);
              return (
                <SelectItem 
                  key={opt.value} 
                  value={opt.value}
                  disabled={isUsed}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{opt.label}</span>
                    {opt.required && <span className="text-red-500">*</span>}
                    {isUsed && <span className="text-xs text-muted-foreground">(in gebruik)</span>}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
