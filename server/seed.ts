import { storage } from "./storage";

async function seedEvents() {
  const events = [
    {
      title: "Summer Music Festival",
      description: "Annual summer festival with live music",
      latitude: "51.7656",
      longitude: "5.5314",
      notificationReach: "5",
      startTime: new Date("2024-07-15T14:00:00"),
      endTime: new Date("2024-07-15T23:00:00"),
      category: "festival",
      subcategory: "music",
      isPaid: true,
      price: 15,
      hostId: 1,
      maxParticipants: 1000,
      recurrence: "once"
    }
  ];

  // Generate 50 test events around the base location
  for (let i = 0; i < 49; i++) {
    const latOffset = (Math.random() - 0.5) * 0.1;
    const lngOffset = (Math.random() - 0.5) * 0.1;

    events.push({
      title: `Test Event ${i + 1}`,
      description: `Description for test event ${i + 1}`,
      latitude: (51.7656 + latOffset).toString(),
      longitude: (5.5314 + lngOffset).toString(),
      notificationReach: Math.floor(Math.random() * 5 + 1).toString(),
      startTime: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      category: ["festival", "sports", "culture", "education", "technology"][Math.floor(Math.random() * 5)],
      subcategory: "general",
      isPaid: Math.random() > 0.5,
      price: Math.random() > 0.5 ? Math.floor(Math.random() * 50) + 5 : null,
      hostId: 1,
      maxParticipants: Math.floor(Math.random() * 200) + 50,
      recurrence: ["once", "daily", "weekly", "monthly"][Math.floor(Math.random() * 4)]
    });
  }

  // Create new events
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