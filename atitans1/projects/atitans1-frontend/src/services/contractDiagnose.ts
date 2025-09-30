import algosdk from 'algosdk';
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { getAppId } from '../config/appIds';

export async function diagnoseContract(): Promise<void> {
  const algodConfig = getAlgodConfigFromViteEnvironment();
  const algodClient = new algosdk.Algodv2(
    String(algodConfig.token),
    algodConfig.server,
    algodConfig.port
  );
  
  const appId = getAppId(algodConfig.network, 'TRADE_INSTRUMENT_REGISTRY_V3');
  
  try {
    // Get application info
    const appInfo = await algodClient.getApplicationByID(appId).do();
    
    console.log('=== CONTRACT DIAGNOSTIC ===');
    console.log('App ID:', appId);
    console.log('Creator:', appInfo.params.creator);
    console.log('Global State:');
    
    if (appInfo.params['global-state']) {
      for (const state of appInfo.params['global-state']) {
        const key = Buffer.from(state.key, 'base64').toString();
        const value = state.value;
        console.log(`  ${key}:`, value);
      }
    }
    
    console.log('=== YOUR DEPLOYER ACCOUNT ===');
    console.log('Expected Creator: Q5OXWYKCH75UKRJ2UK32SPGHTCOBAAYTNLN74JDP7LW3AI5F6B4LCGPKQI');
    console.log('Contract Creator:', appInfo.params.creator);
    console.log('Match:', appInfo.params.creator === 'Q5OXWYKCH75UKRJ2UK32SPGHTCOBAAYTNLN74JDP7LW3AI5F6B4LCGPKQI');
    
    return appInfo;
    
  } catch (error) {
    console.error('Contract diagnostic failed:', error);
    throw error;
  }
}
