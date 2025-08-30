import crypto from 'crypto';

export class TVCPClient {
  constructor(privateKey, domain) {
    this.privateKey = privateKey;
    this.domain = domain;
  }

  // Generate a signed command for TVCP
  generateSignedCommand(command, vehicleId, parameters = {}) {
    if (!this.privateKey) {
      throw new Error('Private key required for TVCP commands');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');

    // Create the command payload
    const commandPayload = {
      command: command,
      vehicle_id: vehicleId,
      parameters: parameters,
      timestamp: timestamp,
      nonce: nonce,
      domain: this.domain
    };

    // Create signature
    const payloadString = JSON.stringify(commandPayload);
    const signature = crypto.sign('RSA-SHA256', Buffer.from(payloadString), this.privateKey);
    const signatureBase64 = signature.toString('base64');

    return {
      payload: commandPayload,
      signature: signatureBase64,
      algorithm: 'RS256'
    };
  }

  // Create TVCP request body
  createTVCPRequest(command, vehicleId, parameters = {}) {
    const signedCommand = this.generateSignedCommand(command, vehicleId, parameters);
    
    return {
      command: signedCommand.payload.command,
      parameters: signedCommand.payload.parameters,
      domain: this.domain,
      timestamp: signedCommand.payload.timestamp,
      nonce: signedCommand.payload.nonce,
      signature: signedCommand.signature,
      algorithm: signedCommand.algorithm
    };
  }

  // Validate domain matches deployment
  validateDomain() {
    if (!this.domain) {
      throw new Error('Domain not configured for TVCP');
    }
    
    // Domain should match your Vercel deployment
    if (!this.domain.includes('vercel.app') && !this.domain.includes('tesla-bot')) {
      console.warn('Domain might not match your public key URL');
    }
    
    return true;
  }
}