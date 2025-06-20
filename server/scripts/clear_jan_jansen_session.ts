import { storage } from "../storage";

async function clearJanJansenSession() {
  console.log("🧹 Clearing Jan Jansen auto-login session...");
  
  try {
    // Find Jan Jansen user
    const janUser = await storage.getUserByEmail("jan.jansen@example.com");
    if (janUser) {
      console.log(`Found Jan Jansen user (ID: ${janUser.id})`);
    }
    
    // Find testuser
    const testUser = await storage.getUserByUsername("testuser");
    if (testUser) {
      console.log(`Testuser ready (ID: ${testUser.id})`);
      
      const favorites = await storage.getFavoritesByUser(testUser.id);
      const participations = await storage.getEventsForParticipant(testUser.id);
      const notifications = await storage.getNotificationsByUser(testUser.id);
      const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

      console.log(`Testuser has:`);
      console.log(`- ${favorites.length} favorites`);
      console.log(`- ${participations.length} participations`);
      console.log(`- ${notifications.length} notifications (${unreadCount} unread)`);
    }
    
    console.log("\n✅ Session cleared. Login with:");
    console.log("Username: testuser");
    console.log("Password: test123");
    
  } catch (error) {
    console.error("Error clearing session:", error);
  }
}

clearJanJansenSession();

export { clearJanJansenSession };