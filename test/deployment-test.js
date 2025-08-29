#!/usr/bin/env node

import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ACCESS_TOKEN = process.env.TEST_ACCESS_TOKEN; // Optional: for API testing

console.log('🚀 Testing Tesla Fleet API Bot Deployment\n');
console.log(`Base URL: ${BASE_URL}\n`);

async function testHealthCheck() {
  console.log('1. Testing health check...');
  try {
    const response = await axios.get(BASE_URL);
    console.log('   ✅ Health check passed');
    console.log('   📊 Response:', response.data);
    return true;
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message);
    return false;
  }
}

async function testPublicKey() {
  console.log('\n2. Testing public key endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/.well-known/appspecific/com.tesla.3p.public-key.pem`);
    
    if (response.data.includes('-----BEGIN PUBLIC KEY-----')) {
      console.log('   ✅ Public key endpoint working');
      console.log('   🔑 Key found and properly formatted');
      return true;
    } else {
      console.log('   ❌ Public key format invalid');
      console.log('   📄 Response:', response.data.substring(0, 100) + '...');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Public key endpoint failed:', error.response?.status, error.message);
    return false;
  }
}

async function testAuthEndpoint() {
  console.log('\n3. Testing authentication endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/auth/login`);
    
    if (response.data.authUrl && response.data.authUrl.includes('auth.tesla.com')) {
      console.log('   ✅ Auth endpoint working');
      console.log('   🔗 Auth URL generated successfully');
      console.log('   📋 To complete auth, visit:', response.data.authUrl.substring(0, 80) + '...');
      return true;
    } else {
      console.log('   ❌ Auth endpoint invalid response');
      console.log('   📄 Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Auth endpoint failed:', error.response?.status, error.message);
    return false;
  }
}

async function testAPIEndpoints() {
  if (!ACCESS_TOKEN) {
    console.log('\n4. Skipping API tests (no access token provided)');
    console.log('   💡 To test APIs, set TEST_ACCESS_TOKEN environment variable');
    return true;
  }

  console.log('\n4. Testing API endpoints...');
  
  const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };
  
  const endpoints = [
    { name: 'System Status', path: '/api/status' },
    { name: 'Vehicles', path: '/api/vehicles' },
    { name: 'Energy Products', path: '/api/energy/products' }
  ];

  let allPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, { headers });
      console.log(`   ✅ ${endpoint.name} - OK`);
    } catch (error) {
      console.log(`   ❌ ${endpoint.name} - ${error.response?.status} ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testWellKnownHealth() {
  console.log('\n5. Testing well-known health check...');
  try {
    const response = await axios.get(`${BASE_URL}/.well-known/health`);
    console.log('   ✅ Well-known health check passed');
    return true;
  } catch (error) {
    console.log('   ❌ Well-known health check failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = [];
  
  results.push(await testHealthCheck());
  results.push(await testPublicKey());
  results.push(await testAuthEndpoint());
  results.push(await testAPIEndpoints());
  results.push(await testWellKnownHealth());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your deployment is ready.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
  }

  console.log('\n📋 Next Steps:');
  console.log('   1. Register your Tesla Fleet API app with public key URL:');
  console.log(`      ${BASE_URL}/.well-known/appspecific/com.tesla.3p.public-key.pem`);
  console.log('   2. Complete authentication flow via /auth/login');
  console.log('   3. Test API endpoints with your access token');
  console.log('   4. Set up automatic charging coordination');
}

// Run tests
runAllTests().catch(console.error);