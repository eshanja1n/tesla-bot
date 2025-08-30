import { TeslaHttpClient } from '../lib/http-client.js';
import { TeslaAuth } from '../auth/tesla-auth.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class VirtualKeyAPI {
  constructor() {
    this.httpClient = new TeslaHttpClient();
    this.teslaAuth = new TeslaAuth();
    this.tokens = null;
    this.domain = process.env.TESLA_REDIRECT_URI?.replace('/auth/callback', '') || 'https://tesla-bot.vercel.app';
  }

  setTokens(tokens) {
    this.tokens = tokens;
    this.httpClient.setAuthToken(tokens.access_token);
  }

  async ensureValidToken() {
    if (!this.tokens) {
      throw new Error('No authentication tokens available. Please authenticate first.');
    }

    if (this.tokens.refresh_token && this.teslaAuth.isTokenExpired(this.tokens)) {
      console.log('Refreshing expired token...');
      this.tokens = await this.teslaAuth.refreshAccessToken(this.tokens.refresh_token);
      this.httpClient.setAuthToken(this.tokens.access_token);
    }

    return this.tokens;
  }

  // Create a virtual key for a specific vehicle
  async createVirtualKey(vehicleId, role = 'driver', formFactor = 'ios') {
    await this.ensureValidToken();

    if (!this.teslaAuth.privateKey) {
      throw new Error('Private key required for virtual key creation');
    }

    try {
      // Generate virtual key request
      const keyRequest = this.generateVirtualKeyRequest(vehicleId, role, formFactor);
      
      const response = await this.httpClient.post(`/api/1/vehicles/${vehicleId}/keys`, keyRequest);
      
      return {
        success: true,
        virtual_key_id: response.data.response?.id,
        status: response.data.response?.status,
        vehicle_id: vehicleId,
        message: 'Virtual key created successfully'
      };
    } catch (error) {
      throw new Error(`Failed to create virtual key: ${error.response?.data?.error || error.message}`);
    }
  }

  // Generate the virtual key request with proper signatures
  generateVirtualKeyRequest(vehicleId, role, formFactor) {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create the virtual key payload
    const keyData = {
      role: role,
      form_factor: formFactor,
      public_key: this.getPublicKeyForVirtualKey(),
      domain: this.domain,
      timestamp: timestamp
    };

    // Create signature for the key request
    const message = JSON.stringify(keyData);
    const signature = crypto.sign('RSA-SHA256', Buffer.from(message), this.teslaAuth.privateKey);
    
    return {
      ...keyData,
      signature: signature.toString('base64')
    };
  }

  // Get public key in the format expected by virtual key system
  getPublicKeyForVirtualKey() {
    if (process.env.TESLA_PUBLIC_KEY) {
      return process.env.TESLA_PUBLIC_KEY;
    }

    try {
      const publicKeyPath = path.join(process.cwd(), 'keys', 'public_key.pem');
      
      if (fs.existsSync(publicKeyPath)) {
        return fs.readFileSync(publicKeyPath, 'utf8');
      }
    } catch (error) {
      console.warn('Could not read public key file:', error.message);
    }

    throw new Error('Public key not available for virtual key creation');
  }

  // List existing virtual keys for a vehicle
  async getVirtualKeys(vehicleId) {
    await this.ensureValidToken();

    try {
      const response = await this.httpClient.get(`/api/1/vehicles/${vehicleId}/keys`);
      return response.data.response || [];
    } catch (error) {
      throw new Error(`Failed to get virtual keys: ${error.response?.data?.error || error.message}`);
    }
  }

  // Check if virtual key exists for a vehicle
  async hasVirtualKey(vehicleId) {
    try {
      const keys = await this.getVirtualKeys(vehicleId);
      const myDomainKeys = keys.filter(key => 
        key.domain === this.domain || 
        key.public_key === this.getPublicKeyForVirtualKey()
      );
      
      return {
        has_key: myDomainKeys.length > 0,
        key_count: myDomainKeys.length,
        keys: myDomainKeys,
        total_keys: keys.length
      };
    } catch (error) {
      return {
        has_key: false,
        error: error.message
      };
    }
  }

  // Remove a virtual key
  async removeVirtualKey(vehicleId, keyId) {
    await this.ensureValidToken();

    try {
      const response = await this.httpClient.delete(`/api/1/vehicles/${vehicleId}/keys/${keyId}`);
      return {
        success: true,
        message: 'Virtual key removed successfully',
        response: response.data
      };
    } catch (error) {
      throw new Error(`Failed to remove virtual key: ${error.response?.data?.error || error.message}`);
    }
  }

  // Auto-setup virtual key for a vehicle if needed
  async ensureVirtualKey(vehicleId, role = 'driver') {
    const keyStatus = await this.hasVirtualKey(vehicleId);
    
    if (keyStatus.has_key) {
      return {
        already_exists: true,
        message: 'Virtual key already exists for this vehicle',
        keys: keyStatus.keys
      };
    }

    console.log(`Creating virtual key for vehicle ${vehicleId}...`);
    return await this.createVirtualKey(vehicleId, role);
  }
}