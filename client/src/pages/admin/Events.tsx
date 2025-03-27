import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AdminNav from '@/components/Layout/AdminNav';
import { 
  CalendarDays, 
  Calendar,
  MapPin, 
  Search, 
  PlusCircle, 
  Edit, 
  Trash2, 
  User, 
  Download, 
  Upload,
  Eye,
  X,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Loader2,
  Info,
  Check,
  List,
  LayoutGrid,
  ArrowUpDown
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CATEGORIES, Event } from '@shared/schema';
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
  DropdownMenuCheckboxItem,
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface EventsFilter {
  category: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'title' | 'category' | 'location';
  timeFrame: 'all' | 'upcoming' | 'past' | 'today';
}

const AdminEvents: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  // State for filters and pagination
  const [filter, setFilter] = useState<EventsFilter>({
    category: 'all',
    searchQuery: '',
    sortBy: 'newest',
    timeFrame: 'all'
  });
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  
  // Fetch events data
  const { data: allEvents, isLoading, error } = useQuery<Event[]>({
    queryKey: ['/api/admin/events'],
    queryFn: async () => {
      return await apiRequest('/api/admin/events');
    }
  });
  
  // Filter and sort events
  const filteredEvents = React.useMemo(() => {
    if (!allEvents) return [];
    
    let filtered = [...allEvents];
    
    // Apply search filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(
        event => 
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query) ||
          event.location?.toLowerCase().includes(query) ||
          event.category.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (filter.category !== 'all') {
      filtered = filtered.filter(
        event => event.category === filter.category || event.secondaryCategory === filter.category
      );
    }
    
    // Apply time filter
    const now = new Date();
    switch (filter.timeFrame) {
      case 'upcoming':
        filtered = filtered.filter(event => new Date(event.startTime) > now);
        break;
      case 'past':
        filtered = filtered.filter(event => new Date(event.startTime) < now);
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        filtered = filtered.filter(event => {
          const eventDate = new Date(event.startTime);
          return eventDate >= today && eventDate < tomorrow;
        });
        break;
    }
    
    // Apply sorting
    switch (filter.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'category':
        filtered.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'location':
        filtered.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
        break;
    }
    
    return filtered;
  }, [allEvents, filter]);
  
  // Paginate events
  const paginatedEvents = React.useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredEvents.slice(startIndex, startIndex + limit);
  }, [filteredEvents, page, limit]);
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredEvents.length / limit);
  
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
        data: {
          activityType: 'delete_event',
          entityType: 'event',
          entityId: selectedEvent?.id,
          details: { 
            title: selectedEvent?.title
          }
        }
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
        data: {
          activityType: 'admin_action',
          details: { 
            action: 'import_events',
            count: data.imported
          }
        }
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
  
  // Clear all filters
  const clearFilters = () => {
    setFilter({
      category: 'all',
      searchQuery: '',
      sortBy: 'newest',
      timeFrame: 'all'
    });
    setSearchInput('');
    setPage(1);
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
        data: {
          activityType: 'admin_action',
          details: { 
            action: 'export_events',
          }
        }
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
    try {
      return format(new Date(dateString), 'd MMMM yyyy', { locale: nl });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Onbekende datum";
    }
  };
  
  // Format date and time
  const formatEventDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMMM yyyy, HH:mm', { locale: nl });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Onbekende datum/tijd";
    }
  };
  
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
            
            <Button 
              className="flex items-center gap-2"
              onClick={() => navigate('/admin/events/new')}
            >
              <PlusCircle className="h-4 w-4" />
              Nieuw Evenement
            </Button>
          </div>
        </div>
        
        {/* Filter section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filter & Zoeken</CardTitle>
              
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="flex gap-1 cursor-pointer">
                  {filteredEvents.length} resultaten
                </Badge>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-1 text-xs"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Wis filters</span>
                </Button>
                
                <div className="flex border rounded-md">
                  <Button
                    variant={view === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-r-none"
                    onClick={() => setView('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8 rounded-l-none"
                    onClick={() => setView('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
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
              
              <div className="flex flex-wrap gap-2">
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
                        <div className="flex items-center gap-2">
                          <CategoryIcon category={category as any} size={16} />
                          <span>{category}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={filter.timeFrame}
                  onValueChange={(value) => handleFilterChange('timeFrame', value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Evenementen</SelectItem>
                    <SelectItem value="upcoming">Aankomende Evenementen</SelectItem>
                    <SelectItem value="past">Afgelopen Evenementen</SelectItem>
                    <SelectItem value="today">Vandaag</SelectItem>
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
                    <SelectItem value="location">Locatie</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setLimit(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Aantal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per pagina</SelectItem>
                    <SelectItem value="25">25 per pagina</SelectItem>
                    <SelectItem value="50">50 per pagina</SelectItem>
                    <SelectItem value="100">100 per pagina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Loading state */}
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
            {/* List view */}
            {view === 'list' && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">
                          <div className="flex items-center gap-1">
                            Titel 
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              onClick={() => handleFilterChange(
                                'sortBy', 
                                filter.sortBy === 'title' ? 'category' : 'title'
                              )}
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Categorie
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5"
                              onClick={() => handleFilterChange(
                                'sortBy', 
                                filter.sortBy === 'category' ? 'title' : 'category'
                              )}
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableHead>
                        <TableHead>Locatie</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Organisator</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEvents.length > 0 ? (
                        paginatedEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <CategoryIcon 
                                  category={event.category as any} 
                                  size={16} 
                                />
                                <span>{event.category}</span>
                                
                                {event.secondaryCategory && (
                                  <Badge 
                                    variant="secondary" 
                                    className="ml-1 text-xs"
                                  >
                                    {event.secondaryCategory}
                                  </Badge>
                                )}
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
                                <span>{formatEventDate(event.startTime.toString())}</span>
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
                                    onClick={() => navigate(`/admin/events/${event.id}`)}
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="flex items-center gap-2"
                                    onClick={() => navigate(`/admin/events/edit/${event.id}`)}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span>Bewerken</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="flex items-center gap-2 text-destructive"
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
                                          className="bg-destructive hover:bg-destructive/90"
                                          onClick={() => deleteMutation.mutate(event.id)}
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
                              <Calendar className="h-12 w-12 mb-3 opacity-20" />
                              <p className="font-medium">Geen evenementen gevonden</p>
                              <p className="text-sm">
                                Probeer andere zoekfilters of maak een nieuw evenement aan
                              </p>
                              <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={() => navigate('/admin/events/new')}
                              >
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Nieuw Evenement
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            
            {/* Grid view */}
            {view === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedEvents.length > 0 ? (
                  paginatedEvents.map((event) => (
                    <Card key={event.id} className="overflow-hidden">
                      <div 
                        className="h-3 w-full" 
                        style={{ backgroundColor: getCategoryColor(event.category as any) }}
                      />
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge 
                              variant="outline" 
                              className="mb-2 flex items-center gap-1"
                              style={{
                                backgroundColor: `${getCategoryColor(event.category as any)}10`,
                                borderColor: `${getCategoryColor(event.category as any)}40`,
                              }}
                            >
                              <CategoryIcon category={event.category as any} size={12} />
                              {event.category}
                            </Badge>
                            <CardTitle className="text-base line-clamp-1">{event.title}</CardTitle>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="flex items-center gap-2"
                                onClick={() => navigate(`/admin/events/${event.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                                <span>Details</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="flex items-center gap-2"
                                onClick={() => navigate(`/admin/events/edit/${event.id}`)}
                              >
                                <Edit className="h-4 w-4" />
                                <span>Bewerken</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="flex items-center gap-2 text-destructive"
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
                                      className="bg-destructive hover:bg-destructive/90"
                                      onClick={() => deleteMutation.mutate(event.id)}
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
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-sm space-y-2 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span>{formatEventDate(event.startTime.toString())}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            <span>Host ID: {event.hostId}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(`/admin/events/${event.id}`)}
                        >
                          Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground py-12">
                    <Calendar className="h-16 w-16 mb-4 opacity-20" />
                    <p className="font-medium text-lg">Geen evenementen gevonden</p>
                    <p className="text-sm mb-6">
                      Probeer andere zoekfilters of maak een nieuw evenement aan
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/admin/events/new')}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Nieuw Evenement
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Pagination */}
            {filteredEvents.length > 0 && (
              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Toont {(page - 1) * limit + 1}-{Math.min(page * limit, filteredEvents.length)} van {filteredEvents.length} resultaten
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      // Only show a few pages around the current page
                      if (
                        pageNum === 1 || 
                        pageNum === totalPages ||
                        (pageNum >= page - 1 && pageNum <= page + 1)
                      ) {
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              isActive={pageNum === page}
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (
                        (pageNum === page - 2 && pageNum > 1) || 
                        (pageNum === page + 2 && pageNum < totalPages)
                      ) {
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importeer Evenementen</DialogTitle>
            <DialogDescription>
              Upload een CSV-bestand met evenementen om te importeren.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <label className="flex flex-col gap-2">
              <span>CSV-bestand</span>
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
              />
            </label>
            
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Het CSV-bestand moet de volgende kolommen bevatten:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>title (verplicht)</li>
                <li>description (verplicht)</li>
                <li>location (verplicht)</li>
                <li>category (verplicht)</li>
                <li>latitude (verplicht)</li>
                <li>longitude (verplicht)</li>
                <li>startTime (verplicht, ISO-formaat)</li>
                <li>endTime (optioneel, ISO-formaat)</li>
                <li>hostId (optioneel)</li>
                <li>price (optioneel)</li>
                <li>tags (optioneel, komma-gescheiden)</li>
              </ul>
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

export default AdminEvents;