# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AlgoKit monorepo workspace for developing Algorand decentralized applications. It contains smart contracts written in Algorand TypeScript and a React frontend.

### Structure

- Root: AlgoKit workspace configuration (`.algokit.toml`)
- `projects/atitans1-contracts/`: Smart contract development using Algorand TypeScript
- `projects/atitans1-frontend/`: React frontend with wallet integration

## Official Documentation Links

### Core Algorand & AlgoKit
- **AlgoKit CLI**: https://github.com/algorandfoundation/algokit-cli
- **AlgoKit Utils TypeScript**: https://github.com/algorandfoundation/algokit-utils-ts
- **Algorand Developer Portal**: https://dev.algorand.co/
- **Algorand TypeScript (Puya-TS)**: https://github.com/algorandfoundation/puya-ts

### Development Tools
- **AlgoKit Project Management**: https://github.com/algorandfoundation/algokit-cli/blob/main/docs/features/project/run.md
- **Smart Contract Debugging**: https://github.com/algorandfoundation/algokit-avm-vscode-debugger
- **Client Generation**: https://github.com/algorandfoundation/algokit-client-generator

### Frontend Integration
- **use-wallet React Hook**: https://github.com/txnlab/use-wallet
- **Algorand SDK**: https://github.com/algorandfoundation/js-algorand-sdk

## Development Commands

### Workspace-Level Commands
```bash
# Bootstrap all projects (run after cloning or dependency changes)
algokit project bootstrap all

# Build all projects
algokit project run build

# Deploy contracts to LocalNet  
algokit project deploy localnet
```

### Smart Contracts (`projects/atitans1-contracts/`)
```bash
# Build contracts and generate client files
npm run build

# Deploy with hot reloading (development)
npm run deploy

# Deploy (CI/production)
npm run deploy:ci

# Type checking
npm run check-types

# Build specific contract
algokit project run build -- contract_name

# Deploy specific contract
algokit project deploy localnet -- contract_name
```

### Frontend (`projects/atitans1-frontend/`)
```bash
# Generate app clients from contracts and start dev server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## Architecture

### Smart Contracts
- Language: Algorand TypeScript (Puya-TS)
- Location: `projects/atitans1-contracts/smart_contracts/`
- Artifacts: Generated in `smart_contracts/artifacts/`
- Client Generation: TypeScript clients auto-generated via AlgoKit
- Deployment Pattern: Uses AlgoKit Utils with Factory pattern

#### Contract Structure
Each contract folder contains:
- `contract.algo.ts`: Main contract logic
- `deploy-config.ts`: Deployment configuration
- Generated client files in `artifacts/` after build

#### Standard Deployment Pattern
```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ContractFactory } from '../artifacts/contract_name/ContractClient'

const algorand = AlgorandClient.fromEnvironment()
const deployer = await algorand.account.fromEnvironment('DEPLOYER')

const factory = algorand.client.getTypedAppFactory(ContractFactory, {
  defaultSender: deployer.addr,
})

const { appClient, result } = await factory.deploy({ 
  onUpdate: 'append', 
  onSchemaBreak: 'append' 
})
```

### Frontend
- Framework: React + TypeScript + Vite
- Styling: Tailwind CSS + daisyUI  
- Wallet Integration: `@txnlab/use-wallet` with multiple providers
- Client Integration: Auto-generated TypeScript clients from contracts

#### Contract Client Integration
1. Contracts compile to ARC34 app specifications
2. `npm run build` generates TypeScript clients
3. `npm run dev` links contracts and starts dev server
4. Clients available in `src/contracts/` for import

## Key Files

- `.algokit.toml`: Workspace configuration
- `projects/atitans1-contracts/smart_contracts/index.ts`: Contract deployment orchestration
- `projects/atitans1-frontend/src/App.tsx`: Main React app with wallet setup
- `projects/atitans1-frontend/package.json`: Frontend build scripts with client generation

## Environment Setup

1. Requires AlgoKit CLI 2.5+ and Node.js 22+
2. Uses LocalNet for development (Docker required)
3. Environment files: `.env.localnet`, `.env.testnet`, `.env.mainnet`
4. Generate env files: `algokit generate env-file -a target_network localnet`

## TypeScript Requirements

**CRITICAL: All development must be done in TypeScript (.ts/.tsx files), never JavaScript (.js/.jsx files)**

### Why TypeScript Only
- Smart contracts are written in Algorand TypeScript (Puya-TS)
- Generated clients are TypeScript with full type safety
- Frontend uses TypeScript for type-safe Algorand SDK integration
- AlgoKit Utils provides comprehensive TypeScript types
- Prevents runtime errors through compile-time type checking

### File Extension Requirements
- **Smart Contracts**: `.algo.ts` (Algorand TypeScript)
- **Deployment Scripts**: `deploy-config.ts` (never `.js`)
- **Frontend Components**: `.tsx` for React components, `.ts` for utilities
- **Test Files**: `.test.ts` or `.spec.ts`
- **Configuration**: TypeScript config files where possible

### Type Safety Benefits
- **Contract Methods**: Full type safety for method calls and arguments
- **State Variables**: Typed global/local state access
- **AlgoKit Utils**: Typed client interactions and transaction building
- **Frontend**: Type-safe wallet integration and contract calls
- **Error Prevention**: Catch type mismatches before deployment

### TypeScript Configuration
- Contracts: Uses `@tsconfig/node22` for Node.js 22+ compatibility
- Frontend: React TypeScript configuration via Vite
- Strict mode enabled across all TypeScript configurations
- AlgoKit generators create TypeScript files by default

## Compiled Contracts & Deployment Patterns

### Available Contracts

1. **HelloWorld** (Basic Example)
   - Location: `smart_contracts/hello_world/`
   - Purpose: Simple greeting contract for testing AlgoKit patterns
   - Methods: `hello(name: string): string`
   - Deployment: Standard Factory pattern with 1 ALGO funding
   - Client: `HelloWorldClient.ts` with `HelloWorldFactory`

2. **NegotiableBL** (Bills of Lading v1)
   - Location: `smart_contracts/negotiable_bl/`
   - Purpose: NFT-based Bills of Lading for Real World Assets
   - Methods: `hello()`, `createBL()`, `listBL()`, `transferBL()`, `getInfo()`
   - Deployment: Factory pattern with 1 ALGO funding
   - Client: `NegotiableBLClient.ts` with `NegotiableBlFactory`

3. **NegotiableBLTrial** (Testing Version)
   - Location: `smart_contracts/negotiable_bl_trial/`
   - Purpose: Trial version for testing BL functionality
   - Similar to NegotiableBL with variations for testing

4. **NegotiableFinBLV1** (Financial BL v1.0)
   - Location: `smart_contracts/negotiable_fin_bl_v1/`
   - Purpose: Advanced financial Bills of Lading with compliance features
   - State Variables: `blCounter`, `totalValueLocked` (GlobalState<uint64>)
   - Methods: Complex financial BL operations with yield calculations
   - Deployment: Factory pattern with 10 ALGO funding (more complex contract)
   - Client: `NegotiableFinBLV1Client.ts` with `NegotiableFinBlv1Factory`

### Standard Deployment Execution Trace

Each contract follows the same deployment pattern:

1. **Environment Setup**
   ```typescript
   const algorand = AlgorandClient.fromEnvironment()
   const deployer = await algorand.account.fromEnvironment('DEPLOYER')
   ```

2. **Factory Creation**
   ```typescript
   const factory = algorand.client.getTypedAppFactory(ContractFactory, {
     defaultSender: deployer.addr,
   })
   ```

3. **Deploy with Options**
   ```typescript
   const { appClient, result } = await factory.deploy({ 
     onUpdate: 'append', 
     onSchemaBreak: 'append' 
   })
   ```

4. **Fund New Apps**
   ```typescript
   if (['create', 'replace'].includes(result.operationPerformed)) {
     await algorand.send.payment({
       amount: (1-10).algo(), // Varies by contract complexity
       sender: deployer.addr,
       receiver: appClient.appAddress,
     })
   }
   ```

5. **Test Contract Methods**
   ```typescript
   const response = await appClient.send.methodName({
     args: { /* method arguments */ },
   })
   ```

### Generated Artifacts Structure

Each compiled contract produces:
- `Contract.approval.teal` - Main contract logic
- `Contract.clear.teal` - Clear state program  
- `Contract.arc32.json` - ARC32 application specification
- `Contract.arc56.json` - ARC56 application specification
- `Contract.approval.puya.map` - Source mapping for debugging
- `ContractClient.ts` - TypeScript client with Factory

### Factory Naming Convention

Generated factory names follow pattern: `{ContractName}Factory`
- HelloWorld → `HelloWorldFactory`
- NegotiableBL → `NegotiableBlFactory`
- NegotiableFinBLV1 → `NegotiableFinBlv1Factory` (note: lowercase 'v')

## Blockchain Integration Requirements

**CRITICAL: NO MOCK TRANSACTIONS - ALL BLOCKCHAIN OPERATIONS MUST BE REAL**

### Absolute Requirements
- **NEVER create mock transaction IDs** - All transactions must use real Algorand SDK
- **NEVER use simulated blockchain calls** - Always use actual algosdk methods
- **NEVER generate fake transaction responses** - Use real blockchain confirmations
- **ALL transaction IDs must be verifiable** on Algorand explorers (LocalNet/TestNet/MainNet)

### Real Transaction Implementation
- Use actual `algosdk.makePaymentTxnWithSuggestedParamsFromObject()` calls
- Implement real wallet signing with `@txnlab/use-wallet`
- Wait for actual blockchain confirmation with `algosdk.waitForConfirmation()`
- Return real transaction IDs from blockchain responses
- Generate real explorer URLs that work with actual transaction data

### Transaction Verification Standards
- Every transaction ID must be verifiable on blockchain explorers
- LocalNet: `http://localhost:8980/v2/transactions/{txId}`
- TestNet: `https://testnet.algoexplorer.io/tx/{txId}`
- MainNet: `https://allo.info/tx/{txId}`

### Code Quality Requirements
- Use proper TypeScript interfaces for all blockchain interactions
- Implement comprehensive error handling for network failures
- Never bypass actual transaction signing processes
- Always validate transaction confirmations before returning success

**If blockchain functionality is temporarily disabled for compilation, clearly document it as "TEMPORARY" and prioritize restoring real blockchain integration immediately.**

## Troubleshooting

- Always run `npm run build` in contracts directory after contract changes
- Client files must be regenerated for Factory exports to work properly
- Use exact Factory naming from generated client files (case-sensitive)
- Check existing working contracts (`hello_world/`) for reference patterns
- GlobalState variables must be initialized with `hasValue` checks
- Complex contracts require more initial funding (see NegotiableFinBLV1: 10 ALGO vs simple contracts: 1 ALGO)
- **NEVER create or modify JavaScript files** - always use TypeScript equivalents
- Run `npm run check-types` to verify TypeScript compilation before deployment
- AlgoKit commands expect TypeScript files and may fail with JavaScript files