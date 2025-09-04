# Tesla Vehicle Command Proxy Setup

This guide shows how to set up Tesla's official vehicle-command proxy for proper TVCP support.

## Prerequisites

1. **Install Go** (1.23.0 or later)
2. **Your existing private key** (from `keys/private_key.pem`)
3. **Tesla OAuth token** (from your authentication flow)

## Step 1: Install Tesla Vehicle Command SDK

```bash
# Install the Tesla vehicle command tools
go install github.com/teslamotors/vehicle-command/cmd/tesla-keygen@latest
go install github.com/teslamotors/vehicle-command/cmd/tesla-control@latest
go install github.com/teslamotors/vehicle-command/cmd/tesla-http-proxy@latest
```

## Step 2: Set Up Configuration

```bash
# Create config directory
mkdir -p tesla-proxy-config

# Generate TLS certificate for the proxy
openssl req -x509 -nodes -newkey ec \
  -pkeyopt ec_paramgen_curve:secp384r1 \
  -subj '/CN=localhost' \
  -keyout tesla-proxy-config/tls-key.pem \
  -out tesla-proxy-config/tls-cert.pem

# Copy your existing private key for vehicle commands
cp keys/private_key.pem tesla-proxy-config/fleet-key.pem
```

## Step 3: Run the Tesla HTTP Proxy

```bash
# Run the proxy (replace with your OAuth token)
TESLA_AUTH_TOKEN="your_access_token_here" \
tesla-http-proxy \
  -tls-key tesla-proxy-config/tls-key.pem \
  -cert tesla-proxy-config/tls-cert.pem \
  -key-file tesla-proxy-config/fleet-key.pem \
  -port 4443
```

## Step 4: Test Vehicle Commands Through Proxy

```bash
# Get your VIN first (replace with your VIN)
VIN="your_vehicle_vin_here"

# Test flash lights command
curl --insecure \
  --header "Authorization: Bearer your_access_token_here" \
  "https://localhost:4443/api/1/vehicles/$VIN/command/flash_lights"

# Test stop charging
curl --insecure \
  -X POST \
  --header "Authorization: Bearer your_access_token_here" \
  "https://localhost:4443/api/1/vehicles/$VIN/command/charge_stop"
```

## Step 5: Update Your Application

Update your Tesla Bot to route commands through the local proxy at `https://localhost:4443` instead of Tesla's direct API.

## Production Deployment

For production on Vercel, you'll need to:
1. Deploy the tesla-http-proxy as a separate service (e.g., on Railway, Fly.io, or a VPS)
2. Use proper TLS certificates
3. Update your bot to use the proxy's public URL

## Important Notes

- The proxy needs to run continuously
- Virtual keys must be installed on your vehicle
- Use your vehicle's VIN instead of the numeric vehicle ID
- The proxy handles all TVCP signing internally