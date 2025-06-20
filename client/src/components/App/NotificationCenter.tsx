import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Bell, X, Calendar, AlertCircle, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { useLocation } from "wouter";

interface Notification {
  id: number;
  eventId?: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user?.id,
  });

  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: [`/api/notifications/unread-count`],
    enabled: !!user?.id,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = unreadCountData?.count || notifications.filter(n => !n.isRead).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/unread-count`] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'event_change':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'event_reminder':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'event_cancelled':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Navigate to the relevant event if eventId exists
    if (notification.eventId) {
      setLocation(`/app/event/${notification.eventId}`);
      setIsOpen(false);
    }
  };

  // Show bell for everyone, but only show notifications for logged in users

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {user && unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Notificaties</SheetTitle>
          <SheetDescription>
            {unreadCount > 0 
              ? `Je hebt ${unreadCount} ongelezen ${unreadCount === 1 ? 'notificatie' : 'notificaties'}`
              : 'Alle notificaties zijn gelezen'
            }
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {!user ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Log in voor notificaties</p>
              <p className="text-sm">Ontvang meldingen over je favoriete evenementen na het inloggen</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen notificaties</p>
              <p className="text-sm">Je ontvangt hier meldingen over je favoriete evenementen</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent",
                    !notification.isRead && "bg-blue-50 border-blue-200 dark:bg-blue-950"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className={cn(
                          "text-sm font-medium",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center space-x-2">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: nl,
                            })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}