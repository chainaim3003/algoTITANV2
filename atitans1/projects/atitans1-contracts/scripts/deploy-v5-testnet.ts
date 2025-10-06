/**
 * Deploy AtomicMarketplaceEscrowV5 to TestNet
 * 
 * This script deploys the V5 contract to TestNet following V4's pattern
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicMarketplaceEscrowV5Factory } from '../smart_contracts/artifacts/atomic_marketplace_escrow_v5/AtomicMarketplaceEscrowV5Client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load TestNet environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.testnet') })

async function deployEscrowV5() {
  console.log('====================================')
  console.log('🚀 Deploying Escrow V5 to TestNet...')
  console.log('====================================')
  console.log('')
  
  try {
    // Initialize TestNet client (following V4 pattern)
    const algorand = AlgorandClient.testNet()
    
    // Get deployer account from environment
    const deployerMnemonic = process.env.DEPLOYER_MNEMONIC
    if (!deployerMnemonic) {
      throw new Error('DEPLOYER_MNEMONIC not found in .env.testnet')
    }
    
    const deployer = algorand.account.fromMnemonic(deployerMnemonic)
    
    console.log(`📝 Deployer: ${deployer.addr}`)
    console.log('')
    
    // Check deployer balance
    const accountInfo = await algorand.client.algod.accountInformation(deployer.addr).do()
    const balance = accountInfo.amount / 1_000_000
    console.log(`💰 Deployer Balance: ${balance.toFixed(6)} ALGO`)
    
    if (balance < 1) {
      console.warn('⚠️  Warning: Low balance. You may need more ALGO for deployment.')
    }
    console.log('')
    
    // Create typed app factory
    const factory = algorand.client.getTypedAppFactory(AtomicMarketplaceEscrowV5Factory, {
      defaultSender: deployer.addr,
    })
    
    console.log('📦 Deploying smart contract...')
    console.log('')
    
    // Deploy the contract
    const { appClient, result } = await factory.deploy({
      deployTimeParams: {},
      createParams: {
        sender: deployer,
      },
      onSchemaBreak: 'replace',
      onUpdate: 'update',
    })
    
    const appId = Number(appClient.appId)
    const appAddress = (await appClient.appClient.getAppReference()).appAddress
    
    console.log('✅ Contract deployed successfully!')
    console.log('')
    console.log(`📍 App ID: ${appId}`)
    console.log(`📍 App Address: ${appAddress}`)
    
    if (result.txIds && result.txIds.length > 0) {
      console.log(`📍 Transaction ID: ${result.txIds[0]}`)
    }
    console.log('')
    
    // Fund the application account for MBR and inner transactions
    console.log('💰 Funding application account...')
    const fundAmount = AlgorandClient.algos(0.5) // 0.5 ALGO for operations
    
    await algorand.send.payment({
      sender: deployer.addr,
      receiver: appAddress,
      amount: fundAmount,
    })
    
    console.log('✅ Application account funded with 0.5 ALGO')
    console.log('')
    
    // Initialize the contract
    console.log('⚙️  Initializing contract...')
    
    const treasuryAddress = deployer.addr  // Use deployer as treasury
    const settlementAssetId = 0  // 0 = ALGO
    
    await appClient.send.initialize({
      args: {
        settlementAssetId: BigInt(settlementAssetId),
        treasuryAddress: treasuryAddress,
      },
      sender: deployer,
      sendParams: {
        fee: (2000).microAlgo(), // Higher fee for box operations
      },
    })
    
    console.log('✅ Contract initialized!')
    console.log('')
    console.log('📊 Configuration:')
    console.log(`   - Settlement: ${settlementAssetId === 0 ? 'ALGO (native)' : `Asset ${settlementAssetId}`}`)
    console.log(`   - Treasury: ${treasuryAddress}`)
    console.log(`   - Next Trade ID: 1`)
    console.log('')
    console.log('⚖️  Default Rates:')
    console.log(`   - Regulator Tax: 5.00%`)
    console.log(`   - Regulator Refund: 2.00%`)
    console.log(`   - Marketplace Fee: 0.25%`)
    console.log('')
    
    // Save deployment info
    const deploymentInfo = {
      network: 'testnet',
      appId,
      appAddress,
      deployerAddress: deployer.addr,
      treasuryAddress,
      settlementAssetId,
      deployedAt: new Date().toISOString(),
      explorerUrl: `https://testnet.explorer.perawallet.app/application/${appId}`,
      rates: {
        regulatorTaxRate: 5.0,
        regulatorRefundRate: 2.0,
        marketplaceFeeRate: 0.25,
      }
    }
    
    console.log('💾 Deployment Info:')
    console.log(JSON.stringify(deploymentInfo, null, 2))
    console.log('')
    
    // Write to file
    const deploymentFilePath = path.join(__dirname, '..', 'deployment-info-v5-testnet.json')
    fs.writeFileSync(
      deploymentFilePath,
      JSON.stringify(deploymentInfo, null, 2)
    )
    
    console.log(`✅ Deployment info saved to: deployment-info-v5-testnet.json`)
    console.log('')
    console.log('🎉 Escrow V5 is ready for trades!')
    console.log('')
    console.log(`🔍 View on Explorer: https://testnet.explorer.perawallet.app/application/${appId}`)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Next Steps:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`1. Update frontend .env.local with:`)
    console.log(`   VITE_ESCROW_APP_ID=${appId}`)
    console.log(`   VITE_NETWORK=testnet`)
    console.log('')
    console.log(`2. Test creating trades in the frontend`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return deploymentInfo
    
  } catch (error: any) {
    console.error('')
    console.error('❌ Deployment failed:', error.message)
    if (error.response) {
      console.error('Response:', error.response)
    }
    throw error
  }
}

// Run deployment
deployEscrowV5()
  .then(() => {
    console.log('')
    console.log('✅ Deployment script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('❌ Deployment script failed')
    console.error(error)
    process.exit(1)
  })
