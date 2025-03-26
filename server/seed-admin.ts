import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcryptjs';

async function seedAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'admin@example.com')
    });

    if (existingAdmin) {
      console.log('Admin user already exists, skipping creation');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Create admin user
    const adminUser = await db.insert(users).values({
      username: 'admin',
      email: 'admin@example.com',
      password: passwordHash,
      role: 'admin'
    }).returning();

    console.log('Admin user created successfully:', adminUser);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the seed function
seedAdminUser()
  .then(() => {
    console.log('Admin user seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during admin user seeding:', error);
    process.exit(1);
  });