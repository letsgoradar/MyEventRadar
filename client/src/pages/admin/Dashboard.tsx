import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import AdminNav from '@/components/Layout/AdminNav';

import type { User, Event } from '@shared/schema';

const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState('overview');

  // Define types for the API responses
  interface Statistics {
    users: number;
    events: number;
    participants: number;
  }

  // Fetch statistics
  const statisticsQuery = useQuery<Statistics>({
    queryKey: ['/api/admin/statistics'],
  });
  const statistics = statisticsQuery.data || { users: 0, events: 0, participants: 0 };
  const statsLoading = statisticsQuery.isLoading;

  // Log errors if they occur
  React.useEffect(() => {
    if (statisticsQuery.error) {
      console.error('Error loading statistics:', statisticsQuery.error);
      toast({
        title: 'Fout bij het ophalen van statistieken',
        description: 'Er is een probleem opgetreden bij het ophalen van de statistieken.',
        variant: 'destructive',
      });
    }
  }, [statisticsQuery.error, toast]);

  // Fetch users
  const usersQuery = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });
  const users = usersQuery.data || [];
  const usersLoading = usersQuery.isLoading;

  // Log errors if they occur
  React.useEffect(() => {
    if (usersQuery.error) {
      console.error('Error loading users:', usersQuery.error);
      toast({
        title: 'Fout bij het ophalen van gebruikers',
        description: 'Er is een probleem opgetreden bij het ophalen van de gebruikers.',
        variant: 'destructive',
      });
    }
  }, [usersQuery.error, toast]);

  // Fetch events
  const eventsQuery = useQuery<Event[]>({
    queryKey: ['/api/admin/events'],
  });
  const events = eventsQuery.data || [];
  const eventsLoading = eventsQuery.isLoading;

  // Log errors if they occur
  React.useEffect(() => {
    if (eventsQuery.error) {
      console.error('Error loading events:', eventsQuery.error);
      toast({
        title: 'Fout bij het ophalen van evenementen',
        description: 'Er is een probleem opgetreden bij het ophalen van de evenementen.',
        variant: 'destructive',
      });
    }
  }, [eventsQuery.error, toast]);

  const statisticsData = [
    { name: 'Gebruikers', value: statistics?.users || 0 },
    { name: 'Evenementen', value: statistics?.events || 0 },
    { name: 'Deelnemers', value: statistics?.participants || 0 },
  ];

  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="users">Gebruikers</TabsTrigger>
            <TabsTrigger value="events">Evenementen</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Gebruikers</CardTitle>
                  <CardDescription>Aantal geregistreerde gebruikers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {statsLoading ? 'Laden...' : statistics?.users || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Evenementen</CardTitle>
                  <CardDescription>Aantal aangeboden evenementen</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {statsLoading ? 'Laden...' : statistics?.events || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Deelnemers</CardTitle>
                  <CardDescription>Totaal aantal deelnames</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {statsLoading ? 'Laden...' : statistics?.participants || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Statistieken</CardTitle>
                <CardDescription>Gebruikers, evenementen en deelnames</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statisticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recente gebruikers</CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <p>Laden...</p>
                  ) : users && users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Naam</TableHead>
                          <TableHead>E-mail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.slice(0, 5).map((user: User) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.id}</TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p>Geen gebruikers gevonden</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recente evenementen</CardTitle>
                </CardHeader>
                <CardContent>
                  {eventsLoading ? (
                    <p>Laden...</p>
                  ) : events && events.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Titel</TableHead>
                          <TableHead>Datum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.slice(0, 5).map((event: Event) => (
                          <TableRow key={event.id}>
                            <TableCell>{event.id}</TableCell>
                            <TableCell>{event.title}</TableCell>
                            <TableCell>
                              {format(new Date(event.startTime), 'dd MMM yyyy', { locale: nl })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p>Geen evenementen gevonden</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gebruikersbeheer</CardTitle>
                <CardDescription>Alle geregistreerde gebruikers</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <p>Laden...</p>
                ) : users && users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Gebruikersnaam</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user: User) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p>Geen gebruikers gevonden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Evenementenbeheer</CardTitle>
                <CardDescription>Alle aangeboden evenementen</CardDescription>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <p>Laden...</p>
                ) : events && events.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Titel</TableHead>
                        <TableHead>Categorie</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Host ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event: Event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.id}</TableCell>
                          <TableCell>{event.title}</TableCell>
                          <TableCell>{event.category}</TableCell>
                          <TableCell>
                            {format(new Date(event.startTime), 'dd MMM yyyy HH:mm', { locale: nl })}
                          </TableCell>
                          <TableCell>{event.hostId}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p>Geen evenementen gevonden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;