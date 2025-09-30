/**
 * Enhanced Exporter Dashboard Component - V3 Integration
 * 
 * Shows RWAs owned by the exporter with advanced marketplace and fractional investment features
 * Integrates with V3 contracts and wallet role switching
 */
import React, { useState, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useApplicationState, useRoleSwitcher } from '../contexts/ApplicationContext'
import { ADDRESSES, getRoleByAddress, formatAddress } from '../services/roleMappingService'
import { realAPI, BLWithTransactions, TokenizedBLWithTransactions, MarketplaceListing } from '../services/realAPI'
import { WalletRoleStatusIndicator } from './WalletRoleSwitcher'

interface RWAAsset {
  id: string
  instrumentId: bigint
  assetId: number
  blReference: string
  cargoDescription: string
  cargoValue: number
  currency: string
  status: 'ACTIVE' | 'LISTED' | 'FRACTIONAL' | 'SETTLED'
  createdAt: string
  maturityDate: string
  originPort: string
  destinationPort: string
  vesselName: string
  riskScore: number
  txnId: string
  explorerUrl: string
  // Marketplace data
  isListed?: boolean
  listingPrice?: number
  listingCurrency?: 'ALGO' | 'USDC'
  // Fractional investment data
  isFractional?: boolean
  totalShares?: number
  availableShares?: number
  sharePrice?: number
  investors?: number
  fundingProgress?: number
}

export function EnhancedExporterDashboard() {
  console.log('🎯 EnhancedExporterDashboard component rendered at:', new Date().toISOString())
  
  const { activeAddress, connect, disconnect, providers } = useWallet()
  const { activeRole, isCurrentlyExporter, availableRoles } = useApplicationState()
  const { switchToAddress } = useRoleSwitcher()
  const [rwaAssets, setRWAAssets] = useState<RWAAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<{
    asset: RWAAsset
    action: 'SELL' | 'FRACTIONAL'
  } | null>(null)

  const exporterAddress = ADDRESSES.EXPORTER
  const isConnectedAsExporter = activeAddress === exporterAddress

  useEffect(() => {
    console.log('🚀 EnhancedExporterDashboard useEffect triggered with activeAddress:', activeAddress)
    console.log('🚀 exporterAddress:', exporterAddress) 
    console.log('🚀 isConnectedAsExporter:', isConnectedAsExporter)
    loadExporterRWAs()
  }, [activeAddress])

  const loadExporterRWAs = async () => {
    console.log('🎯 loadExporterRWAs function called - activeAddress:', activeAddress)
    
    if (!activeAddress) {
      console.log('📍 Enhanced Exporter Dashboard: No active address, skipping data load')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('🔍 Loading RWA assets for exporter:', activeAddress)
      
      // Get ALL Bills of Lading first and debug them
      const allBLs = await realAPI.getBillsOfLading()
      console.log('📋 Total BLs found:', allBLs.length)
      
      // DEBUG: Log all BLs to see their structure
      console.log('🔍 ALL BLs DEBUG:', allBLs.map((bl, index) => ({
        index: index + 1,
        ref: bl.transportDocumentReference,
        createdByCarrier: bl.createdByCarrier,
        assignedToExporter: bl.createdByCarrier?.assignedToExporter,
        currentHolder: bl.currentHolder,
        status: bl.status,
        hasRwaData: !!bl.rwaAssetData,
        hasTokenization: !!bl.tokenizationData
      })))
      
      // Filter BLs that are assigned to this exporter address
      let exporterBLs = allBLs.filter(bl => {
        // Check if this BL is assigned to the current exporter
        const assignedToExporter = bl.createdByCarrier?.assignedToExporter === activeAddress
        const isOwner = bl.currentHolder === activeAddress
        
        console.log(`🔍 Checking BL ${bl.transportDocumentReference}:`, {
          assignedToExporter: bl.createdByCarrier?.assignedToExporter,
          currentExporterAddress: activeAddress,
          isAssignedMatch: assignedToExporter,
          isOwner: bl.currentHolder,
          isOwnerMatch: isOwner,
          finalMatch: assignedToExporter || isOwner
        })
        
        return assignedToExporter || isOwner
      })
      
      console.log('📋 Exporter BLs found:', exporterBLs.length)
      console.log('📊 Exporter BL details:', exporterBLs.map(bl => ({
        ref: bl.transportDocumentReference,
        assignedTo: bl.createdByCarrier?.assignedToExporter,
        assetId: bl.tokenizationData?.assetId,
        status: bl.status
      })))
      
      // DEBUG: If no exporterBLs found, let's also check with a more flexible approach
      if (exporterBLs.length === 0) {
        console.log('⚠️ No BLs found with exact match. Trying flexible matching...')
        
        // Try matching with partial address or different formats
        const flexibleMatches = allBLs.filter(bl => {
          const assignedTo = bl.createdByCarrier?.assignedToExporter
          const currentHolder = bl.currentHolder
          
          // Try different matching approaches
          const partialMatch = assignedTo && activeAddress && (
            assignedTo.includes(activeAddress.slice(-8)) || // Match last 8 chars
            activeAddress.includes(assignedTo.slice(-8)) || // Match in reverse
            assignedTo.toLowerCase() === activeAddress.toLowerCase() // Case insensitive
          )
          
          const holderMatch = currentHolder && activeAddress && (
            currentHolder.includes(activeAddress.slice(-8)) ||
            activeAddress.includes(currentHolder.slice(-8)) ||
            currentHolder.toLowerCase() === activeAddress.toLowerCase()
          )
          
          if (partialMatch || holderMatch) {
            console.log(`🎯 Flexible match found:`, {
              blRef: bl.transportDocumentReference,
              assignedTo,
              currentHolder,
              partialMatch,
              holderMatch
            })
          }
          
          return partialMatch || holderMatch
        })
        
        console.log('🔍 Flexible matches found:', flexibleMatches.length)
        
        if (flexibleMatches.length > 0) {
          // Use flexible matches if exact matches not found
          exporterBLs = flexibleMatches
        }
      }
      
      // Get tokenized BLs for this exporter
      const tokenizedBLs = await realAPI.getTokenizedBLsByExporter(activeAddress)
      console.log('💎 Found Tokenized BLs:', tokenizedBLs.length)
      
      // Convert to RWA format
      const rwaAssets: RWAAsset[] = []
      
      // Add regular BLs as RWA assets
      exporterBLs.forEach((bl, index) => {
        console.log(`🔍 Processing Exporter BL ${index + 1}:`, {
          ref: bl.transportDocumentReference,
          hasRwaData: !!bl.rwaAssetData,
          hasTokenization: !!bl.tokenizationData,
          assetId: bl.tokenizationData?.assetId,
          createdBy: bl.createdByCarrier?.carrierAddress,
          assignedTo: bl.createdByCarrier?.assignedToExporter
        })
        
        const assetId = bl.tokenizationData?.assetId || Math.floor(Math.random() * 900000) + 100000
        
        rwaAssets.push({
          id: bl.transportDocumentReference,
          instrumentId: BigInt(assetId),
          assetId: assetId,
          blReference: bl.transportDocumentReference,
          cargoDescription: bl.consignmentItems?.[0]?.descriptionOfGoods?.[0] || bl.cargoDescription || 'Trade Cargo',
          cargoValue: bl.declaredValue?.amount || bl.cargoValue || 100000,
          currency: bl.declaredValue?.currency || bl.currency || 'USD',
          status: 'ACTIVE',
          createdAt: bl.issuedDate || bl.createdAt || new Date().toISOString(),
          maturityDate: bl.rwaTokenization?.paymentTerms ? 
            new Date(Date.now() + (bl.rwaTokenization.paymentTerms * 24 * 60 * 60 * 1000)).toISOString() :
            new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString(),
          originPort: bl.transports?.portOfLoading?.portName || bl.originPort || 'Origin Port',
          destinationPort: bl.transports?.portOfDischarge?.portName || bl.destinationPort || 'Destination Port',
          vesselName: bl.transports?.vesselVoyages?.[0]?.vesselName || bl.vesselName || 'Vessel',
          riskScore: bl.rwaTokenization?.riskRating === 'LOW' ? 800 : bl.rwaTokenization?.riskRating === 'MEDIUM' ? 650 : 500,
          txnId: bl.createdByCarrier?.creationTxId || bl.txnId || '',
          explorerUrl: bl.createdByCarrier?.explorerUrl || bl.explorerUrl || '',
          isListed: false,
          isFractional: false
        })
      })
      
      // Add tokenized BLs
      tokenizedBLs.forEach((tbl, index) => {
        console.log(`🔍 Processing Tokenized BL ${index + 1}:`, {
          ref: tbl.blReference,
          assetId: tbl.assetId,
          totalShares: tbl.totalShares
        })
        
        // Check if not already added as regular BL
        const existingAsset = rwaAssets.find(asset => asset.blReference === tbl.blReference)
        if (!existingAsset) {
          rwaAssets.push({
            id: tbl.blReference,
            instrumentId: BigInt(tbl.assetId || Math.floor(Math.random() * 900000) + 100000),
            assetId: tbl.assetId || Math.floor(Math.random() * 900000) + 100000,
            blReference: tbl.blReference,
            cargoDescription: tbl.cargoDescription || 'Tokenized Trade Cargo',
            cargoValue: tbl.cargoValue || 100000,
            currency: tbl.currency || 'USD',
            status: 'FRACTIONAL',
            createdAt: tbl.createdAt || new Date().toISOString(),
            maturityDate: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString(),
            originPort: tbl.originPort || 'Origin Port',
            destinationPort: tbl.destinationPort || 'Destination Port',
            vesselName: tbl.vesselName || 'Vessel',
            riskScore: 750,
            txnId: tbl.tokenCreationTx || '',
            explorerUrl: '',
            isListed: false,
            isFractional: true,
            totalShares: tbl.totalShares,
            availableShares: tbl.availableShares,
            sharePrice: tbl.pricePerShare,
            investors: tbl.investments?.length || 0,
            fundingProgress: tbl.totalShares ? ((tbl.totalShares - (tbl.availableShares || 0)) / tbl.totalShares) * 100 : 0
          })
        }
      })
      
      console.log('✅ Final RWA Assets for exporter:', rwaAssets.length)
      console.log('📊 Assets:', rwaAssets)
      setRWAAssets(rwaAssets)
      
    } catch (error) {
      console.error('❌ Error loading exporter RWAs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleListForSale = async (asset: RWAAsset, saleData: {
    priceAlgo?: number
    priceUSDC?: number
    validityDays: number
  }) => {
    if (!isConnectedAsExporter) {
      alert('Please connect as Exporter to list RWA for sale')
      return
    }

    try {
      console.log(`📊 Listing RWA asset for sale:`, {
        assetId: asset.assetId,
        blReference: asset.blReference,
        priceAlgo: saleData.priceAlgo,
        priceUSDC: saleData.priceUSDC,
        validityDays: saleData.validityDays
      })
      
      // Call the real marketplace API
      const listingResult = await realAPI.listRWAForSale({
        blReference: asset.blReference,
        assetId: asset.assetId,
        sellerAddress: exporterAddress,
        priceAlgo: saleData.priceAlgo,
        priceUSDC: saleData.priceUSDC,
        validityDays: saleData.validityDays
      })
      
      // Update local state
      setRWAAssets(prev => prev.map(rwa => 
        rwa.id === asset.id 
          ? { 
              ...rwa, 
              status: 'LISTED',
              isListed: true,
              listingPrice: saleData.priceUSDC || saleData.priceAlgo,
              listingCurrency: saleData.priceUSDC ? 'USDC' : 'ALGO'
            }
          : rwa
      ))
      
      setSelectedAction(null)
      
      // Show success notification
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 max-w-md'
      notification.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">✅</span>
          <span class="font-bold">RWA Listed for Sale!</span>
        </div>
        <div class="text-sm">
          <div><strong>Asset:</strong> ${asset.blReference}</div>
          <div><strong>Price:</strong> ${saleData.priceUSDC || saleData.priceAlgo} ${saleData.priceUSDC ? 'USDC' : 'ALGO'}</div>
          <div><strong>Listing ID:</strong> ${listingResult.id}</div>
          <div class="mt-2">
            <a href="${listingResult.explorerUrl}" target="_blank" class="text-blue-600 underline text-xs">
              View Transaction
            </a>
          </div>
          <div class="mt-2 text-xs text-green-600">
            🏪 This RWA is now available in the Marketplace!
          </div>
        </div>
      `
      document.body.appendChild(notification)
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 10000)
      
    } catch (error) {
      console.error('Error listing RWA for sale:', error)
      alert(`Failed to list RWA: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSwitchToExporter = async () => {
    try {
      const exporterRole = availableRoles.find(role => role.address === exporterAddress)
      if (exporterRole) {
        await switchToAddress(exporterAddress)
        
        // Show instruction notification
        const notification = document.createElement('div')
        notification.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-6 py-4 rounded-lg shadow-lg z-50 max-w-md'
        notification.innerHTML = `
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">🔄</span>
            <span class="font-bold">Opening Lute Wallet</span>
          </div>
          <div class="text-sm mb-2">
            Please switch to the Exporter account in your Lute wallet:
          </div>
          <div class="text-xs font-mono bg-white px-2 py-1 rounded border mb-2">
            ${formatAddress(exporterAddress)}
          </div>
          <div class="text-xs text-blue-600">
            Look for "Premium Exporter Ltd" in your account list
          </div>
        `
        document.body.appendChild(notification)
        
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification)
          }
        }, 8000)
      }
    } catch (error) {
      console.error('Failed to switch to exporter:', error)
      alert('Failed to open wallet. Please manually switch to the Exporter account in Lute wallet.')
    }
  }

  const handleOpenWalletGuide = () => {
    // Show detailed guide modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-md w-full m-4 p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">🔄 How to Switch to Exporter Account</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="space-y-4 text-sm">
          <div class="flex items-start gap-3">
            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">1</span>
            <div>
              <p class="font-medium">Open Lute Wallet</p>
              <p class="text-gray-600">Click the wallet icon in your browser or open the Lute wallet extension</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">2</span>
            <div>
              <p class="font-medium">Find Account Switcher</p>
              <p class="text-gray-600">Look for the account dropdown or "Switch Account" button</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">3</span>
            <div>
              <p class="font-medium">Select Exporter Account</p>
              <p class="text-gray-600">Choose "Premium Exporter Ltd" or the account ending in:</p>
              <p class="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-1">...6UNWE</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">4</span>
            <div>
              <p class="font-medium">Confirm Switch</p>
              <p class="text-gray-600">The page will automatically update when you switch accounts</p>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end">
          <button onclick="this.closest('.fixed').remove()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            Got it!
          </button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
  }

  const handleOpenLuteWallet = async () => {
    try {
      console.log('Available providers:', providers?.map(p => p.metadata.name))
      
      // Find Lute wallet provider with more comprehensive detection
      const luteProvider = providers?.find(p => {
        const name = p.metadata.name.toLowerCase()
        return name.includes('lute') || 
               name.includes('algorand') ||
               name.includes('algo') ||
               p.metadata.id === 'lute' ||
               p.metadata.id === 'algorand'
      })
      
      console.log('Found Lute provider:', luteProvider?.metadata.name)
      
      if (!luteProvider) {
        // Show available providers for debugging
        const availableProviders = providers?.map(p => p.metadata.name).join(', ') || 'None'
        console.log('Available wallet providers:', availableProviders)
        
        // Try to connect to any available provider to open wallet interface
        const anyProvider = providers?.[0]
        if (anyProvider) {
          console.log('Trying to connect with:', anyProvider.metadata.name)
          await connect(anyProvider.metadata.id)
        } else {
          alert(`No wallet providers found. Available: ${availableProviders}. Please ensure Lute wallet extension is installed and enabled.`)
          return
        }
      } else {
        // Disconnect current connection first to force fresh connection
        if (activeAddress) {
          await disconnect()
          // Wait a moment for disconnection
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Connect to Lute wallet - this opens the account selection interface
        console.log('Connecting to Lute wallet...')
        await connect(luteProvider.metadata.id)
      }
      
      // Show helpful instruction
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 max-w-md'
      notification.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">🎯</span>
          <span class="font-bold">Wallet Opened</span>
        </div>
        <div class="text-sm">
          Select any account from your wallet to connect with that role.
        </div>
      `
      document.body.appendChild(notification)
      
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 4000)
      
    } catch (error) {
      console.error('Failed to open wallet:', error)
      alert(`Failed to open wallet: ${error.message}. Please try opening Lute wallet manually and connecting an account.`)
    }
  }

  const handleOpenFractionalInvestment = async (asset: RWAAsset, fractionalData: {
    totalShares: number
    sharePrice: number
    minimumInvestment: number
    expectedYield: number
  }) => {
    try {
      console.log(`📊 Opening fractional investment:`, {
        assetId: asset.assetId,
        blReference: asset.blReference,
        ...fractionalData
      })
      
      // Tokenize the BL for fractional investment
      const tokenizeResult = await realAPI.tokenizeBL({
        blReference: asset.blReference,
        totalShares: fractionalData.totalShares,
        pricePerShare: fractionalData.sharePrice,
        exporterAddress: exporterAddress,
        signer: async (txns, indexes) => {
          // This would use the actual wallet signing
          return [new Uint8Array()] // Mock signature
        }
      })
      
      // Update local state
      setRWAAssets(prev => prev.map(rwa => 
        rwa.id === asset.id 
          ? { 
              ...rwa, 
              status: 'FRACTIONAL',
              isFractional: true,
              totalShares: fractionalData.totalShares,
              availableShares: fractionalData.totalShares,
              sharePrice: fractionalData.sharePrice,
              investors: 0,
              fundingProgress: 0
            }
          : rwa
      ))
      
      setSelectedAction(null)
      
      // Show success notification
      const notification = document.createElement('div')
      notification.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-6 py-4 rounded-lg shadow-lg z-50 max-w-md'
      notification.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">🎯</span>
          <span class="font-bold">Fractional Investment Opened!</span>
        </div>
        <div class="text-sm">
          <div><strong>Asset:</strong> ${asset.blReference}</div>
          <div><strong>Total Shares:</strong> ${fractionalData.totalShares.toLocaleString()}</div>
          <div><strong>Share Price:</strong> $${fractionalData.sharePrice}</div>
          <div><strong>Expected Yield:</strong> ${fractionalData.expectedYield}%</div>
          <div class="mt-2">
            <a href="${tokenizeResult.transactions[0]?.explorerUrl}" target="_blank" class="text-blue-600 underline text-xs">
              View Transaction
            </a>
          </div>
        </div>
      `
      document.body.appendChild(notification)
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 8000)
      
    } catch (error) {
      console.error('Error opening fractional investment:', error)
      alert(`Failed to open fractional investment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading your RWA assets...</span>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📦 Exporter Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your RWA assets and open them for sale or fractional investment</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Exporter({formatAddress(exporterAddress)})
            </div>
            {!isConnectedAsExporter && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  alert(`Connected Address: ${activeAddress}\nExporter Address: ${exporterAddress}\nMatch: ${activeAddress === exporterAddress}`)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
              >
                📍 Check Address
              </button>
              <button
                onClick={async () => {
                  alert('Starting BL check...')
                  try {
                    const allBLs = await realAPI.getBillsOfLading()
                    alert(`Found ${allBLs.length} BLs in system. Check console for details.`)
                    console.log('📋 Total BLs in system:', allBLs.length)
                    console.log('📊 BL References:', allBLs.map(bl => bl.transportDocumentReference))
                    console.log('📁 First BL sample:', allBLs[0])
                    if (allBLs.length > 0) {
                      alert(`First BL reference: ${allBLs[0]?.transportDocumentReference || 'Unknown'}`)
                    }
                  } catch (error) {
                    alert(`Error: ${error.message}`)
                    console.error('❌ Error fetching BLs:', error)
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm"
              >
                🔍 Check BLs
              </button>
            </div>
            )}
            <WalletRoleStatusIndicator />
          </div>
        </div>
        
        {/* Connection Status */}
        {!isConnectedAsExporter ? (
          <div className="bg-orange-100 border border-orange-300 text-orange-800 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Switch to Exporter Account Required</span>
            </div>
            <div className="text-sm mb-3">
              Please connect to the Exporter wallet address to manage your RWA assets:
            </div>
            <div className="text-xs font-mono bg-white px-2 py-1 rounded border mb-3">
              {exporterAddress}
            </div>
            <div className="text-sm mb-4">
              Currently connected: {activeAddress ? `${formatAddress(activeAddress)} (${activeRole?.shortName})` : 'No wallet connected'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleSwitchToExporter()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Switch to Exporter Wallet
              </button>
              <button
                onClick={() => handleOpenWalletGuide()}
                className="border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to Switch?
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">✅ Connected as Exporter</span>
            </div>
            <div className="text-sm">
              You can now manage your RWA assets, list them for sale, or open them for fractional investment.
            </div>
          </div>
        )}
      </div>

      {/* RWA Assets Grid */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">🏆 My RWA Assets</h2>
          <p className="text-sm text-gray-500 mt-1">
            RWA assets you own and can monetize through marketplace or fractional investment
          </p>
        </div>

        <div className="p-6">
          {rwaAssets.length === 0 ? (
            <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">🏭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No RWA Assets Found</h3>
            <p className="text-gray-500 mb-4">
            You don't have any RWA assets yet. Create eBL contracts through the Carrier dashboard to generate RWA assets.
            </p>
            <div className="text-sm text-gray-400 mb-4">
            Connected Address: {formatAddress(activeAddress || '')}
            </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center gap-2 text-blue-800 mb-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">How to Create RWA Assets</span>
                  </div>
                  <ol className="text-sm text-blue-700 space-y-1">
                    <li>1. Switch to <strong>Carrier</strong> tab</li>
                    <li>2. Create new eBL contracts</li>
                    <li>3. Assign ownership to this Exporter</li>
                    <li>4. Return here to manage RWA assets</li>
                  </ol>
                </div>
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rwaAssets.map((asset) => (
                <RWAAssetCard
                  key={asset.id}
                  asset={asset}
                  onListForSale={() => setSelectedAction({ asset, action: 'SELL' })}
                  onOpenFractional={() => setSelectedAction({ asset, action: 'FRACTIONAL' })}
                  isExporterConnected={isConnectedAsExporter}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      {rwaAssets.length > 0 && (
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">📊 Portfolio Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {rwaAssets.length}
                </p>
                <p className="text-sm text-gray-500">Total RWA Assets</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  ${rwaAssets.reduce((sum, asset) => sum + asset.cargoValue, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total Asset Value</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {rwaAssets.filter(asset => asset.status === 'LISTED').length}
                </p>
                <p className="text-sm text-gray-500">Listed for Sale</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {rwaAssets.filter(asset => asset.status === 'FRACTIONAL').length}
                </p>
                <p className="text-sm text-gray-500">Fractional Investments</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {selectedAction && (
        selectedAction.action === 'SELL' ? (
          <SellRWAModal
            asset={selectedAction.asset}
            onSell={handleListForSale}
            onClose={() => setSelectedAction(null)}
          />
        ) : (
          <FractionalInvestmentModal
            asset={selectedAction.asset}
            onOpen={handleOpenFractionalInvestment}
            onClose={() => setSelectedAction(null)}
          />
        )
      )}
    </div>
  )
}

// RWA Asset Card Component
const RWAAssetCard: React.FC<{
  asset: RWAAsset
  onListForSale: () => void
  onOpenFractional: () => void
  isExporterConnected: boolean
}> = ({ asset, onListForSale, onOpenFractional, isExporterConnected }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'LISTED': return 'bg-blue-100 text-blue-800'
      case 'FRACTIONAL': return 'bg-purple-100 text-purple-800'
      case 'SETTLED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 700) return 'text-green-600'
    if (score >= 500) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            🏭 {asset.blReference}
          </h3>
          <p className="text-sm text-gray-500">
            Asset ID: {asset.assetId}
          </p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
          {asset.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div>
          <span className="text-sm font-medium text-gray-700">Cargo:</span>
          <p className="text-sm text-gray-600">{asset.cargoDescription}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Value:</span>
            <p className="text-gray-600">${asset.cargoValue.toLocaleString()} {asset.currency}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Risk Score:</span>
            <p className={getRiskColor(asset.riskScore)}>
              {asset.riskScore}/1000
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Origin:</span>
            <p className="text-gray-600 truncate">{asset.originPort}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Destination:</span>
            <p className="text-gray-600 truncate">{asset.destinationPort}</p>
          </div>
        </div>

        {asset.isFractional && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-purple-800 mb-1">💎 Fractional Investment</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-purple-700">
              <div>Shares: {asset.totalShares?.toLocaleString()}</div>
              <div>Available: {asset.availableShares?.toLocaleString()}</div>
              <div>Price: ${asset.sharePrice}</div>
              <div>Investors: {asset.investors}</div>
            </div>
            <div className="mt-2">
              <div className="bg-purple-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full" 
                  style={{ width: `${asset.fundingProgress || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {asset.fundingProgress?.toFixed(1)}% funded
              </div>
            </div>
          </div>
        )}

        {asset.isListed && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800 mb-1">🏪 Listed for Sale</div>
            <div className="text-sm text-blue-700">
              Price: {asset.listingPrice} {asset.listingCurrency}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {asset.status === 'ACTIVE' && (
          <>
            <button
              onClick={onListForSale}
              disabled={!isExporterConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              🏪 Sell on Marketplace
            </button>
            <button
              onClick={onOpenFractional}
              disabled={!isExporterConnected}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              💰 Open to Finance
            </button>
          </>
        )}
        
        {asset.txnId && (
          <button
            onClick={() => window.open(asset.explorerUrl || `https://testnet.algoexplorer.io/tx/${asset.txnId}`, '_blank')}
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition-colors text-sm"
          >
            🔗 View Transaction
          </button>
        )}
      </div>
    </div>
  )
}

// Sell RWA Modal Component
const SellRWAModal: React.FC<{
  asset: RWAAsset
  onSell: (asset: RWAAsset, data: { priceAlgo?: number; priceUSDC?: number; validityDays: number }) => void
  onClose: () => void
}> = ({ asset, onSell, onClose }) => {
  const [priceAlgo, setPriceAlgo] = useState('')
  const [priceUSDC, setPriceUSDC] = useState('')
  const [validityDays, setValidityDays] = useState(30)
  const [currency, setCurrency] = useState<'ALGO' | 'USDC' | 'BOTH'>('USDC')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (currency === 'ALGO' && !priceAlgo) {
      alert('Please enter ALGO price')
      return
    }
    if (currency === 'USDC' && !priceUSDC) {
      alert('Please enter USDC price')
      return
    }
    if (currency === 'BOTH' && (!priceAlgo || !priceUSDC)) {
      alert('Please enter both ALGO and USDC prices')
      return
    }

    onSell(asset, {
      priceAlgo: currency === 'ALGO' || currency === 'BOTH' ? parseFloat(priceAlgo) : undefined,
      priceUSDC: currency === 'USDC' || currency === 'BOTH' ? parseFloat(priceUSDC) : undefined,
      validityDays
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">🏪 List RWA Asset for Sale</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="font-medium">🏭 {asset.blReference}</p>
            <p className="text-sm text-gray-600">{asset.cargoDescription}</p>
            <p className="text-sm text-gray-600">Value: ${asset.cargoValue.toLocaleString()} {asset.currency}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accept Payment In:
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="ALGO"
                    checked={currency === 'ALGO'}
                    onChange={(e) => setCurrency(e.target.value as 'ALGO')}
                    className="mr-2"
                  />
                  ALGO only
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="USDC"
                    checked={currency === 'USDC'}
                    onChange={(e) => setCurrency(e.target.value as 'USDC')}
                    className="mr-2"
                  />
                  USDC only (Recommended)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="BOTH"
                    checked={currency === 'BOTH'}
                    onChange={(e) => setCurrency(e.target.value as 'BOTH')}
                    className="mr-2"
                  />
                  Both ALGO and USDC
                </label>
              </div>
            </div>

            {(currency === 'ALGO' || currency === 'BOTH') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price in ALGO
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={priceAlgo}
                  onChange={(e) => setPriceAlgo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.000000"
                />
              </div>
            )}

            {(currency === 'USDC' || currency === 'BOTH') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price in USDC
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={priceUSDC}
                  onChange={(e) => setPriceUSDC(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter USDC price"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Suggested: ${(asset.cargoValue * 0.8).toLocaleString()} - ${(asset.cargoValue * 1.2).toLocaleString()}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Listing Valid For (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
              >
                🏪 List for Sale
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Fractional Investment Modal Component
const FractionalInvestmentModal: React.FC<{
  asset: RWAAsset
  onOpen: (asset: RWAAsset, data: { totalShares: number; sharePrice: number; minimumInvestment: number; expectedYield: number }) => void
  onClose: () => void
}> = ({ asset, onOpen, onClose }) => {
  const [totalShares, setTotalShares] = useState(1000)
  const [sharePrice, setSharePrice] = useState(Math.round(asset.cargoValue / 1000))
  const [minimumInvestment, setMinimumInvestment] = useState(50)
  const [expectedYield, setExpectedYield] = useState(12.5)

  const totalValue = totalShares * sharePrice
  const minimumShares = Math.ceil(minimumInvestment / sharePrice)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (totalShares < 10) {
      alert('Total shares must be at least 10')
      return
    }
    if (sharePrice <= 0) {
      alert('Share price must be greater than 0')
      return
    }
    if (expectedYield <= 0 || expectedYield > 100) {
      alert('Expected yield must be between 0% and 100%')
      return
    }

    onOpen(asset, {
      totalShares,
      sharePrice,
      minimumInvestment,
      expectedYield
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">💰 Open to Finance</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="font-medium">🏭 {asset.blReference}</p>
            <p className="text-sm text-gray-600">{asset.cargoDescription}</p>
            <p className="text-sm text-gray-600">Asset Value: ${asset.cargoValue.toLocaleString()} {asset.currency}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Shares
                </label>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={totalShares}
                  onChange={(e) => setTotalShares(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price per Share ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={sharePrice}
                  onChange={(e) => setSharePrice(parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Investment Summary</p>
              <div className="text-sm text-purple-700 mt-1">
                <div>Total Investment Value: <span className="font-medium">${totalValue.toLocaleString()}</span></div>
                <div>Minimum Investment: <span className="font-medium">${minimumInvestment} ({minimumShares} shares)</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Investment ($)
                </label>
                <input
                  type="number"
                  min="1"
                  value={minimumInvestment}
                  onChange={(e) => setMinimumInvestment(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Yield (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={expectedYield}
                  onChange={(e) => setExpectedYield(parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-800">💡 Fractional Investment Benefits</p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Lower barrier to entry for investors</li>
                <li>• Diversified risk across multiple investors</li>
                <li>• Increased liquidity for your RWA asset</li>
                <li>• Transparent blockchain-based ownership</li>
              </ul>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md"
              >
                💰 Open to Finance
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EnhancedExporterDashboard