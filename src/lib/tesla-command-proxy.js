import axios from 'axios';

export class TeslaCommandProxy {
  constructor() {
    // Tesla HTTP Proxy URL (local or deployed instance)
    this.proxyBaseUrl = process.env.TESLA_HTTP_PROXY_URL || 'https://localhost:4443';
    this.tokens = null;
    this.useVin = true; // Tesla proxy uses VIN instead of vehicle ID
  }

  setTokens(tokens) {
    this.tokens = tokens;
  }

  // Convert vehicle ID to VIN if needed
  async getVehicleVin(vehicleId) {
    // If it's already a VIN (17 characters, starts with letter), return as-is
    if (typeof vehicleId === 'string' && vehicleId.length === 17 && /^[A-Z]/.test(vehicleId)) {
      return vehicleId;
    }
    
    // If we have vehicle ID, we need to get VIN from vehicle data
    // For now, assume VIN is provided. In production, you'd fetch vehicle data to get VIN
    return vehicleId; // This needs to be updated based on your vehicle data
  }

  // Send a command through Tesla's HTTP proxy
  async sendCommand(vehicleIdentifier, command, parameters = {}) {
    if (!this.tokens?.access_token) {
      throw new Error('Access token required for vehicle commands');
    }

    try {
      const vehicleId = await this.getVehicleVin(vehicleIdentifier);
      
      // Tesla HTTP proxy uses standard Fleet API endpoints but with TVCP signing
      const url = `${this.proxyBaseUrl}/api/1/vehicles/${vehicleId}/command/${command}`;
      
      const response = await axios.post(
        url,
        parameters,
        {
          headers: {
            'Authorization': `Bearer ${this.tokens.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'TeslaFleetBot/1.0'
          },
          timeout: 30000,
          // Allow self-signed certificates for local development
          httpsAgent: process.env.NODE_ENV === 'development' ? 
            new (await import('https')).Agent({ rejectUnauthorized: false }) : undefined
        }
      );

      return response.data;
    } catch (error) {
      // Enhanced error handling for common issues
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Tesla HTTP Proxy not running. Please start the tesla-http-proxy service.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Check your OAuth token.');
      }
      
      if (error.response?.data?.error?.includes('virtual key')) {
        throw new Error('Virtual key not found on vehicle. Please install virtual key first.');
      }
      
      throw new Error(`Command failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Specific vehicle command methods
  async startCharging(vehicleId) {
    return this.sendCommand(vehicleId, 'charge_start');
  }

  async stopCharging(vehicleId) {
    return this.sendCommand(vehicleId, 'charge_stop');
  }

  async setChargeLimit(vehicleId, percent) {
    if (percent < 50 || percent > 100) {
      throw new Error('Charge limit must be between 50% and 100%');
    }
    return this.sendCommand(vehicleId, 'set_charge_limit', { percent });
  }

  async setChargingAmps(vehicleId, chargingAmps) {
    if (chargingAmps < 5 || chargingAmps > 48) {
      throw new Error('Charging amps must be between 5 and 48');
    }
    return this.sendCommand(vehicleId, 'set_charging_amps', { charging_amps: chargingAmps });
  }

  async lockDoors(vehicleId) {
    return this.sendCommand(vehicleId, 'door_lock');
  }

  async unlockDoors(vehicleId) {
    return this.sendCommand(vehicleId, 'door_unlock');
  }

  async flashLights(vehicleId) {
    return this.sendCommand(vehicleId, 'flash_lights');
  }

  async honkHorn(vehicleId) {
    return this.sendCommand(vehicleId, 'honk_horn');
  }

  async startClimate(vehicleId) {
    return this.sendCommand(vehicleId, 'auto_conditioning_start');
  }

  async stopClimate(vehicleId) {
    return this.sendCommand(vehicleId, 'auto_conditioning_stop');
  }

  async setClimateTemp(vehicleId, driverTemp, passengerTemp = null) {
    return this.sendCommand(vehicleId, 'set_temps', {
      driver_temp: driverTemp,
      passenger_temp: passengerTemp || driverTemp
    });
  }

  // Check if vehicle supports TVCP
  async checkTVCPSupport(vehicleId) {
    try {
      // Try a simple command to test TVCP support
      await this.sendCommand(vehicleId, 'ping');
      return { supported: true, message: 'Vehicle supports TVCP' };
    } catch (error) {
      if (error.message.includes('Tesla Vehicle Command Protocol required')) {
        return { 
          supported: false, 
          message: 'Vehicle requires TVCP but virtual key not installed',
          action: 'Install virtual key on vehicle'
        };
      }
      return { 
        supported: false, 
        message: error.message,
        action: 'Check vehicle compatibility and virtual key setup'
      };
    }
  }
}