import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { User as SelectUser, passwordResetTokens } from "@shared/schema";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import createMemoryStore from "memorystore";
import pgSession from "connect-pg-simple";
import { pool } from "./db";
import { z } from "zod";
import { sanitizeUserInput } from "./utils/sanitize";
import { sendUserVerificationEmail, sendWelcomeEmail } from "./services/email-service";

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  const devSecret = randomBytes(64).toString('hex');
  console.warn('[Dev] No SESSION_SECRET set, using randomly generated secret. Sessions will not persist across restarts.');
  return devSecret;
}

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function checkAccountLockout(identifier: string): { locked: boolean; remaining?: number } {
  const record = failedAttempts.get(identifier.toLowerCase());
  if (!record) return { locked: false };
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return { locked: true, remaining: Math.ceil((record.lockedUntil - Date.now()) / 60000) };
  }
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    failedAttempts.delete(identifier.toLowerCase());
    return { locked: false };
  }
  return { locked: false };
}

function recordFailedAttempt(identifier: string): void {
  const key = identifier.toLowerCase();
  const record = failedAttempts.get(key) || { count: 0 };
  record.count++;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    console.warn(`[Auth] Account locked: "${key}" after ${record.count} failed attempts`);
  }
  failedAttempts.set(key, record);
}

function clearFailedAttempts(identifier: string): void {
  failedAttempts.delete(identifier.toLowerCase());
}

const MemoryStore = createMemoryStore(session);
const PgSessionStore = pgSession(session);

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  return await bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const store = isProduction
    ? new PgSessionStore({
        pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15,
      })
    : new MemoryStore({
        checkPeriod: 86400000,
      });

  const sessionSettings: session.SessionOptions = {
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email', // Tell Passport to look for 'email' field instead of 'username'
        passwordField: 'password'
      },
      async (username, password, done) => {
      try {
        const lockStatus = checkAccountLockout(username);
        if (lockStatus.locked) {
          return done(null, false, { message: `Account tijdelijk vergrendeld. Probeer over ${lockStatus.remaining} minuten opnieuw.` });
        }

        let user = await storage.getUserByUsername(username);
        if (!user) {
          user = await storage.getUserByEmail(username);
        }
        
        if (!user) {
          recordFailedAttempt(username);
          return done(null, false);
        }
        
        const isValidPassword = await comparePasswords(password, user.password);
        
        if (!isValidPassword) {
          recordFailedAttempt(username);
          return done(null, false);
        }

        if (!user.emailVerified) {
          return done(null, false, { message: "email_not_verified" });
        }
        
        clearFailedAttempts(username);
        return done(null, user);
      } catch (error) {
        console.error('Login error:', error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(new Error('Gebruiker niet gevonden'));
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialize error:", error);
      done(error);
    }
  });

  const registerSchema = z.object({
    username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_\-. ]+$/, "Gebruikersnaam bevat ongeldige tekens"),
    email: z.string().email("Ongeldig e-mailadres").max(255),
    password: z.string()
      .min(8, "Wachtwoord moet minimaal 8 tekens zijn")
      .max(128)
      .regex(/[A-Z]/, "Wachtwoord moet minimaal 1 hoofdletter bevatten")
      .regex(/[a-z]/, "Wachtwoord moet minimaal 1 kleine letter bevatten")
      .regex(/[0-9]/, "Wachtwoord moet minimaal 1 cijfer bevatten"),
    role: z.enum(["user", "host"]).default("user"),
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Ongeldige invoer" });
      }
      const { username, email, password, role } = parsed.data;
      const cleanUsername = sanitizeUserInput(username, 50);

      const existingUsername = await storage.getUserByUsername(cleanUsername);
      if (existingUsername) {
        return res.status(400).json({ message: "Gebruikersnaam bestaat al" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "E-mailadres is al in gebruik" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username: cleanUsername,
        email,
        password: hashedPassword,
        role,
      });

      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
        emailVerified: false,
      });

      const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const requestBaseUrl = `${proto}://${req.get('host')}`;
      await sendUserVerificationEmail(email, user.username, verificationToken, requestBaseUrl);

      res.status(201).json({ 
        message: "Account aangemaakt. Check je e-mail om je account te activeren.",
        requiresVerification: true
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Er is een fout opgetreden bij het registreren" });
    }
  });

  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const user = await storage.getUserByVerificationToken(token);

      if (!user) {
        return res.redirect("/web?verify_error=invalid_token");
      }

      if (user.emailVerificationExpiry && new Date() > user.emailVerificationExpiry) {
        return res.redirect("/web?verify_error=token_expired");
      }

      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null as any,
        emailVerificationExpiry: null as any,
      });

      sendWelcomeEmail(user.email, user.username).catch(e =>
        console.error("Welcome email error:", e)
      );

      req.login(user, (err) => {
        if (err) {
          console.error("Auto-login after verification failed:", err);
          return res.redirect("/web?verified=true");
        }
        return res.redirect("/web?verified=true");
      });
    } catch (error) {
      console.error("Email verification error:", error);
      return res.redirect("/web?verify_error=verify_failed");
    }
  });

  app.post("/api/auth/check-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ verified: false });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.json({ verified: false });
      if (user.emailVerified) {
        req.login(user, (err) => {
          if (err) return res.json({ verified: true, loggedIn: false });
          return res.json({ verified: true, loggedIn: true });
        });
      } else {
        return res.json({ verified: false });
      }
    } catch {
      return res.json({ verified: false });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "E-mailadres vereist" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(200).json({ message: "Als dit e-mailadres bekend is, ontvang je een nieuwe verificatiemail." });
      if (user.emailVerified) return res.status(400).json({ message: "Dit account is al geverifieerd." });

      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      });

      const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
      const requestBaseUrl = `${proto}://${req.get('host')}`;
      await sendUserVerificationEmail(email, user.username, verificationToken, requestBaseUrl);
      res.status(200).json({ message: "Verificatiemail opnieuw verzonden." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Er is een fout opgetreden." });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: any, info: any) => {
      if (err) {
        console.error("Login authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        if (info?.message?.includes('vergrendeld')) {
          return res.status(423).json({ message: info.message });
        }
        if (info?.message === 'email_not_verified') {
          return res.status(403).json({ message: "email_not_verified" });
        }
        return res.status(401).json({ message: "Ongeldige gebruikersnaam of wachtwoord" });
      }
      
      req.login(user, (loginErr: Error | null) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return next(loginErr);
        }
        
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
  
  // Route voor het ophalen van de huidige gebruiker (admin/me endpoint)
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Niet ingelogd" });
    }
    // Verwijder wachtwoord uit de response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Route voor gedwongen logout van alle sessies
  app.post("/api/auth/force-logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Force logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      // Destroy session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
        }
        
        // Clear cookie
        res.clearCookie('connect.sid');
        res.status(200).json({ message: "Forced logout successful" });
      });
    });
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
      
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // Determine base URL for the reset link
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${baseUrl}/reset-password/${token}`;

      // Send password reset email
      const { sendPasswordResetEmail } = await import("./services/email-service");
      const emailSent = await sendPasswordResetEmail(user.email, user.username || user.email, resetUrl);
      if (!emailSent) {
        console.log(`[Auth] Password reset email could not be sent for user ${user.id}`);
      }
      
      res.status(200).json({
        message: "Als dit e-mailadres bij ons bekend is, ontvang je binnenkort een e-mail met instructies."
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Er is een fout opgetreden" });
    }
  });
  
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    const { token } = req.params;
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, new Date())));
    
    if (!resetToken) {
      return res.status(400).json({ valid: false, message: "Ongeldige of verlopen token" });
    }
    
    res.json({ valid: true });
  });
  
  app.post("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      const [resetToken] = await db.select().from(passwordResetTokens)
        .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expiresAt, new Date())));
      
      if (!resetToken) {
        return res.status(400).json({ message: "Ongeldige of verlopen token" });
      }
      
      const hashedPassword = await hashPassword(password);
      
      await storage.updateUser(resetToken.userId, {
        password: hashedPassword
      });
      
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
      
      res.json({ message: "Wachtwoord succesvol gewijzigd" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Er is een fout opgetreden" });
    }
  });
  
  // Google OAuth setup
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    const callbackURL = process.env.NODE_ENV === 'production'
      ? `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : ''}/api/auth/google/callback`
      : '/api/auth/google/callback';

    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL,
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || '';
        const photoUrl = profile.photos?.[0]?.value || '';

        let user = await storage.getUserByGoogleId(googleId);

        if (!user && email) {
          user = await storage.getUserByEmail(email);
          if (user) {
            user = await storage.updateUser(user.id, { googleId, photoUrl: photoUrl || user.photoUrl });
          }
        }

        if (!user) {
          const username = email
            ? email.split('@')[0] + '_' + randomBytes(3).toString('hex')
            : 'google_' + randomBytes(6).toString('hex');
          const hashedPassword = await hashPassword(randomBytes(32).toString('hex'));

          user = await storage.createUser({
            username,
            email: email || `${googleId}@google.oauth`,
            password: hashedPassword,
            role: 'user',
            googleId,
            name,
            photoUrl,
          });
        }

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error as Error);
      }
    }));

    app.get("/api/auth/google", (req, res, next) => {
      const rawReturnTo = req.query.returnTo as string || '/web';
      let returnTo = '/web';
      try {
        let decoded = rawReturnTo;
        for (let i = 0; i < 3; i += 1) {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        }
        const base = 'https://evenementenradar.internal';
        const parsed = new URL(decoded, base);
        if (!/[\u0000-\u001f\\]/.test(decoded) && !decoded.startsWith('//') && parsed.origin === base) {
          returnTo = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {}
      const nativeApp = req.query.nativeApp === 'true';
      (req.session as any).returnTo = returnTo;
      (req.session as any).nativeApp = nativeApp;
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    });

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/web/login?error=google_failed" }),
      (req, res) => {
        const returnTo = (req.session as any).returnTo || '/web';
        const nativeApp = (req.session as any).nativeApp === true;
        delete (req.session as any).returnTo;
        delete (req.session as any).nativeApp;
        if (nativeApp) {
          res.redirect('nl.letsgoradar.app://callback');
        } else {
          res.redirect(returnTo);
        }
      }
    );

    console.log('[Auth] Google OAuth configured');
    console.log(`[Auth] Google callback URL: ${callbackURL}`);
    if (process.env.NODE_ENV === 'production') {
      console.log('[Auth] Ensure this URL is added as Authorized Redirect URI in Google Cloud Console:');
      console.log(`[Auth]   ${callbackURL}`);
    }
  } else {
    console.log('[Auth] Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');

    app.get("/api/auth/google", (_req, res) => {
      res.status(503).json({ message: "Google login is niet geconfigureerd. Stel GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in." });
    });
  }

  app.get("/api/auth/google/status", (_req, res) => {
    res.json({ enabled: !!(googleClientId && googleClientSecret) });
  });

  app.get("/api/auth/apple", (_req, res) => {
    res.status(501).json({ message: "Apple login komt binnenkort" });
  });
}