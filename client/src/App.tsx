import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { queryClient } from '@/lib/queryClient';
import { useIsMobile } from '@/hooks/use-mobile';
import Navbar from '@/components/Layout/Navbar';
import MobileNav from '@/components/Layout/MobileNav';
import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import SavedEvents from '@/pages/SavedEvents';
import MyEvents from '@/pages/MyEvents';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/saved" component={SavedEvents} />
      <Route path="/favorites" component={Profile} />
      <Route path="/my-events" component={MyEvents} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Router />
        </main>
        {isMobile && <MobileNav />}
      </div>
    </QueryClientProvider>
  );
}