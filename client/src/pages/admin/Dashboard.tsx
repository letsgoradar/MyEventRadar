import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "@/components/Layout/AdminLayout";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  recentEvents: Array<{ id: number; title: string; date: string; category: string }>;
  topUsers: Array<{
    id: number;
    username: string;
    eventsHosted: number;
    eventsParticipated: number;
  }>;
}

interface FeedHealthEntry {
  status: "healthy" | "warning" | "suspect" | "unknown";
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const chartTooltip = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const AdminDashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/statistics"],
  });
  const { data: feedHealth = {} } = useQuery<Record<number, FeedHealthEntry>>({
    queryKey: ["/api/admin/rss-feeds/health"],
    refetchInterval: 60000,
  });
  const feedHealthValues = Object.values(feedHealth);
  const healthyFeeds = feedHealthValues.filter((feed) => feed.status === "healthy").length;
  const suspectFeeds = feedHealthValues.filter((feed) => feed.status === "suspect").length;
  const attentionFeeds = feedHealthValues.filter((feed) => feed.status === "warning").length;

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    tone,
    onClick,
    trend,
  }: {
    title: string;
    value: number;
    description: string;
    icon: React.ElementType;
    tone: string;
    onClick: () => void;
    trend?: string;
  }) => (
    <Card
      className={`${tone} cursor-pointer transition-shadow hover:shadow-lg`}
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Icon className="h-5 w-5" />{title}</span>
          <ArrowUpRight className="h-4 w-4 opacity-60" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-1 text-3xl font-bold">{value.toLocaleString("nl-NL")}</div>
        <p className="text-sm opacity-80">{description}</p>
        {trend && <p className="mt-2 flex items-center gap-1 text-xs font-medium"><TrendingUp className="h-3 w-3" />{trend}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Growth Cockpit</h1>
          <p className="text-muted-foreground">De positieve signalen van je platform, in één overzicht.</p>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error || !data ? (
          <div className="rounded-lg border p-6 text-center text-destructive">Er is een fout opgetreden bij het laden van de dashboardgegevens.</div>
        ) : (
          <>
            <section aria-label="Groei en activiteit">
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Gebruikers" value={data.userCount} description="Geregistreerde gebruikers" icon={Users}
                  tone="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 dark:from-blue-950 dark:to-blue-900 dark:text-blue-300"
                  onClick={() => setLocation("/admin/users")} trend={`+${data.newUsersThisWeek.toLocaleString("nl-NL")} deze week`} />
                <StatCard title="Evenementen" value={data.eventsCount} description="In de agenda" icon={CalendarDays}
                  tone="bg-gradient-to-br from-green-50 to-green-100 text-green-700 dark:from-green-950 dark:to-green-900 dark:text-green-300"
                  onClick={() => setLocation("/admin/events")} trend={`${data.upcomingEvents.toLocaleString("nl-NL")} gepland`} />
                <StatCard title="Deelnames" value={data.participantsCount} description="Totale eventdeelnames" icon={Activity}
                  tone="bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 dark:from-amber-950 dark:to-amber-900 dark:text-amber-300"
                  onClick={() => setLocation("/admin/activity-logs")} trend={`${data.activityLogsCount.toLocaleString("nl-NL")} recente activiteiten`} />
                <StatCard title="Komende events" value={data.upcomingEvents} description="Met een toekomstige starttijd" icon={CalendarPlus}
                  tone="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-700 dark:from-purple-950 dark:to-purple-900 dark:text-purple-300"
                  onClick={() => setLocation("/admin/events")} trend={`${data.pastEvents.toLocaleString("nl-NL")} afgerond`} />
              </div>
            </section>

            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Nieuwe gebruikers</CardTitle>
                  <CardDescription>Registraties per maand (laatste 6 maanden)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    {data.usersByMonth.length ? <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.usersByMonth} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" /><YAxis className="text-xs" allowDecimals={false} />
                        <Tooltip contentStyle={chartTooltip} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Nieuwe gebruikers" />
                      </BarChart>
                    </ResponsiveContainer> : <EmptyState text="Nog geen registratiegegevens" />}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" />Eventinventaris</CardTitle>
                  <CardDescription>Verdeling van evenementen per categorie</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    {data.eventsByCategory.length ? <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.eventsByCategory} cx="38%" cy="50%" outerRadius={88} dataKey="count" nameKey="category"
                          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""} labelLine={false}>
                          {data.eventsByCategory.map((entry, index) => <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTooltip} /><Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer> : <EmptyState text="Nog geen events per categorie" />}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Recente positieve activiteit</CardTitle>
                  <CardDescription>Nieuwst aangemaakte evenementen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.recentEvents.length ? data.recentEvents.map((event) => (
                    <button key={event.id} className="flex w-full items-start gap-4 rounded-lg p-3 text-left transition-colors hover:bg-accent" onClick={() => setLocation("/admin/events")} data-testid={`event-${event.id}`}>
                      <span className="rounded-lg bg-primary/10 p-2"><CalendarDays className="h-5 w-5 text-primary" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{event.title}</span><span className="flex gap-2 text-sm text-muted-foreground"><span>{event.date}</span><span>•</span><span className="truncate">{event.category}</span></span></span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )) : <EmptyState text="Geen recente evenementen" icon={FileText} />}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Actieve organisatoren</CardTitle>
                  <CardDescription>Gebruikers met de meeste activiteit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.topUsers.length ? data.topUsers.map((user, index) => (
                    <button key={user.id} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent" onClick={() => setLocation("/admin/users")} data-testid={`top-user-${user.id}`}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">{index + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.username}</span><span className="text-xs text-muted-foreground">{user.eventsHosted} georganiseerd • {user.eventsParticipated} deelgenomen</span></span>
                    </button>
                  )) : <EmptyState text="Nog geen activiteit" icon={Users} />}
                </CardContent>
              </Card>
            </div>

            <Card className="border-muted bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5" />Reliability Autopilot
                </CardTitle>
                <CardDescription>De importbewaking werkt op de achtergrond. Alleen feeds die aandacht nodig hebben worden uitgelicht.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
                  <span className="text-green-700"><strong>{healthyFeeds}</strong><br /><small className="text-muted-foreground">gezond</small></span>
                  <span className={attentionFeeds ? "text-amber-700" : ""}><strong>{attentionFeeds}</strong><br /><small className="text-muted-foreground">aandacht</small></span>
                  <span className={suspectFeeds ? "text-destructive" : ""}><strong>{suspectFeeds}</strong><br /><small className="text-muted-foreground">verdacht</small></span>
                </div>
                <Button variant="outline" onClick={() => setLocation("/admin/self-heal")}>Bekijk in Zelf-herstel <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

function EmptyState({ text, icon: Icon = TrendingUp }: { text: string; icon?: React.ElementType }) {
  return <div className="flex h-full min-h-24 flex-col items-center justify-center text-center text-muted-foreground"><Icon className="mb-2 h-8 w-8 opacity-20" /><p>{text}</p></div>;
}

export default AdminDashboard;