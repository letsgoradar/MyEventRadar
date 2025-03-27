import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AdminNav from '@/components/Layout/AdminNav';
import { 
  Search, 
  PlusCircle, 
  Edit, 
  Trash2, 
  Download, 
  Upload,
  X,
  Filter,
  ChevronDown,
  MoreHorizontal,
  Loader2,
  User,
  Users as UsersIcon,
  Shield,
  AtSign,
  Calendar,
  BadgeCheck,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
}

interface UsersFilter {
  role: string;
  searchQuery: string;
  sortBy: 'newest' | 'oldest' | 'username' | 'email';
}

const userSchema = z.object({
  username: z.string().min(3, {
    message: "Gebruikersnaam moet minimaal 3 tekens bevatten",
  }),
  email: z.string().email({
    message: "Ongeldig e-mailadres",
  }),
  password: z.string().min(6, {
    message: "Wachtwoord moet minimaal 6 tekens bevatten",
  }).optional(),
  role: z.enum(["user", "moderator", "admin"], {
    required_error: "Selecteer een rol",
  }),
});

type UserFormValues = z.infer<typeof userSchema>;

const AdminUsers: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for filters and pagination
  const [filter, setFilter] = useState<UsersFilter>({
    role: 'all',
    searchQuery: '',
    sortBy: 'newest',
  });
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  
  // Forms
  const addUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      role: 'user',
    },
  });
  
  const editUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema.partial({ password: true })),
    defaultValues: {
      username: '',
      email: '',
      role: 'user',
    },
  });
  
  // Fetch users data
  const { data, isLoading, error } = useQuery<UsersResponse>({
    queryKey: ['/api/admin/users', page, limit, filter],
    keepPreviousData: true,
  });
  
  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      return apiRequest('/api/admin/users', {
        method: 'POST',
        data: JSON.stringify(userData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsAddUserDialogOpen(false);
      addUserForm.reset();
      
      toast({
        title: 'Gebruiker aangemaakt',
        description: 'De gebruiker is succesvol aangemaakt.',
      });
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'create_user',
            username: addUserForm.getValues().username
          }
        })
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: 'Er is een fout opgetreden bij het aanmaken van de gebruiker.',
        variant: 'destructive',
      });
      console.error('Create error:', error);
    }
  });
  
  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: Partial<UserFormValues> }) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: 'PATCH',
        data: JSON.stringify(userData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditUserDialogOpen(false);
      editUserForm.reset();
      
      toast({
        title: 'Gebruiker bijgewerkt',
        description: 'De gebruiker is succesvol bijgewerkt.',
      });
      
      // Log activity
      if (selectedUser) {
        apiRequest('/api/admin/log-activity', {
          method: 'POST',
          data: JSON.stringify({
            activityType: 'admin_action',
            details: { 
              action: 'update_user',
              userId: selectedUser.id,
              username: selectedUser.username
            }
          })
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: 'Er is een fout opgetreden bij het bijwerken van de gebruiker.',
        variant: 'destructive',
      });
      console.error('Update error:', error);
    }
  });
  
  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: 'Gebruiker verwijderd',
        description: 'De gebruiker is succesvol verwijderd.',
      });
      
      // Log activity
      if (selectedUser) {
        apiRequest('/api/admin/log-activity', {
          method: 'POST',
          data: JSON.stringify({
            activityType: 'admin_action',
            details: { 
              action: 'delete_user',
              userId: selectedUser.id,
              username: selectedUser.username
            }
          })
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: 'Er is een fout opgetreden bij het verwijderen van de gebruiker.',
        variant: 'destructive',
      });
      console.error('Delete error:', error);
    }
  });
  
  // CSV import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/admin/users/import', {
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsImportDialogOpen(false);
      setCsvFile(null);
      
      toast({
        title: 'CSV geïmporteerd',
        description: `${data.imported} gebruikers succesvol geïmporteerd.`,
      });
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'import_users',
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
  const handleFilterChange = (key: keyof UsersFilter, value: string) => {
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
      const response = await apiRequest('/api/admin/users/export', {
        method: 'GET',
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gebruikers_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: JSON.stringify({
          activityType: 'admin_action',
          details: { 
            action: 'export_users',
          }
        })
      });
      
      toast({
        title: 'Gebruikers geëxporteerd',
        description: 'De gebruikers zijn succesvol geëxporteerd als CSV.',
      });
    } catch (error) {
      toast({
        title: 'Fout bij exporteren',
        description: 'Er is een fout opgetreden bij het exporteren van de gebruikers.',
        variant: 'destructive',
      });
      console.error('Export error:', error);
    }
  };
  
  // Handle add user form submit
  const onAddUserSubmit = (values: UserFormValues) => {
    createMutation.mutate(values);
  };
  
  // Handle edit user form submit
  const onEditUserSubmit = (values: Partial<UserFormValues>) => {
    if (selectedUser) {
      // Remove undefined/empty password to avoid changing it when not provided
      const userData = { ...values };
      if (!userData.password) {
        delete userData.password;
      }
      
      updateMutation.mutate({ id: selectedUser.id, userData });
    }
  };
  
  // Handle edit user click
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      username: user.username,
      email: user.email,
      role: user.role as any,
      password: '',
    });
    setIsEditUserDialogOpen(true);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM yyyy');
  };
  
  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-red-500 hover:bg-red-600 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'moderator':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1">
            <BadgeCheck className="h-3 w-3" />
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Gebruiker
          </Badge>
        );
    }
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };
  
  // Calculate total pages
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;
  
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gebruikers Beheer</h1>
          
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
              onClick={() => setIsAddUserDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Nieuwe Gebruiker
            </Button>
          </div>
        </div>
        
        {/* Search and filter */}
        <div className="flex flex-col md:flex-row gap-4 my-6">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Zoek op gebruikersnaam of e-mail"
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
                <SelectItem value="user">Gebruikers</SelectItem>
                <SelectItem value="moderator">Moderators</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
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
                <SelectItem value="username">Gebruikersnaam (A-Z)</SelectItem>
                <SelectItem value="email">E-mail (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
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
                    <TableHead>E-mail</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Aangemaakt op</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.users && data.users.length > 0 ? (
                    data.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar} alt={user.username} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(user.username)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(user.role)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatDate(user.createdAt)}</span>
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
                                onClick={() => handleEditUser(user)}
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
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <UsersIcon className="h-12 w-12 mb-2 opacity-20" />
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
          {data?.total && data.total > 0 && (
            <CardFooter className="flex justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Toont {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} van {data.total} gebruikers
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
      
      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Gebruiker</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe gebruiker toe aan het systeem.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...addUserForm}>
            <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 py-2">
              <FormField
                control={addUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gebruikersnaam</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="johndoe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wachtwoord</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer een rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Gebruiker</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsAddUserDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aanmaken...
                    </>
                  ) : (
                    'Aanmaken'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker Bewerken</DialogTitle>
            <DialogDescription>
              Bewerk de gegevens van {selectedUser?.username}.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4 py-2">
              <FormField
                control={editUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gebruikersnaam</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="johndoe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Wachtwoord
                      <span className="text-sm text-muted-foreground ml-2 font-normal">
                        (laat leeg om ongewijzigd te laten)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer een rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Gebruiker</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setIsEditUserDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Bijwerken...
                    </>
                  ) : (
                    'Bijwerken'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importeer Gebruikers</DialogTitle>
            <DialogDescription>
              Upload een CSV-bestand met gebruikers om te importeren. 
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
                username,email,password,role
              </p>
              <p className="text-xs font-mono text-muted-foreground whitespace-nowrap overflow-x-auto mt-1">
                johndoe,john@example.com,password123,user
              </p>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-md">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Belangrijke opmerking over wachtwoorden:</p>
                <p className="text-sm">Wachtwoorden in het CSV-bestand worden in platte tekst gelezen en daarna veilig gehasht opgeslagen. Gebruik dit alleen voor initiële setup of testgebruikers.</p>
              </div>
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

export default AdminUsers;