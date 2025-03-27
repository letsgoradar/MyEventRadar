import { storage } from '../storage';

async function assignEventsToRandomUsers() {
  console.log("Fetching users and events...");
  
  // Get all events
  const events = await storage.getAllEvents();
  console.log(`Found ${events.length} events to assign hosts to`);
  
  // Get all users
  const users = await storage.getAllUsers();
  const userIds = users
    .filter(user => user.role !== 'admin')
    .map(user => user.id);
  
  console.log(`Found ${userIds.length} users to assign as hosts`);
  
  if (userIds.length === 0) {
    console.error("No users available to assign as hosts");
    return;
  }
  
  // Update each event with a random host
  for (const event of events) {
    const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
    
    try {
      await storage.updateEvent(event.id, { hostId: randomUserId });
      console.log(`Assigned event #${event.id} to user #${randomUserId}`);
    } catch (error) {
      console.error(`Failed to update host for event #${event.id}:`, error);
    }
  }
  
  console.log("Finished assigning random hosts to events");
}

// Run the script
async function main() {
  try {
    await assignEventsToRandomUsers();
    console.log("All done! Events now have random hosts assigned.");
  } catch (error) {
    console.error("Error in main execution:", error);
  } finally {
    process.exit(0);
  }
}

main();