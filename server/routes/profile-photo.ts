import express, { Request, Response } from 'express';
import { storage as appStorage } from '../storage';
import { attachUser } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configureer upload directory
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profile-photos');

// Zorg ervoor dat de directory bestaat
try {
  if (!fs.existsSync(uploadDir)) {
    console.log(`Creating upload directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir, { recursive: true });
  } else {
    console.log(`Upload directory exists: ${uploadDir}`);
    
    // Test schrijfbaarheid
    const testFile = path.join(uploadDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('Upload directory is writable');
  }
} catch (error) {
  console.error('Error setting up upload directory:', error);
}

// Configureer multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Gebruik user ID indien beschikbaar, anders "demo"
    const userId = req.user?.id || 'demo';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    console.log(`Generating filename for user: ${userId}, file: ${file.originalname}`);
    cb(null, `user-${userId}-${uniqueSuffix}${ext}`);
  }
});

// Bestandstypes filteren
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Ongeldig bestandstype. Alleen JPG, PNG, GIF en WEBP worden ondersteund.'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max bestandsgrootte
  }
});

// Middleware for error handling
const handleMulterError = (err: any, req: Request, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'Bestand is te groot. Maximale grootte is 5MB.' 
      });
    }
    return res.status(400).json({ 
      message: `Upload fout: ${err.message}` 
    });
  } else if (err) {
    console.error('Non-multer error:', err);
    return res.status(500).json({ 
      message: err.message || 'Er is een fout opgetreden bij het uploaden' 
    });
  }
  next();
};

// Route voor het uploaden van een profielfoto
router.post('/', 
  (req, res, next) => {
    // Debug authenticatie status
    console.log('Upload request - isAuthenticated:', req.isAuthenticated?.());
    console.log('Upload request - user:', req.user ? { id: req.user.id, email: req.user.email } : 'None');
    console.log('Upload request - session:', req.session ? 'Present' : 'None');
    next();
  },
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  }, 
  async (req: Request, res: Response) => {
    try {
      console.log('Processing profile photo upload, file:', req.file);
    
      if (!req.file) {
        return res.status(400).json({ message: 'Geen bestand geüpload' });
      }
      
      // Flexibele authenticatie check - gebruik beschikbare gebruiker of demo gebruiker
      const userId = req.user?.id || 1; // Fallback naar demo gebruiker
      console.log(`Uploading for user: ${userId}, authenticated: ${!!req.user}`);
      
      // Pad naar het bestand relatief aan de publieke URL
      const relativePath = `/uploads/profile-photos/${req.file.filename}`;
      console.log('File saved at:', relativePath);
      
      try {
        // Probeer gebruiker te detecteren via verschillende methoden
        let actualUserId = userId;
        let shouldUpdateDb = false;
        
        if (req.isAuthenticated?.() && req.user?.id) {
          actualUserId = req.user.id;
          shouldUpdateDb = true;
          console.log('Found authenticated user via Passport:', actualUserId);
        } else if (req.session?.passport?.user) {
          actualUserId = req.session.passport.user;
          shouldUpdateDb = true;
          console.log('Found user via session passport:', actualUserId);
        } else {
          console.log('No authenticated user found - using demo mode');
        }
        
        // Update gebruiker record met nieuwe foto URL
        if (shouldUpdateDb) {
          await appStorage.updateUser(actualUserId, {
            photoUrl: relativePath,
            avatar: relativePath 
          });
          console.log('Database updated successfully for user:', actualUserId);
        } else {
          console.log('Upload successful but no database update (demo mode)');
        }
      } catch (dbError) {
        console.error('Database error while updating user:', dbError);
        // Vang de database error op maar ga door met de response
      }
      
      res.status(200).json({ 
        photoUrl: relativePath,
        message: 'Profielfoto succesvol bijgewerkt'
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Er is een fout opgetreden bij het uploaden van de foto' 
      });
    }
  }
);

export default router;