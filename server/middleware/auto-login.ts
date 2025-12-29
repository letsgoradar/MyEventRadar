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
  const isAdminRoute = req.path.startsWith('/admin') || req.path.startsWith('/api/admin');
  
  // Check if currently logged in user matches what's needed for this route
  const currentUser = req.user as any;
  if (currentUser) {
    // If on admin route but logged in as non-admin, switch to admin
    if (isAdminRoute && currentUser.role !== 'admin') {
      // Clear session to force re-login as admin
      delete (req.session as any).passport;
      req.user = undefined;
    } 
    // If on non-admin route and logged in as admin, that's fine - admin can access everything
    else {
      return next();
    }
  }

  // Skip if session already has passport data and we haven't cleared it above
  if ((req.session as any).passport) {
    return next();
  }

  try {
    // Use admin for admin routes, Jan Jansen for app/web routes
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