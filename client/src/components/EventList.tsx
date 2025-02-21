import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import type { Event } from "@shared/schema"

export function EventList() {
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby'],
    queryFn: () => fetch('/api/events/nearby').then(res => res.json())
  })

  if (isLoading) {
    return <div className="p-4">Loading events...</div>
  }

  return (
    <div className="p-4 space-y-4 overflow-auto max-h-[calc(100vh-16rem)]">
      {events?.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            <CardTitle>{event.title}</CardTitle>
            <CardDescription>{event.category}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{event.description}</p>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>{event.address}</p>
              <p>{format(new Date(event.startTime), 'PPP')}</p>
              {event.isPaid && <p>Price: ${event.price}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
