import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';

export interface WorkingEBLParams {
  instrumentNumber: string;
  exporterAddress: string;
  cargoDescription: string;
  cargoValue: number;
  sender: string;
  signer: (txns: algosdk.Transaction[], indexesToSign?: number[]) => Promise<(Uint8Array | null)[]>;
}

export interface WorkingEBLResult {
  txId: string;
  confirmedRound: number;
  explorerUrl: string;
  assetId: number;
  status: string;
}

export async function createWorkingEBL(params: WorkingEBLParams): Promise<WorkingEBLResult> {
  console.log('Creating eBL ASA with AlgoKit:', params);
  
  try {
    // Get algod config and create AlgorandClient
    const algodConfig = getAlgodConfigFromViteEnvironment();
    
    const algorand = AlgorandClient.fromClients({
      algod: new algosdk.Algodv2(
        String(algodConfig.token),
        algodConfig.server,
        algodConfig.port
      )
    });
    
    // Create ASA using AlgorandClient
    const result = await algorand.send.assetCreate({
      sender: params.sender,
      assetName: 'eBL',
      unitName: 'eBL', 
      total: BigInt(1),
      decimals: 0,
      defaultFrozen: false,
      manager: params.exporterAddress,
      reserve: params.exporterAddress,
      freeze: params.exporterAddress,
      clawback: params.exporterAddress,
      signer: {
        addr: params.sender,
        signer: async (txnGroup: algosdk.Transaction[]) => {
          const signedTxns = await params.signer(txnGroup);
          return signedTxns;
        }
      }
    });
    
    console.log('ASA created successfully:', {
      txId: result.txIds[0],
      assetId: result.assetId,
      confirmedRound: result.confirmation?.confirmedRound
    });
    
    return {
      txId: result.txIds[0],
      confirmedRound: result.confirmation?.confirmedRound || 0,
      explorerUrl: `https://testnet.algoexplorer.io/tx/${result.txIds[0]}`,
      assetId: Number(result.assetId),
      status: 'success'
    };
    
  } catch (error) {
    console.error('Error creating eBL ASA:', error);
    throw error;
  }
}