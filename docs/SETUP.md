# Tesla Fleet API Setup Guide

This guide walks you through setting up your Tesla Fleet API integration with public/private key authentication.

## Step 1: Generate RSA Key Pair

Generate the required RSA key pair for enhanced security:

```bash
npm run generate-keys
```

This creates:
- `keys/private_key.pem` - Keep this secret and secure
- `keys/public_key.pem` - Will be hosted publicly for Tesla to verify

## Step 2: Deploy to Vercel

Deploy your application to get your public domain:

```bash
vercel deploy
```

Note your deployment URL (e.g., `https://your-app.vercel.app`)

## Step 3: Verify Public Key Endpoint

Your public key will be automatically hosted at:
```
https://your-domain.vercel.app/.well-known/appspecific/com.tesla.3p.public-key.pem
```

Test it works by visiting the URL - you should see your public key.

## Step 4: Register Tesla Fleet API Application

1. Go to [Tesla Developer Portal](https://developer.tesla.com)
2. Create a new Fleet API application
3. Fill in the required information:

### Application Details
- **Application Name**: Your app name
- **Description**: Brief description of your charging management bot
- **Website**: Your Vercel app URL
- **Redirect URI**: `https://your-domain.vercel.app/auth/callback`

### Security Configuration
- **Public Key URL**: `https://your-domain.vercel.app/.well-known/appspecific/com.tesla.3p.public-key.pem`

### Scopes Request
Request these scopes for full functionality:
- `openid` - Basic authentication
- `offline_access` - Refresh tokens
- `vehicle_device_data` - Read vehicle data
- `vehicle_cmds` - Control vehicle functions
- `energy_cmds` - Control energy products (Powerwall)

## Step 5: Configure Environment Variables

### For Vercel Production

In your Vercel dashboard, add these environment variables:

```bash
TESLA_CLIENT_ID=your_client_id_from_tesla
TESLA_CLIENT_SECRET=your_client_secret_from_tesla
TESLA_REDIRECT_URI=https://your-domain.vercel.app/auth/callback
```

### Add Your Private Key

Copy your private key content to Vercel environment variables:

1. Run: `npm run show-public-key` to see your public key
2. Copy the content of `keys/private_key.pem` 
3. In Vercel dashboard, add:
   ```
   TESLA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
   your_private_key_content_here
   -----END PRIVATE KEY-----"
   ```

**Important**: Include the literal `\n` characters for line breaks, or paste the multi-line value directly in Vercel's interface.

### Optional: Add Public Key

For redundancy, you can also add the public key:
```
TESLA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
your_public_key_content_here
-----END PUBLIC KEY-----"
```

## Step 6: Test Your Setup

1. Visit your deployed app: `https://your-domain.vercel.app`
2. Check that the public key endpoint works: `https://your-domain.vercel.app/.well-known/appspecific/com.tesla.3p.public-key.pem`
3. Test authentication flow: `https://your-domain.vercel.app/auth/login`

## Step 7: Complete Authentication

1. Visit `/auth/login` to get the authorization URL
2. Follow the Tesla OAuth flow
3. You'll be redirected back with access tokens
4. Store the tokens securely for API access

## Security Best Practices

### Private Key Security
- ✅ Store private key in environment variables
- ✅ Never commit private key to git
- ✅ Use different keys for development/production
- ❌ Never expose private key in client-side code
- ❌ Never log or display private key content

### Token Management
- Store access/refresh tokens securely
- Implement proper token refresh logic
- Use HTTPS for all communications
- Set appropriate token scopes

### Rate Limiting
- Respect Tesla's 20 requests/second limit
- Implement exponential backoff for errors
- Monitor your API usage

## Troubleshooting

### Public Key Issues

**Problem**: "Public key not found" error
**Solution**: 
1. Check that keys were generated: `npm run validate-keys`
2. Verify Vercel environment variable is set
3. Check the public key URL is accessible

### Authentication Errors

**Problem**: "Token exchange failed"
**Solutions**:
1. Verify client ID and secret are correct
2. Check redirect URI matches exactly
3. Ensure public key URL is accessible to Tesla
4. Verify private key format in environment variables

### API Access Issues

**Problem**: 403/401 errors when calling Fleet API
**Solutions**:
1. Check token hasn't expired
2. Verify required scopes were granted
3. Ensure vehicle is awake (call wake endpoint first)
4. Check API rate limits

### Key Validation

Test your key setup:

```bash
# Validate key pair works
npm run validate-keys

# Check public key content
npm run show-public-key

# Regenerate if needed
npm run generate-keys
```

## Development vs Production

### Development
- Keys stored in `keys/` directory
- Use local `.env` file
- Test with `npm run dev`

### Production (Vercel)
- Keys stored in environment variables
- No local files used
- Automatic HTTPS
- Serverless functions

## Next Steps

Once setup is complete:
1. Test basic vehicle commands
2. Configure Powerwall integration
3. Set up automatic charging coordination
4. Monitor API usage and costs

For detailed usage instructions, see the main [README.md](../README.md).