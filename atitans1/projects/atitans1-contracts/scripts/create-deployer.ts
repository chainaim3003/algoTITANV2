#!/usr/bin/env ts-node

import { mnemonicToSecretKey, generateAccount, secretKeyToMnemonic } from 'algosdk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Creates a new deployer account for testnet deployment
 * This is the SIMPLEST way to create a deployer account
 */
async function createDeployerAccount() {
  console.log('🚀 Creating new deployer account...\n');
  
  // Generate a new account
  const account = generateAccount();
  
  // Convert secret key to mnemonic
  const mnemonic = secretKeyToMnemonic(account.sk);
  
  console.log('✅ New deployer account created!');
  console.log('📋 Account Details:');
  console.log('─'.repeat(50));
  console.log(`Address: ${account.addr}`);
  console.log(`Mnemonic: ${mnemonic}`);
  console.log('─'.repeat(50));
  
  // Update .env.testnet file
  const envPath = path.join(__dirname, '..', '.env.testnet');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Replace the deployer mnemonic
  envContent = envContent.replace(
    /DEPLOYER_MNEMONIC=.*/,
    `DEPLOYER_MNEMONIC=${mnemonic}`
  );
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Updated .env.testnet with new deployer account');
  console.log('\n📝 Next Steps:');
  console.log('1. Fund this account with TestNet ALGO using the dispenser:');
  console.log('   https://testnet.algoexplorer.io/dispenser');
  console.log(`2. Send ALGO to: ${account.addr}`);
  console.log('3. Run deployment: npm run deploy');
  
  console.log('\n🔐 IMPORTANT: Save your mnemonic securely!');
  console.log('⚠️  Anyone with this mnemonic can control your account.');
  
  return {
    address: account.addr,
    mnemonic: mnemonic
  };
}

// Run the script
if (require.main === module) {
  createDeployerAccount()
    .then(() => {
      console.log('\n🎉 Deployer account setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error creating deployer account:', error);
      process.exit(1);
    });
}

export { createDeployerAccount };
