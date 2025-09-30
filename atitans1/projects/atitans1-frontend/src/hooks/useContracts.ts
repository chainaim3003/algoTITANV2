/**
 * Contracts Integration Hook
 * 
 * Manages connection to all V3 smart contracts
 */
import { useState, useEffect } from 'react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TradeInstrumentRegistryClient } from '../contracts/TradeInstrumentRegistryClient'
import { AtomicMarketplaceV3Client } from '../contracts/AtomicMarketplaceV3Client'
import { ContractClients, V3Config } from '../types/v3-contract-types'

export interface UseContractsResult {
  contracts: ContractClients | null
  loading: boolean
  error: string | null
  reconnect: () => Promise<void>
}

// Get configuration from environment variables
const getConfig = (): V3Config => {
  const network = (process.env.REACT_APP_NETWORK as 'localnet' | 'testnet' | 'mainnet') || 'localnet'
  
  return {
    network,
    contracts: {
      registry: parseInt(process.env.REACT_APP_REGISTRY_APP_ID || '0'),
      marketplace: parseInt(process.env.REACT_APP_MARKETPLACE_APP_ID || '0'),
      financePool: parseInt(process.env.REACT_APP_FINANCE_POOL_APP_ID || '0'),
      lending: parseInt(process.env.REACT_APP_LENDING_APP_ID || '0')
    },
    assets: {
      usdcAssetId: parseInt(process.env.REACT_APP_USDC_ASSET_ID || '31566704')
    },
    features: {
      enableTrading: true,
      enableLending: true,
      enablePools: true,
      enableRiskScoring: true
    }
  }
}

export const useContracts = (): UseContractsResult => {
  const [contracts, setContracts] = useState<ContractClients | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeContracts()
  }, [])

  const initializeContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      const config = getConfig()

      // Validate configuration
      if (!config.contracts.registry || !config.contracts.marketplace) {
        throw new Error('Missing contract configuration. Please check environment variables.')
      }

      // Initialize Algorand client based on network
      let algorand: AlgorandClient

      if (config.network === 'localnet') {
        algorand = AlgorandClient.fromEnvironment()
      } else {
        // For testnet/mainnet, use public nodes
        algorand = new AlgorandClient({
          server: config.network === 'testnet' 
            ? 'https://testnet-api.algonode.cloud'
            : 'https://mainnet-api.algonode.cloud',
          port: 443,
          token: ''
        })
      }

      // Initialize contract clients
      const registryClient = new TradeInstrumentRegistryClient(
        {
          algorand,
          resolveBy: 'id',
          id: config.contracts.registry
        },
        algorand
      )

      const marketplaceClient = new AtomicMarketplaceV3Client(
        {
          algorand,
          resolveBy: 'id',
          id: config.contracts.marketplace
        },
        algorand
      )

      // Test contract connectivity
      try {
        await registryClient.getGlobalState()
        await marketplaceClient.getGlobalState()
      } catch (connectivityError) {
        throw new Error(`Contracts not accessible. Please check network connection and contract deployment.`)
      }

      setContracts({
        algorand,
        registry: registryClient,
        marketplace: marketplaceClient,
        financePool: null, // To be implemented
        lending: null, // To be implemented
        config
      })

      console.log(`✅ Connected to ${config.network} contracts:`, {
        registry: config.contracts.registry,
        marketplace: config.contracts.marketplace
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to initialize contracts:', err)
    } finally {
      setLoading(false)
    }
  }

  const reconnect = async () => {
    await initializeContracts()
  }

  return {
    contracts,
    loading,
    error,
    reconnect
  }
}

// Helper hooks for specific contract interactions
export const useRegistry = () => {
  const { contracts } = useContracts()
  return contracts?.registry || null
}

export const useMarketplace = () => {
  const { contracts } = useContracts()
  return contracts?.marketplace || null
}
