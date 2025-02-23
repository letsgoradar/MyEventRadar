
import { storage } from "./storage";

async function seedEvents() {
  const events = [
    {
      title: "Oss Summer Festival",
      description: "Annual summer festival with live music and food stalls",
      location: { lat: 51.7656, lng: 5.5314 },
      startTime: new Date("2024-07-15T14:00:00"),
      endTime: new Date("2024-07-15T23:00:00"),
      category: "festival",
      isPaid: true,
      price: 15,
      hostId: 1,
      maxParticipants: 1000
    },
    {
      title: "Weekly Market Oss",
      description: "Traditional Dutch market with local products",
      location: { lat: 51.7651, lng: 5.5288 },
      startTime: new Date("2024-03-20T09:00:00"),
      endTime: new Date("2024-03-20T17:00:00"),
      category: "market",
      isPaid: false,
      hostId: 1
    },
    {
      title: "Theater Show Lith",
      description: "Local theater performance",
      location: { lat: 51.8147, lng: 5.4397 },
      startTime: new Date("2024-04-01T20:00:00"),
      endTime: new Date("2024-04-01T22:30:00"),
      category: "culture",
      isPaid: true,
      price: 25,
      hostId: 1,
      maxParticipants: 200
    },
    {
      title: "Tech Meetup Oss",
      description: "Monthly technology meetup for developers",
      location: { lat: 51.7659, lng: 5.5307 },
      startTime: new Date("2024-03-25T18:30:00"),
      endTime: new Date("2024-03-25T21:00:00"),
      category: "technology",
      isPaid: false,
      hostId: 1,
      maxParticipants: 50
    },
    {
      title: "Food Truck Festival",
      description: "Various food trucks with international cuisine",
      location: { lat: 51.7670, lng: 5.5290 },
      startTime: new Date("2024-06-01T12:00:00"),
      endTime: new Date("2024-06-01T22:00:00"),
      category: "food",
      isPaid: true,
      price: 5,
      hostId: 1
    },
    {
      title: "Yoga in the Park",
      description: "Morning yoga session in the park",
      location: { lat: 51.7640, lng: 5.5280 },
      startTime: new Date("2024-04-15T08:00:00"),
      endTime: new Date("2024-04-15T09:30:00"),
      category: "sports",
      isPaid: true,
      price: 10,
      hostId: 1,
      maxParticipants: 30
    },
    {
      title: "Photography Workshop",
      description: "Learn photography basics in the city",
      location: { lat: 51.7665, lng: 5.5320 },
      startTime: new Date("2024-05-10T14:00:00"),
      endTime: new Date("2024-05-10T17:00:00"),
      category: "education",
      isPaid: true,
      price: 45,
      hostId: 1,
      maxParticipants: 15
    },
    {
      title: "Local Band Night",
      description: "Performances by local bands",
      location: { lat: 51.7680, lng: 5.5300 },
      startTime: new Date("2024-04-20T20:00:00"),
      endTime: new Date("2024-04-21T01:00:00"),
      category: "music",
      isPaid: true,
      price: 12,
      hostId: 1
    },
    {
      title: "Children's Art Workshop",
      description: "Creative workshop for kids aged 6-12",
      location: { lat: 51.7645, lng: 5.5310 },
      startTime: new Date("2024-04-06T13:00:00"),
      endTime: new Date("2024-04-06T15:00:00"),
      category: "children",
      isPaid: true,
      price: 15,
      hostId: 1,
      maxParticipants: 20
    },
    {
      title: "Vintage Market",
      description: "Market with vintage clothing and accessories",
      location: { lat: 51.7675, lng: 5.5295 },
      startTime: new Date("2024-05-25T11:00:00"),
      endTime: new Date("2024-05-25T18:00:00"),
      category: "market",
      isPaid: false,
      hostId: 1
    }
  ];

  for (const event of events) {
    await storage.createEvent(event);
  }
  
  console.log("Test events created successfully!");
}

seedEvents().catch(console.error);
