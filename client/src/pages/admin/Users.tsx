import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import AdminSidebar from "@/components/Layout/AdminSidebar";
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
interface UserType extends Omit<UserSchemaType, 'createdAt'> {
  createdAt: string | Date | null;
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
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    email: "",
    password: "",
    name: "",
    role: "user",
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role: "user",
  });
  const [filter, setFilter] = useState<UserFilter>({
    role: "all",
    searchQuery: "",
    sortBy: "newest",
  });

  // Query to get all users
  const { data, isLoading, error } = useQuery<UserType[]>({
    queryKey: ['/api/admin/users', page, limit, filter],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/users`);
      return response;
    },
  });

  // Filter and sort data client-side
  const filteredData = data?.filter(user => {
    const matchesRole = filter.role === "all" || user.role === filter.role;
    const matchesSearch = !filter.searchQuery || 
      user.username.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(filter.searchQuery.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(filter.searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  }).sort((a, b) => {
    switch (filter.sortBy) {
      case 'newest':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'oldest':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'name':
        return (a.name || a.username).localeCompare(b.name || b.username);
      case 'email':
        return a.email.localeCompare(b.email);
      default:
        return 0;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: typeof newUserForm) => {
      return apiRequest("/api/admin/users", {
        method: "POST",
        data: userData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsNewUserDialogOpen(false);
      setNewUserForm({ username: "", email: "", password: "", name: "", role: "user" });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: typeof editUserForm }) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: "PATCH",
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
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
      setSelectedUser(null);
    },
  });

  // Open edit dialog
  const openEditDialog = (user: UserType) => {
    setSelectedUser(user);
    setEditUserForm({
      name: user.name || "",
      email: user.email,
      role: user.role,
    });
    setIsEditUserDialogOpen(true);
  };

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
  const formatUserDate = (dateValue: string | Date | null) => {
    if (!dateValue) return "Onbekende datum";
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      return format(date, 'd MMMM yyyy', { locale: nl });
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
    <div className="h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Gebruikers Beheer</h1>
              <p className="text-muted-foreground">Beheer alle geregistreerde gebruikers</p>
            </div>
          
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setIsNewUserDialogOpen(true)}
                className="flex items-center gap-2"
                data-testid="button-new-user"
              >
                <User className="h-4 w-4" />
                Nieuwe Gebruiker
              </Button>
            </div>
          </div>
        
        {/* New User Dialog */}
        <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nieuwe Gebruiker Aanmaken</DialogTitle>
              <DialogDescription>
                Vul de gegevens in om een nieuwe gebruiker toe te voegen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gebruikersnaam *</label>
                <Input
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="gebruikersnaam"
                  data-testid="input-new-username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Naam</label>
                <Input
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Volledige naam"
                  data-testid="input-new-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail *</label>
                <Input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@voorbeeld.nl"
                  data-testid="input-new-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Wachtwoord *</label>
                <Input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <Select
                  value={newUserForm.role}
                  onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-new-role">
                    <SelectValue placeholder="Selecteer rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="organizer">Organisator</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>
                Annuleren
              </Button>
              <Button 
                onClick={() => createUserMutation.mutate(newUserForm)}
                disabled={createUserMutation.isPending || !newUserForm.username || !newUserForm.email || !newUserForm.password}
                data-testid="button-create-user"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aanmaken...
                  </>
                ) : (
                  'Aanmaken'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gebruiker Bewerken</DialogTitle>
              <DialogDescription>
                Wijzig de gegevens van {selectedUser?.username}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Naam</label>
                <Input
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Volledige naam"
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@voorbeeld.nl"
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <Select
                  value={editUserForm.role}
                  onValueChange={(value) => setEditUserForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Selecteer rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="organizer">Organisator</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Annuleren
              </Button>
              <Button 
                onClick={() => selectedUser && updateUserMutation.mutate({ userId: selectedUser.id, data: editUserForm })}
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  'Opslaan'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
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
                      {filteredData && filteredData.length > 0 ? (
                        filteredData.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={user.avatar || user.photoUrl || undefined} />
                                  <AvatarFallback>{getInitials(user.name || user.username)}</AvatarFallback>
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
                                <span>{user.createdAt ? formatUserDate(user.createdAt) : 'Onbekend'}</span>
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
                                  <DropdownMenuItem 
                                    className="flex items-center gap-2"
                                    onClick={() => openEditDialog(user)}
                                  >
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
              {filteredData && filteredData.length > 0 && (
                <CardFooter className="flex justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Toont {filteredData.length} gebruikers
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
                  {filteredData && filteredData.length > 0 ? (
                    filteredData.map((user) => (
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
                                <DropdownMenuItem 
                                  className="flex items-center gap-2"
                                  onClick={() => openEditDialog(user)}
                                >
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
                
                {filteredData && filteredData.length > 0 && (
                  <div className="flex justify-between items-center mt-6">
                    <div className="text-sm text-muted-foreground">
                      Toont {filteredData.length} gebruikers
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
      </main>
    </div>
  );
};

export default AdminUsers;