import React from "react";
import { useQuery } from "@tanstack/react-query";
import AdminNav from "@/components/Layout/AdminNav";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  CalendarDays,
  Clock,
  FileText,
  Loader2,
  Star,
  Users,
} from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface DashboardStats {
  userCount: number;
  eventsCount: number;
  participantsCount: number;
  activityLogsCount: number;
  recentEvents: Array<{
    id: number;
    title: string;
    date: string;
    category: string;
  }>;
  topUsers: Array<{
    id: number;
    username: string;
    eventsHosted: number;
    eventsParticipated: number;
  }>;
}

const AdminDashboard: React.FC = () => {
  // Query to get dashboard stats
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/dashboard'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/dashboard');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>Er is een fout opgetreden bij het laden van de dashboard gegevens.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-blue-700 dark:text-blue-300 flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Gebruikers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    {data?.userCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Totaal aantal geregistreerde gebruikers</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-green-700 dark:text-green-300 flex items-center">
                    <CalendarDays className="mr-2 h-5 w-5" />
                    Evenementen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    {data?.eventsCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Totaal aantal evenementen in het systeem</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-purple-700 dark:text-purple-300 flex items-center">
                    <Star className="mr-2 h-5 w-5" />
                    Deelnemers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    {data?.participantsCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Totaal aantal event aanmeldingen</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-amber-700 dark:text-amber-300 flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    Activiteiten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    {data?.activityLogsCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Totaal aantal gelogde activiteiten</p>
                </CardContent>
              </Card>
            </div>

            {/* Activity and Recent Events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    Recente Evenementen
                  </CardTitle>
                  <CardDescription>
                    De meest recent toegevoegde evenementen in het systeem
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {data?.recentEvents && data.recentEvents.length > 0 ? (
                      data.recentEvents.map((event) => (
                        <div key={event.id} className="flex items-start">
                          <div className="mr-4 mt-0.5">
                            <CalendarDays className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium">{event.title}</p>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <span>{event.date}</span>
                              <span className="px-2">•</span>
                              <span>{event.category}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Geen recente evenementen gevonden</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* User Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Top Gebruikers
                  </CardTitle>
                  <CardDescription>
                    Gebruikers met de meeste georganiseerde evenementen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {data?.topUsers && data.topUsers.length > 0 ? (
                      data.topUsers.map((user) => (
                        <div key={user.id} className="flex items-center gap-4">
                          <div className="w-12 h-12">
                            <CircularProgressbar
                              value={user.eventsHosted}
                              maxValue={Math.max(20, user.eventsHosted)}
                              text={`${user.eventsHosted}`}
                              styles={buildStyles({
                                textSize: '2rem',
                                pathColor: 'var(--primary)',
                                textColor: 'var(--primary)',
                                trailColor: 'var(--muted)'
                              })}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.eventsParticipated} deelgenomen
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Geen gebruikers data beschikbaar</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;