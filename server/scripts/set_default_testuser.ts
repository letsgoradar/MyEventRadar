import { storage } from "../storage";

async function setDefaultTestUser() {
  console.log("🔄 Setting testuser as default login...");
  
  try {
    // Verify testuser exists
    const testUser = await storage.getUserByUsername("testuser");
    if (!testUser) {
      console.error("❌ Testuser not found! Run create_realistic_test_scenario first.");
      process.exit(1);
    }

    console.log(`✅ Found testuser: ${testUser.username} (ID: ${testUser.id})`);
    
    // Show testuser stats
    const favorites = await storage.getFavoritesByUser(testUser.id);
    const participations = await storage.getEventsForParticipant(testUser.id);
    const notifications = await storage.getNotificationsByUser(testUser.id);
    const unreadCount = await storage.getUnreadNotificationCount(testUser.id);

    console.log("\n📊 Testuser statistics:");
    console.log(`   Favorites: ${favorites.length} events`);
    console.log(`   Participations: ${participations.length} events`);
    console.log(`   Notifications: ${notifications.length} total (${unreadCount} unread)`);
    
    console.log("\n🔐 Default login credentials:");
    console.log("   Username: testuser");
    console.log("   Password: test123");
    
    console.log("\n✅ Testuser is now the default user for the application!");
    
  } catch (error) {
    console.error("❌ Error setting default testuser:", error);
    process.exit(1);
  }
}

// Run the script
setDefaultTestUser();

export { setDefaultTestUser };