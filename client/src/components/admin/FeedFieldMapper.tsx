import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  RefreshCw,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  Type,
  FileText,
  Building2,
  Tag,
  ChevronRight,
  ChevronDown,
  Info,
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
  { value: 'title', label: 'Titel', icon: Type, required: true },
  { value: 'description', label: 'Beschrijving', icon: FileText, required: false },
  { value: 'startTime', label: 'Startdatum/tijd', icon: Calendar, required: true },
  { value: 'endTime', label: 'Einddatum/tijd', icon: Clock, required: false },
  { value: 'location', label: 'Locatie', icon: MapPin, required: true },
  { value: 'image', label: 'Afbeelding', icon: ImageIcon, required: false },
  { value: 'link', label: 'Link', icon: ExternalLink, required: false },
  { value: 'category', label: 'Categorie', icon: Tag, required: false },
];

function getTypeColor(type: DiscoveredField['type']): string {
  switch (type) {
    case 'string': return 'bg-blue-100 text-blue-800';
    case 'number': return 'bg-green-100 text-green-800';
    case 'boolean': return 'bg-yellow-100 text-yellow-800';
    case 'date': return 'bg-purple-100 text-purple-800';
    case 'array': return 'bg-orange-100 text-orange-800';
    case 'object': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function formatSampleValue(value: any, maxLength: number = 80): string {
  if (value === null || value === undefined) return '(leeg)';
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

export function FeedFieldMapper({ feedUrl, onMappingComplete, onValidationChange, initialMapping }: FeedFieldMapperProps) {
  const [discoveryResult, setDiscoveryResult] = useState<FeedDiscoveryResult | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>(initialMapping || {});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

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
      
      // Auto-set mappings from suggestions
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

  // Report validation status when mapping changes
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
      // Remove any existing mapping for this field
      const newMapping = { ...mapping };
      for (const [key, value] of Object.entries(newMapping)) {
        if (value === fieldPath) {
          delete newMapping[key as keyof FieldMapping];
        }
      }
      setMapping(newMapping);
    } else {
      // Remove this mapping type from any other field first
      const newMapping = { ...mapping };
      for (const [key, value] of Object.entries(newMapping)) {
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

  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];
    for (const opt of MAPPING_OPTIONS) {
      if (opt.required && !mapping[opt.value as keyof FieldMapping]) {
        missing.push(opt.label);
      }
    }
    return missing;
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

  // Generate preview from current mappings
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
    
    // Handle XML text nodes
    if (current && typeof current === 'object' && current._ !== undefined) {
      return current._;
    }
    
    return current;
  };

  if (discoverMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Velden ontdekken in de feed...</p>
      </div>
    );
  }

  if (discoverMutation.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Fout bij analyseren van de feed. Probeer opnieuw.
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {discoveryResult.errors.join(', ')}
        </AlertDescription>
      </Alert>
    );
  }

  const preview = generatePreview();
  const missingFields = getMissingRequiredFields();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Veld Verkenner</h3>
          <p className="text-xs text-muted-foreground">
            {discoveryResult.totalItems} items gevonden in {discoveryResult.feedType.toUpperCase()} feed
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => discoverMutation.mutate()}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Verversen
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Field list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Beschikbare Velden</CardTitle>
            <CardDescription className="text-xs">
              Koppel velden aan event eigenschappen
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[350px]">
              <div className="space-y-1 p-2">
                {discoveryResult.discoveredFields.map((field) => {
                  const currentMapping = getCurrentMapping(field.path);
                  const isExpanded = expandedFields.has(field.path);
                  const mappingOption = MAPPING_OPTIONS.find(o => o.value === currentMapping);
                  
                  return (
                    <div 
                      key={field.path}
                      className={`border rounded-md p-2 transition-colors ${
                        currentMapping !== 'none' ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleFieldExpanded(field.path)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <code className="text-xs font-mono truncate">{field.path}</code>
                            <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${getTypeColor(field.type)}`}>
                              {field.type}
                            </Badge>
                            {field.suggestedMapping && currentMapping === 'none' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                                suggestie: {field.suggestedMapping}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="mt-1 text-xs text-muted-foreground truncate pl-5">
                            {formatSampleValue(field.sampleValue, 60)}
                          </div>
                          
                          {isExpanded && field.allSamples.length > 1 && (
                            <div className="mt-2 pl-5 space-y-1 border-l-2 border-muted ml-1">
                              <p className="text-[10px] font-medium text-muted-foreground">Meer voorbeelden:</p>
                              {field.allSamples.slice(1).map((sample, i) => (
                                <p key={i} className="text-xs text-muted-foreground pl-2">
                                  {formatSampleValue(sample, 80)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <Select
                          value={currentMapping}
                          onValueChange={(value) => handleMappingChange(field.path, value)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Niet koppelen</span>
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
                                    <Icon className="h-3 w-3" />
                                    {opt.label}
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
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voorbeeld Event</CardTitle>
            <CardDescription className="text-xs">
              Zo ziet een geïmporteerd event eruit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preview && Object.keys(preview).length > 0 ? (
              <div className="space-y-3">
                {preview.image && (
                  <div className="aspect-video bg-muted rounded-md overflow-hidden">
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
                    <Label className="text-xs text-muted-foreground">Titel</Label>
                    <p className="text-sm font-medium">{formatSampleValue(preview.title, 100)}</p>
                  </div>
                )}
                
                {preview.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Beschrijving</Label>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {String(preview.description).replace(/<[^>]*>/g, '').substring(0, 200)}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {preview.startTime && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Start
                      </Label>
                      <p className="text-xs">{formatSampleValue(preview.startTime, 40)}</p>
                    </div>
                  )}
                  
                  {preview.endTime && (
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Eind
                      </Label>
                      <p className="text-xs">{formatSampleValue(preview.endTime, 40)}</p>
                    </div>
                  )}
                </div>
                
                {preview.location && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Locatie
                    </Label>
                    <p className="text-xs">{formatSampleValue(preview.location, 60)}</p>
                  </div>
                )}
                
                {preview.link && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Link
                    </Label>
                    <p className="text-xs truncate">{formatSampleValue(preview.link, 50)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Koppel velden om een preview te zien
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation */}
      {missingFields.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Verplichte velden nog niet gekoppeld:</span>{' '}
            {missingFields.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => onMappingComplete(mapping, discoveryResult)}
          disabled={missingFields.length > 0}
        >
          <Check className="h-4 w-4 mr-2" />
          Mapping opslaan
        </Button>
      </div>
    </div>
  );
}
