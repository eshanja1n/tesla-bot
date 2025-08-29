import { TeslaHttpClient } from '../lib/http-client.js';

export class TeslaEnergyAPI {
  constructor() {
    this.httpClient = new TeslaHttpClient();
    this.tokens = null;
  }

  setTokens(tokens) {
    this.tokens = tokens;
    this.httpClient.setAuthToken(tokens.access_token);
  }

  async ensureValidToken() {
    if (!this.tokens) {
      throw new Error('No authentication tokens available. Please authenticate first.');
    }

    if (this.teslaAuth && this.teslaAuth.isTokenExpired(this.tokens)) {
      this.tokens = await this.teslaAuth.refreshAccessToken(this.tokens.refresh_token);
      this.httpClient.setAuthToken(this.tokens.access_token);
    }

    return this.tokens;
  }

  async getEnergyProducts() {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.get('/api/1/products');
      return response.data.response.filter(product => 
        product.resource_type === 'battery' || 
        product.resource_type === 'solar'
      );
    } catch (error) {
      throw new Error(`Failed to fetch energy products: ${error.response?.data?.error || error.message}`);
    }
  }

  async getPowerwallStatus(siteId) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.get(`/api/1/energy_sites/${siteId}/live_status`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch Powerwall status: ${error.response?.data?.error || error.message}`);
    }
  }

  async getSiteInfo(siteId) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.get(`/api/1/energy_sites/${siteId}/site_info`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch site info: ${error.response?.data?.error || error.message}`);
    }
  }

  async getSiteConfig(siteId) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.get(`/api/1/energy_sites/${siteId}/site_config`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch site config: ${error.response?.data?.error || error.message}`);
    }
  }

  async getEnergyHistory(siteId, period = 'day', options = {}) {
    await this.ensureValidToken();
    
    const validPeriods = ['day', 'week', 'month', 'year', 'lifetime'];
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    const params = new URLSearchParams({ period });
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.timezone) params.append('time_zone', options.timezone);
    
    const queryString = params.toString();
    const url = `/api/1/energy_sites/${siteId}/history?${queryString}`;
    
    try {
      const response = await this.httpClient.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch energy history: ${error.response?.data?.error || error.message}`);
    }
  }

  async setBackupReserve(siteId, backupReservePercent) {
    await this.ensureValidToken();
    
    if (backupReservePercent < 0 || backupReservePercent > 100) {
      throw new Error('Backup reserve percent must be between 0 and 100');
    }

    try {
      const response = await this.httpClient.post(`/api/1/energy_sites/${siteId}/backup`, {
        backup_reserve_percent: backupReservePercent
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set backup reserve: ${error.response?.data?.error || error.message}`);
    }
  }

  async setOperationMode(siteId, defaultRealMode) {
    await this.ensureValidToken();
    
    const validModes = ['autonomous', 'backup', 'self_consumption'];
    if (!validModes.includes(defaultRealMode)) {
      throw new Error(`Invalid operation mode. Must be one of: ${validModes.join(', ')}`);
    }

    try {
      const response = await this.httpClient.post(`/api/1/energy_sites/${siteId}/operation`, {
        default_real_mode: defaultRealMode
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set operation mode: ${error.response?.data?.error || error.message}`);
    }
  }

  async setTimeBasedControl(siteId, settings) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.post(`/api/1/energy_sites/${siteId}/time_of_use_settings`, {
        tou_settings: settings
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set time-based control: ${error.response?.data?.error || error.message}`);
    }
  }

  async setGridCharging(siteId, disallowChargeFromGridWithSolarInstalled) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.post(`/api/1/energy_sites/${siteId}/grid_import_export`, {
        disallow_charge_from_grid_with_solar_installed: disallowChargeFromGridWithSolarInstalled
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set grid charging: ${error.response?.data?.error || error.message}`);
    }
  }

  async setStormWatch(siteId, enabled) {
    await this.ensureValidToken();
    
    try {
      const response = await this.httpClient.post(`/api/1/energy_sites/${siteId}/storm_mode`, {
        enabled: enabled
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to set storm watch: ${error.response?.data?.error || error.message}`);
    }
  }

  async optimizeChargingSchedule(siteId, vehicleChargingSchedule) {
    await this.ensureValidToken();
    
    try {
      const [siteStatus, energyHistory] = await Promise.all([
        this.getPowerwallStatus(siteId),
        this.getEnergyHistory(siteId, 'day')
      ]);

      const currentBatteryLevel = siteStatus.response.percentage_charged;
      const solarGeneration = energyHistory.response.solar || [];
      
      const recommendations = {
        currentBatteryLevel,
        solarGeneration,
        recommendations: []
      };

      if (currentBatteryLevel > 90) {
        recommendations.recommendations.push({
          type: 'vehicle_charging',
          message: 'High Powerwall charge - good time to charge vehicles',
          action: 'start_charging'
        });
      }

      if (currentBatteryLevel < 20) {
        recommendations.recommendations.push({
          type: 'vehicle_charging',
          message: 'Low Powerwall charge - delay vehicle charging if possible',
          action: 'delay_charging'
        });
      }

      const avgSolarGeneration = solarGeneration.reduce((acc, val) => acc + val, 0) / solarGeneration.length;
      if (avgSolarGeneration > 5000) {
        recommendations.recommendations.push({
          type: 'solar_excess',
          message: 'High solar generation - optimal time for vehicle charging',
          action: 'schedule_charging_solar_peak'
        });
      }

      return recommendations;
    } catch (error) {
      throw new Error(`Failed to optimize charging schedule: ${error.response?.data?.error || error.message}`);
    }
  }
}