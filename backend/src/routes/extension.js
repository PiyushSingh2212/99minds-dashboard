const router   = require('express').Router();
const archiver = require('archiver');
const path     = require('path');
const fs       = require('fs');

const EXT_DIR = path.resolve(__dirname, '../../../chrome-extension');

// GET /api/extension/download — streams the extension as a zip
router.get('/download', (req, res) => {
  if (!fs.existsSync(EXT_DIR)) {
    return res.status(404).json({ error: 'Extension source not found on server.' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="leadvault-lead-extractor.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => { throw err; });
  archive.pipe(res);
  archive.directory(EXT_DIR, 'leadvault-lead-extractor');
  archive.finalize();
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
      downloadUrl: '/api/extension/download',
    });
  } catch {
    res.status(404).json({ error: 'Extension manifest not found.' });
  }
});

module.exports = router;
