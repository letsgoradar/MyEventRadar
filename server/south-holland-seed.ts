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
      category: "Eten & Drinken",
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
      category: "Tentoonstelling",
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
      category: "Cursus & Workshop",
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
      category: "Cursus & Workshop",
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
      category: "Theater, Dans & Film",
      isPaid: true,
      price: 25,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Gouda Kaasmarkt",
      description: "Traditional cheese market and demonstrations",
      location: { 
        lat: 52.0115, 
        lng: 4.7104,
        notificationReach: 3,
      },
      startTime: new Date("2024-04-04T10:00:00"),
      endTime: new Date("2024-04-04T16:00:00"),
      category: "Markt & Beurs",
      isPaid: false,
      price: null,
      hostId: 1,
      recurrence: "weekly"
    },
    {
      title: "Dordrecht Historische Rondleiding",
      description: "Guided walking tour through historic Dordrecht",
      location: { 
        lat: 51.8132, 
        lng: 4.6665,
        notificationReach: 2,
      },
      startTime: new Date("2024-04-10T14:00:00"),
      endTime: new Date("2024-04-10T16:00:00"),
      category: "Rondleiding & Uitstap",
      isPaid: true,
      price: 12,
      hostId: 1,
      recurrence: "weekly"
    },
    {
      title: "Rotterdam Marathon",
      description: "Jaarlijkse marathonloop door Rotterdam",
      location: { 
        lat: 51.9244, 
        lng: 4.4777,
        notificationReach: 5,
      },
      startTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
      category: "Rondleiding & Uitstap",
      isPaid: true,
      price: 45,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Euromast Tower Run",
      description: "Trappenloop in de Euromast",
      location: { 
        lat: 51.9050, 
        lng: 4.4664,
        notificationReach: 3,
      },
      startTime: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      category: "Rondleiding & Uitstap",
      isPaid: true,
      price: 30,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Peace Palace Tour",
      description: "Guided tour of the Peace Palace in The Hague",
      location: { 
        lat: 52.0880, 
        lng: 4.2950,
        notificationReach: 2,
      },
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      category: "Tentoonstelling",
      isPaid: true,
      price: 15,
      hostId: 1,
      recurrence: "once"
    },
    {
      title: "Internationale Voedselmarkt Den Haag",
      description: "International food market in The Hague",
      location: { 
        lat: 52.0705, 
        lng: 4.3007,
        notificationReach: 4,
      },
      startTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      category: "Markt & Beurs",
      isPaid: false,
      price: null,
      hostId: 1,
      recurrence: "once"
    },
  ];

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
