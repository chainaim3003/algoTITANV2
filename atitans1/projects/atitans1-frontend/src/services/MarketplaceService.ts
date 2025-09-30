/**
 * Marketplace Service
 * 
 * Handles all marketplace operations: listing, buying, browsing
 */
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TradeInstrumentRegistryClient } from '../contracts/TradeInstrumentRegistryClient'
import { AtomicMarketplaceV3Client } from '../contracts/AtomicMarketplaceV3Client'
import {
  TradeInstrument,
  InstrumentListing,
  InstrumentSale,
  ListInstrumentRequest,
  ListInstrumentResponse,
  PurchaseWithAlgoRequest,
  PurchaseWithUSDCRequest,
  PurchaseResponse,
  Currency
} from '../types/v3-contract-types'

export class MarketplaceService {
  constructor(
    private algorand: AlgorandClient,
    private registryClient: TradeInstrumentRegistryClient,
    private marketplaceClient: AtomicMarketplaceV3Client
  ) {}

  /**
   * List instrument for sale on marketplace
   */
  async listInstrumentForSale(request: ListInstrumentRequest): Promise<ListInstrumentResponse> {
    try {
      // Convert validity days to seconds
      const validityPeriod = request.validityDays * 24 * 60 * 60

      // Determine listing type (fixed price for now)
      const listingType = 1 // Fixed price

      // Call marketplace contract to list instrument
      const result = await this.marketplaceClient.listInstrument({
        instrumentId: request.instrumentAssetId,
        askPriceAlgo: request.priceAlgo || 0n,
        askPriceUSDC: request.priceUSDC || 0n,
        validityPeriod: BigInt(validityPeriod),
        listingType: BigInt(listingType)
      })

      return {
        listingId: BigInt(result.return || 0),
        txnId: result.txnId || ''
      }
    } catch (error) {
      console.error('Failed to list instrument:', error)
      throw new Error(`Failed to list instrument: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Purchase instrument with ALGO
   */
  async purchaseWithAlgo(request: PurchaseWithAlgoRequest): Promise<PurchaseResponse> {
    try {
      // Create payment transaction
      const paymentTxn = await this.algorand.transactions.payment({
        sender: request.buyerAddress,
        receiver: this.marketplaceClient.appAddress,
        amount: request.paymentAmount,
        note: `Purchase listing ${request.listingId}`
      })

      // Call marketplace contract to purchase
      const result = await this.marketplaceClient.purchaseWithAlgo({
        listingId: request.listingId,
        payment: paymentTxn
      })

      // Get listing details to return instrument asset ID
      const listing = await this.getListing(request.listingId)

      return {
        saleId: BigInt(0), // Would be returned from contract in real implementation
        txnId: result.txnId || '',
        instrumentAssetId: listing.instrumentId
      }
    } catch (error) {
      console.error('Failed to purchase with ALGO:', error)
      throw new Error(`Failed to purchase with ALGO: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Purchase instrument with USDC
   */
  async purchaseWithUSDC(request: PurchaseWithUSDCRequest): Promise<PurchaseResponse> {
    try {
      // Get USDC asset ID from config
      const usdcAssetId = 31566704 // This should come from config

      // Create USDC transfer transaction
      const usdcTransferTxn = await this.algorand.transactions.assetTransfer({
        sender: request.buyerAddress,
        receiver: this.marketplaceClient.appAddress,
        assetId: usdcAssetId,
        amount: request.paymentAmount,
        note: `Purchase listing ${request.listingId} with USDC`
      })

      // Call marketplace contract to purchase
      const result = await this.marketplaceClient.purchaseWithUSDC({
        listingId: request.listingId,
        usdcTransfer: usdcTransferTxn
      })

      // Get listing details to return instrument asset ID
      const listing = await this.getListing(request.listingId)

      return {
        saleId: BigInt(0), // Would be returned from contract in real implementation
        txnId: result.txnId || '',
        instrumentAssetId: listing.instrumentId
      }
    } catch (error) {
      console.error('Failed to purchase with USDC:', error)
      throw new Error(`Failed to purchase with USDC: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all active marketplace listings
   */
  async getMarketplaceListings(): Promise<InstrumentListing[]> {
    try {
      // In a real implementation, this would query the marketplace contract
      // for all active listings. For now, return mock data or implement
      // based on actual contract structure.
      
      // This is a placeholder - actual implementation would need to:
      // 1. Get total number of listings from contract global state
      // 2. Iterate through listing IDs and fetch active ones
      // 3. Return array of active listings
      
      return []
    } catch (error) {
      console.error('Failed to get marketplace listings:', error)
      throw new Error(`Failed to get marketplace listings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get recent sales
   */
  async getRecentSales(limit: number = 10): Promise<InstrumentSale[]> {
    try {
      // Placeholder implementation
      // Would query marketplace contract for recent sales
      return []
    } catch (error) {
      console.error('Failed to get recent sales:', error)
      throw new Error(`Failed to get recent sales: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get specific listing details
   */
  async getListing(listingId: bigint): Promise<InstrumentListing> {
    try {
      const result = await this.marketplaceClient.getListing({
        listingId
      })

      // Convert contract response to interface
      return {
        listingId: result.listingId || 0n,
        instrumentId: result.instrumentId || 0n,
        seller: result.seller || '',
        askPriceAlgo: result.askPriceAlgo || 0n,
        askPriceUSDC: result.askPriceUSDC || 0n,
        listingTime: result.listingTime || 0n,
        validUntil: result.validUntil || 0n,
        isActive: result.isActive || false,
        listingType: result.listingType || 0n,
        reservePrice: result.reservePrice || 0n,
        marketplaceFee: result.marketplaceFee || 0n
      }
    } catch (error) {
      console.error('Failed to get listing:', error)
      throw new Error(`Failed to get listing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get instrument details from registry
   */
  async getInstrumentDetails(instrumentId: bigint): Promise<TradeInstrument | null> {
    try {
      const result = await this.registryClient.getInstrument({
        instrumentId
      })

      // Convert contract response to interface
      return {
        instrumentNumber: result.instrumentNumber || '',
        instrumentType: result.instrumentType || 0n,
        instrumentAssetId: result.instrumentAssetId || 0n,
        issueDate: result.issueDate || 0n,
        maturityDate: result.maturityDate || 0n,
        
        faceValue: result.faceValue || 0n,
        currentMarketValue: result.currentMarketValue || 0n,
        currencyCode: result.currencyCode || '',
        paymentTerms: result.paymentTerms || '',
        
        issuerAddress: result.issuerAddress || '',
        currentHolder: result.currentHolder || '',
        exporterAddress: result.exporterAddress || '',
        importerAddress: result.importerAddress || '',
        
        cargoDescription: result.cargoDescription || '',
        cargoValue: result.cargoValue || 0n,
        weight: result.weight || 0n,
        originPort: result.originPort || '',
        destinationPort: result.destinationPort || '',
        vesselName: result.vesselName || '',
        voyageNumber: result.voyageNumber || '',
        
        riskScore: result.riskScore || 0n,
        instrumentStatus: result.instrumentStatus || 0n,
        
        createdAt: result.createdAt || 0n,
        lastUpdated: result.lastUpdated || 0n,
        endorsementHistory: result.endorsementHistory || []
      }
    } catch (error) {
      console.error('Failed to get instrument details:', error)
      return null
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats() {
    try {
      const result = await this.marketplaceClient.getMarketplaceStats()
      
      return {
        totalVolume: result[0] || 0n,
        totalFees: result[1] || 0n,
        totalListings: result[2] || 0n,
        totalSales: result[3] || 0n
      }
    } catch (error) {
      console.error('Failed to get marketplace stats:', error)
      return {
        totalVolume: 0n,
        totalFees: 0n,
        totalListings: 0n,
        totalSales: 0n
      }
    }
  }
}
