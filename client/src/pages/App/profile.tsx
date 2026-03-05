import * as React from "react";
import { AppLayout } from "@/components/App/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut,
  Settings,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Clock,
  Globe,
  Moon,
  Sun,
  Info,
  Edit,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ProfilePhotoUpload from "@/components/App/ProfilePhotoUpload";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Type definitie voor de gebruiker
interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  photoUrl?: string | null;
  joinedAt: string;
  location: string;
  bio: string;
}

export function AppProfilePage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const { user: authUser, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    name: '',
    phone: '',
    location: '',
    bio: '',
  });

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user'],
    enabled: !!authUser,
  });
  
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; location: string; bio: string }) => {
      return await apiRequest('/api/user/profile', {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsEditDialogOpen(false);
      toast({
        title: "Profiel bijgewerkt",
        description: "Je profielgegevens zijn succesvol opgeslagen.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij opslaan",
        description: error.message || "Er is iets misgegaan bij het opslaan van je profiel.",
        variant: "destructive",
      });
    },
  });

  const [notifications, setNotifications] = React.useState({
    email: true,
    push: true,
    eventReminders: true,
    newEvents: false,
  });
  
  const handleOpenEditDialog = () => {
    setEditForm({
      name: user?.name || authUser?.name || '',
      phone: user?.phone || '',
      location: user?.location || '',
      bio: user?.bio || '',
    });
    setIsEditDialogOpen(true);
  };
  
  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/app/welcome');
        toast({
          title: "Uitgelogd",
          description: "Je bent succesvol uitgelogd.",
        });
      }
    });
  };

  if (!authUser) {
    return (
      <AppLayout title="Profiel" header={<div className="hidden"></div>}>
        <div className="pb-20 h-full overflow-auto flex flex-col items-center justify-center px-6">
          <div className="flex flex-col items-center max-w-sm w-full py-12">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Geen profiel</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Log in of maak een account aan om je profiel te bekijken en evenementen te beheren.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Link href="/app/login">
                <Button className="w-full" size="lg">
                  Inloggen
                </Button>
              </Link>
              <Link href="/app/register">
                <Button variant="outline" className="w-full" size="lg">
                  Account aanmaken
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Profiel" header={
      <div className="hidden"></div>
    }>
      <div className="pb-20 h-full overflow-auto">
        
        <Tabs defaultValue="profile">
          <TabsList className="w-full mb-4 sticky top-0 bg-background z-10">
            <TabsTrigger value="profile" className="flex-1">Profiel</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Instellingen</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card className="mb-4">
              <CardContent className="pt-6 flex flex-col items-center">
                <ProfilePhotoUpload 
                  currentPhotoUrl={user?.photoUrl || user?.avatar || undefined}
                  onPhotoUploaded={(photoUrl) => {
                    console.log("Profile page received photo URL:", photoUrl);
                    
                    // Converteer naar absolute URL indien nodig
                    const absolutePhotoUrl = photoUrl.startsWith('http') 
                      ? photoUrl 
                      : window.location.origin + photoUrl;
                    
                    // Sla de URL op in localStorage voor persistentie tussen pagina's
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('profilePhotoUrl', absolutePhotoUrl);
                      console.log("Saved to localStorage from profile page:", absolutePhotoUrl);
                      
                      // Er is geen reload meer nodig dankzij onze verbeterde state handling in AppLayout
                    }
                    
                    toast({
                      title: "Profielfoto bijgewerkt",
                      description: "Je profielfoto is succesvol bijgewerkt."
                    });
                  }}
                  size="lg"
                  showUploadButton={true}
                />
                <h2 className="text-xl font-bold">{user?.name || authUser?.name || ''}</h2>
                <p className="text-muted-foreground">{user?.location || ''}</p>
                
                <Separator className="my-4" />
                
                <div className="space-y-3 w-full">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span>{user?.email || authUser?.email || ''}</span>
                  </div>
                  {user?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  {user?.joinedAt && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span>Lid sinds {new Date(user.joinedAt).toLocaleDateString('nl-NL')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleOpenEditDialog}
                  data-testid="button-edit-profile"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Profiel bewerken
                </Button>
              </CardFooter>
            </Card>
            
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-[90vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Profiel bewerken</DialogTitle>
                  <DialogDescription>
                    Pas je profielgegevens aan
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Naam</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Je naam"
                      data-testid="input-edit-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Telefoonnummer</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+31 6 12345678"
                      data-testid="input-edit-phone"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-location">Locatie</Label>
                    <Input
                      id="edit-location"
                      value={editForm.location}
                      onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Stad of gemeente"
                      data-testid="input-edit-location"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-bio">Over mij</Label>
                    <Textarea
                      id="edit-bio"
                      value={editForm.bio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Vertel iets over jezelf..."
                      className="min-h-[100px]"
                      data-testid="input-edit-bio"
                    />
                  </div>
                </div>
                
                <DialogFooter className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Annuleren
                  </Button>
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Card>
              <CardHeader>
                <CardTitle>Over mij</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {user?.bio || 'Nog geen bio ingevuld.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Notificaties</CardTitle>
                <CardDescription>
                  Pas aan hoe en wanneer je geïnformeerd wilt worden
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">E-mailnotificaties</Label>
                    <p className="text-sm text-muted-foreground">
                      Ontvang updates via e-mail
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Push-meldingen</Label>
                    <p className="text-sm text-muted-foreground">
                      Ontvang meldingen op je apparaat
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={notifications.push}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="event-reminders">Evenement herinneringen</Label>
                    <p className="text-sm text-muted-foreground">
                      Herinneringen voor evenementen waar je aan deelneemt
                    </p>
                  </div>
                  <Switch
                    id="event-reminders"
                    checked={notifications.eventReminders}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, eventReminders: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-events">Nieuwe evenementen in de buurt</Label>
                    <p className="text-sm text-muted-foreground">
                      Word op de hoogte gehouden van nieuwe evenementen
                    </p>
                  </div>
                  <Switch
                    id="new-events"
                    checked={notifications.newEvents}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newEvents: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Weergave</CardTitle>
                <CardDescription>
                  Pas het uiterlijk van de app aan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="theme-toggle">Donkere modus</Label>
                    <p className="text-sm text-muted-foreground">
                      Schakel tussen licht en donker thema
                    </p>
                  </div>
                  <Switch
                    id="theme-toggle"
                    checked={isDarkMode}
                    onCheckedChange={(checked) => {
                      setIsDarkMode(checked);
                      document.documentElement.classList.toggle('dark', checked);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Info className="mr-2 h-4 w-4" />
                  Help & ondersteuning
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  Accountgegevens
                </Button>
                <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Uitloggen
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default AppProfilePage;