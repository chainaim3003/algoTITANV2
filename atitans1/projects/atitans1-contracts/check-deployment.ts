import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { NegotiableFinBlv1Client } from './smart_contracts/artifacts/negotiable_fin_bl_v1/NegotiableFinBLV1Client'

async function checkDeployment() {
  console.log('=== Checking V1 Contract Deployment ===')
  
  try {
    const algorand = AlgorandClient.fromEnvironment()
    
    // Get network details using the documented API
    const network = await algorand.client.network()
    
    console.log('Network Genesis ID:', network.genesisId)
    console.log('Network Genesis Hash:', network.genesisHash)
    console.log('Is TestNet:', network.isTestNet)
    console.log('Is MainNet:', network.isMainNet)
    console.log('Is LocalNet:', network.isLocalNet)
    
    // Try to connect to deployed app
    const appClient = new NegotiableFinBlv1Client({
      algorand,
      appId: 1016,
      defaultSender: 'AY24UQYSO7EUGNYQYTBY5ABLCWVO22VJJC4363LMCUGUGZOCBPPMNRVIUE'
    })
    
    console.log('\nApp ID:', appClient.appId)
    console.log('App Address:', appClient.appAddress)
    
    // Test a contract call to verify deployment
    console.log('\n--- Testing Contract Call ---')
    const response = await appClient.send.hello({
      args: { name: 'Network Check' }
    })
    console.log('Contract Response:', response.return)
    console.log('Transaction ID:', response.txIds[0])
    
    // Determine network type and provide explorer URLs
    if (network.isTestNet) {
      console.log('\n🌐 NETWORK: TESTNET')
      console.log('App Explorer: https://testnet.algoexplorer.io/application/1016')
      console.log('Transaction Explorer: https://testnet.algoexplorer.io/tx/' + response.txIds[0])
    } else if (network.isMainNet) {
      console.log('\n🌐 NETWORK: MAINNET') 
      console.log('App Explorer: https://algoexplorer.io/application/1016')
      console.log('Transaction Explorer: https://algoexplorer.io/tx/' + response.txIds[0])
    } else if (network.isLocalNet) {
      console.log('\n🌐 NETWORK: LOCALNET')
      console.log('Genesis ID:', network.genesisId)
      console.log('No public explorer available for LocalNet')
    } else {
      console.log('\n🌐 NETWORK: UNKNOWN')
      console.log('Genesis ID:', network.genesisId)
    }
    
    console.log('\n✅ Contract is deployed and working!')
    
  } catch (error) {
    console.error('Error checking deployment:', error.message)
    
    // Provide debugging information based on error type
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.log('\n🚨 Network Connection Issue')
      console.log('Possible causes:')
      console.log('1. LocalNet not running (try: algokit localnet start)')
      console.log('2. Network configuration issue')
      console.log('3. Remote node unavailable')
    } else if (error.message.includes('application does not exist')) {
      console.log('\n🚨 App Not Found')
      console.log('App ID 1016 not found on the current network')
    }
  }
}

checkDeployment().catch(console.error)
