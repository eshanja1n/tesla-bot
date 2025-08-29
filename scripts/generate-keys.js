#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEYS_DIR = './keys';
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public_key.pem');

function generateKeyPair() {
  console.log('Generating RSA key pair for Tesla Fleet API...');
  
  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    console.log(`Created ${KEYS_DIR} directory`);
  }

  // Generate RSA key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Write private key
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  console.log(`✓ Private key saved to: ${PRIVATE_KEY_PATH}`);

  // Write public key
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
  console.log(`✓ Public key saved to: ${PUBLIC_KEY_PATH}`);

  console.log('\n=== IMPORTANT SECURITY NOTES ===');
  console.log('1. The private key must be kept secret and secure');
  console.log('2. Never commit the private key to version control');
  console.log('3. The public key will be hosted at your domain for Tesla to verify');
  console.log('4. Add the private key to your environment variables');

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Deploy your application to get your domain');
  console.log('2. Your public key will be available at:');
  console.log('   https://your-domain.vercel.app/.well-known/appspecific/com.tesla.3p.public-key.pem');
  console.log('3. Register this URL with Tesla when creating your Fleet API application');
  console.log('4. Add your private key to environment variables (see .env.example)');

  return { privateKey, publicKey };
}

function displayPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    console.error('Public key not found. Run key generation first.');
    return;
  }

  const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  console.log('\n=== PUBLIC KEY CONTENT ===');
  console.log(publicKey);
}

function validateKeys() {
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.error('Keys not found. Generate keys first.');
    return false;
  }

  try {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

    // Test encryption/decryption
    const testMessage = 'Tesla Fleet API Test';
    const encrypted = crypto.publicEncrypt(publicKey, Buffer.from(testMessage));
    const decrypted = crypto.privateDecrypt(privateKey, encrypted);

    if (decrypted.toString() === testMessage) {
      console.log('✓ Key pair validation successful');
      return true;
    } else {
      console.error('✗ Key pair validation failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Key validation error:', error.message);
    return false;
  }
}

// Command line interface
const command = process.argv[2] || 'generate';

switch (command) {
  case 'generate':
    generateKeyPair();
    break;
    
  case 'display':
    displayPublicKey();
    break;
    
  case 'validate':
    validateKeys();
    break;
    
  case 'help':
    console.log('Tesla Fleet API Key Generator');
    console.log('\nCommands:');
    console.log('  generate  - Generate new RSA key pair (default)');
    console.log('  display   - Display public key content');
    console.log('  validate  - Validate key pair');
    console.log('  help      - Show this help');
    break;
    
  default:
    console.log('Unknown command. Use "help" for available commands.');
}