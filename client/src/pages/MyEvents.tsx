import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventCard from "@/components/Events/EventCard";
import type { Event } from "@shared/schema";

export default function MyEvents() {
  const { data: hostedEvents } = useQuery<Event[]>({
    queryKey: ["/api/users/1/hosted-events"], // TODO: Get user ID from auth context
  });

  const { data: participatingEvents } = useQuery<Event[]>({
    queryKey: ["/api/users/1/participating-events"],
  });

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">My Events</h1>

      <Tabs defaultValue="hosting">
        <TabsList className="w-full">
          <TabsTrigger value="hosting" className="flex-1">
            Hosting
          </TabsTrigger>
          <TabsTrigger value="participating" className="flex-1">
            Participating
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hosting" className="mt-6">
          <div className="space-y-4">
            {hostedEvents?.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="participating" className="mt-6">
          <div className="space-y-4">
            {participatingEvents?.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
