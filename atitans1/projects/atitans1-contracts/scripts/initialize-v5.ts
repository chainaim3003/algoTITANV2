import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicMarketplaceEscrowV5Factory } from '../smart_contracts/artifacts/atomic_marketplace_escrow_v4/AtomicMarketplaceEscrowV5Client'

async function initializeContract() {
  console.log('====================================')
  console.log('🔧 Manually Initializing Escrow V5...')
  console.log('====================================')
  
  const APP_ID = 746822940
  const APP_ADDRESS = 'O5PNOOQQXP3FR2PYWJQ7TY5FFEUSMXENLFRIFEY6RBDBHPDDJUC4BWDBJ4'
  
  try {
    const algorand = AlgorandClient.fromEnvironment()
    const deployer = await algorand.account.fromEnvironment('DEPLOYER')
    
    console.log(`📝 Deployer: ${deployer.addr}`)
    console.log(`📍 App ID: ${APP_ID}`)
    console.log(`📍 App Address: ${APP_ADDRESS}`)
    
    // Create client for existing app
    const factory = algorand.client.getTypedAppFactory(AtomicMarketplaceEscrowV5Factory, {
      defaultSender: deployer.addr,
    })
    
    const appClient = factory.getAppClientById({
      id: BigInt(APP_ID),
      name: 'AtomicMarketplaceEscrowV5'
    })
    
    // Treasury and settlement config
    const treasuryAddress = deployer.addr
    const settlementAssetId = 0  // ALGO
    
    console.log(`💵 Settlement: ${settlementAssetId === 0 ? 'ALGO (native)' : `Asset ${settlementAssetId}`}`)
    console.log(`💰 Treasury: ${treasuryAddress}`)
    console.log('')
    console.log('⚙️  Calling initialize method...')
    
    const result = await appClient.send.initialize({
      args: {
        settlementAssetId: BigInt(settlementAssetId),
        treasuryAddress: treasuryAddress,
      },
      sender: deployer.addr,
      sendParams: {
        fee: (2000).microAlgo(), // Higher fee for box operations
      },
    })
    
    console.log(`✅ Initialize transaction confirmed!`)
    console.log(`📍 Txn ID: ${result.txIds[0]}`)
    console.log('')
    console.log('✅ Contract initialized successfully!')
    console.log(`⚖️  Default Rates:`)
    console.log(`   - Regulator Tax: 5.00%`)
    console.log(`   - Regulator Refund: 2.00%`)
    console.log(`   - Marketplace Fee: 0.25%`)
    console.log('')
    console.log('🎉 Escrow V5 is now ready for trades!')
    console.log('')
    console.log('Verify at: https://testnet.explorer.perawallet.app/application/746822940')
    
  } catch (error: any) {
    console.error('❌ Initialization failed:', error.message)
    throw error
  }
}

initializeContract()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
