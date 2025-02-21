import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import SavedEvents from "@/pages/SavedEvents";
import MyEvents from "@/pages/MyEvents";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Layout/Navbar";
import MobileNav from "@/components/Layout/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/saved" component={SavedEvents} />
      <Route path="/my-events" component={MyEvents} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto px-4 pb-16">
          <Router />
        </main>
        {isMobile && <MobileNav />}
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;