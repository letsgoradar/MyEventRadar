import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminSidebar from "@/components/Layout/AdminSidebar";
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
  CalendarPlus,
  CalendarCheck,
  Clock,
  FileText,
  Loader2,
  TrendingUp,
  Users,
  UserPlus,
  ArrowUpRight,
  AlertTriangle,
  Shield,
  Server,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  userCount: number;
  eventsCount: number;
  participantsCount: number;
  activityLogsCount: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  upcomingEvents: number;
  pastEvents: number;
  usersByMonth: Array<{ month: string; count: number }>;
  eventsByCategory: Array<{ category: string; count: number }>;
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

interface ApiUsageData {
  summary: {
    last24h: { requests: number; blocked: number };
    lastHour: { requests: number; blocked: number };
    averageHourly: number;
    peakHour: { hour: string; requests: number } | null;
    isSpike: boolean;
  };
  hourlyData: Array<{ hour: string; requests: number; blocked: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

const AdminDashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/statistics'],
  });
  
  const { data: apiUsage } = useQuery<ApiUsageData>({
    queryKey: ['/api/admin/api-usage'],
    refetchInterval: 60000, // Refresh every minute
  });

  const StatCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    gradient, 
    onClick,
    trend,
    trendLabel
  }: { 
    title: string; 
    value: number; 
    description: string; 
    icon: any; 
    gradient: string;
    onClick?: () => void;
    trend?: number;
    trendLabel?: string;
  }) => (
    <Card 
      className={`${gradient} cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </span>
          {onClick && <ArrowUpRight className="h-4 w-4 opacity-60" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-1">{value.toLocaleString('nl-NL')}</div>
        <p className="text-sm opacity-80">{description}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <TrendingUp className="h-3 w-3" />
            <span>+{trend} {trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="h-screen flex bg-background">
      <AdminSidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Overzicht van het platform</p>
            </div>
          </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Gebruikers"
                  value={data?.userCount || 0}
                  description="Totaal geregistreerd"
                  icon={Users}
                  gradient="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 text-blue-700 dark:text-blue-300"
                  onClick={() => setLocation('/admin/users')}
                  trend={data?.newUsersThisWeek}
                  trendLabel="deze week"
                />
                <StatCard
                  title="Evenementen"
                  value={data?.eventsCount || 0}
                  description="Totaal aangemaakt"
                  icon={CalendarDays}
                  gradient="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 text-green-700 dark:text-green-300"
                  onClick={() => setLocation('/admin/events')}
                />
                <StatCard
                  title="Komend"
                  value={data?.upcomingEvents || 0}
                  description="Toekomstige events"
                  icon={CalendarPlus}
                  gradient="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 text-purple-700 dark:text-purple-300"
                  onClick={() => setLocation('/admin/events')}
                />
                <StatCard
                  title="Aanmeldingen"
                  value={data?.participantsCount || 0}
                  description="Totale deelnames"
                  icon={Activity}
                  gradient="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 text-amber-700 dark:text-amber-300"
                  onClick={() => setLocation('/admin/activity-logs')}
                />
              </div>

              {/* API Usage Monitoring - Spike Warning */}
              {apiUsage?.summary?.isSpike && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-200">Ongewone activiteit gedetecteerd!</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Het huidige aantal requests ({apiUsage.summary.lastHour.requests}/uur) is meer dan 200% van het gemiddelde 
                      ({Math.round(apiUsage.summary.averageHourly)}/uur). Dit kan wijzen op een aanval of onverwacht hoog gebruik.
                    </p>
                    {apiUsage.summary.lastHour.blocked > 0 && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-medium">
                        {apiUsage.summary.lastHour.blocked} requests zijn geblokkeerd door rate limiting.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* API Usage Stats Card */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    API Gebruik Monitor
                    {apiUsage?.summary?.isSpike && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full">
                        SPIKE
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Realtime monitoring van server requests en geblokkeerde aanvragen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{apiUsage?.summary?.lastHour?.requests || 0}</div>
                      <div className="text-xs text-muted-foreground">Requests dit uur</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{apiUsage?.summary?.last24h?.requests || 0}</div>
                      <div className="text-xs text-muted-foreground">Requests 24u</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{apiUsage?.summary?.last24h?.blocked || 0}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Geblokkeerd 24u
                      </div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{Math.round(apiUsage?.summary?.averageHourly || 0)}</div>
                      <div className="text-xs text-muted-foreground">Gem. per uur</div>
                    </div>
                  </div>
                  
                  <div className="h-[200px]">
                    {apiUsage?.hourlyData && apiUsage.hourlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={apiUsage.hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="hour" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="Requests" />
                          <Bar dataKey="blocked" fill="#ef4444" radius={[2, 2, 0, 0]} name="Geblokkeerd" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Server className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p>Nog geen usage data - dit wordt automatisch verzameld</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Nieuwe Gebruikers
                    </CardTitle>
                    <CardDescription>Registraties per maand (laatste 6 maanden)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {data?.usersByMonth && data.usersByMonth.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.usersByMonth}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="month" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Nieuwe gebruikers" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Geen data beschikbaar
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      Evenementen per Categorie
                    </CardTitle>
                    <CardDescription>Verdeling over categorieën</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {data?.eventsByCategory && data.eventsByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.eventsByCategory}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ category, percent }) => 
                                percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                              }
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="category"
                            >
                              {data.eventsByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number, name: string) => [value, name]}
                            />
                            <Legend 
                              layout="vertical" 
                              align="right" 
                              verticalAlign="middle"
                              wrapperStyle={{ fontSize: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Geen data beschikbaar
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recente Evenementen
                    </CardTitle>
                    <CardDescription>Laatst toegevoegde evenementen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data?.recentEvents && data.recentEvents.length > 0 ? (
                        data.recentEvents.map((event) => (
                          <div 
                            key={event.id} 
                            className="flex items-start gap-4 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => setLocation(`/admin/events`)}
                            data-testid={`event-${event.id}`}
                          >
                            <div className="p-2 rounded-lg bg-primary/10">
                              <CalendarDays className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{event.title}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{event.date}</span>
                                <span>•</span>
                                <span className="truncate">{event.category}</span>
                              </div>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>Geen recente evenementen</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Top Organisatoren
                    </CardTitle>
                    <CardDescription>Meest actieve gebruikers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data?.topUsers && data.topUsers.length > 0 ? (
                        data.topUsers.map((user, index) => (
                          <div 
                            key={user.id} 
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => setLocation('/admin/users')}
                            data-testid={`top-user-${user.id}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-100 text-gray-700' :
                              index === 2 ? 'bg-amber-100 text-amber-700' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.eventsHosted} georganiseerd • {user.eventsParticipated} deelgenomen
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>Geen data beschikbaar</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
