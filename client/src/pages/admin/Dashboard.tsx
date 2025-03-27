import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Users, 
  Calendar, 
  UserCheck, 
  ArrowRight,
  TrendingUp,
  ListChecks
} from 'lucide-react';
import AdminNav from '@/components/Layout/AdminNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface Statistics {
  users: number;
  events: number;
  participants: number;
}

const AdminDashboard: React.FC = () => {
  // Fetch statistics
  const { data: statistics, isLoading } = useQuery<Statistics>({
    queryKey: ['/api/admin/statistics'],
  });
  
  interface ActivityLog {
    id: number;
    userId: number;
    activityType: string;
    details: any;
    createdAt: string;
  }
  
  interface ActivityLogsResponse {
    logs: ActivityLog[];
    total: number;
  }
  
  // Fetch recent activity logs
  const { data: activityLogsData } = useQuery<ActivityLogsResponse>({
    queryKey: ['/api/admin/activity-logs', { limit: 5 }],
  });
  
  const recentLogs = activityLogsData?.logs || [];
  
  // Placeholder data for the charts (you could replace this with real data)
  const eventsByCategory = [
    { category: 'Sport en spel', count: 28 },
    { category: 'Kunst en Cultuur', count: 17 },
    { category: 'Gezellig en Sociaal', count: 22 },
    { category: 'Leren en Ontdekken', count: 15 },
    { category: 'Vrijwilligerswerk en hulp', count: 8 },
  ];
  
  const eventsByDay = [
    { day: 'Ma', count: 12 },
    { day: 'Di', count: 8 },
    { day: 'Wo', count: 15 },
    { day: 'Do', count: 22 },
    { day: 'Vr', count: 28 },
    { day: 'Za', count: 35 },
    { day: 'Zo', count: 18 },
  ];
  
  // Format activity type for display
  const formatActivityType = (type: string): string => {
    switch (type) {
      case 'login': return 'Inloggen';
      case 'logout': return 'Uitloggen';
      case 'create_event': return 'Evenement aanmaken';
      case 'update_event': return 'Evenement bijwerken';
      case 'delete_event': return 'Evenement verwijderen';
      case 'join_event': return 'Deelnemen aan evenement';
      case 'leave_event': return 'Evenement verlaten';
      case 'favorite_event': return 'Evenement favoriet maken';
      case 'unfavorite_event': return 'Evenement ongunstig maken';
      case 'create_user': return 'Gebruiker aanmaken';
      case 'update_user': return 'Gebruiker bijwerken';
      case 'admin_action': return 'Admin-actie';
      default: return type;
    }
  };
  
  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        
        {/* Stats cards */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Totaal Gebruikers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="w-6 h-6 mr-3 text-primary" />
                <div className="text-3xl font-bold">
                  {isLoading ? '...' : statistics?.users.toLocaleString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/admin/users">
                <a className="text-sm text-primary flex items-center">
                  Bekijk gebruikers
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Totaal Evenementen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-primary" />
                <div className="text-3xl font-bold">
                  {isLoading ? '...' : statistics?.events.toLocaleString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/admin/events">
                <a className="text-sm text-primary flex items-center">
                  Bekijk evenementen
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Totaal Deelnemers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <UserCheck className="w-6 h-6 mr-3 text-primary" />
                <div className="text-3xl font-bold">
                  {isLoading ? '...' : statistics?.participants.toLocaleString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/admin/events">
                <a className="text-sm text-primary flex items-center">
                  Bekijk deelnames
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Link>
            </CardFooter>
          </Card>
        </div>
        
        {/* Tabs for different charts/data */}
        <Tabs defaultValue="overview" className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="categories">Categorieën</TabsTrigger>
            <TabsTrigger value="activity">Activiteit per dag</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recente Activiteit</CardTitle>
                  <CardDescription>De laatste 5 acties in het systeem</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentLogs.length === 0 ? (
                    <p className="text-muted-foreground">Geen recente activiteit.</p>
                  ) : (
                    <div className="space-y-4">
                      {recentLogs.map((log: ActivityLog) => (
                        <div 
                          key={log.id} 
                          className="flex items-start pb-4 border-b last:border-0 last:pb-0"
                        >
                          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                            <ListChecks className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {formatActivityType(log.activityType)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {log.details && log.details.title 
                                ? log.details.title 
                                : (log.details && log.details.action)
                                  ? log.details.action
                                  : 'Geen details'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Link href="/admin/activity-logs">
                    <a className="text-sm text-primary flex items-center">
                      Bekijk alle activiteit
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </Link>
                </CardFooter>
              </Card>
              
              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Systeem Status</CardTitle>
                  <CardDescription>Overzicht van systeemprestaties</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Database</span>
                        <span className="text-sm font-medium text-green-600">Online</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">API Prestaties</span>
                        <span className="text-sm font-medium text-green-600">Goed</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Server Belasting</span>
                        <span className="text-sm font-medium text-yellow-600">Normaal</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Schijfruimte</span>
                        <span className="text-sm font-medium text-green-600">76% vrij</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '24%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Bekijk details
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Evenementen per Categorie</CardTitle>
                <CardDescription>
                  Verdeling van evenementen over categorieën
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {eventsByCategory.map((item) => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${(item.count / Math.max(...eventsByCategory.map(i => i.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activiteit per Dag</CardTitle>
                <CardDescription>
                  Verdeling van evenementen over de week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-end justify-between">
                  {eventsByDay.map((item) => (
                    <div key={item.day} className="flex flex-col items-center">
                      <div 
                        className="bg-primary rounded-t-md w-12" 
                        style={{ 
                          height: `${(item.count / Math.max(...eventsByDay.map(i => i.count))) * 250}px`,
                        }}
                      />
                      <span className="mt-2 text-sm font-medium">{item.day}</span>
                      <span className="text-xs text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;