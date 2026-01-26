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
import { AlertTriangle, Trash2, Edit, ExternalLink, SkipForward, MapPin, Calendar, CheckCircle, RefreshCw, Save, FileCheck } from 'lucide-react';
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
  const [editForm, setEditForm] = useState({
    address: '',
    latitude: '',
    longitude: '',
    startDate: '',
    startTime: '',
  });

  const { data: items = [], isLoading } = useQuery<RssFeedItem[]>({
    queryKey: ['/api/admin/incomplete-items', feedId],
    queryFn: async () => {
      const url = feedId 
        ? `/api/admin/incomplete-items?feedId=${feedId}`
        : '/api/admin/incomplete-items';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: feeds = [] } = useQuery<RssFeed[]>({
    queryKey: ['/api/admin/feeds-list'],
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/incomplete-items/count', feedId],
    queryFn: async () => {
      const url = feedId 
        ? `/api/admin/incomplete-items/count?feedId=${feedId}`
        : '/api/admin/incomplete-items/count';
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items/count'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items/count'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/incomplete-items/count'] });
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

  const openEditDialog = (item: RssFeedItem) => {
    setSelectedItem(item);
    setEditForm({
      address: item.derivedData?.geocodedAddress || '',
      latitude: item.derivedData?.geocodedLat?.toString() || '',
      longitude: item.derivedData?.geocodedLng?.toString() || '',
      startDate: item.derivedData?.parsedStartDate || '',
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Incomplete Items ({countData?.count || 0})
          </CardTitle>
          <CardDescription>
            Events die niet geïmporteerd konden worden vanwege ontbrekende informatie.
            Vul de ontbrekende gegevens aan om ze alsnog te importeren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>Geen incomplete items gevonden!</p>
              <p className="text-sm">Alle events zijn succesvol geïmporteerd.</p>
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
                {items.slice(0, 50).map((item) => (
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getFeedName(item.feedId)}</Badge>
                    </TableCell>
                    <TableCell>
                      {getMissingFieldBadges(item.missingFields)}
                    </TableCell>
                    <TableCell>
                      {item.lastAttemptedAt 
                        ? format(new Date(item.lastAttemptedAt), 'd MMM HH:mm', { locale: nl })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                ))}
              </TableBody>
            </Table>
          )}
          
          {items.length > 50 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Toont 50 van {items.length} items
            </p>
          )}
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
