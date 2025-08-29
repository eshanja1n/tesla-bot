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
    message: 'Token debugging info'
  });
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
    
    const vehicles = await vehicleAPI.getVehicles();
    res.json(vehicles);
  } catch (error) {
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