import axios from 'axios';

export class TeslaCommandProxy {
  constructor() {
    // Tesla's official vehicle command proxy endpoints
    this.proxyBaseUrl = process.env.TESLA_COMMAND_PROXY_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
    this.tokens = null;
  }

  setTokens(tokens) {
    this.tokens = tokens;
  }

  // Send a command through Tesla's vehicle command proxy
  async sendCommand(vehicleId, command, parameters = {}) {
    if (!this.tokens?.access_token) {
      throw new Error('Access token required for vehicle commands');
    }

    try {
      // Use Tesla's signed commands endpoint which handles TVCP internally
      const response = await axios.post(
        `${this.proxyBaseUrl}/api/1/vehicles/${vehicleId}/signed_command`,
        {
          command: command,
          ...parameters
        },
        {
          headers: {
            'Authorization': `Bearer ${this.tokens.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'TeslaFleetBot/1.0'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      // Check if this is a TVCP requirement error
      if (error.response?.data?.error?.includes('Tesla Vehicle Command Protocol required')) {
        throw new Error(`TVCP Error: ${error.response.data.error}. Ensure virtual key is installed and vehicle supports TVCP.`);
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