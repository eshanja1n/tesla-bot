import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Decode and analyze JWT token to check scopes
router.get('/token-scopes', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Decode token without verification (just to read payload)
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const payload = decoded.payload;
    
    const analysis = {
      token_info: {
        algorithm: decoded.header?.alg,
        type: decoded.header?.typ,
        issued_at: new Date(payload.iat * 1000).toISOString(),
        expires_at: new Date(payload.exp * 1000).toISOString(),
        issuer: payload.iss,
        audience: payload.aud,
        subject: payload.sub
      },
      scopes: {
        raw_scope: payload.scope,
        parsed_scopes: payload.scope ? payload.scope.split(' ') : [],
        has_vehicle_data: payload.scope?.includes('vehicle_device_data'),
        has_vehicle_cmds: payload.scope?.includes('vehicle_cmds'),
        has_energy_cmds: payload.scope?.includes('energy_cmds'),
        has_offline_access: payload.scope?.includes('offline_access'),
        has_openid: payload.scope?.includes('openid')
      },
      recommendations: []
    };
    
    // Add recommendations based on missing scopes
    if (!analysis.scopes.has_vehicle_data) {
      analysis.recommendations.push('Missing vehicle_device_data scope - cannot read vehicle information');
    }
    
    if (!analysis.scopes.has_vehicle_cmds) {
      analysis.recommendations.push('Missing vehicle_cmds scope - cannot control vehicles');
    }
    
    if (!analysis.scopes.has_energy_cmds) {
      analysis.recommendations.push('Missing energy_cmds scope - cannot control Powerwall');
    }
    
    if (!analysis.scopes.has_offline_access) {
      analysis.recommendations.push('Missing offline_access scope - cannot refresh tokens');
    }
    
    if (analysis.recommendations.length === 0) {
      analysis.recommendations.push('All required scopes are present');
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      analysis.recommendations.push('⚠️  TOKEN IS EXPIRED - This could be the issue!');
    }
    
    res.json(analysis);
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to decode token',
      message: error.message,
      suggestion: 'Token might be malformed or use a different format'
    });
  }
});

// Check what Tesla account the token belongs to
router.get('/token-account', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Try to get user info from Tesla's userinfo endpoint
    const axios = (await import('axios')).default;
    
    const response = await axios.get('https://auth.tesla.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    res.json({
      success: true,
      user_info: response.data,
      message: 'Successfully retrieved user information'
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user info',
      status: error.response?.status,
      message: error.response?.data || error.message,
      suggestion: 'Token might not have openid scope or might be invalid'
    });
  }
});

export { router as debugRouter };