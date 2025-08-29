import { TeslaFleetAPI } from '../api/tesla-fleet-api.js';
import { TeslaEnergyAPI } from '../api/energy-api.js';

export class ChargingCoordinator {
  constructor() {
    this.vehicleAPI = new TeslaFleetAPI();
    this.energyAPI = new TeslaEnergyAPI();
    this.isActive = false;
    this.scheduledTasks = new Map();
  }

  setTokens(tokens) {
    this.vehicleAPI.setTokens(tokens);
    this.energyAPI.setTokens(tokens);
  }

  async getSystemStatus() {
    try {
      const [vehicles, energyProducts] = await Promise.all([
        this.vehicleAPI.getVehicles(),
        this.energyAPI.getEnergyProducts()
      ]);

      const powerwalls = energyProducts.filter(product => product.resource_type === 'battery');
      const solarSystems = energyProducts.filter(product => product.resource_type === 'solar');

      const systemStatus = {
        vehicles: vehicles.response || [],
        powerwalls,
        solarSystems,
        timestamp: new Date().toISOString()
      };

      if (powerwalls.length > 0) {
        const powerwallStatus = await this.energyAPI.getPowerwallStatus(powerwalls[0].energy_site_id);
        systemStatus.powerwallStatus = powerwallStatus.response;
      }

      return systemStatus;
    } catch (error) {
      throw new Error(`Failed to get system status: ${error.message}`);
    }
  }

  async createOptimalChargingPlan(options = {}) {
    const {
      targetChargeLevels = {},
      priorityVehicles = [],
      maxSimultaneousCharging = 2,
      preservePowerwallReserve = 20,
      considerSolarForecast = true
    } = options;

    try {
      const systemStatus = await this.getSystemStatus();
      const plan = {
        createdAt: new Date().toISOString(),
        vehicles: [],
        powerwallActions: [],
        schedule: [],
        recommendations: []
      };

      const powerwallLevel = systemStatus.powerwallStatus?.percentage_charged || 0;
      const solarProduction = systemStatus.powerwallStatus?.solar_power || 0;
      const homeLoad = systemStatus.powerwallStatus?.load_power || 0;
      const gridPower = systemStatus.powerwallStatus?.grid_power || 0;

      for (const vehicle of systemStatus.vehicles) {
        if (vehicle.state === 'online') {
          try {
            const vehicleData = await this.vehicleAPI.getVehicleData(vehicle.id);
            const chargeState = vehicleData.response?.charge_state;
            
            if (chargeState) {
              const currentLevel = chargeState.battery_level;
              const targetLevel = targetChargeLevels[vehicle.id] || 80;
              const chargingNeeded = targetLevel - currentLevel;
              const isPluggedIn = chargeState.charge_port_door_open && chargeState.charge_port_latch === 'Engaged';

              const vehiclePlan = {
                vehicleId: vehicle.id,
                vehicleName: vehicle.display_name,
                currentCharge: currentLevel,
                targetCharge: targetLevel,
                chargingNeeded,
                isPluggedIn,
                priority: priorityVehicles.includes(vehicle.id) ? 'high' : 'normal',
                recommendedAction: 'none'
              };

              if (chargingNeeded > 0 && isPluggedIn) {
                if (powerwallLevel > (preservePowerwallReserve + 30)) {
                  vehiclePlan.recommendedAction = 'start_charging';
                  vehiclePlan.reason = 'High Powerwall level allows charging';
                } else if (solarProduction > (homeLoad + 3000)) {
                  vehiclePlan.recommendedAction = 'start_charging';
                  vehiclePlan.reason = 'Excess solar production available';
                } else if (powerwallLevel < preservePowerwallReserve) {
                  vehiclePlan.recommendedAction = 'delay_charging';
                  vehiclePlan.reason = 'Preserve Powerwall reserve';
                } else {
                  vehiclePlan.recommendedAction = 'schedule_off_peak';
                  vehiclePlan.reason = 'Schedule for off-peak hours';
                }
              }

              plan.vehicles.push(vehiclePlan);
            }
          } catch (vehicleError) {
            console.warn(`Failed to get data for vehicle ${vehicle.id}:`, vehicleError.message);
          }
        }
      }

      if (powerwallLevel < preservePowerwallReserve && gridPower < 0) {
        plan.powerwallActions.push({
          action: 'increase_backup_reserve',
          currentReserve: preservePowerwallReserve,
          recommendedReserve: Math.min(preservePowerwallReserve + 10, 100),
          reason: 'Low battery level and grid export detected'
        });
      }

      if (solarProduction > (homeLoad + 5000) && powerwallLevel > 95) {
        plan.recommendations.push({
          type: 'energy_optimization',
          message: 'High solar production and full Powerwall - excellent time for vehicle charging',
          action: 'prioritize_vehicle_charging'
        });
      }

      const chargingVehicles = plan.vehicles.filter(v => v.recommendedAction === 'start_charging');
      if (chargingVehicles.length > maxSimultaneousCharging) {
        const sortedByPriority = chargingVehicles.sort((a, b) => {
          if (a.priority === 'high' && b.priority === 'normal') return -1;
          if (a.priority === 'normal' && b.priority === 'high') return 1;
          return b.chargingNeeded - a.chargingNeeded;
        });

        sortedByPriority.slice(maxSimultaneousCharging).forEach(vehicle => {
          vehicle.recommendedAction = 'queue_charging';
          vehicle.reason = 'Waiting for charging slot to become available';
        });
      }

      return plan;
    } catch (error) {
      throw new Error(`Failed to create charging plan: ${error.message}`);
    }
  }

  async executeChargingPlan(plan) {
    const results = {
      executed: [],
      failed: [],
      skipped: []
    };

    for (const vehiclePlan of plan.vehicles) {
      try {
        switch (vehiclePlan.recommendedAction) {
          case 'start_charging':
            await this.vehicleAPI.startCharging(vehiclePlan.vehicleId);
            results.executed.push({
              vehicleId: vehiclePlan.vehicleId,
              action: 'start_charging',
              message: 'Charging started successfully'
            });
            break;

          case 'delay_charging':
            await this.vehicleAPI.stopCharging(vehiclePlan.vehicleId);
            results.executed.push({
              vehicleId: vehiclePlan.vehicleId,
              action: 'delay_charging',
              message: 'Charging delayed to preserve Powerwall'
            });
            break;

          case 'schedule_off_peak':
            const offPeakTime = this.calculateOffPeakTime();
            await this.vehicleAPI.scheduleCharging(vehiclePlan.vehicleId, offPeakTime);
            results.executed.push({
              vehicleId: vehiclePlan.vehicleId,
              action: 'schedule_off_peak',
              message: `Charging scheduled for ${offPeakTime}`
            });
            break;

          case 'queue_charging':
            results.skipped.push({
              vehicleId: vehiclePlan.vehicleId,
              action: 'queue_charging',
              message: 'Added to charging queue'
            });
            break;

          default:
            results.skipped.push({
              vehicleId: vehiclePlan.vehicleId,
              action: 'none',
              message: 'No action required'
            });
        }
      } catch (error) {
        results.failed.push({
          vehicleId: vehiclePlan.vehicleId,
          action: vehiclePlan.recommendedAction,
          error: error.message
        });
      }
    }

    for (const powerwallAction of plan.powerwallActions) {
      try {
        if (powerwallAction.action === 'increase_backup_reserve') {
          const siteId = (await this.energyAPI.getEnergyProducts())[0].energy_site_id;
          await this.energyAPI.setBackupReserve(siteId, powerwallAction.recommendedReserve);
          results.executed.push({
            action: 'increase_backup_reserve',
            message: `Backup reserve increased to ${powerwallAction.recommendedReserve}%`
          });
        }
      } catch (error) {
        results.failed.push({
          action: powerwallAction.action,
          error: error.message
        });
      }
    }

    return results;
  }

  calculateOffPeakTime() {
    const now = new Date();
    const offPeakHour = 23;
    const offPeakTime = new Date(now);
    
    if (now.getHours() >= offPeakHour) {
      offPeakTime.setDate(offPeakTime.getDate() + 1);
    }
    
    offPeakTime.setHours(offPeakHour, 0, 0, 0);
    return Math.floor(offPeakTime.getTime() / 1000);
  }

  async startAutomaticCoordination(options = {}) {
    const {
      intervalMinutes = 15,
      autoExecute = false,
      ...planOptions
    } = options;

    if (this.isActive) {
      throw new Error('Automatic coordination is already active');
    }

    this.isActive = true;
    console.log('Starting automatic charging coordination...');

    const coordinationLoop = async () => {
      if (!this.isActive) return;

      try {
        const plan = await this.createOptimalChargingPlan(planOptions);
        console.log('Charging plan created:', {
          vehicles: plan.vehicles.length,
          actions: plan.vehicles.filter(v => v.recommendedAction !== 'none').length,
          timestamp: plan.createdAt
        });

        if (autoExecute) {
          const results = await this.executeChargingPlan(plan);
          console.log('Plan execution results:', {
            executed: results.executed.length,
            failed: results.failed.length,
            skipped: results.skipped.length
          });
        }
      } catch (error) {
        console.error('Error in coordination loop:', error.message);
      }

      if (this.isActive) {
        setTimeout(coordinationLoop, intervalMinutes * 60 * 1000);
      }
    };

    coordinationLoop();
    return { message: 'Automatic coordination started', intervalMinutes, autoExecute };
  }

  stopAutomaticCoordination() {
    if (!this.isActive) {
      throw new Error('Automatic coordination is not active');
    }

    this.isActive = false;
    console.log('Stopping automatic charging coordination...');
    return { message: 'Automatic coordination stopped' };
  }

  getCoordinationStatus() {
    return {
      isActive: this.isActive,
      scheduledTasks: this.scheduledTasks.size,
      lastUpdate: new Date().toISOString()
    };
  }
}