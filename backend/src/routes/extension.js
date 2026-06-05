const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');

const EXT_DIR = path.resolve(__dirname, '../../../chrome-extension');

// GET /api/extension/download — redirect to the pre-built static zip
router.get('/download', (_req, res) => {
  res.redirect('/leadvault-lead-extractor.zip');
});

// GET /api/extension/info — version & metadata
router.get('/info', (req, res) => {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8')
    );
    res.json({
      name:        manifest.name,
      version:     manifest.version,
      description: manifest.description,
      downloadUrl: '/leadvault-lead-extractor.zip',
    });
  } catch {
    res.status(404).json({ error: 'Extension manifest not found.' });
  }
});

module.exports = router;
