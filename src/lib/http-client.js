import axios from 'axios';

export class TeslaHttpClient {
  constructor() {
    this.fleetBaseUrl = process.env.TESLA_FLEET_BASE_URL || 'https://fleet-api.prd.na.vn.cloud.tesla.com';
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxRequestsPerSecond = 20;
    this.requestInterval = 1000 / this.maxRequestsPerSecond;
    
    this.client = axios.create({
      baseURL: this.fleetBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TeslaFleetBot/1.0'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        const timestamp = new Date().toISOString();
        const status = error.response?.status || 'Network Error';
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
        const url = error.config?.url || 'unknown';
        
        console.error(`[${timestamp}] Error: ${status} ${method} ${url}`);
        
        if (error.response?.status === 429) {
          console.warn('Rate limit exceeded. Consider implementing backoff strategy.');
        }
        
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { config, resolve, reject } = this.requestQueue.shift();
      
      try {
        const response = await this.client(config);
        resolve(response);
      } catch (error) {
        reject(error);
      }

      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestInterval));
      }
    }

    this.isProcessingQueue = false;
  }

  async request(config) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ config, resolve, reject });
      this.processQueue();
    });
  }

  async get(url, config = {}) {
    return this.request({ ...config, method: 'get', url });
  }

  async post(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'post', url, data });
  }

  async put(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'put', url, data });
  }

  async patch(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'patch', url, data });
  }

  async delete(url, config = {}) {
    return this.request({ ...config, method: 'delete', url });
  }

  getQueueLength() {
    return this.requestQueue.length;
  }

  clearQueue() {
    this.requestQueue = [];
  }
}