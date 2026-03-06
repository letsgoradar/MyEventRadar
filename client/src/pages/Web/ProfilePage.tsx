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
import { useAuth } from "@/hooks/use-auth";
import { useUserPreferences, type MapStyle } from "@/hooks/use-user-preferences";
import { Link } from "wouter";
import { Lock } from "lucide-react";

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
  const { user: authUser } = useAuth();
  const { preferences, updatePreferences, isAuthenticated: isLoggedIn } = useUserPreferences();

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/current-user'],
    enabled: !!authUser,
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

  if (!authUser) {
    return (
      <WebLayout>
        <div className="container mx-auto p-6 max-w-md">
          <div className="flex flex-col items-center py-16">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Geen profiel</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Log in of maak een account aan om je profiel te bekijken en evenementen te beheren.
            </p>
            <div className="flex gap-3">
              <Link href="/web/login">
                <Button size="lg">Inloggen</Button>
              </Link>
              <Link href="/web/register">
                <Button variant="outline" size="lg">Account aanmaken</Button>
              </Link>
            </div>
          </div>
        </div>
      </WebLayout>
    );
  }

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
                  size="lg"
                  showUploadButton={true}
                />
                <h2 className="text-xl font-bold mt-4">{user?.name || authUser?.name || ''}</h2>
                <p className="text-muted-foreground">{user?.location || ''}</p>
                
                <Separator className="my-4 w-full" />
                
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
                
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Voorkeuren</CardTitle>
                    <CardDescription>
                      Standaardinstellingen voor zoeken en de kaart
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {!isLoggedIn && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        <span>Log in om je voorkeuren op te slaan</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Standaard zoekradius</Label>
                      <div className="flex flex-wrap gap-2">
                        {[5, 10, 15, 20, 30, 50].map(km => (
                          <button
                            key={km}
                            disabled={!isLoggedIn}
                            onClick={() => updatePreferences({ defaultRadius: km })}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              preferences.defaultRadius === km
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:border-primary/50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {km} km
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Standaard tijdvenster</Label>
                      <div className="flex flex-wrap gap-2">
                        {[7, 14, 30, 60, 100].map(days => (
                          <button
                            key={days}
                            disabled={!isLoggedIn}
                            onClick={() => updatePreferences({ defaultWindowDays: days })}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              preferences.defaultWindowDays === days
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:border-primary/50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {days} dagen
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Standaard kaartsoort</Label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: 'default', label: 'Standaard' },
                          { value: 'minimal', label: 'Minimaal' },
                          { value: 'satellite', label: 'Satelliet' },
                          { value: 'dark', label: 'Donker' },
                          { value: 'colorful', label: 'Kleurrijk' },
                        ] as { value: MapStyle; label: string }[]).map(({ value, label }) => (
                          <button
                            key={value}
                            disabled={!isLoggedIn}
                            onClick={() => updatePreferences({ mapStyle: value })}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              preferences.mapStyle === value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border hover:border-primary/50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
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