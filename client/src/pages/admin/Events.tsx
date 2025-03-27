import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AdminNav from '@/components/Layout/AdminNav';
import { 
  CalendarDays, 
  MapPin, 
  Search, 
  PlusCircle, 
  Edit, 
  Trash2, 
  User, 
  Download, 
  Upload,
  X,
  Filter,
  ChevronDown,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CATEGORIES } from '@shared/schema';
import { CategoryIcon, getCategoryColor } from '@/components/CategoryIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  category: string;
  lat: number;
  lng: number;
  hostId: number;
  image?: string;
  price?: number;
  createdAt: string;
  updatedAt: string;
}

interface EventsResponse {
  events: Event[];
  total: number;
}

interface EventsFilter {
  category: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'title' | 'category';
}

const AdminEvents: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for filters and pagination
  const [filter, setFilter] = useState<EventsFilter>({
    category: 'all',
    searchQuery: '',
    sortBy: 'newest',
  });
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Fetch events data
  const { data, isLoading, error } = useQuery<EventsResponse>({
    queryKey: ['/api/admin/events', page, limit, filter],
    keepPreviousData: true,
  });
  
  // Delete event mutation
  const deleteMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      toast({
        title: 'Evenement verwijderd',
        description: 'Het evenement is succesvol verwijderd.',
      });
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'delete_event',
          details: { 
            eventId: selectedEvent?.id,
            title: selectedEvent?.title
          }
        })
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: 'Er is een fout opgetreden bij het verwijderen van het evenement.',
        variant: 'destructive',
      });
      console.error('Delete error:', error);
    }
  });
  
  // CSV import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/admin/events/import', {
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      setIsImportDialogOpen(false);
      setCsvFile(null);
      
      toast({
        title: 'CSV geïmporteerd',
        description: `${data.imported} evenementen succesvol geïmporteerd.`,
      });
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'import_events',
            count: data.imported
          }
        })
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij importeren',
        description: 'Er is een fout opgetreden bij het importeren van de CSV.',
        variant: 'destructive',
      });
      console.error('Import error:', error);
    }
  });
  
  // Handle search
  const handleSearch = () => {
    setFilter({
      ...filter,
      searchQuery: searchInput,
    });
    setPage(1); // Reset to first page
  };
  
  // Handle filter changes
  const handleFilterChange = (key: keyof EventsFilter, value: string) => {
    setFilter({
      ...filter,
      [key]: value,
    });
    setPage(1); // Reset to first page
  };
  
  // Handle CSV file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };
  
  // Handle CSV import
  const handleImport = () => {
    if (csvFile) {
      const formData = new FormData();
      formData.append('file', csvFile);
      importMutation.mutate(formData);
    } else {
      toast({
        title: 'Geen bestand geselecteerd',
        description: 'Selecteer eerst een CSV-bestand.',
        variant: 'destructive',
      });
    }
  };
  
  // Handle CSV export
  const handleExport = async () => {
    try {
      const response = await apiRequest('/api/admin/events/export', {
        method: 'GET',
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `evenementen_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'export_events',
          }
        })
      });
      
      toast({
        title: 'Evenementen geëxporteerd',
        description: 'De evenementen zijn succesvol geëxporteerd als CSV.',
      });
    } catch (error) {
      toast({
        title: 'Fout bij exporteren',
        description: 'Er is een fout opgetreden bij het exporteren van de evenementen.',
        variant: 'destructive',
      });
      console.error('Export error:', error);
    }
  };
  
  // Format date
  const formatEventDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMMM yyyy', { locale: nl });
  };
  
  // Calculate total pages
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;
  
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Evenementen Beheer</h1>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsImportDialogOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Importeer CSV
            </Button>
            
            <Button 
              onClick={handleExport}
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exporteer CSV
            </Button>
            
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Nieuw Evenement
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="list" className="mb-6">
          <TabsList>
            <TabsTrigger value="list">Lijst Weergave</TabsTrigger>
            <TabsTrigger value="cards">Kaart Weergave</TabsTrigger>
          </TabsList>
          
          {/* Search and filter */}
          <div className="flex flex-col md:flex-row gap-4 my-6">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Zoek op titel, locatie of beschrijving"
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch}>Zoeken</Button>
            </div>
            
            <div className="flex gap-2">
              <Select
                value={filter.category}
                onValueChange={(value) => handleFilterChange('category', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Categorieën</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={filter.sortBy}
                onValueChange={(value) => handleFilterChange('sortBy', value as any)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sorteer op" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Nieuwste eerst</SelectItem>
                  <SelectItem value="oldest">Oudste eerst</SelectItem>
                  <SelectItem value="title">Titel (A-Z)</SelectItem>
                  <SelectItem value="category">Categorie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <TabsContent value="list">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-xl">Evenementen</CardTitle>
                <CardDescription>
                  Beheer alle evenementen in het systeem.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="p-6 text-center text-red-500">
                    <p>Er is een fout opgetreden bij het laden van de evenementen.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Categorie</TableHead>
                        <TableHead>Locatie</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Organisator</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.events && data.events.length > 0 ? (
                        data.events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <CategoryIcon 
                                  category={event.category as any} 
                                  size={16} 
                                />
                                <span>{event.category}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">{event.location}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{formatEventDate(event.startDate)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Host ID: {event.hostId}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acties</DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    className="flex items-center gap-2"
                                    onClick={() => window.open(`/event/${event.id}`, '_blank')}
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>Bekijken</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="flex items-center gap-2">
                                    <Edit className="h-4 w-4" />
                                    <span>Bewerken</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="flex items-center gap-2 text-red-500"
                                        onSelect={(e) => {
                                          e.preventDefault();
                                          setSelectedEvent(event);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Verwijderen</span>
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Weet je zeker dat je dit evenement wilt verwijderen?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Deze actie kan niet ongedaan worden gemaakt.
                                          Alle gegevens van dit evenement worden permanent verwijderd.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-500 hover:bg-red-600"
                                          onClick={() => {
                                            if (selectedEvent) {
                                              deleteMutation.mutate(selectedEvent.id);
                                            }
                                          }}
                                        >
                                          {deleteMutation.isPending ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Verwijderen...
                                            </>
                                          ) : (
                                            'Verwijderen'
                                          )}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <Calendar className="h-12 w-12 mb-2 opacity-20" />
                              <p>Geen evenementen gevonden</p>
                              <p className="text-sm">Probeer andere zoekfilters of voeg nieuwe evenementen toe</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              {data?.total && data.total > 0 && (
                <CardFooter className="flex justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} van {data.total} evenementen
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((old) => Math.max(old - 1, 1))}
                      disabled={page === 1}
                    >
                      Vorige
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((old) => (old < totalPages ? old + 1 : old))}
                      disabled={page === totalPages}
                    >
                      Volgende
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
          
          <TabsContent value="cards">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                <p>Er is een fout opgetreden bij het laden van de evenementen.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data?.events && data.events.length > 0 ? (
                    data.events.map((event) => (
                      <Card key={event.id} className="overflow-hidden">
                        <div 
                          className="h-32 bg-muted" 
                          style={{
                            backgroundColor: getCategoryColor(event.category as any),
                            opacity: 0.3
                          }}
                        />
                        <CardHeader className="pb-3">
                          <div className="flex justify-between">
                            <Badge 
                              variant="secondary"
                              className="mb-2 flex items-center gap-1 w-fit"
                            >
                              <CategoryIcon 
                                category={event.category as any} 
                                size={12} 
                              />
                              {event.category}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  className="flex items-center gap-2"
                                  onClick={() => window.open(`/event/${event.id}`, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>Bekijken</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2">
                                  <Edit className="h-4 w-4" />
                                  <span>Bewerken</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="flex items-center gap-2 text-red-500"
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setSelectedEvent(event);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Verwijderen</span>
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Weet je zeker dat je dit evenement wilt verwijderen?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Deze actie kan niet ongedaan worden gemaakt.
                                        Alle gegevens van dit evenement worden permanent verwijderd.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600"
                                        onClick={() => {
                                          if (selectedEvent) {
                                            deleteMutation.mutate(selectedEvent.id);
                                          }
                                        }}
                                      >
                                        {deleteMutation.isPending ? (
                                          <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Verwijderen...
                                          </>
                                        ) : (
                                          'Verwijderen'
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardTitle className="line-clamp-1">{event.title}</CardTitle>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span>{formatEventDate(event.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm line-clamp-2">{event.description}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between pt-0">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>Host ID: {event.hostId}</span>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => window.open(`/event/${event.id}`, '_blank')}>
                            Bekijken
                          </Button>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Calendar className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg">Geen evenementen gevonden</p>
                        <p className="text-sm">Probeer andere zoekfilters of voeg nieuwe evenementen toe</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {data?.total && data.total > 0 && (
                  <div className="flex justify-between items-center mt-6">
                    <div className="text-sm text-muted-foreground">
                      Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} van {data.total} evenementen
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((old) => Math.max(old - 1, 1))}
                        disabled={page === 1}
                      >
                        Vorige
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((old) => (old < totalPages ? old + 1 : old))}
                        disabled={page === totalPages}
                      >
                        Volgende
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importeer Evenementen</DialogTitle>
            <DialogDescription>
              Upload een CSV-bestand met evenementen om te importeren. 
              Het bestand moet de juiste kolomnamen bevatten.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="csv">CSV Bestand</Label>
              <div className="flex gap-2">
                <Input 
                  id="csv" 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                />
                {csvFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCsvFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Accepteert alleen .csv bestanden
              </p>
            </div>
            
            {csvFile && (
              <div className="text-sm">
                <p>Geselecteerd bestand: <span className="font-medium">{csvFile.name}</span></p>
                <p className="text-muted-foreground">
                  Grootte: {(csvFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}
            
            <div className="bg-muted rounded-md p-3">
              <h4 className="font-medium mb-2">CSV-indeling voorbeeld:</h4>
              <p className="text-xs font-mono text-muted-foreground whitespace-nowrap overflow-x-auto">
                title,description,startDate,endDate,location,category,lat,lng,hostId,price
              </p>
              <p className="text-xs font-mono text-muted-foreground whitespace-nowrap overflow-x-auto mt-1">
                Zomerfestival,Een gezellig festival,2023-07-20T14:00:00,2023-07-20T22:00:00,Stadspark Oss,Gezellig en Sociaal,51.7656,5.5314,1,10.50
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!csvFile || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importeren...
                </>
              ) : (
                'Importeren'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add missing components needed for the form
function Label({ htmlFor, children }: { htmlFor: string, children: React.ReactNode }) {
  return (
    <label 
      htmlFor={htmlFor} 
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      {children}
    </label>
  );
}

function Eye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default AdminEvents;