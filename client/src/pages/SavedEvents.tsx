import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EventList from "@/components/Events/EventList";
import type { SavedSearch } from "@shared/schema";

export default function SavedEvents() {
  const { data: savedSearches } = useQuery<SavedSearch[]>({
    queryKey: ["/api/users/1/saved-searches"], // TODO: Get user ID from auth context
  });

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Saved Searches</h1>

      <div className="space-y-6">
        {savedSearches?.map((search) => (
          <Card key={search.id}>
            <CardHeader>
              <CardTitle>{search.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <EventList
                location={search.filters.location}
                radius={search.filters.radius}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
