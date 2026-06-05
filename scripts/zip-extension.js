#!/usr/bin/env node
// Zips chrome-extension/ → frontend/public/leadvault-lead-extractor.zip
// Uses only built-in Node.js + platform zip command (no extra deps).
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT     = path.resolve(__dirname, '..');
const EXT_DIR  = path.join(ROOT, 'chrome-extension');
const OUT_DIR  = path.join(ROOT, 'frontend', 'public');
const OUT_FILE = path.join(OUT_DIR, 'leadvault-lead-extractor.zip');

if (!fs.existsSync(EXT_DIR)) {
  console.error('chrome-extension directory not found:', EXT_DIR);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);

try {
  if (process.platform === 'win32') {
    // PowerShell: put all files from chrome-extension/ directly into the zip root
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${EXT_DIR}\\*' -DestinationPath '${OUT_FILE}'"`,
      { stdio: 'inherit' }
    );
  } else {
    // Linux / macOS (Vercel build environment)
    execSync(`zip -r "${OUT_FILE}" .`, { cwd: EXT_DIR, stdio: 'inherit' });
  }
  console.log('Extension zip ready:', OUT_FILE);
} catch (err) {
  console.error('zip failed:', err.message);
  process.exit(1);
}
