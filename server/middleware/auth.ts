import { Request, Response, NextFunction } from 'express';
import 'express-session';

// Type definition to extend Express.Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

// Add user property to session
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      email: string;
      role: string;
    };
  }
}

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check Passport.js authentication first (req.isAuthenticated() method)
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  
  // Fallback check for session-based auth
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  return res.status(401).json({ message: 'Unauthorized: Please log in' });
};

// Middleware to check if user is an admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    req.user = req.session.user;
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: Admin access required' });
};

// Middleware to add user to request if authenticated
export const attachUser = (req: Request, res: Response, next: NextFunction) => {
  // Passport.js sets req.user automatically, but we can also check session fallback
  if (!req.user && req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
};