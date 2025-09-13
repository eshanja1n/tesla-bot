import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export class TeslaAuth {
  constructor() {
    this.clientId = process.env.TESLA_CLIENT_ID;
    this.clientSecret = process.env.TESLA_CLIENT_SECRET;
    this.redirectUri = process.env.TESLA_REDIRECT_URI;
    this.authBaseUrl = process.env.TESLA_AUTH_BASE_URL || 'https://auth.tesla.com';
    this.fleetAuthUrl = process.env.TESLA_FLEET_AUTH_URL || 'https://fleet-auth.prd.vn.cloud.tesla.com';
    this.privateKey = this.loadPrivateKey();
  }

  loadPrivateKey() {
    // Try environment variable first (production)
    if (process.env.TESLA_PRIVATE_KEY) {
      return process.env.TESLA_PRIVATE_KEY;
    }

    // Try loading from file (development)
    try {
      const privateKeyPath = path.join(process.cwd(), 'keys', 'private_key.pem');
      if (fs.existsSync(privateKeyPath)) {
        return fs.readFileSync(privateKeyPath, 'utf8');
      }
    } catch (error) {
      console.warn('Could not load private key from file:', error.message);
    }

    return null;
  }

  generateAuthUrl(scopes = ['openid', 'offline_access', 'vehicle_device_data', 'vehicle_cmds', 'energy_cmds', "user_data", "vehicle_charging_cmds", "energy_device_data", "vehicle_location"]) {
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      locale: 'en-US',
      prompt: 'consent', // Force consent screen to show
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${this.authBaseUrl}/oauth2/v3/authorize?${params}`;
    
    return {
      authUrl,
      state,
      codeVerifier
    };
  }

  async exchangeCodeForTokens(authCode, codeVerifier) {
    try {
      // Use standard Tesla auth endpoint for authorization code flow
      // Fleet API endpoint may have different requirements
      const tokenUrl = `${this.authBaseUrl}/oauth2/v3/token`;
      
      const tokenData = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: authCode,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier
      };

      // Always include client_secret as it's required by Tesla Fleet API
      tokenData.client_secret = this.clientSecret;
      
      // Additionally use private key for client assertion if available (enhanced security)
      if (this.privateKey) {
        try {
          const clientAssertion = this.createClientAssertion();
          tokenData.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
          tokenData.client_assertion = clientAssertion;
          console.log('Using private key client assertion for enhanced security');
        } catch (error) {
          console.warn('Failed to create client assertion, using client_secret only:', error.message);
        }
      } else {
        console.log('No private key found, using client_secret authentication');
      }

      const response = await axios.post(tokenUrl, new URLSearchParams(tokenData), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  createClientAssertion() {
    if (!this.privateKey) {
      throw new Error('Private key not available for client assertion');
    }

    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const payload = {
      iss: this.clientId,
      sub: this.clientId,
      aud: this.fleetAuthUrl,
      exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID()
    };

    const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const message = `${headerEncoded}.${payloadEncoded}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(message), this.privateKey);
    const signatureEncoded = signature.toString('base64url');
    
    return `${message}.${signatureEncoded}`;
  }

  async refreshAccessToken(refreshToken) {
    try {
      const tokenUrl = `${this.authBaseUrl}/oauth2/v3/token`;
      
      const refreshData = {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: refreshToken
      };

      // Always include client_secret
      refreshData.client_secret = this.clientSecret;
      
      // Additionally use client assertion if private key is available
      if (this.privateKey) {
        try {
          const clientAssertion = this.createClientAssertion();
          refreshData.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
          refreshData.client_assertion = clientAssertion;
        } catch (error) {
          console.warn('Failed to create client assertion for refresh, using client_secret only:', error.message);
        }
      }

      const response = await axios.post(tokenUrl, new URLSearchParams(refreshData), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  isTokenExpired(tokenData) {
    if (!tokenData || !tokenData.expires_at) {
      return true;
    }
    
    const bufferTime = 60 * 1000;
    return Date.now() > (tokenData.expires_at - bufferTime);
  }

  async ensureValidToken(tokenData) {
    if (!this.isTokenExpired(tokenData)) {
      return tokenData;
    }

    if (!tokenData.refresh_token) {
      throw new Error('No refresh token available and access token is expired');
    }

    return await this.refreshAccessToken(tokenData.refresh_token);
  }
}