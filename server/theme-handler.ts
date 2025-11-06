import { Router } from 'express';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

// Get current theme
router.get('/theme', (req, res) => {
  try {
    const themePath = join(process.cwd(), 'theme.json');
    const theme = JSON.parse(readFileSync(themePath, 'utf-8'));
    res.json(theme);
  } catch (error) {
    res.status(500).json({ error: 'Could not read theme' });
  }
});

// Update theme
router.post('/theme', (req, res) => {
  try {
    const { variant, primary, appearance, radius } = req.body;
    const theme = { variant, primary, appearance, radius };
    const themePath = join(process.cwd(), 'theme.json');
    writeFileSync(themePath, JSON.stringify(theme, null, 2));
    res.json({ success: true, theme });
  } catch (error) {
    res.status(500).json({ error: 'Could not update theme' });
  }
});

export default router;
