import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import AdminNav from "@/components/Layout/AdminNav";
import {
  Calendar,
  CalendarDays,
  Edit,
  Info,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  Shield,
  Trash2,
  User,
  UserCircle,
  X,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User as UserSchemaType } from "@shared/schema";

// Extend the User type to include fields we need that might not be in the schema
interface UserType extends UserSchemaType {
  name?: string;
  createdAt: string;
  updatedAt?: string;
}

interface UserFilter {
  role: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'name' | 'email';
}

const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [filter, setFilter] = useState<UserFilter>({
    role: "all",
    searchQuery: "",
    sortBy: "newest",
  });

  // Query to get all users
  const { data, isLoading, error } = useQuery<UserType[]>({
    queryKey: ['/api/admin/users', page, limit, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filter.role !== "all" && { role: filter.role }),
        ...(filter.searchQuery && { search: filter.searchQuery }),
        sortBy: filter.sortBy,
      });

      const response = await apiRequest(`/api/admin/users?${params.toString()}`);
      return response;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: number) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      // Log activity
      logActivityMutation.mutate({
        activityType: "USER_DELETE",
        details: `User ${selectedUser?.username || selectedUser?.id} deleted`,
      });
    },
  });

  // Activity log mutation
  const logActivityMutation = useMutation({
    mutationFn: (logData: { activityType: string; details: string }) => {
      return apiRequest("/api/admin/log-activity", {
        method: "POST",
        data: logData,
      });
    },
  });

  // Search handler
  const handleSearch = () => {
    setFilter(prev => ({ ...prev, searchQuery: searchInput }));
    setPage(1);
  };

  // Filter change handler
  const handleFilterChange = (key: keyof UserFilter, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Format date
  const formatUserDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMMM yyyy', { locale: nl });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Onbekende datum";
    }
  };

  // Calculate total pages
  const totalPages = data ? Math.ceil(data.length / limit) : 0;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Badge className="bg-red-500">Admin</Badge>;
      case 'moderator':
        return <Badge className="bg-amber-500">Moderator</Badge>;
      case 'organizer':
        return <Badge className="bg-green-500">Organisator</Badge>;
      default:
        return <Badge variant="secondary">Gebruiker</Badge>;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gebruikers Beheer</h1>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Nieuwe Gebruiker
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
                  placeholder="Zoek op naam, email of gebruikersnaam"
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
                value={filter.role}
                onValueChange={(value) => handleFilterChange('role', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Rollen</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="organizer">Organisator</SelectItem>
                  <SelectItem value="user">Gebruiker</SelectItem>
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
                  <SelectItem value="name">Naam (A-Z)</SelectItem>
                  <SelectItem value="email">Email (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <TabsContent value="list">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-xl">Gebruikers</CardTitle>
                <CardDescription>
                  Beheer alle gebruikers in het systeem.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="p-6 text-center text-red-500">
                    <p>Er is een fout opgetreden bij het laden van de gebruikers.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gebruiker</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Gebruikersnaam</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Aangemeld op</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data && data.length > 0 ? (
                        data.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.avatar || undefined} />
                                  <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.name || user.username}</p>
                                  <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{user.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{formatUserDate(user.createdAt)}</span>
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
                                  <DropdownMenuItem className="flex items-center gap-2">
                                    <UserCircle className="h-4 w-4" />
                                    <span>Profiel Bekijken</span>
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
                                          setSelectedUser(user);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Verwijderen</span>
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Weet je zeker dat je deze gebruiker wilt verwijderen?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Deze actie kan niet ongedaan worden gemaakt.
                                          Alle gegevens van deze gebruiker worden permanent verwijderd.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-500 hover:bg-red-600"
                                          onClick={() => {
                                            if (selectedUser) {
                                              deleteMutation.mutate(selectedUser.id);
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
                              <User className="h-12 w-12 mb-2 opacity-20" />
                              <p>Geen gebruikers gevonden</p>
                              <p className="text-sm">Probeer andere zoekfilters of voeg nieuwe gebruikers toe</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              {data && data.length > 0 && (
                <CardFooter className="flex justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.length)} van {data.length} gebruikers
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
                <p>Er is een fout opgetreden bij het laden van de gebruikers.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data && data.length > 0 ? (
                    data.map((user) => (
                      <Card key={user.id} className="overflow-hidden">
                        <CardHeader className="p-6">
                          <div className="flex justify-between mb-4">
                            {getRoleBadge(user.role)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="flex items-center gap-2">
                                  <UserCircle className="h-4 w-4" />
                                  <span>Profiel Bekijken</span>
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
                                        setSelectedUser(user);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Verwijderen</span>
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Weet je zeker dat je deze gebruiker wilt verwijderen?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Deze actie kan niet ongedaan worden gemaakt.
                                        Alle gegevens van deze gebruiker worden permanent verwijderd.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600"
                                        onClick={() => {
                                          if (selectedUser) {
                                            deleteMutation.mutate(selectedUser.id);
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
                          <div className="flex flex-col items-center">
                            <Avatar className="h-20 w-20 mb-4">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback className="text-xl">{getInitials(user.username)}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-center">{user.name || user.username}</CardTitle>
                            <CardDescription className="text-center mt-1">{user.username}</CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{user.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span>Rol: {user.role}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              <span>Aangemeld op: {formatUserDate(user.createdAt)}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between p-6 pt-3 border-t">
                          <Button variant="outline" size="sm" className="w-full flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            <span>Bekijk Profiel</span>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <User className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg">Geen gebruikers gevonden</p>
                        <p className="text-sm">Probeer andere zoekfilters of voeg nieuwe gebruikers toe</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {data && data.length > 0 && (
                  <div className="flex justify-between items-center mt-6">
                    <div className="text-sm text-muted-foreground">
                      Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.length)} van {data.length} gebruikers
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
    </div>
  );
};

export default AdminUsers;