import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Calendar, Heart, User, Plus, PlusCircle, Menu } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Route, Switch } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import MapView from "@/components/Map/MapView"
import EventList from "@/components/Events/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import TopNav from "@/components/Layout/TopNav"
import React, { useState } from 'react';
import Home from '@/pages/Home';
import EventDetails from '@/pages/EventDetails';
import CreateEvent from '@/pages/CreateEvent';
import { Toaster } from '@/components/ui/toaster';
import FilterSheet from '@/components/Filter/FilterSheet';


const queryClient = new QueryClient();

export default function App() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");

  return (
    <QueryClientProvider client={queryClient}>
      <TopNav 
        toggleFilterSheet={() => setFilterOpen(true)}
        isMapView={view === "map"}
        toggleView={() => setView(view === "map" ? "list" : "map")}
      />
      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} />
      <Switch>
        <Route path="/" component={() => <Home view={view} setView={setView} />} />
        <Route path="/event/:id" component={EventDetails} />
        <Route path="/event/create" component={CreateEvent} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}