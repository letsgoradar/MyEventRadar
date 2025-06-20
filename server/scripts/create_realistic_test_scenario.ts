import { storage } from "../storage";
import { hash } from "crypto";

// Voeg automatisch login credentials toe voor de testgebruiker
const TEST_USER_CREDENTIALS = {
  username: "testuser",
  password: "test123",
  email: "test@example.com"
};

async function createRealisticTestScenario() {
  console.log("🚀 Creating realistic test scenario...");

  // 1. Update existing events with realistic future dates and times
  const events = await storage.getAllEvents();
  console.log(`📅 Updating ${events.length} events with future dates...`);

  const now = new Date();
  const futureEvents = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const daysFromNow = Math.floor(Math.random() * 30) + 1; // 1-30 dagen in de toekomst
    const startTime = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    
    // Set realistic times
    const hour = Math.floor(Math.random() * 12) + 9; // 9:00 - 21:00
    const minute = Math.random() < 0.5 ? 0 : 30; // :00 or :30
    startTime.setHours(hour, minute, 0, 0);
    
    // End time 1-4 hours later
    const duration = (Math.floor(Math.random() * 4) + 1) * 60 * 60 * 1000;
    const endTime = new Date(startTime.getTime() + duration);

    await storage.updateEvent(event.id, {
      startTime: startTime,
      endTime: endTime
    });

    futureEvents.push({ ...event, startTime, endTime });
  }

  // 2. Select events happening soon (next 3 days) for highlighting
  const soonEvents = futureEvents.filter(event => {
    const eventDate = new Date(event.startTime);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return eventDate <= threeDaysFromNow;
  });

  console.log(`⏰ ${soonEvents.length} events happening soon (binnenkort)`);

  // 3. Get or create test user
  let testUser = await storage.getUserByUsername(TEST_USER_CREDENTIALS.username);
  if (!testUser) {
    console.log("👤 Creating test user...");
    testUser = await storage.createUser({
      username: TEST_USER_CREDENTIALS.username,
      email: TEST_USER_CREDENTIALS.email,
      password: TEST_USER_CREDENTIALS.password, // Will be hashed in auth.ts
      role: "user"
    });
  }

  // 4. Add some events as favorites for the test user
  const favoriteCount = Math.min(8, Math.floor(futureEvents.length * 0.3));
  const favoriteEvents = futureEvents
    .sort(() => Math.random() - 0.5)
    .slice(0, favoriteCount);

  console.log(`⭐ Adding ${favoriteCount} events as favorites...`);
  
  for (const event of favoriteEvents) {
    try {
      await storage.addFavorite({
        userId: testUser.id,
        eventId: event.id
      });
    } catch (error) {
      // Ignore if already favorite
    }
  }

  // 5. Add user as participant to some events
  const participantCount = Math.min(5, Math.floor(futureEvents.length * 0.2));
  const participantEvents = futureEvents
    .filter(e => !favoriteEvents.includes(e))
    .sort(() => Math.random() - 0.5)
    .slice(0, participantCount);

  console.log(`🎯 Registering for ${participantCount} events...`);
  
  for (const event of participantEvents) {
    try {
      await storage.addParticipant({
        userId: testUser.id,
        eventId: event.id,
        status: "confirmed"
      });
    } catch (error) {
      // Ignore if already participant
    }
  }

  // 6. Create notifications for upcoming favorite events
  console.log("🔔 Creating notifications for upcoming events...");
  
  for (const event of favoriteEvents.filter(e => soonEvents.includes(e))) {
    await storage.createNotification({
      userId: testUser.id,
      title: `${event.title} begint binnenkort!`,
      message: `Je favoriete evenement "${event.title}" begint op ${new Date(event.startTime).toLocaleDateString('nl-NL')} om ${new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
      type: "event_reminder",
      isRead: false,
      relatedEventId: event.id
    });
  }

  // 7. Create some general notifications
  await storage.createNotification({
    userId: testUser.id,
    title: "Welkom bij Eventjes!",
    message: "Je hebt nu toegang tot alle evenementen in jouw omgeving. Veel plezier!",
    type: "welcome",
    isRead: false
  });

  const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

  console.log("\n✅ Realistic test scenario created!");
  console.log(`👤 Test user: ${TEST_USER_CREDENTIALS.username} / ${TEST_USER_CREDENTIALS.password}`);
  console.log(`⭐ Favorite events: ${favoriteCount}`);
  console.log(`🎯 Participating in: ${participantCount} events`);
  console.log(`⏰ Events happening soon: ${soonEvents.length}`);
  console.log(`🔔 Unread notifications: ${unreadCount}`);
  console.log("\n🎮 You can now log in and test the full app experience!");

  return {
    testUser,
    favoriteEvents,
    participantEvents,
    soonEvents,
    unreadCount
  };
}

// Run if called directly
createRealisticTestScenario()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error creating test scenario:", error);
    process.exit(1);
  });

export { createRealisticTestScenario, TEST_USER_CREDENTIALS };