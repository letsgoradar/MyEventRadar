import { storage } from '../storage';
import { faker } from '@faker-js/faker';
import { InsertUser, InsertParticipant, CATEGORIES } from '../../shared/schema';
import bcrypt from 'bcryptjs';

async function generateTestUsers(count: number) {
  console.log(`Generating ${count} test users...`);
  
  const users: InsertUser[] = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    const user: InsertUser = {
      username: faker.internet.userName({ firstName, lastName }).toLowerCase(),
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: await bcrypt.hash('password123', 10), // All test users have the same password
      role: 'user',
      avatar: faker.image.avatar()
    };
    
    users.push(user);
  }
  
  const importedUsers = await storage.importUsers(users);
  console.log(`Successfully imported ${importedUsers.length} users`);
  
  // Return user IDs for further processing
  return importedUsers.map(user => user.id);
}

async function assignEventsToRandomUsers(userIds: number[]) {
  console.log("Assigning events to random users...");
  
  if (userIds.length === 0) {
    console.error("No users available to assign as hosts");
    return;
  }
  
  // Get all events
  const events = await storage.getAllEvents();
  console.log(`Found ${events.length} events to assign hosts to`);
  
  // Update each event with a random host
  for (const event of events) {
    const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
    
    try {
      await storage.updateEvent(event.id, { hostId: randomUserId });
    } catch (error) {
      console.error(`Failed to update host for event #${event.id}:`, error);
    }
  }
  
  console.log("Finished assigning random hosts to events");
}

async function addParticipantsToEvents(userIds: number[]) {
  console.log("Adding participants to events...");
  
  if (userIds.length === 0) {
    console.error("No users available to add as participants");
    return;
  }
  
  // Get all events
  const events = await storage.getAllEvents();
  console.log(`Found ${events.length} events to add participants to`);
  
  // For each event, add a random number of participants
  for (const event of events) {
    // Decide how many participants to add (between 0 and 10, avoiding the host)
    const participantsCount = Math.floor(Math.random() * 10);
    const shuffledUserIds = [...userIds].sort(() => Math.random() - 0.5);
    const potentialParticipants = shuffledUserIds.filter(id => id !== event.hostId);
    
    // Add random participants up to the decided count
    for (let i = 0; i < Math.min(participantsCount, potentialParticipants.length); i++) {
      try {
        const participant: InsertParticipant = {
          userId: potentialParticipants[i],
          eventId: event.id,
          status: faker.helpers.arrayElement(['registered', 'attended', 'cancelled'])
        };
        await storage.addParticipant(participant);
      } catch (error) {
        console.error(`Failed to add participant to event #${event.id}:`, error);
      }
    }
  }
  
  console.log("Finished adding participants to events");
}

// Run the script
async function main() {
  try {
    // Generate test users and get their IDs
    const userIds = await generateTestUsers(100);
    
    // Assign random users as hosts for events
    await assignEventsToRandomUsers(userIds);
    
    // Add random participants to events
    await addParticipantsToEvents(userIds);
    
    console.log("All done! Database has been populated with test users and relationships.");
  } catch (error) {
    console.error("Error in main execution:", error);
  } finally {
    process.exit(0);
  }
}

main();