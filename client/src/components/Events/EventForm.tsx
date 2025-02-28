
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Event } from '@shared/schema';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Define the schema for form validation
const eventFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isPaid: z.boolean().default(false),
  price: z.string().optional(),
  maxParticipants: z.string().transform(val => Number(val) || 0),
  notificationReach: z.string().transform(val => Number(val) || 1),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const categories = [
  "festival", "food", "culture", "sports", "market", 
  "education", "music", "technology", "gaming", "health", "nature"
];

const LocationMarker = ({ position, setPosition }: { 
  position: [number, number], 
  setPosition: (pos: [number, number]) => void 
}) => {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <Marker position={position} />
  );
};

interface EventFormProps {
  defaultValues?: Partial<Event>;
  onSubmit: (data: Partial<Event>) => void;
  submitButtonText?: string;
}

export function EventForm({ defaultValues, onSubmit, submitButtonText = 'Submit' }: EventFormProps) {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(
    defaultValues && defaultValues.latitude && defaultValues.longitude
      ? [defaultValues.latitude, defaultValues.longitude]
      : [51.505, -0.09] // Default position
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: defaultValues?.title || '',
      description: defaultValues?.description || '',
      category: defaultValues?.category || '',
      subcategory: defaultValues?.subcategory || '',
      startTime: defaultValues?.startTime ? new Date(defaultValues.startTime).toISOString().slice(0, 16) : '',
      endTime: defaultValues?.endTime ? new Date(defaultValues.endTime).toISOString().slice(0, 16) : '',
      latitude: defaultValues?.latitude || markerPosition[0],
      longitude: defaultValues?.longitude || markerPosition[1],
      isPaid: defaultValues?.isPaid || false,
      price: defaultValues?.price || '',
      maxParticipants: defaultValues?.maxParticipants?.toString() || '0',
      notificationReach: defaultValues?.notificationReach?.toString() || '1',
    },
  });

  // Update form values when marker position changes
  useEffect(() => {
    form.setValue('latitude', markerPosition[0]);
    form.setValue('longitude', markerPosition[1]);
  }, [markerPosition, form]);

  const handleFormSubmit = (data: EventFormValues) => {
    const formattedData = {
      ...data,
      isPaid: !!data.isPaid,
      price: data.isPaid ? data.price : '0',
    };
    
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
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
                  {...field} 
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
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
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategory (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Subcategory" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
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
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isPaid"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Is this a paid event?</FormLabel>
              </div>
            </FormItem>
          )}
        />

        {form.watch('isPaid') && (
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (EUR)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="maxParticipants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maximum Participants</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notificationReach"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notification Reach (km)</FormLabel>
              <FormControl>
                <Input type="number" min="1" max="100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Location</FormLabel>
          <p className="text-sm text-muted-foreground mb-2">Click on the map to set the event location</p>
          <div className="h-[300px] rounded-md overflow-hidden border">
            <MapContainer 
              center={markerPosition} 
              zoom={13} 
              className="h-full w-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <LocationMarker 
                position={markerPosition}
                setPosition={setMarkerPosition}
              />
            </MapContainer>
          </div>
        </div>

        <Button type="submit" className="w-full">
          {submitButtonText}
        </Button>
      </form>
    </Form>
  );
}
