import express from 'express';
import { TeslaAuth } from '../auth/tesla-auth.js';

const router = express.Router();
const teslaAuth = new TeslaAuth();

const authSessions = new Map();

router.get('/login', (req, res) => {
  try {
    const { authUrl, state, codeVerifier } = teslaAuth.generateAuthUrl();
    
    authSessions.set(state, {
      codeVerifier,
      createdAt: Date.now()
    });

    setTimeout(() => {
      authSessions.delete(state);
    }, 10 * 60 * 1000);

    res.json({
      authUrl,
      instructions: 'Visit the authUrl to authorize the application, then return to /auth/callback with the authorization code'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state parameter' });
    }

    const session = authSessions.get(state);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired state parameter' });
    }

    authSessions.delete(state);

    const tokens = await teslaAuth.exchangeCodeForTokens(code, session.codeVerifier);
    
    res.json({
      message: 'Authentication successful',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: tokens.expires_at
      },
      next_steps: 'Store these tokens securely and use the access_token for API requests'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token in request body' });
    }

    const tokens = await teslaAuth.refreshAccessToken(refresh_token);
    
    res.json({
      message: 'Token refreshed successfully',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: tokens.expires_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as authRouter };