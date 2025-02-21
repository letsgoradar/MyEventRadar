
import { storage } from "./storage";

async function seedEvents() {
  const events = [
    {
      title: "Oss Summer Festival",
      description: "Annual summer festival with live music and food stalls",
      location: { lat: 51.7656, lng: 5.5314 },
      address: "Eikenboomgaard 1, 5341 CT Oss",
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
      address: "Heuvel, 5341 CP Oss",
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
      address: "Marktplein 4, 5397 Lith",
      startTime: new Date("2024-04-01T20:00:00"),
      endTime: new Date("2024-04-01T22:30:00"),
      category: "culture",
      isPaid: true,
      price: 25,
      hostId: 1,
      maxParticipants: 200
    }
  ];

  for (const event of events) {
    await storage.createEvent(event);
  }
  
  console.log("Test events created successfully!");
}

seedEvents().catch(console.error);
