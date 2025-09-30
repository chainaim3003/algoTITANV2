#!/bin/bash
# Enhanced BL Smart Contract Build & Deploy Script
# Deploys: NegotiableBLTrial and Enhanced NegotiableFinBLV1 with Real ASA Tokenization

echo "=== AlgoTITANS BL Smart Contract Deployment ==="
echo "Enhanced with Real ASA Tokenization Capabilities"
echo ""

# Build all contracts
echo "🔨 Building smart contracts..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""

# Check which contracts were built
echo "📦 Generated contract artifacts:"
ls -la smart_contracts/artifacts/

echo ""

# Deploy specific contracts with enhanced testing
echo "🚀 Deploying contracts..."

echo "--- Deploying NegotiableBLTrial (Basic Marketplace) ---"
npm run deploy:ci negotiable_bl_trial

echo ""
echo "--- Deploying Enhanced NegotiableFinBLV1 (Real ASA Tokenization) ---"
npm run deploy:ci negotiable_fin_bl_v1

echo ""
echo "=== Deployment Summary ==="
echo "✅ NegotiableBLTrial: Basic BL marketplace with state management"
echo "✅ NegotiableFinBLV1: Advanced BL with real ASA creation and USDC transfers"
echo ""
echo "🎯 Ready for UI integration demonstrating:"
echo "   • Real BL asset creation (Algorand Standard Assets)"
echo "   • Asset transfers between wallets" 
echo "   • USDC stablecoin payments"
echo "   • Cross-border settlement capabilities"
echo ""
echo "📡 Networks supported: LocalNet, TestNet, MainNet"
echo "🔗 Explorer integration: AlgoExplorer links for all transactions"
