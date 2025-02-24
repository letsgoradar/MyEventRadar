import { storage } from "./storage";

async function seedSouthHollandEvents() {
  const events = [
    {
      title: "Rotterdam Food Festival",
      description: "Annual food festival featuring local and international cuisine",
      location: { 
        lat: 51.9244, 
        lng: 4.4777,
        notificationReach: 5,
      },
      startTime: new Date("2024-03-30T11:00:00"),
      endTime: new Date("2024-03-30T22:00:00"),
      category: "festival",
      subcategory: "food",
      isPaid: true,
      price: 15,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "The Hague Art Fair",
      description: "Contemporary art exhibition featuring Dutch artists",
      location: { 
        lat: 52.0705, 
        lng: 4.3007,
        notificationReach: 3,
      },
      startTime: new Date("2024-04-05T10:00:00"),
      endTime: new Date("2024-04-07T18:00:00"),
      category: "culture",
      subcategory: "art",
      isPaid: true,
      price: 20,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Delft Tech Meetup",
      description: "Monthly technology networking event",
      location: { 
        lat: 52.0116, 
        lng: 4.3571,
        notificationReach: 2,
      },
      startTime: new Date("2024-03-28T18:30:00"),
      endTime: new Date("2024-03-28T21:30:00"),
      category: "technology",
      subcategory: "networking",
      isPaid: false,
      price: null,
      hostId: 1,
      recurrence: "monthly"
    },
    {
      title: "Leiden University Open Day",
      description: "Information day for prospective students",
      location: { 
        lat: 52.1601, 
        lng: 4.4970,
        notificationReach: 4,
      },
      startTime: new Date("2024-04-15T09:00:00"),
      endTime: new Date("2024-04-15T17:00:00"),
      category: "education",
      subcategory: "open day",
      isPaid: false,
      price: null,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Scheveningen Beach Festival",
      description: "Music and entertainment on the beach",
      location: { 
        lat: 52.1133, 
        lng: 4.2831,
        notificationReach: 5,
      },
      startTime: new Date("2024-07-20T12:00:00"),
      endTime: new Date("2024-07-20T23:00:00"),
      category: "festival",
      subcategory: "music",
      isPaid: true,
      price: 25,
      hostId: 1,
      recurrence: "once"
    },
    // Add more events here...
    {
      title: "Gouda Cheese Market",
      description: "Traditional cheese market and demonstrations",
      location: { 
        lat: 52.0115, 
        lng: 4.7104,
        notificationReach: 3,
      },
      startTime: new Date("2024-04-04T10:00:00"),
      endTime: new Date("2024-04-04T16:00:00"),
      category: "market",
      subcategory: "food",
      isPaid: false,
      price: null,
      hostId: 1,
      recurrence: "weekly"
    },
    // Adding more events to reach 25 total...
    // Cities: Rotterdam, The Hague, Delft, Leiden, Gouda, Dordrecht, Schiedam, Zoetermeer
    {
      title: "Dordrecht Historical Tour",
      description: "Guided walking tour through historic Dordrecht",
      location: { 
        lat: 51.8132, 
        lng: 4.6665,
        notificationReach: 2,
      },
      startTime: new Date("2024-04-10T14:00:00"),
      endTime: new Date("2024-04-10T16:00:00"),
      category: "culture",
      subcategory: "history",
      isPaid: true,
      price: 12,
      hostId: 1,
      recurrence: "weekly"
    },
    // Continue with more events...
  ];

  // Add more events to reach 25
  const additionalEvents = [
    {
      city: "Rotterdam",
      lat: 51.9244,
      lng: 4.4777,
      events: [
        {
          title: "Rotterdam Marathon",
          category: "sports",
          subcategory: "running",
          isPaid: true,
          price: 45
        },
        {
          title: "Euromast Tower Run",
          category: "sports",
          subcategory: "running",
          isPaid: true,
          price: 30
        }
      ]
    },
    {
      city: "The Hague",
      lat: 52.0705,
      lng: 4.3007,
      events: [
        {
          title: "Peace Palace Tour",
          category: "culture",
          subcategory: "history",
          isPaid: true,
          price: 15
        },
        {
          title: "International Food Market",
          category: "market",
          subcategory: "food",
          isPaid: false,
          price: null
        }
      ]
    },
    // Add more cities and events...
  ];

  // Generate events from the additional cities
  additionalEvents.forEach(city => {
    city.events.forEach(eventInfo => {
      events.push({
        title: eventInfo.title,
        description: `Event in ${city.city}`,
        location: {
          lat: city.lat + (Math.random() - 0.5) * 0.01, // Small random offset
          lng: city.lng + (Math.random() - 0.5) * 0.01,
          notificationReach: 3,
        },
        startTime: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within next 30 days
        endTime: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours after start
        category: eventInfo.category,
        subcategory: eventInfo.subcategory,
        isPaid: eventInfo.isPaid,
        price: eventInfo.price,
        hostId: 1,
        recurrence: "once"
      });
    });
  });

  for (const event of events) {
    try {
      await storage.createEvent(event);
      console.log(`Created event: ${event.title}`);
    } catch (error) {
      console.error(`Error creating event ${event.title}:`, error);
    }
  }

  console.log("South Holland test events created successfully!");
}

seedSouthHollandEvents().catch(console.error);
