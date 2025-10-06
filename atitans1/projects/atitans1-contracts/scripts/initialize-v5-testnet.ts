/**
 * Initialize AtomicMarketplaceEscrowV5 on TestNet
 * 
 * This script initializes the already deployed V5 contract
 * Following the pattern that worked for V4
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicMarketplaceEscrowV5Factory } from '../smart_contracts/artifacts/atomic_marketplace_escrow_v4/AtomicMarketplaceEscrowV5Client'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load TestNet environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.testnet') })

async function initializeContract() {
  console.log('====================================')
  console.log('🔧 Initializing Escrow V5 on TestNet...')
  console.log('====================================')
  
  const APP_ID = 746822940
  const APP_ADDRESS = 'O5PNOOQQXP3FR2PYWJQ7TY5FFEUSMXENLFRIFEY6RBDBHPDDJUC4BWDBJ4'
  
  try {
    // Initialize TestNet client (same as V4)
    const algorand = AlgorandClient.testNet()
    
    // Get deployer account from environment
    const deployerMnemonic = process.env.DEPLOYER_MNEMONIC
    if (!deployerMnemonic) {
      throw new Error('DEPLOYER_MNEMONIC not found in .env.testnet')
    }
    
    const deployer = algorand.account.fromMnemonic(deployerMnemonic)
    
    console.log(`📝 Deployer: ${deployer.addr}`)
    console.log(`📍 App ID: ${APP_ID}`)
    console.log(`📍 App Address: ${APP_ADDRESS}`)
    
    // Create typed app factory
    const factory = algorand.client.getTypedAppFactory(AtomicMarketplaceEscrowV5Factory, {
      defaultSender: deployer.addr,
    })
    
    // Get the app client for the existing deployed contract
    const appClient = factory.getAppClientById({
      id: BigInt(APP_ID),
      name: 'AtomicMarketplaceEscrowV5'
    })
    
    // Configuration
    const treasuryAddress = deployer.addr  // Use deployer as treasury
    const settlementAssetId = 0  // 0 = ALGO (native currency)
    
    console.log(`💵 Settlement: ${settlementAssetId === 0 ? 'ALGO (native)' : `Asset ${settlementAssetId}`}`)
    console.log(`💰 Treasury: ${treasuryAddress}`)
    console.log('')
    console.log('⚙️  Calling initialize method...')
    
    // Initialize the contract
    const result = await appClient.send.initialize({
      args: {
        settlementAssetId: BigInt(settlementAssetId),
        treasuryAddress: treasuryAddress,
      },
      sender: deployer,
      sendParams: {
        fee: (2000).microAlgo(), // Higher fee for box operations
      },
    })
    
    console.log(`✅ Initialize transaction confirmed!`)
    console.log(`📍 Txn ID: ${result.txIds[0]}`)
    console.log('')
    console.log('✅ Contract initialized successfully!')
    console.log('')
    console.log(`⚖️  Default Rates (from contract):`)
    console.log(`   - Regulator Tax: 5.00%`)
    console.log(`   - Regulator Refund: 2.00%`)
    console.log(`   - Marketplace Fee: 0.25%`)
    console.log('')
    console.log('🎉 Escrow V5 is now ready for trades!')
    console.log('')
    console.log(`🔍 Verify at: https://testnet.explorer.perawallet.app/application/${APP_ID}`)
    
  } catch (error: any) {
    console.error('❌ Initialization failed:', error.message)
    if (error.response) {
      console.error('Response:', error.response)
    }
    throw error
  }
}

// Run initialization
initializeContract()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed')
    console.error(error)
    process.exit(1)
  })
