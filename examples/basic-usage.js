import { TeslaFleetAPI } from '../src/api/tesla-fleet-api.js';
import { TeslaEnergyAPI } from '../src/api/energy-api.js';
import { ChargingCoordinator } from '../src/services/charging-coordinator.js';
import { TeslaAuth } from '../src/auth/tesla-auth.js';

async function basicUsageExample() {
  
  const tokens = {
    access_token: 'your_access_token_here',
    refresh_token: 'your_refresh_token_here',
    expires_at: Date.now() + 3600000
  };

  console.log('=== Tesla Fleet API Basic Usage Example ===\n');

  console.log('1. Initializing API clients...');
  const vehicleAPI = new TeslaFleetAPI();
  const energyAPI = new TeslaEnergyAPI();
  const coordinator = new ChargingCoordinator();

  vehicleAPI.setTokens(tokens);
  energyAPI.setTokens(tokens);
  coordinator.setTokens(tokens);

  try {
    console.log('2. Getting system status...');
    const systemStatus = await coordinator.getSystemStatus();
    
    console.log(`   Found ${systemStatus.vehicles.length} vehicles`);
    console.log(`   Found ${systemStatus.powerwalls.length} Powerwall systems`);
    console.log(`   Found ${systemStatus.solarSystems.length} solar systems\n`);

    console.log('3. Getting vehicle information...');
    for (const vehicle of systemStatus.vehicles.slice(0, 2)) {
      console.log(`   Vehicle: ${vehicle.display_name} (${vehicle.state})`);
      
      if (vehicle.state === 'online') {
        const vehicleData = await vehicleAPI.getVehicleData(vehicle.id);
        const chargeState = vehicleData.response?.charge_state;
        
        if (chargeState) {
          console.log(`     Battery: ${chargeState.battery_level}%`);
          console.log(`     Range: ${chargeState.battery_range} miles`);
          console.log(`     Plugged in: ${chargeState.charge_port_door_open ? 'Yes' : 'No'}`);
          console.log(`     Charging: ${chargeState.charging_state}`);
        }
      }
    }

    if (systemStatus.powerwalls.length > 0) {
      console.log('\n4. Getting Powerwall status...');
      const powerwall = systemStatus.powerwalls[0];
      const powerwallStatus = await energyAPI.getPowerwallStatus(powerwall.energy_site_id);
      
      console.log(`   Battery level: ${powerwallStatus.response.percentage_charged}%`);
      console.log(`   Solar power: ${powerwallStatus.response.solar_power}W`);
      console.log(`   Load power: ${powerwallStatus.response.load_power}W`);
      console.log(`   Grid power: ${powerwallStatus.response.grid_power}W`);
    }

    console.log('\n5. Creating optimal charging plan...');
    const chargingPlan = await coordinator.createOptimalChargingPlan({
      targetChargeLevels: {},
      preservePowerwallReserve: 20,
      maxSimultaneousCharging: 2
    });

    console.log('   Charging plan created:');
    for (const vehiclePlan of chargingPlan.vehicles) {
      console.log(`     ${vehiclePlan.vehicleName}: ${vehiclePlan.recommendedAction}`);
      console.log(`       Current: ${vehiclePlan.currentCharge}%, Target: ${vehiclePlan.targetCharge}%`);
      if (vehiclePlan.reason) {
        console.log(`       Reason: ${vehiclePlan.reason}`);
      }
    }

    if (chargingPlan.recommendations.length > 0) {
      console.log('\n   Recommendations:');
      for (const rec of chargingPlan.recommendations) {
        console.log(`     - ${rec.message}`);
      }
    }

    console.log('\n6. Example: Setting charge limit...');
    const onlineVehicles = systemStatus.vehicles.filter(v => v.state === 'online');
    if (onlineVehicles.length > 0) {
      const vehicleId = onlineVehicles[0].id;
      console.log(`   Setting charge limit to 80% for ${onlineVehicles[0].display_name}...`);
      
      try {
        const result = await vehicleAPI.setChargeLimit(vehicleId, 80);
        console.log('   ✓ Charge limit set successfully');
      } catch (error) {
        console.log(`   ✗ Failed to set charge limit: ${error.message}`);
      }
    }

    if (systemStatus.powerwalls.length > 0) {
      console.log('\n7. Example: Setting Powerwall backup reserve...');
      const siteId = systemStatus.powerwalls[0].energy_site_id;
      console.log('   Setting backup reserve to 25%...');
      
      try {
        const result = await energyAPI.setBackupReserve(siteId, 25);
        console.log('   ✓ Backup reserve set successfully');
      } catch (error) {
        console.log(`   ✗ Failed to set backup reserve: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error in basic usage example:', error.message);
  }

  console.log('\n=== Example completed ===');
}

async function authenticationExample() {
  console.log('\n=== Authentication Flow Example ===\n');

  const teslaAuth = new TeslaAuth();

  console.log('1. Generating authorization URL...');
  const { authUrl, state, codeVerifier } = teslaAuth.generateAuthUrl();
  
  console.log('Authorization URL:', authUrl);
  console.log('State:', state);
  console.log('\nVisit the authorization URL in your browser and grant permissions.');
  console.log('After authorization, Tesla will redirect to your callback URL with a "code" parameter.');
  console.log('Use that code with the exchangeCodeForTokens function.\n');

  console.log('2. Example token exchange (replace AUTH_CODE with actual code):');
  console.log(`
    const authCode = 'AUTH_CODE_FROM_CALLBACK';
    const tokens = await teslaAuth.exchangeCodeForTokens(authCode, '${codeVerifier}');
    console.log('Access token:', tokens.access_token);
    console.log('Refresh token:', tokens.refresh_token);
  `);

  console.log('\n3. Example token refresh:');
  console.log(`
    const refreshedTokens = await teslaAuth.refreshAccessToken('your_refresh_token');
    console.log('New access token:', refreshedTokens.access_token);
  `);
}

async function automaticCoordinationExample() {
  console.log('\n=== Automatic Coordination Example ===\n');

  const tokens = {
    access_token: 'your_access_token_here',
    refresh_token: 'your_refresh_token_here',
    expires_at: Date.now() + 3600000
  };

  const coordinator = new ChargingCoordinator();
  coordinator.setTokens(tokens);

  try {
    console.log('1. Starting automatic coordination...');
    
    const coordinationConfig = {
      intervalMinutes: 15,            
      autoExecute: false,             
      targetChargeLevels: {
        'vehicle_id_1': 80,
        'vehicle_id_2': 90
      },
      preservePowerwallReserve: 25,   
      maxSimultaneousCharging: 2      
    };

    const result = await coordinator.startAutomaticCoordination(coordinationConfig);
    console.log('   ✓ Automatic coordination started:', result.message);
    console.log(`   Checking every ${result.intervalMinutes} minutes`);
    console.log(`   Auto-execute: ${result.autoExecute}`);

    setTimeout(async () => {
      console.log('\n2. Stopping automatic coordination...');
      const stopResult = coordinator.stopAutomaticCoordination();
      console.log('   ✓', stopResult.message);
    }, 5000);

  } catch (error) {
    console.error('Error in automatic coordination example:', error.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Choose an example to run:');
  console.log('1. Basic usage (vehicle and energy management)');
  console.log('2. Authentication flow');
  console.log('3. Automatic coordination');
  
  const example = process.argv[2] || '1';
  
  switch (example) {
    case '1':
      basicUsageExample();
      break;
    case '2':
      authenticationExample();
      break;
    case '3':
      automaticCoordinationExample();
      break;
    default:
      console.log('Invalid example. Use: node examples/basic-usage.js [1|2|3]');
  }
}