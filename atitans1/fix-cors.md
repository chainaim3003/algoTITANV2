# Fix CORS Issue for Algorand LocalNet

## Steps to Enable CORS:

### 1. Stop current LocalNet
```bash
algokit localnet stop
```

### 2. Create custom LocalNet configuration
Create a file `docker-compose.yml` in your project root with CORS enabled:

```yaml
version: '3.8'
services:
  algod:
    image: algorand/algod:latest
    ports:
      - "4001:8080"
    environment:
      - ALGORAND_DATA=/opt/algorand/data
      - CORS_ENABLED=true
      - CORS_ALLOWED_ORIGINS=*
    command: ["algod", "-d", "/opt/algorand/data", "-g", "/opt/algorand/data/genesis.json"]
    
  indexer:
    image: algorand/indexer:latest
    ports:
      - "8980:8980"
    environment:
      - INDEXER_CORS_ALLOWED_ORIGINS=*
```

### 3. OR Use AlgoKit with CORS (Simpler)
```bash
# Reset and restart with development settings
algokit localnet reset

# Start with development mode (usually includes CORS)
algokit localnet start --dev
```

### 4. Alternative: Use Proxy in React
Add this to your `vite.config.ts`:

```typescript
export default defineConfig({
  // ... other config
  server: {
    proxy: {
      '/v2': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

Then update your algorandService to use `/v2/status` instead of `http://localhost:4001/v2/status`
