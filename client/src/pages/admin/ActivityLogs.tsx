import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import AdminNav from "@/components/Layout/AdminNav";
import {
  Activity,
  CalendarDays,
  FileText,
  Filter,
  Loader2,
  Search,
  User,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_TYPES } from "@shared/schema";

interface ActivityLog {
  id: number;
  userId: number;
  username: string;
  activityType: string;
  details: string;
  createdAt: string;
  ipAddress?: string;
}

interface LogsFilter {
  activityType: string;
  searchQuery: string;
  sortBy: "newest" | "oldest";
}

const ActivityLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<LogsFilter>({
    activityType: "all",
    searchQuery: "",
    sortBy: "newest",
  });

  // Query to get activity logs
  const { data, isLoading, error } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ['/api/admin/activity-logs', page, limit, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filter.activityType !== "all" && { activityType: filter.activityType }),
        ...(filter.searchQuery && { search: filter.searchQuery }),
        sortBy: filter.sortBy,
      });

      const response = await apiRequest(`/api/admin/activity-logs?${params.toString()}`);
      return response;
    },
  });

  // Search handler
  const handleSearch = () => {
    setFilter(prev => ({ ...prev, searchQuery: searchInput }));
    setPage(1);
  };

  // Filter change handler
  const handleFilterChange = (key: keyof LogsFilter, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value as any }));
    setPage(1);
  };

  // Format date
  const formatLogDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMMM yyyy, HH:mm:ss', { locale: nl });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Onbekende datum";
    }
  };

  // Activity Type Badge
  const getActivityBadge = (type: string) => {
    switch (type) {
      case "USER_LOGIN":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Login</Badge>;
      case "USER_LOGOUT":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Logout</Badge>;
      case "USER_CREATE":
        return <Badge variant="outline" className="border-green-500 text-green-500">Gebruiker Aangemaakt</Badge>;
      case "USER_UPDATE":
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Gebruiker Gewijzigd</Badge>;
      case "USER_DELETE":
        return <Badge variant="outline" className="border-red-500 text-red-500">Gebruiker Verwijderd</Badge>;
      case "EVENT_CREATE":
        return <Badge variant="outline" className="border-green-500 text-green-500">Evenement Aangemaakt</Badge>;
      case "EVENT_UPDATE":
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Evenement Gewijzigd</Badge>;
      case "EVENT_DELETE":
        return <Badge variant="outline" className="border-red-500 text-red-500">Evenement Verwijderd</Badge>;
      case "CSV_IMPORT":
        return <Badge variant="outline" className="border-purple-500 text-purple-500">CSV Import</Badge>;
      case "CSV_EXPORT":
        return <Badge variant="outline" className="border-purple-500 text-purple-500">CSV Export</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Calculate total pages
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Activiteiten Logboek</h1>
        </div>

        {/* Search and filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Zoek in activiteiten en details"
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
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Activiteit Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Activiteiten</SelectItem>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
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
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-xl">Activiteiten Logboek</CardTitle>
            <CardDescription>
              Een overzicht van alle gelogde activiteiten in het systeem.
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
                    <TableHead>Tijdstip</TableHead>
                    <TableHead>Gebruiker</TableHead>
                    <TableHead>Activiteit</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP-adres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs && data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="whitespace-nowrap">{formatLogDate(log.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{log.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            {getActivityBadge(log.activityType)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="truncate" title={log.details}>
                            {log.details}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.ipAddress || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-12 w-12 mb-2 opacity-20" />
                          <p>Geen activiteiten gevonden</p>
                          <p className="text-sm">Probeer andere zoekfilters of een ander tijdvak</p>
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