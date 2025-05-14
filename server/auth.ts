import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import createMemoryStore from "memorystore";

// Voor wachtwoord reset tokens
interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}

// In-memory token opslag (in productie zou dit in een database moeten)
const resetTokens = new Map<string, PasswordResetToken>();

const MemoryStore = createMemoryStore(session);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'event-app-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 uur
      httpOnly: true,
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        console.log(`Login attempt with: ${email}`);
        const user = await storage.getUserByEmail(email);
        if (!user) {
          console.log(`No user found with email: ${email}`);
          return done(null, false);
        }
        
        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
          console.log(`Invalid password for user: ${email}`);
          return done(null, false);
        }
        
        console.log(`Login successful for user: ${email}`);
        return done(null, user);
      } catch (error) {
        console.error(`Login error for user ${email}:`, error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Route voor registratie
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, email, password, role = 'user' } = req.body;
      
      // Controleer of de gebruikersnaam al bestaat
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Gebruikersnaam bestaat al" });
      }
      
      // Controleer of het e-mailadres al bestaat
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "E-mailadres is al in gebruik" });
      }

      // Hash het wachtwoord en maak de gebruiker aan
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role,
      });

      // Log de gebruiker in
      req.login(user, (err) => {
        if (err) return next(err);
        // Verwijder wachtwoord uit de response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Er is een fout opgetreden bij het registreren" });
    }
  });

  // Route voor inloggen
  app.post("/api/auth/login", (req, res, next) => {
    console.log("Login request received:", req.body);
    
    passport.authenticate("local", (err: Error | null, user: any, info: any) => {
      if (err) {
        console.error("Login authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Authentication failed - no user returned");
        return res.status(401).json({ message: "Ongeldige gebruikersnaam of wachtwoord" });
      }
      
      req.login(user, (loginErr: Error | null) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return next(loginErr);
        }
        
        console.log("User successfully logged in:", user.email);
        
        // Verwijder wachtwoord uit de response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Route voor uitloggen
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Route voor het ophalen van de huidige gebruiker
  app.get("/api/current-user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Niet ingelogd" });
    }
    // Verwijder wachtwoord uit de response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Route voor wachtwoord vergeten
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      // Controleren of het email adres bestaat
      const user = await storage.getUserByEmail(email);
      
      // Voor veiligheid altijd succesbericht sturen, ook als email niet bestaat
      if (!user) {
        console.log(`Wachtwoord reset aangevraagd voor niet-bestaand email: ${email}`);
        return res.status(200).json({
          message: "Als dit e-mailadres bij ons bekend is, ontvang je binnenkort een e-mail met instructies."
        });
      }
      
      // Token genereren
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Token is 30 minuten geldig
      
      // Token opslaan
      resetTokens.set(token, {
        userId: user.id,
        token,
        expiresAt
      });
      
      // In een echte applicatie zou hier een email worden verzonden
      // met een link zoals /reset-password?token=123abc
      console.log(`Reset token voor gebruiker ${user.id}: ${token}`);
      
      res.status(200).json({
        message: "Als dit e-mailadres bij ons bekend is, ontvang je binnenkort een e-mail met instructies."
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Er is een fout opgetreden" });
    }
  });
  
  // Valideer reset token
  app.get("/api/auth/reset-password/:token", (req, res) => {
    const { token } = req.params;
    const resetToken = resetTokens.get(token);
    
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, message: "Ongeldige of verlopen token" });
    }
    
    res.json({ valid: true });
  });
  
  // Reset wachtwoord
  app.post("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      const resetToken = resetTokens.get(token);
      
      if (!resetToken || resetToken.expiresAt < new Date()) {
        return res.status(400).json({ message: "Ongeldige of verlopen token" });
      }
      
      // Hash nieuw wachtwoord
      const hashedPassword = await hashPassword(password);
      
      // Update gebruiker
      const user = await storage.updateUser(resetToken.userId, {
        password: hashedPassword
      });
      
      // Token verwijderen
      resetTokens.delete(token);
      
      res.json({ message: "Wachtwoord succesvol gewijzigd" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Er is een fout opgetreden" });
    }
  });
  
  // OAuth routes - placeholders voor sociale login
  // In een echte applicatie zou hier de integratie met Google/Apple zijn
  app.get("/api/auth/google", (req, res) => {
    res.status(501).json({ message: "Google login nog niet geïmplementeerd" });
  });
  
  app.get("/api/auth/apple", (req, res) => {
    res.status(501).json({ message: "Apple login nog niet geïmplementeerd" });
  });
}