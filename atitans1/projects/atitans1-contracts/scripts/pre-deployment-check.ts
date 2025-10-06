/**
 * Pre-deployment Check for V5 TestNet Deployment
 * 
 * Verifies all prerequisites before deploying
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load TestNet environment
dotenv.config({ path: path.join(__dirname, '..', '.env.testnet') })

async function checkPrerequisites() {
  console.log('====================================')
  console.log('🔍 Pre-Deployment Checks')
  console.log('====================================')
  console.log('')
  
  let allChecksPassed = true
  
  // Check 1: .env.testnet exists
  console.log('1️⃣  Checking .env.testnet file...')
  const envPath = path.join(__dirname, '..', '.env.testnet')
  if (fs.existsSync(envPath)) {
    console.log('   ✅ .env.testnet file found')
  } else {
    console.log('   ❌ .env.testnet file NOT found')
    allChecksPassed = false
  }
  console.log('')
  
  // Check 2: DEPLOYER_MNEMONIC exists
  console.log('2️⃣  Checking DEPLOYER_MNEMONIC...')
  const mnemonic = process.env.DEPLOYER_MNEMONIC
  if (mnemonic) {
    const wordCount = mnemonic.trim().split(/\s+/).length
    if (wordCount === 25) {
      console.log('   ✅ DEPLOYER_MNEMONIC found (25 words)')
    } else {
      console.log(`   ⚠️  DEPLOYER_MNEMONIC found but has ${wordCount} words (should be 25)`)
      allChecksPassed = false
    }
  } else {
    console.log('   ❌ DEPLOYER_MNEMONIC not found in .env.testnet')
    allChecksPassed = false
  }
  console.log('')
  
  // Check 3: TestNet connectivity
  console.log('3️⃣  Checking TestNet connectivity...')
  try {
    const algorand = AlgorandClient.testNet()
    const status = await algorand.client.algod.status().do()
    console.log(`   ✅ Connected to TestNet (Round: ${status['last-round']})`)
  } catch (error: any) {
    console.log(`   ❌ Cannot connect to TestNet: ${error.message}`)
    allChecksPassed = false
  }
  console.log('')
  
  // Check 4: Deployer account balance
  if (mnemonic) {
    console.log('4️⃣  Checking deployer account balance...')
    try {
      const algorand = AlgorandClient.testNet()
      const deployer = algorand.account.fromMnemonic(mnemonic)
      console.log(`   📝 Deployer Address: ${deployer.addr}`)
      
      const accountInfo = await algorand.client.algod.accountInformation(deployer.addr).do()
      const balance = accountInfo.amount / 1_000_000
      console.log(`   💰 Balance: ${balance.toFixed(6)} ALGO`)
      
      if (balance >= 1.0) {
        console.log('   ✅ Sufficient balance for deployment')
      } else {
        console.log('   ⚠️  Low balance. Recommended: at least 1 ALGO')
        console.log('   💡 Get TestNet ALGO: https://bank.testnet.algorand.network/')
        allChecksPassed = false
      }
    } catch (error: any) {
      console.log(`   ❌ Cannot check balance: ${error.message}`)
      allChecksPassed = false
    }
  } else {
    console.log('4️⃣  Skipping balance check (no mnemonic)')
  }
  console.log('')
  
  // Check 5: Compiled contracts exist
  console.log('5️⃣  Checking compiled contracts...')
  const artifactsPath = path.join(__dirname, '..', 'smart_contracts', 'artifacts', 'atomic_marketplace_escrow_v5')
  if (fs.existsSync(artifactsPath)) {
    const approvalPath = path.join(artifactsPath, 'approval.teal')
    const clearPath = path.join(artifactsPath, 'clear.teal')
    
    if (fs.existsSync(approvalPath) && fs.existsSync(clearPath)) {
      console.log('   ✅ Compiled contract artifacts found')
    } else {
      console.log('   ⚠️  Contract artifacts incomplete')
      console.log('   💡 Run: npm run build')
      allChecksPassed = false
    }
  } else {
    console.log('   ⚠️  Contract artifacts not found')
    console.log('   💡 Run: npm run build')
    allChecksPassed = false
  }
  console.log('')
  
  // Summary
  console.log('====================================')
  if (allChecksPassed) {
    console.log('✅ All checks passed!')
    console.log('')
    console.log('🚀 Ready to deploy!')
    console.log('')
    console.log('Run: deploy-v5-testnet.bat')
    console.log('Or:  npx tsx scripts/deploy-v5-testnet.ts')
  } else {
    console.log('❌ Some checks failed')
    console.log('')
    console.log('Please fix the issues above before deploying.')
  }
  console.log('====================================')
  
  return allChecksPassed
}

// Run checks
checkPrerequisites()
  .then((passed) => {
    process.exit(passed ? 0 : 1)
  })
  .catch((error) => {
    console.error('Error running checks:', error)
    process.exit(1)
  })
