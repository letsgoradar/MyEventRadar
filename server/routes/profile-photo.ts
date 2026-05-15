import express, { Request, Response } from 'express';
import { storage as appStorage } from '../storage';
import { attachUser } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * Verify the first bytes of a saved file match a known image signature.
 * This is server-side validation independent of any client-supplied MIME type.
 *
 * Signatures checked:
 *  JPEG  : FF D8 FF
 *  PNG   : 89 50 4E 47 0D 0A 1A 0A
 *  GIF87a: 47 49 46 38 37 61
 *  GIF89a: 47 49 46 38 39 61
 *  WebP  : 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
 */
async function isAllowedImageMagic(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const fd = fs.open(filePath, 'r', (err, fd) => {
      if (err) { resolve(false); return; }
      const buf = Buffer.alloc(12);
      fs.read(fd, buf, 0, 12, 0, (readErr, _bytesRead) => {
        fs.close(fd, () => {});
        if (readErr) { resolve(false); return; }
        // JPEG
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) { resolve(true); return; }
        // PNG
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
            && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
          resolve(true); return;
        }
        // GIF87a / GIF89a
        if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
            && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
          resolve(true); return;
        }
        // WebP: starts with RIFF....WEBP
        if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
            && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
          resolve(true); return;
        }
        resolve(false);
      });
    });
  });
}

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

// Map alleen vertrouwde MIME-types naar veilige extensies (nooit van originalname)
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/gif':  '.gif',
  'image/webp': '.webp',
};

// Configureer multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Gebruik user ID indien beschikbaar, anders "demo"
    const userId = req.user?.id || 'demo';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Extensie ALTIJD afleiden van de server-side MIME-allowlist, nooit van originalname.
    // Dit voorkomt dat een aanvaller een .html/.js extensie kan forceren.
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] ?? '.jpg';
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('Upload request - isAuthenticated:', req.isAuthenticated?.());
      console.log('Upload request - user:', req.user ? { id: (req.user as any).id } : 'None');
    }
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

      // Valideer de echte bestandsinhoud via magic bytes (niet de client-gestuurde MIME type).
      // Dit voorkomt dat niet-afbeeldingen worden opgeslagen, ook als de client een
      // image/* Content-Type meestuurt.
      const validImage = await isAllowedImageMagic(req.file.path);
      if (!validImage) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          message: 'Ongeldig bestandstype. Alleen JPG, PNG, GIF en WEBP worden ondersteund.',
        });
      }

      // Gebruik de daadwerkelijk ingelogde gebruiker
      if (!req.user || !req.user.id) {
        fs.unlink(req.file.path, () => {});
        return res.status(401).json({ message: 'Je moet ingelogd zijn om een profielfoto te uploaden' });
      }
      
      const userId = req.user.id;
      console.log(`Database update voor gebruiker: ${userId}`);
      
      // Pad naar het bestand relatief aan de publieke URL
      const relativePath = `/uploads/profile-photos/${req.file.filename}`;
      console.log('File saved at:', relativePath);
      
      try {
        // Update de database voor de ingelogde gebruiker
        await appStorage.updateUser(userId, {
          photoUrl: relativePath,
          avatar: relativePath 
        });
        console.log('Database updated successfully for user:', userId);
      } catch (dbError) {
        console.error('Database error while updating user:', dbError);
        return res.status(500).json({ message: 'Fout bij het opslaan van de profielfoto in de database' });
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