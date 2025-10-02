import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicMarketplaceEscrowV4Factory } from '../artifacts/atomic_marketplace_escrow_v4/AtomicMarketplaceEscrowV4Client'

export async function deploy() {
  console.log('====================================')
  console.log('🚀 Deploying Atomic Marketplace Escrow V4...')
  console.log('====================================')
  
  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')
  
  console.log(`📝 Deployer: ${deployer.addr}`)
  
  // Treasury address - use deployer for now
  const treasuryAddress = deployer.addr
  
  // Settlement: 0 for ALGO, or asset ID for USDCa
  const settlementAssetId = 0  // Start with ALGO
  
  console.log(`💵 Settlement: ${settlementAssetId === 0 ? 'ALGO (native)' : `Asset ${settlementAssetId}`}`)
  console.log(`💰 Treasury: ${treasuryAddress}`)
  
  try {
    // Use Factory pattern like V3
    const factory = algorand.client.getTypedAppFactory(AtomicMarketplaceEscrowV4Factory, {
      defaultSender: deployer.addr,
    })
    
    console.log('📦 Deploying contract...')
    
    const { appClient, result } = await factory.deploy({
      onUpdate: 'append',
      onSchemaBreak: 'append',
    })
    
    console.log(`✅ Contract deployed!`)
    console.log(`📍 App ID: ${appClient.appClient.appId}`)
    console.log(`📍 App Address: ${appClient.appAddress}`)
    
    // If app was just created or replaced, initialize it
    if (['create', 'replace'].includes(result.operationPerformed)) {
      // Fund the app account FIRST for box storage and inner transactions
      console.log('💰 Funding app account...')
      await algorand.send.payment({
        amount: (1).algo(), // 1 ALGO for box storage + operations
        sender: deployer.addr,
        receiver: appClient.appAddress,
      })
      console.log(`✅ App account funded with 1 ALGO`)
      
      // Initialize the contract
      console.log('⚙️  Initializing contract...')
      
      await appClient.send.initialize({
        args: {
          settlementAssetId: BigInt(settlementAssetId),
          treasuryAddress: treasuryAddress,
        },
        sender: deployer,  // Add explicit sender
        sendParams: {
          fee: (2000).microAlgo(), // Higher fee for box operations
        },
      })
      
      console.log('✅ Contract initialized!')
    } else {
      console.log('ℹ️  Contract already deployed and initialized, skipping initialization')
    }
    
    console.log('✅ AtomicMarketplaceEscrowV4 ready!')
    console.log(`📍 App ID: ${appClient.appClient.appId}`)
    console.log(`📍 App Address: ${appClient.appAddress}`)
    console.log(`💵 Settlement: ${settlementAssetId === 0 ? 'ALGO (native)' : `Asset ${settlementAssetId}`}`)
    console.log(`💰 Treasury: ${treasuryAddress}`)
    console.log(`⚖️  Default Rates:`)
    console.log(`   - Regulator Tax: 5.00%`)
    console.log(`   - Regulator Refund: 2.00%`)
    console.log(`   - Marketplace Fee: 0.25%`)
    console.log('')
    console.log('🎉 Escrow V4 ready for trades!')
    
    return {
      appId: appClient.appClient.appId,
      appAddress: appClient.appAddress,
      operationPerformed: result.operationPerformed,
      settlementAssetId,
      treasuryAddress,
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error)
    throw error
  }
}
