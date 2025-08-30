import express from 'express';
import { TeslaFleetAPI } from '../api/tesla-fleet-api.js';
import { TeslaEnergyAPI } from '../api/energy-api.js';
import { ChargingCoordinator } from '../services/charging-coordinator.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/debug-token', (req, res) => {
  res.json({
    token_received: !!req.tokens?.access_token,
    token_length: req.tokens?.access_token?.length || 0,
    token_preview: req.tokens?.access_token?.substring(0, 20) + '...',
    has_refresh_token: !!req.tokens?.refresh_token,
    message: 'Token debugging info'
  });
});

router.get('/debug-tvcp', (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    const hasPrivateKey = !!vehicleAPI.teslaAuth.privateKey;
    const domain = vehicleAPI.domain;
    
    res.json({
      tvcp_ready: hasPrivateKey && domain,
      has_private_key: hasPrivateKey,
      domain: domain,
      private_key_preview: hasPrivateKey ? 'Present' : 'Missing',
      public_key_url: `${domain}/.well-known/appspecific/com.tesla.3p.public-key.pem`,
      message: hasPrivateKey ? 'TVCP should work' : 'Private key missing - TVCP will fail'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      tvcp_ready: false
    });
  }
});

router.get('/test-api', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    const energyAPI = new TeslaEnergyAPI();
    
    const tokenData = { 
      access_token: req.tokens.access_token,
      expires_at: Date.now() + 3600000 
    };
    
    vehicleAPI.setTokens(tokenData);
    energyAPI.setTokens(tokenData);
    
    console.log('=== COMPREHENSIVE TESLA FLEET API DEBUG ===');
    
    const results = {
      timestamp: new Date().toISOString(),
      token_info: {
        length: req.tokens.access_token?.length,
        preview: req.tokens.access_token?.substring(0, 30) + '...'
      },
      tests: {},
      troubleshooting: []
    };
    
    // Test 1: Raw /api/1/vehicles endpoint
    try {
      console.log('Testing /api/1/vehicles...');
      const response = await vehicleAPI.httpClient.get('/api/1/vehicles');
      results.tests.vehicles_raw = {
        success: true,
        status: response.status,
        headers: response.headers,
        data: response.data,
        has_response_array: !!response.data?.response,
        response_count: response.data?.response?.length || 0
      };
      
      if (response.data?.response?.length === 0) {
        results.troubleshooting.push("No vehicles returned - this is the main issue");
      }
    } catch (error) {
      results.tests.vehicles_raw = {
        success: false,
        status: error.response?.status,
        error: error.message,
        response_data: error.response?.data
      };
    }
    
    // Test 2: Raw /api/1/products endpoint
    try {
      console.log('Testing /api/1/products...');
      const response = await vehicleAPI.httpClient.get('/api/1/products');
      results.tests.products_raw = {
        success: true,
        status: response.status,
        data: response.data,
        total_products: response.data?.response?.length || 0,
        product_types: response.data?.response?.map(p => p.resource_type) || []
      };
      
      const vehicles = response.data?.response?.filter(p => p.resource_type === 'vehicle') || [];
      const batteries = response.data?.response?.filter(p => p.resource_type === 'battery') || [];
      const solar = response.data?.response?.filter(p => p.resource_type === 'solar') || [];
      
      results.tests.products_breakdown = {
        vehicles: vehicles.length,
        batteries: batteries.length,  
        solar: solar.length,
        vehicle_details: vehicles,
        battery_details: batteries,
        solar_details: solar
      };
      
      if (vehicles.length === 0) {
        results.troubleshooting.push("No vehicle products found in /api/1/products");
      }
      
    } catch (error) {
      results.tests.products_raw = {
        success: false,
        status: error.response?.status,
        error: error.message,
        response_data: error.response?.data
      };
    }
    
    // Test 3: Try different API regions
    const regions = [
      { name: 'North America', url: 'https://fleet-api.prd.na.vn.cloud.tesla.com' },
      { name: 'Europe', url: 'https://fleet-api.prd.eu.vn.cloud.tesla.com' },
      { name: 'China', url: 'https://fleet-api.prd.cn.vn.cloud.tesla.com' }
    ];
    
    results.tests.regional_tests = {};
    
    for (const region of regions) {
      try {
        console.log(`Testing ${region.name} region...`);
        const regionResponse = await vehicleAPI.httpClient.client({
          method: 'get',
          url: '/api/1/vehicles',
          baseURL: region.url,
          headers: {
            'Authorization': `Bearer ${req.tokens.access_token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        results.tests.regional_tests[region.name] = {
          success: true,
          vehicle_count: regionResponse.data?.response?.length || 0,
          url: region.url
        };
        
        if (regionResponse.data?.response?.length > 0) {
          results.troubleshooting.push(`FOUND VEHICLES in ${region.name} region!`);
        }
        
      } catch (error) {
        results.tests.regional_tests[region.name] = {
          success: false,
          error: error.response?.status || error.message,
          url: region.url
        };
      }
    }
    
    // Add troubleshooting recommendations
    if (results.troubleshooting.length === 0) {
      results.troubleshooting = [
        "Fleet API authentication successful but no vehicles found",
        "This usually means vehicles need to be enrolled in Fleet API",
        "Try: 1) Re-authenticate with all scopes, 2) Contact Tesla Fleet API support",
        "Check if vehicle is in a different region",
        "Ensure vehicle was used in Tesla mobile app recently"
      ];
    }
    
    res.json(results);
    
  } catch (error) {
    console.error('Comprehensive test error:', error);
    res.status(500).json({ 
      error: error.message,
      success: false 
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const coordinator = new ChargingCoordinator();
    coordinator.setTokens(req.tokens);
    
    const systemStatus = await coordinator.getSystemStatus();
    res.json(systemStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    console.log('Fetching vehicles with token length:', req.tokens.access_token?.length);
    const vehicles = await vehicleAPI.getVehicles();
    res.json(vehicles);
  } catch (error) {
    console.error('Vehicles endpoint error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const vehicleData = await vehicleAPI.getVehicleData(req.params.id);
    res.json(vehicleData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles/:id/wake', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const result = await vehicleAPI.wakeVehicle(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles/:id/charging/start', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const result = await vehicleAPI.startCharging(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles/:id/charging/stop', async (req, res) => {
  try {
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const result = await vehicleAPI.stopCharging(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles/:id/charging/limit', async (req, res) => {
  try {
    const { percent } = req.body;
    
    if (!percent || percent < 50 || percent > 100) {
      return res.status(400).json({ error: 'Charge limit must be between 50 and 100 percent' });
    }
    
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const result = await vehicleAPI.setChargeLimit(req.params.id, percent);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles/:id/charging/amps', async (req, res) => {
  try {
    const { amps } = req.body;
    
    if (!amps || amps < 5 || amps > 48) {
      return res.status(400).json({ error: 'Charging amps must be between 5 and 48' });
    }
    
    const vehicleAPI = new TeslaFleetAPI();
    vehicleAPI.setTokens(req.tokens);
    
    const result = await vehicleAPI.setChargingAmps(req.params.id, amps);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/energy/products', async (req, res) => {
  try {
    const energyAPI = new TeslaEnergyAPI();
    energyAPI.setTokens(req.tokens);
    
    const products = await energyAPI.getEnergyProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/energy/sites/:id/status', async (req, res) => {
  try {
    const energyAPI = new TeslaEnergyAPI();
    energyAPI.setTokens(req.tokens);
    
    const status = await energyAPI.getPowerwallStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/energy/sites/:id/backup-reserve', async (req, res) => {
  try {
    const { percent } = req.body;
    
    if (percent < 0 || percent > 100) {
      return res.status(400).json({ error: 'Backup reserve must be between 0 and 100 percent' });
    }
    
    const energyAPI = new TeslaEnergyAPI();
    energyAPI.setTokens(req.tokens);
    
    const result = await energyAPI.setBackupReserve(req.params.id, percent);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/charging/plan', async (req, res) => {
  try {
    const coordinator = new ChargingCoordinator();
    coordinator.setTokens(req.tokens);
    
    const plan = await coordinator.createOptimalChargingPlan(req.body);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/charging/execute', async (req, res) => {
  try {
    const coordinator = new ChargingCoordinator();
    coordinator.setTokens(req.tokens);
    
    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ error: 'Charging plan is required' });
    }
    
    const results = await coordinator.executeChargingPlan(plan);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/charging/auto/start', async (req, res) => {
  try {
    const coordinator = new ChargingCoordinator();
    coordinator.setTokens(req.tokens);
    
    const result = await coordinator.startAutomaticCoordination(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/charging/auto/stop', async (req, res) => {
  try {
    const coordinator = new ChargingCoordinator();
    coordinator.setTokens(req.tokens);
    
    const result = await coordinator.stopAutomaticCoordination();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as apiRouter };