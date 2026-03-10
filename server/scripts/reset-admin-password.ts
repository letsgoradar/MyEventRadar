import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function resetAdminPassword() {
  const email = "info@letsgoradar.com";
  const newPassword = "LetsGo1234";
  
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    console.log(`[Admin Reset] User ${email} not found, skipping`);
    process.exit(0);
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.email, email));
  console.log(`[Admin Reset] Password updated for ${email}`);
  process.exit(0);
}

resetAdminPassword().catch((err) => {
  console.error("[Admin Reset] Error:", err);
  process.exit(1);
});
