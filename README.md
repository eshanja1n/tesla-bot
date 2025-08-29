# Tesla Fleet API Bot

A comprehensive Node.js application for managing Tesla vehicle charging through Powerwall integration using the official Tesla Fleet API.

## Features

- **OAuth 2.0 Authentication** with Tesla Fleet API
- **Vehicle Management** - Monitor and control Tesla vehicles
- **Energy Management** - Control Powerwall settings and monitoring
- **Intelligent Charging Coordination** - Optimize vehicle charging based on Powerwall status and solar production
- **Automatic Scheduling** - Set up automated charging coordination
- **Rate Limiting** - Built-in request queuing to respect API limits
- **Vercel Ready** - Configured for serverless deployment

## Prerequisites

1. Tesla Account with Fleet API access
2. Tesla vehicles and/or Powerwall system
3. Node.js 18+ 
4. Tesla Fleet API application credentials

## Setup

### 1. Tesla Fleet API Application

1. Visit [Tesla Developer Portal](https://developer.tesla.com)
2. Create a new Fleet API application
3. Note your `Client ID` and `Client Secret`
4. Set redirect URI to your deployed app URL + `/auth/callback`

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your Tesla credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `TESLA_CLIENT_ID` - Your Tesla app client ID
- `TESLA_CLIENT_SECRET` - Your Tesla app client secret  
- `TESLA_REDIRECT_URI` - Your app's callback URL

### 3. Installation

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

### 5. Deployment to Vercel

```bash
vercel deploy
```

Make sure to set your environment variables in the Vercel dashboard.

## Usage

### Authentication Flow

1. **Start Authentication**
   ```
   GET /auth/login
   ```
   Returns an authorization URL to visit

2. **Complete Authentication**
   ```
   GET /auth/callback?code=<auth_code>&state=<state>
   ```
   Exchanges authorization code for access tokens

3. **Refresh Tokens**
   ```
   POST /auth/refresh
   Body: { "refresh_token": "your_refresh_token" }
   ```

### API Endpoints

All API endpoints require authentication via `Authorization: Bearer <access_token>` header.

#### System Status
```
GET /api/status
```
Returns comprehensive status of all vehicles and energy products.

#### Vehicle Control
```
GET /api/vehicles                           # List all vehicles
GET /api/vehicles/:id                       # Get vehicle details
POST /api/vehicles/:id/wake                 # Wake up vehicle
POST /api/vehicles/:id/charging/start       # Start charging
POST /api/vehicles/:id/charging/stop        # Stop charging
POST /api/vehicles/:id/charging/limit       # Set charge limit (50-100%)
POST /api/vehicles/:id/charging/amps        # Set charging amps (5-48A)
```

#### Energy Management
```
GET /api/energy/products                    # List energy products
GET /api/energy/sites/:id/status           # Get Powerwall status
POST /api/energy/sites/:id/backup-reserve  # Set backup reserve (0-100%)
```

#### Intelligent Charging Coordination
```
POST /api/charging/plan                     # Create optimal charging plan
POST /api/charging/execute                  # Execute charging plan
POST /api/charging/auto/start              # Start automatic coordination
POST /api/charging/auto/stop               # Stop automatic coordination
```

### Example Usage

#### Create Optimal Charging Plan

```javascript
const response = await fetch('/api/charging/plan', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_access_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    targetChargeLevels: {
      'vehicle_id_1': 80,
      'vehicle_id_2': 90
    },
    preservePowerwallReserve: 20,
    maxSimultaneousCharging: 2
  })
});

const plan = await response.json();
console.log('Charging plan:', plan);
```

#### Execute Charging Plan

```javascript
const response = await fetch('/api/charging/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_access_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan })
});

const results = await response.json();
console.log('Execution results:', results);
```

#### Start Automatic Coordination

```javascript
const response = await fetch('/api/charging/auto/start', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_access_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    intervalMinutes: 15,
    autoExecute: true,
    preservePowerwallReserve: 25,
    maxSimultaneousCharging: 1
  })
});
```

## Charging Coordination Logic

The system makes intelligent decisions based on:

1. **Powerwall Battery Level** - Higher levels allow more aggressive vehicle charging
2. **Solar Production** - Excess solar power prioritizes vehicle charging  
3. **Home Energy Load** - Ensures sufficient power for home needs
4. **Time of Use** - Schedules charging during off-peak hours when needed
5. **Vehicle Priority** - Allows setting high-priority vehicles
6. **Charging Limits** - Respects maximum simultaneous charging settings

### Decision Matrix

| Powerwall Level | Solar Excess | Recommendation |
|-----------------|--------------|----------------|
| >90% | Any | Start charging immediately |
| >50% | >3kW excess | Start charging |
| <20% | Any | Delay charging |
| 20-50% | <1kW excess | Schedule off-peak |

## API Rate Limits

- Maximum 20 requests per second per application
- Built-in request queuing handles rate limiting automatically
- Tokens refresh automatically when near expiration

## Error Handling

The application includes comprehensive error handling for:
- Network connectivity issues
- API rate limiting
- Authentication token expiration
- Vehicle communication errors
- Powerwall communication errors

## Security Notes

- Never expose your `TESLA_CLIENT_SECRET` in client-side code
- Store tokens securely - they provide full access to your Tesla account
- Use HTTPS in production
- Regularly rotate your application credentials

## Development

### Project Structure

```
src/
├── api/                 # Tesla Fleet API wrappers
├── auth/               # Authentication handling
├── lib/                # HTTP client and utilities  
├── middleware/         # Express middleware
├── routes/             # API route handlers
└── services/           # Business logic services
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues with the Tesla Fleet API itself, consult the [Tesla Developer Documentation](https://developer.tesla.com/docs/fleet-api).

For application-specific issues, please create an issue in this repository.