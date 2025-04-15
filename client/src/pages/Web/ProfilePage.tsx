import * as React from "react";
import { WebLayout } from "@/components/Web/WebLayout";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import ProfilePhotoUpload from "@/components/App2/ProfilePhotoUpload";

// Dummy gebruikersgegevens (normaal gesproken zou dit uit een API komen)
const dummyUser = {
  id: 1,
  name: "Jan Jansen",
  email: "jan.jansen@example.com",
  phone: "+31 6 12345678",
  avatar: null,
  photoUrl: null,
  joinedAt: "2022-05-15T10:30:00Z",
  location: "Eindhoven",
  bio: "Enthousiaste evenementenbezoeker en organisator van lokale community activiteiten. Ik ben geïnteresseerd in muziek, technologie en lokale initiatieven.",
};

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

export function WebProfilePage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Haal gebruikersgegevens op van de API
  const { data: user = dummyUser as UserProfile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/current-user'],
    enabled: true, 
    // Als er geen data is geladen, gebruik dummyUser als fallback
    placeholderData: dummyUser as UserProfile
  });

  const [notifications, setNotifications] = React.useState({
    email: true,
    push: true,
    eventReminders: true,
    newEvents: false,
  });

  const handleLogout = () => {
    toast({
      title: "Uitgelogd",
      description: "Je bent succesvol uitgelogd.",
    });
  };

  return (
    <WebLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Mijn Profiel</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Linker zijbalk met profielfoto */}
          <div className="md:col-span-1">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ProfilePhotoUpload 
                  currentPhotoUrl={user?.photoUrl || user?.avatar}
                  onPhotoUploaded={(photoUrl) => {
                    toast({
                      title: "Profielfoto bijgewerkt",
                      description: "Je profielfoto is succesvol bijgewerkt."
                    });
                  }}
                  size="xl"
                  showUploadButton={true}
                />
                <h2 className="text-xl font-bold mt-4">{user.name}</h2>
                <p className="text-muted-foreground">{user.location}</p>
                
                <Separator className="my-4 w-full" />
                
                <div className="space-y-3 w-full">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Lid sinds {new Date(user.joinedAt).toLocaleDateString('nl-NL')}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Profiel bewerken
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          {/* Rechter content met tabs */}
          <div className="md:col-span-2">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="profile" className="flex-1">Profiel</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">Instellingen</TabsTrigger>
                <TabsTrigger value="events" className="flex-1">Mijn Evenementen</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>Over mij</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {user.bio}
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
              
              <TabsContent value="events">
                <Card>
                  <CardHeader>
                    <CardTitle>Mijn Evenementen</CardTitle>
                    <CardDescription>
                      Evenementen die je organiseert of waaraan je deelneemt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                      Je hebt nog geen evenementen. Ontdek evenementen in je buurt of maak je eigen evenement aan.
                    </p>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline">Evenementen bekijken</Button>
                      <Button>Maak evenement</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </WebLayout>
  );
}

export default WebProfilePage;