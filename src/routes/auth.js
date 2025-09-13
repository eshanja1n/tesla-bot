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
      instructions: 'Visit the authUrl to authorize the application, then return to /auth/callback with the authorization code',
      scopes_requested: ['openid', 'offline_access', 'vehicle_device_data', 'vehicle_cmds', 'energy_cmds', 'user_data', 'vehicle_charging_cmds', 'energy_device_data', 'vehicle_location'],
      note: 'Make sure to grant ALL permissions shown on Tesla\'s OAuth page'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/login-full-scopes', (req, res) => {
  try {
    // Force request all available scopes
    const allScopes = [
      'openid', 
      'offline_access', 
      'vehicle_device_data', 
      'vehicle_cmds', 
      'energy_cmds', 
      'user_data', 
      'vehicle_charging_cmds', 
      'energy_device_data', 
      'vehicle_location'
    ];
    
    const { authUrl, state, codeVerifier } = teslaAuth.generateAuthUrl(allScopes);
    
    authSessions.set(state, {
      codeVerifier,
      createdAt: Date.now()
    });

    setTimeout(() => {
      authSessions.delete(state);
    }, 10 * 60 * 1000);

    res.json({
      authUrl,
      scopes_requested: allScopes,
      instructions: 'This endpoint requests ALL available scopes. Visit the authUrl and grant ALL permissions.',
      warning: 'Your current token is missing user_data scope - you MUST re-authenticate'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: authError, error_description } = req.query;
    
    // Handle OAuth errors from Tesla
    if (authError) {
      return res.status(400).json({ 
        error: `OAuth error: ${authError}`, 
        description: error_description 
      });
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state parameter' });
    }

    const session = authSessions.get(state);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired state parameter' });
    }

    authSessions.delete(state);

    console.log('Exchanging authorization code for tokens...');
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
    console.error('Token exchange error:', error.message);
    res.status(500).json({ 
      error: error.message,
      debug_info: process.env.NODE_ENV === 'development' ? {
        client_id_set: !!process.env.TESLA_CLIENT_ID,
        client_secret_set: !!process.env.TESLA_CLIENT_SECRET,
        private_key_set: !!process.env.TESLA_PRIVATE_KEY,
        redirect_uri: process.env.TESLA_REDIRECT_URI
      } : undefined
    });
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