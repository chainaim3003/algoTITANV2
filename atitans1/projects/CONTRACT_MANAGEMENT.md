# Contract Management System

## Overview

Centralized contract management with automatic updates after deployment.

## File Structure

```
projects/
├── atitans1-frontend/src/config/
│   ├── contracts.json          # 📝 Source of truth (auto-updated)
│   ├── contracts.ts            # 🔧 TypeScript wrapper with helpers
│   └── deployments.md          # 📚 Human-readable deployment history
└── atitans1-contracts/scripts/
    └── update-contracts.js     # 🤖 Auto-update script
```

## How It Works

### 1. Deploy Contract (Automated)

```bash
cd projects/atitans1-contracts
algokit project deploy testnet
```

The deployment script automatically:
- ✅ Deploys the contract
- ✅ Updates `contracts.json` with new App ID and address
- ✅ Moves old contract to deprecated section
- ✅ Updates `deployments.md` version history

### 2. Manual Update (if auto-update fails)

```bash
cd projects/atitans1-contracts
node scripts/update-contracts.js ESCROW_V5 746800123 "ABCD..." --deprecate ESCROW_V4
```

Parameters:
- `ESCROW_V5`: Contract key in contracts.json
- `746800123`: New App ID
- `"ABCD..."`: New App Address
- `--deprecate ESCROW_V4`: (Optional) Move old contract to deprecated

## Usage in Frontend

```typescript
import { getActiveEscrowContract } from '@/config/contracts';

// Get active escrow contract (automatically returns V5 after deployment)
const escrow = getActiveEscrowContract();
console.log(escrow.appId);      // 746800123
console.log(escrow.appAddress); // "ABCD..."
```

## Available Helpers

```typescript
// Get specific contracts
getActiveEscrowContract()        // Active escrow (V5 after deployment)
getActiveMarketplaceContract()   // Active marketplace
getActiveRegistryContract()      // Active registry
getLendingContract()             // Lending contract

// Get all contracts
getAllActiveContracts()          // All active contracts
getAllDeprecatedContracts()      // All deprecated contracts

// Get by name
getContractByName('ESCROW_V5')   // Specific contract
```

## Benefits

✅ **Single Source of Truth**: All contract IDs in one JSON file  
✅ **Automatic Updates**: Deployment scripts update config automatically  
✅ **Type Safety**: TypeScript wrapper provides autocomplete and validation  
✅ **Version Control**: Track all deployments in git  
✅ **Easy Rollback**: Keep deprecated contracts for emergency fallback  
✅ **Audit Trail**: deployments.md provides human-readable history  

## Deprecating a Contract

### Option 1: Auto-deprecate during deployment
The deployment script automatically deprecates old contracts.

### Option 2: Manual deprecation
```bash
node scripts/update-contracts.js NEW_CONTRACT 123456 "ADDR..." --deprecate OLD_CONTRACT
```

This:
1. Moves OLD_CONTRACT from `active` to `deprecated`
2. Adds `deprecatedAt` timestamp
3. Adds `reason` field explaining why
4. Updates deployments.md

## Emergency: Revert to Old Contract

If V5 has issues, quickly revert:

```typescript
// In contracts.ts, modify getActiveEscrowContract():
export function getActiveEscrowContract(): ContractConfig {
  // Emergency: Use V4 instead of V5
  return CONTRACTS.deprecated.ESCROW_V4;
}
```

No need to update App IDs in multiple places!

## Example Workflow

```bash
# 1. Deploy V5
cd projects/atitans1-contracts
algokit project deploy testnet

# Deployment automatically:
# - Creates V5 contract
# - Updates contracts.json: ESCROW_V5.appId = 746800123
# - Moves ESCROW_V4 to deprecated
# - Logs to deployments.md

# 2. Frontend automatically uses V5
# No manual updates needed!

# 3. Verify
cat ../atitans1-frontend/src/config/contracts.json
```

## Verification

After deployment, verify:

```bash
# Check contracts.json
cat projects/atitans1-frontend/src/config/contracts.json

# Check deployment history
cat projects/atitans1-frontend/src/config/deployments.md

# Test frontend
cd projects/atitans1-frontend
npm run dev
```

## Troubleshooting

### Auto-update failed?
Manually run:
```bash
node scripts/update-contracts.js <KEY> <APP_ID> <ADDRESS> --deprecate <OLD_KEY>
```

### Wrong contract deployed?
Update contracts.json manually, then commit.

### Need to rollback?
Edit `getActiveEscrowContract()` in contracts.ts to return the old contract.

---

**Remember**: After deployment, only `contracts.json` needs updating. Everything else is automatic! 🎉
