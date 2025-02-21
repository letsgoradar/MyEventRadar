import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { insertEventSchema } from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CategoryPicker } from "@/components/CategoryPicker"
import { DateTimePicker } from "@/components/date-time-picker"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"

const RECURRENCE_OPTIONS = [
  { value: "once", label: "One-time event" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
]

export default function CreateEventPage() {
  const form = useForm({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      title: "",
      description: "",
      location: { lat: 0, lng: 0 },
      address: "",
      startTime: new Date(),
      endTime: null,
      category: "",
      isPaid: false,
      price: 0,
      maxParticipants: null,
      recurrence: "once",
    },
  })

  const handleCategoryChange = (mainCategory: string, subCategory: string) => {
    form.setValue("category", subCategory || mainCategory);
  };

  function onSubmit(data: any) {
    console.log(data)
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card className="p-6">
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your event"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Location</FormLabel>
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Map integration coming soon...</p>
                <Input placeholder="Search location" />
              </div>
            </div>

            <div className="space-y-4">
              <FormLabel>Category</FormLabel>
              <CategoryPicker onCategoryChange={handleCategoryChange} />
            </div>

            <div className="space-y-4">
              <FormLabel>Date & Time</FormLabel>
              <div className="grid gap-4">
                <DateTimePicker
                  date={form.watch("startTime")}
                  setDate={(date) => form.setValue("startTime", date)}
                />
                <Select
                  value={form.watch("recurrence")}
                  onValueChange={(value) => form.setValue("recurrence", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FormField
              control={form.control}
              name="maxParticipants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Participants</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Leave empty for unlimited"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Paid Event</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable if this is a paid event
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("isPaid") && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter price"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="pt-6">
              <Button type="submit" className="w-full">
                Create Event
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  )
}