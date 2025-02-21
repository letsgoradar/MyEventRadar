import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocation } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CategoryPicker } from "@/components/CategoryPicker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import * as z from 'zod'
import { insertEventSchema } from "@shared/schema"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"

const RECURRENCE_OPTIONS = [
  { label: "Eenmalig", value: "once" },
  { label: "Dagelijks", value: "daily" },
  { label: "Wekelijks", value: "weekly" },
  { label: "Maandelijks", value: "monthly" }
]

export default function CreateEventPage() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const [position, setPosition] = useState({ lat: 52.3676, lng: 4.9041 })

  const form = useForm({
    resolver: zodResolver(
      insertEventSchema.extend({
        startTime: insertEventSchema.shape.startTime.refine(
          (date) => new Date(date) > new Date(),
          "Event must be in the future"
        ),
        endTime: insertEventSchema.shape.endTime.refine(
          (date, ctx) => {
            if (!date) return true;
            const startTime = new Date(ctx.startTime);
            const endTime = new Date(date);
            return endTime > startTime;
          },
          "End time must be after start time"
        ),
        recurrence: z.enum(["once", "daily", "weekly", "monthly"]).default("once"),
      })
    ),
    defaultValues: {
      title: "",
      description: "",
      location: position,
      startTime: new Date(),
      endTime: new Date(),
      category: "",
      subcategory: "",
      isPaid: false,
      price: 0,
      maxParticipants: 0,
      recurrence: "once",
      hostId: 1, // This will be replaced with actual user ID when auth is implemented
    },
  })

  function LocationMarker() {
    useMapEvents({
      click(e) {
        setPosition(e.latlng)
        form.setValue("location", e.latlng)
      },
    })
    return <Marker position={position} />
  }

  async function onSubmit(data: any) {
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to create event')
      }

      toast({
        title: "Success",
        description: "Event created successfully",
      })
      setLocation('/')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card className="p-6 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={() => setLocation('/')}
        >
          <X className="h-4 w-4" />
        </Button>

        <h1 className="text-2xl font-bold mb-6">Create New Event</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Location</FormLabel>
              <div className="h-[200px] rounded-md overflow-hidden">
                <MapContainer
                  center={[position.lat, position.lng]}
                  zoom={13}
                  className="h-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationMarker />
                </MapContainer>
              </div>
            </div>

            <div className="space-y-2">
              <FormLabel>Category</FormLabel>
              <CategoryPicker
                onCategoryChange={(main, sub) => {
                  form.setValue("category", main)
                  form.setValue("subcategory", sub)
                }}
              />
              <FormMessage />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field}
                        value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="recurrence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxParticipants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Participants</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter max participants"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter event description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Input 
                      type="checkbox" 
                      className="w-4 h-4"
                      checked={field.value}
                      onChange={e => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <FormLabel>Is this a paid event?</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("isPaid") && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per person</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter price"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full">
              Create Event
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  )
}