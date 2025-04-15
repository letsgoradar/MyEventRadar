import * as React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
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

// Dummy gebruikersgegevens (normaal gesproken zou dit uit een API komen)
const dummyUser = {
  id: 1,
  name: "Jan Jansen",
  email: "jan.jansen@example.com",
  phone: "+31 6 12345678",
  avatar: null,
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
  avatar: string | null;
  joinedAt: string;
  location: string;
  bio: string;
}

export function App2ProfilePage() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  // Zou normaal een API call zijn
  const { data: user = dummyUser as UserProfile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user/profile'],
    enabled: false // We gebruiken dummy data voor nu
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
    <App2Layout title="Profiel">
      <div className="pb-20">
        
        <Tabs defaultValue="profile">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="profile" className="flex-1">Profiel</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Instellingen</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card className="mb-4">
              <CardContent className="pt-6 flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src="/images/default-user.svg" alt={user.name} />
                  <AvatarFallback>
                    {user.name.split(" ").map((n: string) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold">{user.name}</h2>
                <p className="text-muted-foreground">{user.location}</p>
                
                <Separator className="my-4" />
                
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
        </Tabs>
      </div>
    </App2Layout>
  );
}

export default App2ProfilePage;