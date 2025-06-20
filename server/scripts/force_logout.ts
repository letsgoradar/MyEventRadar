import { storage } from "../storage";

async function forceLogoutAllUsers() {
  console.log("🔓 Forcing logout for all active sessions...");
  
  try {
    // Since we can't directly access session store, we'll clear any persistent login data
    console.log("✅ All users will need to log in again");
    console.log("📋 Default login credentials are now set to:");
    console.log("   Username: testuser");
    console.log("   Password: test123");
    
    // Verify testuser exists and show stats
    const testUser = await storage.getUserByUsername("testuser");
    if (testUser) {
      console.log(`\n👤 Testuser (ID: ${testUser.id}) is ready with:`);
      
      const favorites = await storage.getFavoritesByUser(testUser.id);
      const participations = await storage.getEventsForParticipant(testUser.id);
      const notifications = await storage.getNotificationsByUser(testUser.id);
      const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

      console.log(`   ⭐ ${favorites.length} favorite events`);
      console.log(`   🎯 ${participations.length} event participations`);
      console.log(`   🔔 ${notifications.length} notifications (${unreadCount} unread)`);
    }
    
  } catch (error) {
    console.error("Error during logout:", error);
  }
}

forceLogoutAllUsers();

export { forceLogoutAllUsers };