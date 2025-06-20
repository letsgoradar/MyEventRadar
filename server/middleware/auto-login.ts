import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Extend session interface for passport
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user: number;
    };
  }
}

// Auto-login middleware for testuser
export const autoLoginTestUser = async (req: Request, res: Response, next: NextFunction) => {
  // Skip auto-login if user is already authenticated
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Skip if session already has passport data
  if ((req.session as any).passport) {
    return next();
  }

  try {
    // Get testuser for auto-login
    const testUser = await storage.getUserByUsername("testuser");
    if (testUser) {
      // Set user in session for auto-login (Passport.js format)
      (req.session as any).passport = { user: testUser.id };
      req.user = testUser;
      
      // Log the auto-login for debugging
      console.log(`🔐 Auto-logged in as testuser (ID: ${testUser.id})`);
    }
  } catch (error) {
    console.log('Auto-login failed, continuing without authentication:', error);
  }
  
  next();
};