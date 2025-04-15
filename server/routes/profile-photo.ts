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
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

// Route voor het uploaden van een profielfoto
router.post('/', isAuthenticated, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Geen bestand geüpload' });
    }
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Niet geautoriseerd' });
    }
    
    const userId = req.user.id;
    
    // Pad naar het bestand relatief aan de publieke URL
    const relativePath = `/uploads/profile-photos/${req.file.filename}`;
    
    // Update gebruiker record met nieuwe foto URL
    const updatedUser = await appStorage.updateUser(userId, {
      photoUrl: relativePath
    });
    
    res.status(200).json({ 
      photoUrl: relativePath,
      message: 'Profielfoto succesvol bijgewerkt'
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ message: 'Er is een fout opgetreden bij het uploaden van de foto' });
  }
});

export default router;