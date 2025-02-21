import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle, XCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Event } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface EventOverlayProps {
  event: Event;
  onClose: () => void;
}

export default function EventOverlay({ event, onClose }: EventOverlayProps) {
  const overlayStyle = "fixed bottom-0 left-0 right-0 bg-background p-4 rounded-t-xl shadow-lg z-[51] max-h-[50vh] overflow-y-auto";
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleParticipate = async () => {
    try {
      await apiRequest("POST", `/api/events/${event.id}/participants`, {
        userId: 1, // TODO: Get from auth context
        eventId: event.id,
        status: "attending",
      });
      toast({
        title: "Success",
        description: "You've been registered for this event",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to register for event",
        variant: "destructive",
      });
    }
  };

  const handleFavorite = async () => {
    try {
      await apiRequest("POST", "/api/favorites", {
        userId: 1, // TODO: Get from auth context
        eventId: event.id,
      });
      toast({
        title: "Success",
        description: "Event added to favorites",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to favorites",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className={`h-${isExpanded ? "3/4" : "1/4"} p-0 transition-all duration-300`}
      >
        <div
          className="h-2 w-12 rounded-full bg-gray-300 mx-auto mt-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        />
        
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
          <p className="text-gray-600 mb-4">{event.address}</p>
          
          <div className="flex gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Start Time</p>
              <p>{format(new Date(event.startTime), "MMM d, h:mm a")}</p>
            </div>
            {event.endTime && (
              <div>
                <p className="text-sm text-gray-500">End Time</p>
                <p>{format(new Date(event.endTime), "MMM d, h:mm a")}</p>
              </div>
            )}
          </div>

          {isExpanded && (
            <>
              <p className="mb-4">{event.description}</p>
              {event.isPaid && (
                <p className="text-primary font-bold mb-4">
                  Price: ${event.price}
                </p>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleParticipate}
              className="flex-1"
              variant="default"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Join
            </Button>
            <Button
              onClick={onClose}
              className="flex-1"
              variant="destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleFavorite}
              variant="secondary"
              className="w-auto"
            >
              <Star className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
