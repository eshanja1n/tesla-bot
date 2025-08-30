import { TeslaHttpClient } from '../lib/http-client.js';
import { TeslaAuth } from '../auth/tesla-auth.js';
import { TeslaCommandProxy } from '../lib/tesla-command-proxy.js';

export class TeslaFleetAPI {
  constructor() {
    this.httpClient = new TeslaHttpClient();
    this.teslaAuth = new TeslaAuth();
    this.commandProxy = new TeslaCommandProxy();
    this.tokens = null;
  }

  setTokens(tokens) {
    this.tokens = tokens;
    this.httpClient.setAuthToken(tokens.access_token);
    this.commandProxy.setTokens(tokens);
  }

  async ensureValidToken() {
    if (!this.tokens) {
      throw new Error('No authentication tokens available. Please authenticate first.');
    }

    // Skip automatic refresh if we don't have a refresh token
    // This means the token was passed directly via API calls
    if (this.tokens.refresh_token && this.teslaAuth.isTokenExpired(this.tokens)) {
      console.log('Refreshing expired token...');
      this.tokens = await this.teslaAuth.refreshAccessToken(this.tokens.refresh_token);
      this.httpClient.setAuthToken(this.tokens.access_token);
    }

    return this.tokens;
  }

  async getVehicles() {
    await this.ensureValidToken();
    
    try {
      console.log('Making request to /api/1/vehicles...');
      const response = await this.httpClient.get('/api/1/vehicles');
      console.log('Vehicles response status:', response.status);
      console.log('Vehicles response data:', JSON.stringify(response.data, null, 2));
      
      if (!response.data) {
        console.log('No response data received');
        return { response: [], count: 0 };
      }
      
      return response.data;
    } catch (error) {
      console.error('Vehicles API error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to fetch vehicles: ${error.response?.data?.error || error.message}`);
    }
  }

  async getVehicleData(vehicleId) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.get(`/api/1/vehicles/${vehicleId}/vehicle_data`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch vehicle data: ${error.response?.data?.error || error.message}`);
    }
  }

  async getChargingHistory(vehicleId, options = {}) {
    await this.ensureValidToken();
    
    const params = new URLSearchParams();
    if (options.startTime) params.append('startTime', options.startTime);
    if (options.endTime) params.append('endTime', options.endTime);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    
    const queryString = params.toString();
    const url = `/api/1/vehicles/${vehicleId}/charging_history${queryString ? `?${queryString}` : ''}`;
    
    try {
      const response = await this.httpClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch charging history: ${error.response?.data?.error || error.message}`);
    }
  }

  async setChargingAmps(vehicleId, chargingAmps) {
    await this.ensureValidToken();
    return this.commandProxy.setChargingAmps(vehicleId, chargingAmps);
  }

  async setChargeLimit(vehicleId, percent) {
    await this.ensureValidToken();
    return this.commandProxy.setChargeLimit(vehicleId, percent);
  }

  async startCharging(vehicleId) {
    await this.ensureValidToken();
    return this.commandProxy.startCharging(vehicleId);
  }

  async stopCharging(vehicleId) {
    await this.ensureValidToken();
    return this.commandProxy.stopCharging(vehicleId);
  }

  async scheduleCharging(vehicleId, time) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.post(`/api/1/vehicles/${vehicleId}/command/scheduled_charging`, {
        enable: true,
        time: time
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to schedule charging: ${error.response?.data?.error || error.message}`);
    }
  }

  async cancelScheduledCharging(vehicleId) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.post(`/api/1/vehicles/${vehicleId}/command/scheduled_charging`, {
        enable: false
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to cancel scheduled charging: ${error.response?.data?.error || error.message}`);
    }
  }

  async wakeVehicle(vehicleId) {
    await this.ensureValidToken();
    
    try {
      // Wake up is still a simple POST, not requiring TVCP
      const response = await this.httpClient.post(`/api/1/vehicles/${vehicleId}/wake_up`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to wake vehicle: ${error.response?.data?.error || error.message}`);
    }
  }
}