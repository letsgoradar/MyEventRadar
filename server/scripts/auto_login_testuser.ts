import { storage } from "../storage";

async function autoLoginTestUser() {
  console.log("🔐 Setting up auto-login for test user...");
  
  // Get the test user
  const testUser = await storage.getUserByUsername("testuser");
  if (!testUser) {
    console.error("❌ Test user not found");
    return;
  }

  // Log current stats
  const favoriteEvents = await storage.getFavoritesByUser(testUser.id);
  const participantEvents = await storage.getEventsForParticipant(testUser.id);
  const notifications = await storage.getNotificationsByUser(testUser.id);
  const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

  console.log("\n✅ Test scenario ready!");
  console.log(`👤 Test user: testuser (ID: ${testUser.id})`);
  console.log(`⭐ Favorite events: ${favoriteEvents.length}`);
  console.log(`🎯 Participating in: ${participantEvents.length} events`);
  console.log(`🔔 Total notifications: ${notifications.length}`);
  console.log(`🔔 Unread notifications: ${unreadCount}`);
  
  console.log("\n🎮 Login credentials:");
  console.log("Username: testuser");
  console.log("Password: test123");
  
  console.log("\n📅 Events happening soon (highlighted with 'binnenkort'):");
  console.log("- Tennis clinic (in 30 min)");
  console.log("- Taalcafé Bibliotheek (in 45 min)");
  console.log("- Workshop Fotografie (in 1 hour)");
  
  return testUser;
}

// Auto-run
autoLoginTestUser();

export { autoLoginTestUser };