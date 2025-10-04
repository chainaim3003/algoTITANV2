import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicMarketplaceEscrowV5Factory } from '../artifacts/atomic_marketplace_escrow_v5/AtomicMarketplaceEscrowV5Client'

export async function deploy() {
  console.log('=== Deploying AtomicMarketplaceEscrowV5 ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER', (1).algo())

  const factory = algorand.client.getTypedAppFactory(AtomicMarketplaceEscrowV5Factory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    deployTimeParams: {},
    createParams: {},
    deleteParams: {},
    updateParams: {},
    onSchemaBreak: 'replace',
    onUpdate: 'update',
  })

  console.log(`App deployed with ID: ${appClient.appId}`)
  
  if (result.txIds && result.txIds.length > 0) {
    console.log(`Transaction ID: ${result.txIds[0]}`)
  } else {
    console.log('No transaction sent (app already up to date)')
  }

  return { appClient, result }
}