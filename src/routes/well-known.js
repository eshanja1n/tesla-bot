import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Tesla Fleet API requires public key to be hosted at this specific path
router.get('/appspecific/com.tesla.3p.public-key.pem', (req, res) => {
  try {
    // Try to read from environment variable first (for production)
    const publicKeyFromEnv = process.env.TESLA_PUBLIC_KEY;
    
    if (publicKeyFromEnv) {
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': 'inline'
      });
      return res.send(publicKeyFromEnv);
    }

    // Fallback to reading from file system (for development)
    const publicKeyPath = path.join(process.cwd(), 'keys', 'public_key.pem');
    
    if (fs.existsSync(publicKeyPath)) {
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': 'inline'
      });
      return res.send(publicKey);
    }

    // If no public key is found
    res.status(404).json({
      error: 'Public key not found',
      message: 'Please generate a key pair using: npm run generate-keys',
      expectedPath: '/.well-known/appspecific/com.tesla.3p.public-key.pem'
    });

  } catch (error) {
    console.error('Error serving public key:', error);
    res.status(500).json({
      error: 'Failed to serve public key',
      message: error.message
    });
  }
});

// Health check for the well-known endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Well-known endpoints are operational',
    endpoints: {
      publicKey: '/.well-known/appspecific/com.tesla.3p.public-key.pem'
    }
  });
});

export { router as wellKnownRouter };