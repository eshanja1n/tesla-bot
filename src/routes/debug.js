import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Helper function to safely parse scopes from different formats
function parseScopes(scopeField, scpField) {
  // Handle 'scope' field (usually string)
  if (scopeField) {
    if (typeof scopeField === 'string') {
      return scopeField.split(' ');
    } else if (Array.isArray(scopeField)) {
      return scopeField;
    }
  }
  
  // Handle 'scp' field (could be string or array)
  if (scpField) {
    if (typeof scpField === 'string') {
      return scpField.split(' ');
    } else if (Array.isArray(scpField)) {
      return scpField;
    }
  }
  
  return [];
}

// Helper function to check if scopes contain a specific scope
function hasScope(scopeField, scpField, targetScope) {
  // Check in 'scope' field
  if (scopeField) {
    if (typeof scopeField === 'string' && scopeField.includes(targetScope)) {
      return true;
    } else if (Array.isArray(scopeField) && scopeField.includes(targetScope)) {
      return true;
    }
  }
  
  // Check in 'scp' field
  if (scpField) {
    if (typeof scpField === 'string' && scpField.includes(targetScope)) {
      return true;
    } else if (Array.isArray(scpField) && scpField.includes(targetScope)) {
      return true;
    }
  }
  
  return false;
}

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
        scp_claim: payload.scp, // Tesla might use 'scp' instead of 'scope'
        all_claims: Object.keys(payload),
        parsed_scopes: parseScopes(payload.scope, payload.scp),
        has_vehicle_data: hasScope(payload.scope, payload.scp, 'vehicle_device_data'),
        has_vehicle_cmds: hasScope(payload.scope, payload.scp, 'vehicle_cmds'),
        has_energy_cmds: hasScope(payload.scope, payload.scp, 'energy_cmds'),
        has_offline_access: hasScope(payload.scope, payload.scp, 'offline_access'),
        has_openid: hasScope(payload.scope, payload.scp, 'openid'),
        has_user_data: hasScope(payload.scope, payload.scp, 'user_data'),
        has_vehicle_charging_cmds: hasScope(payload.scope, payload.scp, 'vehicle_charging_cmds'),
        has_energy_device_data: hasScope(payload.scope, payload.scp, 'energy_device_data'),
        has_vehicle_location: hasScope(payload.scope, payload.scp, 'vehicle_location')
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
    
    if (!analysis.scopes.has_user_data) {
      analysis.recommendations.push('⚠️  Missing user_data scope - cannot access user endpoints (THIS IS YOUR CURRENT ISSUE)');
    }
    
    if (!analysis.scopes.has_vehicle_charging_cmds) {
      analysis.recommendations.push('Missing vehicle_charging_cmds scope - limited charging control');
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