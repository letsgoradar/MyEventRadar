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

// Auto-login middleware - uses Jan Jansen for app/web, admin for admin routes
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
    // Use admin for admin routes, Jan Jansen for app/web routes
    const isAdminRoute = req.path.startsWith('/admin') || req.path.startsWith('/api/admin');
    const username = isAdminRoute ? 'admin' : 'janjansen';
    
    const user = await storage.getUserByUsername(username);
    if (user) {
      // Set user in session for auto-login (Passport.js format)
      (req.session as any).passport = { user: user.id };
      req.user = user;
      
      // Log the auto-login for debugging
      console.log(`🔐 Auto-logged in as ${user.name || user.username} (ID: ${user.id}, role: ${user.role})`);
    }
  } catch (error) {
    console.log('Auto-login failed, continuing without authentication:', error);
  }
  
  next();
};