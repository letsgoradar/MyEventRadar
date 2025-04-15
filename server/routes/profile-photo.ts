import express, { Request, Response } from 'express';
import { storage as appStorage } from '../storage';
import { isAuthenticated } from '../middleware/auth';
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
    const userId = req.user?.id;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
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
  isAuthenticated, 
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
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Niet geautoriseerd' });
      }
      
      const userId = req.user.id;
      
      // Pad naar het bestand relatief aan de publieke URL
      const relativePath = `/uploads/profile-photos/${req.file.filename}`;
      console.log('File saved at:', relativePath);
      
      // Update gebruiker record met nieuwe foto URL
      const updatedUser = await appStorage.updateUser(userId, {
        photoUrl: relativePath,
        avatar: relativePath // Update beide velden voor backward compatibility
      });
      
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