import { storage } from "./storage";

async function seedEvents() {
  const events = [
    {
      title: "Oss Summer Festival",
      description: "Annual summer festival with live music and food stalls",
      location: { 
        lat: 51.7656, 
        lng: 5.5314,
        notificationReach: 5,
        locationName: "Centrum Oss"
      },
      startTime: new Date("2024-07-15T14:00:00"),
      endTime: new Date("2024-07-15T23:00:00"),
      category: "festival",
      subcategory: "music",
      isPaid: true,
      price: 15,
      hostId: 1,
      maxParticipants: 1000,
      recurrence: "once"
    },
    {
      title: "Weekly Market Oss",
      description: "Traditional Dutch market with local products",
      location: { 
        lat: 51.7651, 
        lng: 5.5288,
        notificationReach: 3,
        address: "Heuvel, Oss"
      },
      startTime: new Date("2024-03-20T09:00:00"),
      endTime: new Date("2024-03-20T17:00:00"),
      category: "market",
      subcategory: "local",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 0,
      recurrence: "weekly"
    },
    {
      title: "Theater Show Lith",
      description: "Local theater performance",
      location: { 
        lat: 51.8147, 
        lng: 5.4397,
        notificationReach: 2,
        address: "Theater Lith"
      },
      startTime: new Date("2024-04-01T20:00:00"),
      endTime: new Date("2024-04-01T22:30:00"),
      category: "culture",
      subcategory: "theater",
      isPaid: true,
      price: 25,
      hostId: 1,
      maxParticipants: 200,
      recurrence: "once"
    },
    {
      title: "Tech Meetup Oss",
      description: "Monthly technology meetup for developers",
      location: { 
        lat: 51.7659, 
        lng: 5.5307,
        notificationReach: 4,
        address: "Library Oss"
      },
      startTime: new Date("2024-03-25T18:30:00"),
      endTime: new Date("2024-03-25T21:00:00"),
      category: "technology",
      subcategory: "networking",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 50,
      recurrence: "monthly"
    }
  ];

  for (const event of events) {
    try {
      await storage.createEvent(event);
      console.log(`Created event: ${event.title}`);
    } catch (error) {
      console.error(`Error creating event ${event.title}:`, error);
    }
  }

  console.log("Test events created successfully!");
}

seedEvents().catch(console.error);