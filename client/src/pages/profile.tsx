import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopNav from "@/components/Layout/TopNav";
import BottomNav from "@/components/Layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Bell,
  CalendarDays,
  MapPin,
  Settings,
  User,
  Mail,
  Lock,
  LogOut,
  ChevronRight
} from "lucide-react";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Example user data - will be replaced with actual API call
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user/profile"],
    queryFn: async () => {
      // Mock data for development
      return {
        name: "John Doe",
        avatarUrl: "",
        bio: "Event enthusiast and organizer",
        hostedEvents: 12,
        attendedEvents: 28,
        interests: ["festival", "music", "culture", "technology", "food"],
        notifications: {
          push: true,
          location: false,
          reminders: true
        }
      };
    },
  });

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopNav />

      <div className="flex-1 overflow-auto pb-20">
        {/* Profile Header */}
        <div className="bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback>
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{user?.name || "Gebruiker"}</h1>
              <p className="text-muted-foreground">{user?.bio || "Geen biografie toegevoegd"}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overzicht</TabsTrigger>
              <TabsTrigger value="settings">Instellingen</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistieken</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{user?.hostedEvents || 0}</p>
                    <p className="text-sm text-muted-foreground">Georganiseerd</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{user?.attendedEvents || 0}</p>
                    <p className="text-sm text-muted-foreground">Bezocht</p>
                  </div>
                </CardContent>
              </Card>

              {/* Interests */}
              <Card>
                <CardHeader>
                  <CardTitle>Interesses</CardTitle>
                  <CardDescription>Jouw favoriete evenement categorieën</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {user?.interests?.map((interest: string) => (
                    <Badge key={interest} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {/* Account Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Instellingen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Email wijzigen</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>Wachtwoord wijzigen</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Notificaties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span>Push notificaties</span>
                    </div>
                    <Switch checked={user?.notifications?.push} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>Locatie notificaties</span>
                    </div>
                    <Switch checked={user?.notifications?.location} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>Event herinneringen</span>
                    </div>
                    <Switch checked={user?.notifications?.reminders} />
                  </div>
                </CardContent>
              </Card>

              {/* Logout */}
              <Button variant="destructive" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Uitloggen
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}