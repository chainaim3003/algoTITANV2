# V3 Address Type Fix

## Fixed Issues

The compilation errors were caused by type mismatches when passing `arc4.Address` to asset operations that expect `bytes`.

### Changes Made:

1. **Asset Config Parameters**: Changed all address parameters to use `.bytes` property:
   - `manager: exporterAddress.bytes`
   - `reserve: exporterAddress.bytes` 
   - `freeze: exporterAddress.bytes`
   - `clawback: exporterAddress.bytes`

2. **Asset Transfer Parameters**: Updated receiver to use `.bytes`:
   - `assetReceiver: exporterAddress.bytes`
   - `assetReceiver: newHolderAddress.bytes`

## Try Building Again:

```bash
npm run build
```

The V3 contracts should now compile successfully with proper address type handling!
