import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Trash2, Edit, ExternalLink, SkipForward, MapPin, Calendar, CheckCircle, RefreshCw, Save, FileCheck, Brain, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface RssFeedItem {
  id: number;
  feedId: number;
  externalId: string;
  title: string;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  rawData: any;
  eventId: number | null;
  isProcessed: boolean;
  processingStatus: string;
  missingFields: string[] | null;
  derivedData: {
    geocodedAddress?: string;
    geocodedLat?: number;
    geocodedLng?: number;
    parsedStartDate?: string;
    parsedEndDate?: string;
    detectedVenue?: string;
    validationErrors?: string[];
    aiDateConfidence?: number;
    aiDateSource?: string;
    dateRescuedByAi?: boolean;
    dateRescueFailed?: boolean;
    aiDateResult?: { startDate?: string; confidence?: number; source?: string };
    sourceUrl?: string;
  } | null;
  lastAttemptedAt: string | null;
  createdAt: string;
}

interface RssFeed {
  id: number;
  name: string;
  municipality: string | null;
}

interface IncompleteItemsManagerProps {
  feedId?: number;
}

export default function IncompleteItemsManager({ feedId }: IncompleteItemsManagerProps) {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<RssFeedItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('incomplete');
  const [editForm, setEditForm] = useState({
    address: '',
    latitude: '',
    longitude: '',
    startDate: '',
    startTime: '',
  });

  const statusParam = activeTab === 'all' ? 'all' : activeTab === 'missing_date' ? 'missing_date' : undefined;

  const { data: items = [], isLoading } = useQuery<RssFeedItem[]>({
    queryKey: ['/api/admin/incomplete-items', feedId, statusParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feedId) params.set('feedId', feedId.toString());
      if (statusParam) params.set('status', statusParam);
      const url = `/api/admin/incomplete-items${params.toString() ? '?' + params : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: feeds = [] } = useQuery<RssFeed[]>({
    queryKey: ['/api/admin/feeds-list'],
  });

  const { data: incompleteCount } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/incomplete-items/count', feedId, 'incomplete'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feedId) params.set('feedId', feedId.toString());
      const url = `/api/admin/incomplete-items/count?${params}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: missingDateCount } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/incomplete-items/count', feedId, 'missing_date'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feedId) params.set('feedId', feedId.toString());
      params.set('status', 'missing_date');
      const url = `/api/admin/incomplete-items/count?${params}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const skipItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/incomplete-items/${id}/skip`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items'] });
      toast({
        title: 'Item overgeslagen',
        description: 'Het item wordt niet meer getoond.',
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/incomplete-items/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items'] });
      toast({
        title: 'Item verwijderd',
        description: 'Het item is verwijderd uit de wachtrij.',
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/admin/incomplete-items/${id}`, {
        method: 'PATCH',
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items'] });
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      toast({
        title: 'Item bijgewerkt',
        description: 'De gegevens zijn opgeslagen.',
      });
    },
  });

  const importItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/incomplete-items/${id}/import`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Import failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      toast({
        title: 'Event aangemaakt!',
        description: 'Het item is succesvol geïmporteerd als evenement.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Import mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const acceptAiDateMutation = useMutation({
    mutationFn: async (item: RssFeedItem) => {
      const derivedData = item.derivedData || {};
      const startDate = derivedData.parsedStartDate;
      if (!startDate) throw new Error('Geen AI-datum beschikbaar');

      return apiRequest(`/api/admin/incomplete-items/${item.id}`, {
        method: 'PATCH',
        data: {
          derivedData: {
            ...derivedData,
            dateAcceptedByAdmin: true,
          },
          missingFields: (item.missingFields || []).filter(f => f !== 'date'),
          processingStatus: 'incomplete',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items'] });
      toast({
        title: 'AI-datum geaccepteerd',
        description: 'De datum is overgenomen. Het item kan nu geïmporteerd worden.',
      });
    },
  });

  const openEditDialog = (item: RssFeedItem) => {
    setSelectedItem(item);
    setEditForm({
      address: item.derivedData?.geocodedAddress || '',
      latitude: item.derivedData?.geocodedLat?.toString() || '',
      longitude: item.derivedData?.geocodedLng?.toString() || '',
      startDate: item.derivedData?.parsedStartDate
        ? item.derivedData.parsedStartDate.slice(0, 10)
        : '',
      startTime: '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedItem) return;

    const derivedData = {
      ...selectedItem.derivedData,
      geocodedAddress: editForm.address || undefined,
      geocodedLat: editForm.latitude ? parseFloat(editForm.latitude) : undefined,
      geocodedLng: editForm.longitude ? parseFloat(editForm.longitude) : undefined,
      parsedStartDate: editForm.startDate || undefined,
    };

    const hasLocation = derivedData.geocodedLat && derivedData.geocodedLng;
    const hasDate = derivedData.parsedStartDate;
    
    const missingFields = [];
    if (!hasLocation) missingFields.push('location');
    if (!hasDate) missingFields.push('date');

    updateItemMutation.mutate({
      id: selectedItem.id,
      data: {
        derivedData,
        missingFields: missingFields.length > 0 ? missingFields : null,
      },
    });
  };

  const getFeedName = (feedId: number) => {
    const feed = feeds.find(f => f.id === feedId);
    return feed?.name || `Feed ${feedId}`;
  };

  const getMissingFieldBadges = (fields: string[] | null) => {
    if (!fields || fields.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {fields.map(field => (
          <Badge key={field} variant="destructive" className="text-xs">
            {field === 'location' && <MapPin className="w-3 h-3 mr-1" />}
            {field === 'date' && <Calendar className="w-3 h-3 mr-1" />}
            {field}
          </Badge>
        ))}
      </div>
    );
  };

  const getAiDateInfo = (item: RssFeedItem) => {
    const d = item.derivedData;
    if (!d) return null;

    if (d.dateRescuedByAi && d.parsedStartDate) {
      return (
        <div className="mt-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Brain className="w-3 h-3 text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">
              AI: {format(new Date(d.parsedStartDate), 'd MMM yyyy HH:mm', { locale: nl })}
            </span>
          </div>
          {d.aiDateConfidence !== undefined && (
            <span className="text-xs text-muted-foreground">
              Zekerheid: {Math.round(d.aiDateConfidence * 100)}%
              {d.aiDateSource ? ` — ${d.aiDateSource}` : ''}
            </span>
          )}
        </div>
      );
    }

    if (d.dateRescueFailed && d.aiDateResult) {
      return (
        <div className="mt-1 flex items-center gap-1">
          <Brain className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-muted-foreground">
            AI kon geen datum vinden
            {d.aiDateResult.confidence !== undefined ? ` (${Math.round(d.aiDateResult.confidence * 100)}%)` : ''}
          </span>
        </div>
      );
    }

    if (item.processingStatus === 'missing_date' && !d.dateRescueFailed) {
      return (
        <div className="mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-amber-600">Wacht op AI datum-analyse</span>
        </div>
      );
    }

    return null;
  };

  const renderItemRow = (item: RssFeedItem) => (
    <TableRow key={item.id} data-testid={`incomplete-item-${item.id}`}>
      <TableCell>
        <div className="max-w-[300px]">
          <div className="font-medium truncate" title={item.title}>
            {item.title}
          </div>
          {item.link && (
            <a 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Bron bekijken
            </a>
          )}
          {getAiDateInfo(item)}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{getFeedName(item.feedId)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {getMissingFieldBadges(item.missingFields)}
          {item.processingStatus === 'missing_date' && (
            <Badge variant="secondary" className="text-xs w-fit">
              <Calendar className="w-3 h-3 mr-1" />
              datum ontbreekt
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {item.lastAttemptedAt 
          ? format(new Date(item.lastAttemptedAt), 'd MMM HH:mm', { locale: nl })
          : '-'
        }
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {item.derivedData?.dateRescuedByAi && item.derivedData?.parsedStartDate && item.processingStatus === 'missing_date' && (
            <Button
              size="sm"
              variant="default"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => acceptAiDateMutation.mutate(item)}
              disabled={acceptAiDateMutation.isPending}
              title="AI-datum accepteren"
            >
              <Brain className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditDialog(item)}
            title="Bewerken"
            data-testid={`edit-item-${item.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => importItemMutation.mutate(item.id)}
            disabled={importItemMutation.isPending || Boolean(item.missingFields && item.missingFields.length > 0)}
            title={item.missingFields && item.missingFields.length > 0 ? "Vul eerst ontbrekende velden aan" : "Importeren als event"}
            data-testid={`import-item-${item.id}`}
          >
            <FileCheck className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => skipItemMutation.mutate(item.id)}
            disabled={skipItemMutation.isPending}
            title="Overslaan"
            data-testid={`skip-item-${item.id}`}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                data-testid={`delete-item-${item.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Item verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Weet je zeker dat je "{item.title}" wilt verwijderen?
                  Dit kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteItemMutation.mutate(item.id)}
                >
                  Verwijderen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  const totalCount = (incompleteCount?.count || 0) + (missingDateCount?.count || 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Incomplete Items ({totalCount})
          </CardTitle>
          <CardDescription>
            Events die niet geïmporteerd konden worden vanwege ontbrekende informatie.
            Vul de ontbrekende gegevens aan om ze alsnog te importeren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="incomplete">
                Incompleet ({incompleteCount?.count || 0})
              </TabsTrigger>
              <TabsTrigger value="missing_date">
                <Calendar className="w-4 h-4 mr-1" />
                Datum ontbreekt ({missingDateCount?.count || 0})
              </TabsTrigger>
              <TabsTrigger value="all">
                Alles ({totalCount})
              </TabsTrigger>
            </TabsList>

            {['incomplete', 'missing_date', 'all'].map(tab => (
              <TabsContent key={tab} value={tab}>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>Geen items gevonden!</p>
                    <p className="text-sm">
                      {tab === 'missing_date'
                        ? 'Er zijn geen items met ontbrekende datums.'
                        : 'Alle events zijn succesvol geïmporteerd.'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Feed</TableHead>
                        <TableHead>Ontbrekend</TableHead>
                        <TableHead>Laatste poging</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.slice(0, 50).map(renderItemRow)}
                    </TableBody>
                  </Table>
                )}

                {items.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Toont 50 van {items.length} items
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Item aanvullen</DialogTitle>
            <DialogDescription>
              Vul de ontbrekende informatie aan voor "{selectedItem?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Straatnaam 123, Stad"
                data-testid="input-edit-address"
              />
              {selectedItem?.missingFields?.includes('location') && (
                <p className="text-xs text-orange-600">Locatie ontbreekt - vul adres of coördinaten in</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Breedtegraad</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0001"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  placeholder="51.4416"
                  data-testid="input-edit-latitude"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Lengtegraad</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0001"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  placeholder="5.4697"
                  data-testid="input-edit-longitude"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum</Label>
              <Input
                id="startDate"
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                data-testid="input-edit-date"
              />
              {selectedItem?.missingFields?.includes('date') && (
                <p className="text-xs text-orange-600">Datum ontbreekt - vul startdatum in</p>
              )}
              {selectedItem?.derivedData?.dateRescuedByAi && selectedItem?.derivedData?.parsedStartDate && (
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-md flex items-start gap-2">
                  <Brain className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      AI-suggestie: {format(new Date(selectedItem.derivedData.parsedStartDate), 'd MMMM yyyy HH:mm', { locale: nl })}
                    </p>
                    {selectedItem.derivedData.aiDateConfidence !== undefined && (
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Zekerheid: {Math.round(selectedItem.derivedData.aiDateConfidence * 100)}%
                        {selectedItem.derivedData.aiDateSource ? ` — ${selectedItem.derivedData.aiDateSource}` : ''}
                      </p>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-xs text-purple-600"
                      onClick={() => {
                        if (selectedItem?.derivedData?.parsedStartDate) {
                          setEditForm(f => ({
                            ...f,
                            startDate: selectedItem.derivedData!.parsedStartDate!.slice(0, 10),
                          }));
                        }
                      }}
                    >
                      AI-datum overnemen
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {selectedItem?.derivedData?.validationErrors && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Validatie fouten:
                </h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                  {selectedItem.derivedData.validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateItemMutation.isPending}
              data-testid="button-save-edit"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
