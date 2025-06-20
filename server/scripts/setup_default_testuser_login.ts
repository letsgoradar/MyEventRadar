import { storage } from "../storage";

async function setupDefaultTestUserLogin() {
  console.log("Setting up default testuser login...");
  
  try {
    // Verify testuser exists
    const testUser = await storage.getUserByUsername("testuser");
    if (!testUser) {
      console.error("Testuser not found - run create_realistic_test_scenario first");
      return;
    }

    console.log(`Found testuser: ${testUser.username} (ID: ${testUser.id})`);
    console.log("Login credentials:");
    console.log("Username: testuser");
    console.log("Password: test123");
    console.log("");
    console.log("This user has:");
    
    // Show test user stats
    const favorites = await storage.getFavoritesByUser(testUser.id);
    const participations = await storage.getEventsForParticipant(testUser.id);
    const notifications = await storage.getNotificationsByUser(testUser.id);
    const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

    console.log(`- ${favorites.length} favorite events`);
    console.log(`- ${participations.length} event participations`);
    console.log(`- ${notifications.length} total notifications (${unreadCount} unread)`);
    
    return testUser;
  } catch (error) {
    console.error("Error setting up testuser login:", error);
  }
}

// Run immediately
setupDefaultTestUserLogin();

export { setupDefaultTestUserLogin };