import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AdminNav from '@/components/Layout/AdminNav';
import { 
  Search, 
  Download, 
  Filter,
  Calendar,
  Clock,
  User,
  Activity,
  Loader2,
  ClipboardList,
  FileText
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ACTIVITY_TYPES } from '@shared/schema';
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DatePicker } from "@/components/ui/date-picker";

interface ActivityLog {
  id: number;
  userId: number;
  activityType: string;
  details: any;
  createdAt: string;
  user?: {
    username: string;
    email: string;
    role: string;
  };
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
}

interface ActivityLogsFilter {
  activityType: string;
  userId: string | number;
  searchQuery: string;
  startDate: string | null;
  endDate: string | null;
  sortBy: 'newest' | 'oldest';
}

const ActivityLogs: React.FC = () => {
  const { toast } = useToast();
  
  // State for filters and pagination
  const [filter, setFilter] = useState<ActivityLogsFilter>({
    activityType: 'all',
    userId: '',
    searchQuery: '',
    startDate: null,
    endDate: null,
    sortBy: 'newest',
  });
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  // Fetch activity logs data
  const { data, isLoading, error } = useQuery<ActivityLogsResponse>({
    queryKey: ['/api/admin/activity-logs', { page, limit, ...filter }],
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
  const handleFilterChange = (key: keyof ActivityLogsFilter, value: any) => {
    setFilter({
      ...filter,
      [key]: value,
    });
    setPage(1); // Reset to first page
  };
  
  // Handle CSV export
  const handleExport = async () => {
    try {
      const response = await apiRequest('/api/admin/activity-logs/export', {
        method: 'GET',
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activiteiten_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'export_activity_logs',
          }
        })
      });
      
      toast({
        title: 'Activiteiten geëxporteerd',
        description: 'De activiteiten zijn succesvol geëxporteerd als CSV.',
      });
    } catch (error) {
      toast({
        title: 'Fout bij exporteren',
        description: 'Er is een fout opgetreden bij het exporteren van de activiteiten.',
        variant: 'destructive',
      });
      console.error('Export error:', error);
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM yyyy', { locale: nl });
  };
  
  // Format time
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm:ss', { locale: nl });
  };
  
  // Format activity type for display
  const formatActivityType = (type: string): string => {
    switch (type) {
      case 'login': return 'Inloggen';
      case 'logout': return 'Uitloggen';
      case 'create_event': return 'Evenement aanmaken';
      case 'update_event': return 'Evenement bijwerken';
      case 'delete_event': return 'Evenement verwijderen';
      case 'join_event': return 'Deelnemen aan evenement';
      case 'leave_event': return 'Evenement verlaten';
      case 'favorite_event': return 'Evenement favoriet maken';
      case 'unfavorite_event': return 'Evenement ongunstig maken';
      case 'create_user': return 'Gebruiker aanmaken';
      case 'update_user': return 'Gebruiker bijwerken';
      case 'delete_user': return 'Gebruiker verwijderen';
      case 'admin_action': return 'Admin-actie';
      default: return type;
    }
  };
  
  // Get activity badge
  const getActivityTypeBadge = (type: string) => {
    let color = 'bg-gray-100 text-gray-800';
    let icon = <Activity className="h-3 w-3" />;
    
    switch (type) {
      case 'login':
      case 'logout':
        color = 'bg-blue-100 text-blue-800';
        icon = <User className="h-3 w-3" />;
        break;
      case 'create_event':
      case 'update_event':
      case 'delete_event':
        color = 'bg-green-100 text-green-800';
        icon = <FileText className="h-3 w-3" />;
        break;
      case 'join_event':
      case 'leave_event':
      case 'favorite_event':
      case 'unfavorite_event':
        color = 'bg-purple-100 text-purple-800';
        icon = <ClipboardList className="h-3 w-3" />;
        break;
      case 'admin_action':
        color = 'bg-red-100 text-red-800';
        icon = <ClipboardList className="h-3 w-3" />;
        break;
    }
    
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {icon}
        <span className="ml-1">{formatActivityType(type)}</span>
      </div>
    );
  };
  
  // Get details summary
  const getDetailsSummary = (log: ActivityLog): string => {
    if (!log.details) return 'Geen details beschikbaar';
    
    try {
      const details = log.details;
      
      switch (log.activityType) {
        case 'login':
          return `Ingelogd ${details.section ? `in ${details.section}` : ''}`;
        case 'logout':
          return 'Uitgelogd';
        case 'create_event':
          return `Evenement '${details.title || 'Onbekend'}' aangemaakt`;
        case 'update_event':
          return `Evenement '${details.title || 'Onbekend'}' bijgewerkt`;
        case 'delete_event':
          return `Evenement '${details.title || 'Onbekend'}' verwijderd`;
        case 'join_event':
          return `Deelgenomen aan evenement '${details.title || 'Onbekend'}'`;
        case 'leave_event':
          return `Evenement '${details.title || 'Onbekend'}' verlaten`;
        case 'favorite_event':
          return `Evenement '${details.title || 'Onbekend'}' toegevoegd aan favorieten`;
        case 'unfavorite_event':
          return `Evenement '${details.title || 'Onbekend'}' verwijderd uit favorieten`;
        case 'admin_action':
          if (details.action === 'import_events') {
            return `${details.count || '?'} evenementen geïmporteerd`;
          }
          if (details.action === 'export_events') {
            return 'Evenementen geëxporteerd';
          }
          if (details.action === 'import_users') {
            return `${details.count || '?'} gebruikers geïmporteerd`;
          }
          if (details.action === 'export_users') {
            return 'Gebruikers geëxporteerd';
          }
          if (details.action === 'create_user') {
            return `Gebruiker '${details.username || 'Onbekend'}' aangemaakt`;
          }
          if (details.action === 'update_user') {
            return `Gebruiker '${details.username || 'Onbekend'}' bijgewerkt`;
          }
          if (details.action === 'delete_user') {
            return `Gebruiker '${details.username || 'Onbekend'}' verwijderd`;
          }
          return `Admin actie: ${details.action || 'Onbekend'}`;
        default:
          return JSON.stringify(details);
      }
    } catch (e) {
      return 'Ongeldige details';
    }
  };
  
  // Get initials for avatar
  const getInitials = (name: string = 'Gebruiker'): string => {
    return name.charAt(0).toUpperCase();
  };
  
  // Calculate total pages
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;
  
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Activiteitslogboek</h1>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleExport}
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exporteer CSV
            </Button>
          </div>
        </div>
        
        {/* Search and filter */}
        <div className="flex flex-col md:flex-row gap-4 my-6">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Zoek in activiteiten..."
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
              value={filter.activityType}
              onValueChange={(value) => handleFilterChange('activityType', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Activiteit Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatActivityType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar className="h-4 w-4" />
              <span>Datum</span>
            </Button>
            
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
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Date picker */}
        {showDatePicker && (
          <div className="mb-6 p-4 border rounded-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Selecteer een datum:</h3>
                <DatePicker
                  date={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    if (date) {
                      const formattedDate = format(date, 'yyyy-MM-dd');
                      handleFilterChange('startDate', formattedDate);
                      handleFilterChange('endDate', formattedDate);
                    } else {
                      handleFilterChange('startDate', null);
                      handleFilterChange('endDate', null);
                    }
                  }}
                />
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-sm mb-2">Actieve datumfilter:</h3>
                <div className="text-sm">
                  {filter.startDate ? (
                    <div className="flex items-center">
                      <Badge variant="outline" className="flex gap-1 items-center">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(filter.startDate), 'd MMMM yyyy', { locale: nl })}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 ml-2"
                        onClick={() => {
                          setSelectedDate(undefined);
                          handleFilterChange('startDate', null);
                          handleFilterChange('endDate', null);
                        }}
                      >
                        Wissen
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Geen datumfilter actief</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-xl">Activiteiten</CardTitle>
            <CardDescription>
              Bekijk alle activiteiten in het systeem.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                <p>Er is een fout opgetreden bij het laden van de activiteiten.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gebruiker</TableHead>
                    <TableHead>Activiteit</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Tijd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs && data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.user ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(log.user.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{log.user.username}</div>
                                <div className="text-xs text-muted-foreground">{log.user.email}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                                  ?
                                </AvatarFallback>
                              </Avatar>
                              <div className="font-medium text-sm">
                                Gebruiker {log.userId}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getActivityTypeBadge(log.activityType)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px] truncate">
                            {getDetailsSummary(log)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatDate(log.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatTime(log.createdAt)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <ClipboardList className="h-12 w-12 mb-2 opacity-20" />
                          <p>Geen activiteiten gevonden</p>
                          <p className="text-sm">Probeer andere zoekfilters</p>
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
                Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} van {data.total} activiteiten
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
      </div>
    </div>
  );
};

export default ActivityLogs;