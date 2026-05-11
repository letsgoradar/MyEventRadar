import { storage } from "./storage";

async function seedOssEvents() {
  const events = [
    {
      title: "Muziekfestival Centrum Oss",
      description: "Jaarlijks muziekfestival met lokale bands",
      location: { 
        lat: 51.7656, 
        lng: 5.5314,
        notificationReach: 5,
      },
      startTime: new Date("2024-03-30T14:00:00"),
      endTime: new Date("2024-03-30T23:00:00"),
      category: "Voorstelling",
      isPaid: true,
      price: 15.00,
      hostId: 1,
      maxParticipants: 1000,
      recurrence: "once"
    },
    {
      title: "Weekmarkt Oss",
      description: "Traditionele markt met lokale producten",
      location: { 
        lat: 51.7651, 
        lng: 5.5288,
        notificationReach: 3,
      },
      startTime: new Date("2024-03-27T09:00:00"),
      endTime: new Date("2024-03-27T17:00:00"),
      category: "Markt & Beurs",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 0,
      recurrence: "weekly"
    },
    {
      title: "Tech Meetup Bibliotheek",
      description: "Maandelijkse tech meetup voor developers",
      location: { 
        lat: 51.7659, 
        lng: 5.5307,
        notificationReach: 2,
      },
      startTime: new Date("2024-03-28T18:30:00"),
      endTime: new Date("2024-03-28T21:00:00"),
      category: "Leren & Ontdekken",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 50,
      recurrence: "monthly"
    },
    {
      title: "Sportdag TalentsCentrum",
      description: "Sportieve dag voor jong en oud",
      location: { 
        lat: 51.7645, 
        lng: 5.5298,
        notificationReach: 4,
      },
      startTime: new Date("2024-04-05T10:00:00"),
      endTime: new Date("2024-04-05T16:00:00"),
      category: "Activiteit",
      isPaid: true,
      price: 5.00,
      hostId: 1,
      maxParticipants: 200,
      recurrence: "once"
    },
    {
      title: "Kunstexpositie De Groene Engel",
      description: "Lokale kunstenaars tonen hun werk",
      location: { 
        lat: 51.7662, 
        lng: 5.5321,
        notificationReach: 3,
      },
      startTime: new Date("2024-03-31T13:00:00"),
      endTime: new Date("2024-03-31T18:00:00"),
      category: "Tentoonstelling",
      isPaid: true,
      price: 7.50,
      hostId: 1,
      maxParticipants: 100,
      recurrence: "once"
    },
    {
      title: "Workshop Duurzaamheid",
      description: "Leer over duurzaam leven",
      location: { 
        lat: 51.7648, 
        lng: 5.5334,
        notificationReach: 2,
      },
      startTime: new Date("2024-04-02T19:00:00"),
      endTime: new Date("2024-04-02T21:30:00"),
      category: "Leren & Ontdekken",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 30,
      recurrence: "once"
    },
    {
      title: "Food Truck Festival",
      description: "Diverse food trucks met internationale gerechten",
      location: { 
        lat: 51.7641, 
        lng: 5.5292,
        notificationReach: 5,
      },
      startTime: new Date("2024-04-06T12:00:00"),
      endTime: new Date("2024-04-06T22:00:00"),
      category: "Eten & Drinken",
      isPaid: false,
      price: null,
      hostId: 1,
      maxParticipants: 0,
      recurrence: "once"
    },
    {
      title: "Theater in de Open Lucht",
      description: "Openluchtvoorstelling door lokale theatergroep",
      location: { 
        lat: 51.7667, 
        lng: 5.5301,
        notificationReach: 4,
      },
      startTime: new Date("2024-04-07T15:00:00"),
      endTime: new Date("2024-04-07T17:00:00"),
      category: "Voorstelling",
      isPaid: true,
      price: 12.50,
      hostId: 1,
      maxParticipants: 150,
      recurrence: "once"
    },
    {
      title: "Gaming Tournament",
      description: "E-sports competitie voor lokale gamers",
      location: { 
        lat: 51.7653, 
        lng: 5.5327,
        notificationReach: 3,
      },
      startTime: new Date("2024-04-03T13:00:00"),
      endTime: new Date("2024-04-03T20:00:00"),
      category: "Quiz & Spelletjes",
      isPaid: true,
      price: 10.00,
      hostId: 1,
      maxParticipants: 64,
      recurrence: "once"
    },
    {
      title: "Yoga in het Park",
      description: "Buiten yoga sessie voor alle niveaus",
      location: { 
        lat: 51.7671, 
        lng: 5.5315,
        notificationReach: 2,
      },
      startTime: new Date("2024-04-01T09:00:00"),
      endTime: new Date("2024-04-01T10:30:00"),
      category: "Activiteit",
      isPaid: true,
      price: 8.00,
      hostId: 1,
      maxParticipants: 25,
      recurrence: "weekly"
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

  console.log("Oss test events created successfully!");
}

seedOssEvents().catch(console.error);
