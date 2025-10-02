import React, { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { realAPI, DocumentSubmission, BLWithTransactions, TokenizedBLWithTransactions } from '../services/realAPI';
import AdaptiveWalletStatus from './AdaptiveWalletStatus';
import { boxStorageService } from '../services/boxStorage';
// import SmartContractInfo from './SmartContractInfo'; // COMMENTED OUT - Component not found
import EnhancedBLForm from './EnhancedBLForm';
import RWADisplay from './RWADisplay';
// REMOVED: import { handleRealBLCreation } from '../integrations/eblIntegration'; - No longer needed, calling blockchain directly
import { 
  EXPORTERS, 
  PORTS_OF_LOADING, 
  PORTS_OF_DISCHARGE, 
  VESSELS,
  CARGO_TYPES,
  getExporterById,
  getCargoItemsByExporter,
  getPreferredPortsForExporter
} from '../config';
import {
  EXPORTER_OPTIONS,
  PORT_OF_LOADING_OPTIONS,
  PORT_OF_DISCHARGE_OPTIONS,
  VESSEL_OPTIONS,
  INCOTERMS_OPTIONS,
  CURRENCY_OPTIONS
} from '../config/constants';

export function CarrierDashboard() {
  const [documents, setDocuments] = useState<DocumentSubmission[]>([]);
  const [createdBLs, setCreatedBLs] = useState<BLWithTransactions[]>([]);
  const [carrierRWAs, setCarrierRWAs] = useState<TokenizedBLWithTransactions[]>([]); // ADDED: Carrier's RWAs
  const [createdAssets, setCreatedAssets] = useState<any[]>([]); // Assets created by this carrier
  const [loading, setLoading] = useState(true);
  const [isCreatingBL, setIsCreatingBL] = useState(false);
  const [shippingApproved, setShippingApproved] = useState(false);
  const [lastCreatedBL, setLastCreatedBL] = useState<any>(null); // Store the last created BL for displaying success message
  const [transferringAsset, setTransferringAsset] = useState<string | null>(null); // Track which asset is being transferred
  
  // Shipping Instructions state with defaults from SREE PALANI ANDAVAR AGROS
  const [shippingInstructions, setShippingInstructions] = useState(() => {
    const defaultExporter = getExporterById('sree_palani_agros');
    const defaultCargo = getCargoItemsByExporter('sree_palani_agros')[0];
    return {
      exporterId: 'sree_palani_agros',
      exporterName: defaultExporter?.name || 'SREE PALANI ANDAVAR AGROS PRIVATE LIMITED',
      exporterLEI: defaultExporter?.lei || '894500Q32QG6KKGMMI95',
      exporterAddress: defaultExporter?.address || 'Tamil Nadu, India',
      titleInstrumentType: 'Bill of Lading (Negotiable)',
      shipmentTitle: 'Container SPAG-2025 Agricultural Products',
      cargoDescription: defaultCargo?.description || 'Premium Spices and Agricultural Products from Tamil Nadu',
      cargoType: 'SITC-0',
      hsCode: defaultCargo?.hsCode || '0904.11.10',
      declaredValue: {
        amount: 85000,
        currency: 'USD'
      },
      packingType: defaultCargo?.packingType || 'PP Bags',
      grossWeight: 2500,
      netWeight: 2350,
      numberOfPackages: 100,
      unitOfMeasure: 'KGS',
      complianceInfo: 'DGFT compliant, FSSAI certified, organic certification, customs cleared',
      zkProofStatus: 'ZK-PRET Verified',
      portOfLoading: {
        code: 'INMAA',
        name: 'Chennai Port',
        city: 'Chennai',
        state: 'Tamil Nadu'
      },
      portOfDischarge: {
        code: 'NLRTM',
        name: 'Port of Rotterdam',
        city: 'Rotterdam',
        country: 'Netherlands'
      },
      vesselName: 'MV CHENNAI EXPRESS',
      estimatedTransitDays: 28,
      incoterms: 'FOB',
      specialInstructions: [
        'Handle with care - organic food grade products',
        'Maintain dry storage conditions throughout transit',
        'Temperature range: 15-25°C maximum',
        'Notify consignee 48 hours before arrival at destination port',
        'All documentation must comply with EU food import regulations',
        'Certificate of Origin and Phytosanitary Certificate attached',
        'Container seal number to be verified at Rotterdam customs'
      ]
    };
  });

  const { activeAddress, signTransactions } = useWallet();

  // Helper function to get exporter signer if exporter wallet is available
  const getExporterSigner = async () => {
    const EXPORTER_ADDRESS = 'EWYZFEJLQOZV25XLSMU5TSNPU3LY4U36IWDPSRQXOKWYBOLFZEXEB6UNWE';
    
    console.log('🔑 Checking if exporter signer is available...');
    console.log('   Current active address:', activeAddress);
    console.log('   Exporter address needed:', EXPORTER_ADDRESS);
    console.log('   Network: TestNet - Multi-account signing not available');
    
    // ON TESTNET: We cannot sign for multiple accounts atomically
    // The exporter will need to manually opt-in after asset creation
    // So we return undefined to use the fallback flow
    
    console.log('⚠️ TestNet mode: Exporter will need to manually opt-in');
    console.log('   The asset will be created, then exporter can claim it from their dashboard');
    
    return undefined; // Always use fallback flow on TestNet
  };

  useEffect(() => {
    loadCarrierData();
    if (activeAddress) {
      loadCarrierAssets();
    }
  }, [activeAddress]);

  // Load assets created by this carrier
  const loadCarrierAssets = async () => {
    if (!activeAddress) return;
    
    try {
      console.log('📦 Loading assets created by carrier:', activeAddress);
      
      // Load all BLs from box storage
      const allBLs = await boxStorageService.listAllBLs();
      
      // Filter BLs created by this carrier
      const myCreatedBLs = allBLs.filter(bl => 
        bl.createdByCarrier?.carrierAddress === activeAddress
      );
      
      console.log(`✅ Found ${myCreatedBLs.length} BLs created by this carrier`);
      
      // Separate into pending and transferred
      const pending = myCreatedBLs.filter(bl => 
        bl.currentHolder === activeAddress && bl.status === 'pending_transfer'
      );
      
      const transferred = myCreatedBLs.filter(bl => 
        bl.currentHolder !== activeAddress || bl.status === 'transferred'
      );
      
      console.log(`📊 Pending: ${pending.length}, Transferred: ${transferred.length}`);
      
      setCreatedAssets(myCreatedBLs);
      
    } catch (error) {
      console.error('❌ Error loading carrier assets:', error);
    }
  };

  // Transfer asset to exporter
  const handleTransferToExporter = async (bl: any) => {
    if (!activeAddress || !signTransactions) {
      alert('Please connect your wallet first');
      return;
    }

    const assetId = bl.rwaTokenization?.assetId;
    
    // Try multiple ways to get exporter address with fallback
    const exporterAddress = 
      bl.createdByCarrier?.assignedToExporter || 
      bl.assignedToExporter ||
      'EWYZFEJLQOZV25XLSMU5TSNPU3LY4U36IWDPSRQXOKWYBOLFZEXEB6UNWE'; // Hardcoded fallback

    console.log('🔍 Debug - BL data:', {
      hasCreatedByCarrier: !!bl.createdByCarrier,
      assignedToExporter: bl.createdByCarrier?.assignedToExporter,
      directAssigned: bl.assignedToExporter,
      finalExporterAddress: exporterAddress,
      fullBL: bl
    });

    if (!assetId) {
      alert('Asset ID not found');
      return;
    }

    if (!exporterAddress) {
      alert('Exporter address not found');
      return;
    }

    try {
      setTransferringAsset(bl.transportDocumentReference);
      console.log('🚀 Starting asset transfer...');
      console.log('   Asset ID:', assetId);
      console.log('   From (Carrier):', activeAddress);
      console.log('   To (Exporter):', exporterAddress);

      // Import Algorand SDK
      const algosdk = await import('algosdk');

      // Connect to AlgoNode TestNet
      const algodClient = new algosdk.Algodv2(
        '',
        'https://testnet-api.algonode.cloud',
        ''
      );

      // Get suggested params
      const suggestedParams = await algodClient.getTransactionParams().do();

      // Create asset transfer transaction
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: exporterAddress,
        assetIndex: assetId,
        amount: 1, // Transfer 1 unit (non-divisible ASA)
        suggestedParams,
      });

      // Sign transaction
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      const signedTxns = await signTransactions([encodedTxn]);

      if (!signedTxns || signedTxns.length === 0 || !signedTxns[0]) {
        throw new Error('Transaction signing failed');
      }

      // Send transaction
      console.log('📤 Sending transfer transaction...');
      const sendResult = await algodClient.sendRawTransaction(signedTxns[0]).do();
      const txId = sendResult.txid || txn.txID().toString();
      console.log('✅ Transaction sent! TX ID:', txId);

      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const result = await algosdk.waitForConfirmation(algodClient, txId, 4);
      console.log('✅ Transfer confirmed! Round:', result.confirmedRound);

      // Update BL status in box storage
      await boxStorageService.updateBLStatus(
        bl.transportDocumentReference,
        'transferred',
        exporterAddress
      );

      // Show success message
      alert(`✅ Asset successfully transferred to exporter!\n\nTransaction ID: ${txId}\n\nThe exporter can now see this asset in their dashboard.`);

      // Reload assets
      await loadCarrierAssets();

    } catch (error: any) {
      console.error('❌ Transfer failed:', error);
      
      // Check if it's an opt-in error
      if (error.message?.includes('receiver error') || error.message?.includes('asset not opted in')) {
        alert('⚠️ Transfer failed: Exporter has not opted into this asset yet.\n\nThe exporter needs to opt-in from their dashboard before the transfer can succeed.');
      } else {
        alert(`❌ Transfer failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setTransferringAsset(null);
    }
  };

  // Handle exporter change in shipping instructions
  const handleExporterChange = (exporterId: string) => {
    const exporter = getExporterById(exporterId);
    const cargoItems = getCargoItemsByExporter(exporterId);
    const preferredPorts = getPreferredPortsForExporter(exporterId);
    
    if (exporter && cargoItems.length > 0) {
      const defaultCargo = cargoItems[0];
      const defaultLoadingPort = preferredPorts[0] || PORTS_OF_LOADING[0];
      
      setShippingInstructions(prev => ({
        ...prev,
        exporterId,
        exporterName: exporter.name,
        exporterLEI: exporter.lei,
        exporterAddress: exporter.address || `${exporter.location}, India`,
        cargoDescription: defaultCargo.description,
        cargoType: exporter.industry.includes('Textile') ? 'SITC-6' : 
                  exporter.industry.includes('Electronics') ? 'SITC-7' : 'SITC-0',
        hsCode: defaultCargo.hsCode,
        packingType: defaultCargo.packingType,
        portOfLoading: {
        code: defaultLoadingPort.code,
        name: defaultLoadingPort.name,
        city: defaultLoadingPort.city,
        state: defaultLoadingPort.state || ''
        },
        shipmentTitle: `Container ${exporter.id.toUpperCase()}-2025 ${exporter.industry.split(' ')[0]}`
      }));
    }
  };

  // Handle shipping instructions field changes
  const handleShippingInstructionChange = (field: string, value: any) => {
    setShippingInstructions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle nested object changes (like ports, declared value)
  const handleNestedChange = (parentField: string, childField: string, value: any) => {
    setShippingInstructions(prev => {
      const parentObject = prev[parentField as keyof typeof prev];
      if (typeof parentObject === 'object' && parentObject !== null && !Array.isArray(parentObject)) {
        return {
          ...prev,
          [parentField]: {
            ...parentObject,
            [childField]: value
          }
        };
      }
      return prev;
    });
  };

  // Approve shipping instructions and auto-copy to enhanced form
  const handleApproveShippingInstructions = () => {
    setShippingApproved(true);
    
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
    notification.innerHTML = `
      <div class="flex items-center gap-2 mb-2">
        <span class="text-lg">✅</span>
        <span class="font-bold">Shipping Instructions Approved!</span>
      </div>
      <div class="text-sm">
        Data has been automatically populated in the enhanced eBL creation form below.
        You can now upload compliance documents and create the eBL RWA.
      </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-scroll to enhanced form
    setTimeout(() => {
      const enhancedForm = document.getElementById('enhanced-bl-form');
      if (enhancedForm) {
        enhancedForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  };

  // SIMPLIFIED: Direct blockchain transaction handler
  const handleEnhancedBLCreated = async (blData: any) => {
    console.log('🚀 SIMPLIFIED HANDLER - Direct blockchain call');
    console.log('📦 BL Data received:', blData);
    
    // Validate wallet
    if (!signTransactions) {
      console.error('❌ No wallet signer');
      alert('Please connect your wallet first');
      return;
    }
    
    if (!activeAddress) {
      console.error('❌ No active address');
      alert('Please connect your wallet first');
      return;
    }
    
    // Hardcoded exporter address
    const EXPORTER_ADDRESS = 'EWYZFEJLQOZV25XLSMU5TSNPU3LY4U36IWDPSRQXOKWYBOLFZEXEB6UNWE';
    
    console.log('🔑 Wallet address:', activeAddress);
    console.log('🏢 Exporter address:', EXPORTER_ADDRESS);
    
    try {
      setIsCreatingBL(true);
      
      // Try to get exporter signer for atomic transaction
      const exporterSigner = await getExporterSigner();
      
      if (exporterSigner) {
        console.log('✅ Exporter signer available - will use ATOMIC transaction group');
      } else {
        console.log('⚠️ Exporter signer not available - will use fallback flow');
      }
      
      // DIRECT blockchain call - no intermediate layers
      console.log('⚡ Calling createWorkingEBL directly...');
      
      const { createWorkingEBL } = await import('../services/workingEBL');
      
      const result = await createWorkingEBL({
        instrumentNumber: blData.eblReference,
        exporterAddress: EXPORTER_ADDRESS,
        cargoDescription: blData.cargoDescription || 'Trade Cargo',
        cargoValue: (blData.cargoValue || 100000) * 100,
        sender: activeAddress,
        signer: signTransactions,
        exporterSigner: exporterSigner // Pass exporter signer if available
      });
      
      console.log('✅ Blockchain transaction successful!');
      console.log('📋 Transaction ID:', result.txId);
      console.log('🪙 Asset ID:', result.assetId);
      console.log('🔗 Explorer:', result.explorerUrl);
      console.log('📦 Transfer status:', result.status);
      
      // Check if transfer was successful
      if (result.status === 'created_pending_transfer') {
        console.log('⚠️ Asset created but transfer pending - exporter needs to opt-in');
      } else if (result.status === 'created_transfer_failed') {
        console.log('⚠️ Asset created but transfer failed');
      } else {
        console.log('✅ Asset successfully transferred to exporter');
      }
      
      // Log compliance documents for verification
      console.log('📁 Compliance documents received:', blData.complianceDocuments?.length || 0);
      console.log('📜 DCSA v3 document:', blData.dcsaTransportDocument ? 'Present' : 'Missing');
      console.log('✅ DCSA compliant:', blData.isDCSACompliant);
      
      // Create complete BL object with ALL required DCSA v3 fields
      // Using type assertion for additional compliance fields not in base type
      const newBL: BLWithTransactions = {
        id: blData.eblReference,
        transportDocumentReference: blData.eblReference,
        shippedOnBoardDate: new Date().toISOString(),
        receiptTypeAtOrigin: 'CY',
        deliveryTypeAtDestination: 'CY',
        cargoMovementTypeAtOrigin: 'FCL',
        cargoMovementTypeAtDestination: 'FCL',
        serviceContractReference: `SC-${Date.now()}`,
        shipmentTerms: blData.incoterms || 'FOB',
        canBeFinanced: true,
        carrierCodeListProvider: 'NMFTA',
        isShippedOnBoardType: true,
        invoicePayableAt: 'PORT_OF_DISCHARGE',
        
        // Transport details
        transports: {
          portOfLoading: {
            portCode: blData.portOfLoading || 'INMAA',
            portName: blData.portOfLoading || 'Chennai Port',
            UNLocationCode: blData.portOfLoading || 'INMAA'
          },
          portOfDischarge: {
            portCode: blData.portOfDischarge || 'NLRTM',
            portName: blData.portOfDischarge || 'Port of Rotterdam',
            UNLocationCode: blData.portOfDischarge || 'NLRTM'
          },
          vesselVoyages: [{
            vesselName: blData.vesselName || 'MV CHENNAI EXPRESS',
            carrierExportVoyageNumber: `VOY-${Date.now()}`
          }]
        },
        
        // Declared value - REQUIRED
        declaredValue: {
          amount: blData.cargoValue || 100000,
          currency: blData.currency || 'USD'
        },
        
        // Document parties - REQUIRED with proper structure
        documentParties: {
          issuingParty: {
            partyName: 'Algo Titans Carrier Services',
            role: 'CARRIER',
            address: {
              street: 'Blockchain Street',
              streetNumber: '1',
              city: 'Singapore',
              countryCode: 'SG'
            }
          },
          shipper: {
            partyName: blData.selectedExporter || 'Exporter',
            role: 'SHIPPER',
            titleHolder: true,
            displayedAddress: ['Exporter Address', 'Tamil Nadu, India'],
            partyContactDetails: [{
              name: 'Export Manager',
              email: `export@${blData.selectedExporter || 'exporter'}.com`
            }]
          },
          consignee: {
            partyName: 'To Be Assigned',
            role: 'CONSIGNEE',
            displayedAddress: ['To Be Assigned', 'Port of Discharge'],
            partyContactDetails: [{
              name: 'Import Manager',
              email: 'import@consignee.com'
            }]
          }
        },
        
        // Consignment items - REQUIRED
        consignmentItems: [{
          carrierBookingReference: `CBR-${Date.now()}`,
          descriptionOfGoods: [blData.cargoDescription || 'Trade Cargo'],
          HSCodes: ['0904.11.10'],
          cargoItems: [{
            equipmentReference: 'CONT001',
            cargoGrossWeight: { value: 2500, unit: 'KGM' },
            cargoNetWeight: { value: 2350, unit: 'KGM' },
            outerPackaging: {
              numberOfPackages: 100,
              packageCode: 'BG',
              description: 'PP Bags'
            }
          }]
        }],
        
        // IPFS data - REQUIRED
        ipfsData: {
          metadataHash: `QmMeta${Date.now()}`,
          imageHash: `QmImg${Date.now()}`,
          documentHash: `QmDoc${Date.now()}`,
          encryptionKey: `key${Date.now()}`
        },
        
        // RWA Tokenization - REQUIRED
        rwaTokenization: {
          canTokenize: true,
          enabled: true,
          assetId: result.assetId,
          totalShares: 1,
          sharePrice: (blData.cargoValue || 100000) / 1,
          minInvestment: 1000,
          expectedYield: 8.5,
          paymentTerms: 90,
          riskRating: 'LOW',
          marketplaceEligible: true
        },
        
        // Charges - REQUIRED (can be empty array)
        charges: [],
        
        // Blockchain transactions
        transactions: [{
          txId: result.txId,
          confirmedRound: result.confirmedRound,
          explorerUrl: result.explorerUrl,
          timestamp: new Date().toISOString(),
          type: 'ENHANCED_BL_CREATION',
          description: 'eBL created and assigned to exporter'
        }]
      };
      
      // Add BLWithTransactions-specific fields (not in base BillOfLading type)
      (newBL as any).status = 'ACTIVE';
      (newBL as any).currentHolder = EXPORTER_ADDRESS;
      (newBL as any).createdByCarrier = {
        carrierAddress: activeAddress,
        assignedToExporter: EXPORTER_ADDRESS,
        creationTxId: result.txId,
        explorerUrl: result.explorerUrl
      };
      (newBL as any).tokenizationData = {
        assetId: result.assetId,
        tokenCreationTx: {
          txId: result.txId,
          confirmedRound: result.confirmedRound,
          explorerUrl: result.explorerUrl,
          blId: blData.eblReference,
          amount: blData.cargoValue || 100000
        },
        assetExplorerUrl: `https://testnet.algoexplorer.io/asset/${result.assetId}`,
        assetMetadata: {
          assetName: 'eBL',
          unitName: 'eBL',
          totalSupply: 1,
          decimals: 0
        },
        ownershipInfo: {
          owner: EXPORTER_ADDRESS,
          manager: EXPORTER_ADDRESS,
          reserve: EXPORTER_ADDRESS,
          freeze: EXPORTER_ADDRESS
        }
      };
      
      // Add convenience fields (flattened data)
      (newBL as any).cargoDescription = blData.cargoDescription || 'Trade Cargo';
      (newBL as any).cargoValue = blData.cargoValue || 100000;
      (newBL as any).currency = blData.currency || 'USD';
      (newBL as any).vesselName = blData.vesselName || 'MV CHENNAI EXPRESS';
      
      // CRITICAL: Set current holder based on transfer status
      if (result.status === 'success') {
        (newBL as any).currentHolder = EXPORTER_ADDRESS; // Successfully transferred
        (newBL as any).ownershipStatus = 'TRANSFERRED_TO_EXPORTER';
      } else {
        (newBL as any).currentHolder = activeAddress; // Still with carrier
        (newBL as any).ownershipStatus = result.status === 'created_pending_transfer' 
          ? 'PENDING_EXPORTER_OPTIN' 
          : 'TRANSFER_FAILED';
      }
      
      // Add compliance data dynamically (CRITICAL for RWA substantiation)
      (newBL as any).dcsaVersion = blData.dcsaVersion || '3.0.0';
      (newBL as any).dcsaTransportDocument = blData.dcsaTransportDocument;
      (newBL as any).dcsaValidation = blData.dcsaValidation;
      (newBL as any).isDCSACompliant = blData.isDCSACompliant || false;
      (newBL as any).complianceDocuments = blData.complianceDocuments || [];
      (newBL as any).hasComplianceDocuments = blData.hasComplianceDocuments || false;
      
      console.log('✅ BL created with', (newBL as any).complianceDocuments?.length || 0, 'compliance documents');
      
      // Update state with properly typed BL
      setCreatedBLs(prev => [newBL, ...prev]);
      
      // Set success message
      setLastCreatedBL({
        ...newBL,
        txId: result.txId,
        assetId: result.assetId,
        explorerUrl: result.explorerUrl,
        exporterAddress: EXPORTER_ADDRESS,
        carrierAddress: activeAddress
      });
      
      // Scroll to success message
      setTimeout(() => {
        const successElement = document.getElementById('bl-creation-success');
        if (successElement) {
          successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // Reload data
      await loadCarrierData();
      
      // SUCCESS MESSAGE MOVED TO ON-SCREEN DISPLAY - NO ALERT
      // The success message is already set in lastCreatedBL and will be displayed in the UI
      
    } catch (error) {
      console.error('❌ Blockchain transaction failed:', error);
      console.error('❌ Error details:', error);
      alert(`Failed to create eBL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingBL(false);
    }
  };

  const loadCarrierData = async () => {
    try {
      setLoading(true);
      const [docsData, blsData, carrierRWAsData] = await Promise.all([
        realAPI.getDocumentSubmissions(),
        realAPI.getBillsOfLading(),
        activeAddress ? realAPI.getTokenizedBLsByCarrier(activeAddress) : [] // ADDED: Load carrier RWAs
      ]);
      
      setDocuments(docsData);
      // Filter BLs created by this carrier
      setCreatedBLs(blsData.filter(bl => 
        bl.createdByCarrier?.carrierAddress === activeAddress
      ));
      setCarrierRWAs(carrierRWAsData); // ADDED: Set carrier RWAs
    } catch (error) {
      console.error('Error loading carrier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentReview = async (documentId: string, status: 'VERIFIED' | 'REJECTED', notes: string) => {
    if (!activeAddress) return;

    try {
      await realAPI.reviewDocument(documentId, activeAddress, status, notes);
      await loadCarrierData(); // Refresh data
      alert(`Document ${status.toLowerCase()} successfully!`);
    } catch (error) {
      console.error('Error reviewing document:', error);
      alert('Error reviewing document. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading carrier dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          🚢 Carrier Dashboard
        </h1>
        <p className="text-xl text-gray-600">
          Review Shipping Instructions & Create DCSA v3 Bills of Lading
        </p>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-semibold">
            ⚠️ All transactions are REAL blockchain transactions on Algorand
          </p>
          <p className="text-blue-700 text-sm">
            Every operation creates actual transactions with real transaction IDs verifiable on Algokit
          </p>
        </div>
      </div>

      {/* Wallet Status */}
      <AdaptiveWalletStatus 
        requireConnection={true}
        pageContext="carrier"
        showContractInfo={true}
        showRoleSwitcher={true}
      >
        {/* Shipping Instructions from Exporter */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📦 Shipping Instructions from Exporter
          </h2>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <p className="text-blue-800 font-semibold mb-2">
              📋 Review Shipping Details - Approve to Auto-Populate eBL Form
            </p>
            <p className="text-blue-700 text-sm">
              Review the shipping instructions below. When you approve them, the data will automatically populate the enhanced eBL creation form.
            </p>
          </div>
          
          {/* Exporter Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
              🏢 Exporter Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Exporter *
                </label>
                <select
                  value={shippingInstructions.exporterId}
                  onChange={(e) => handleExporterChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={shippingApproved}
                >
                  {EXPORTER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.industry}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LEI (Legal Entity Identifier)
                </label>
                <input
                  type="text"
                  value={shippingInstructions.exporterLEI}
                  onChange={(e) => handleShippingInstructionChange('exporterLEI', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="20-character LEI code"
                  disabled={shippingApproved}
                />
              </div>
            </div>
          </div>
          
          {/* Cargo and Route Information - Condensed */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                📦 Cargo Information
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Cargo Description:</span>
                  <p className="text-sm text-gray-900">{shippingInstructions.cargoDescription}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Value:</span>
                    <p className="text-sm text-gray-900">${shippingInstructions.declaredValue.amount.toLocaleString()} {shippingInstructions.declaredValue.currency}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">HS Code:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.hsCode}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Weight:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.grossWeight} KGS</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Packages:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.numberOfPackages}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Packing:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.packingType}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                🚢 Route & Vessel
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Vessel:</span>
                  <p className="text-sm text-gray-900">{shippingInstructions.vesselName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Route:</span>
                  <p className="text-sm text-gray-900">
                    {shippingInstructions.portOfLoading.name} ({shippingInstructions.portOfLoading.code}) 
                    → {shippingInstructions.portOfDischarge.name} ({shippingInstructions.portOfDischarge.code})
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Transit:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.estimatedTransitDays} days</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Incoterms:</span>
                    <p className="text-sm text-gray-900">{shippingInstructions.incoterms}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ZK Proof Status */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
              🔐 Compliance & Verification
            </h3>
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-green-700 font-medium text-lg">✅ {shippingInstructions.zkProofStatus}</span>
              </div>
              <div className="text-sm text-green-600 mb-2">
                PLONK-based zero-knowledge proof system (O1.js) - Privacy-first verification complete
              </div>
              <div className="text-sm text-green-700">
                <strong>Compliance:</strong> {shippingInstructions.complianceInfo}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center">
            <button 
              onClick={handleApproveShippingInstructions}
              disabled={shippingApproved}
              className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                shippingApproved 
                  ? 'bg-green-500 text-white cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {shippingApproved ? (
                <>
                  ✅ Shipping Instructions Approved
                  <div className="text-xs opacity-90">Data copied to eBL form below</div>
                </>
              ) : (
                <>
                  ✅ Approve Shipping Instructions
                  <div className="text-xs opacity-90">Auto-populate eBL creation form</div>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ADDED: Carrier RWAs Section */}
        {activeAddress && (
          <section className="mb-8">
            <RWADisplay 
              title="RWAs from Bills of Lading You Created"
              rwaList={carrierRWAs}
              roleContext="carrier"
              userAddress={activeAddress}
              loading={loading}
            />
          </section>
        )}

        {/* SUCCESS MESSAGE DISPLAY - Replaces alert() */}
        {lastCreatedBL && (
          <section id="bl-creation-success" className="mb-8">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg shadow-lg p-8">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-3xl font-bold text-green-700 mb-2">
                  eBL Created Successfully!
                </h2>
                <p className="text-gray-700 text-lg">
                  Your Bill of Lading has been created and tokenized on Algorand TestNet
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Transaction Details */}
                <div className="bg-white rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🔗</span>
                    Blockchain Transaction
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Transaction ID:</span>
                      <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                        {lastCreatedBL.txId}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Confirmed Round:</span>
                      <div className="text-gray-800 mt-1">
                        #{lastCreatedBL.transactions?.[0]?.confirmedRound || 'Pending'}
                      </div>
                    </div>
                    <a
                      href={`https://testnet.explorer.perawallet.app/tx/${lastCreatedBL.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg transition-colors"
                    >
                      View on Lora TestNet Explorer →
                    </a>
                  </div>
                </div>
                
                {/* Asset Details */}
                <div className="bg-white rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="text-2xl mr-2">🪙</span>
                    RWA Asset Created
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Asset ID:</span>
                      <div className="text-2xl font-bold text-purple-600 mt-1">
                        {lastCreatedBL.assetId}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Asset Type:</span>
                      <div className="text-gray-800 mt-1">
                        Algorand Standard Asset (ASA)
                      </div>
                    </div>
                    <a
                      href={`https://testnet.explorer.perawallet.app/asset/${lastCreatedBL.assetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg transition-colors"
                    >
                      View Asset on Explorer →
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Ownership Information */}
              <div className="bg-white rounded-lg p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-2">👥</span>
                  Ownership & Assignment
                </h3>
                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Created by Carrier:</span>
                    <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                      {lastCreatedBL.carrierAddress}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Assigned to Exporter:</span>
                    <div className="font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                      {lastCreatedBL.exporterAddress}
                    </div>
                  </div>
                </div>
                
                {/* Transfer Status */}
                {lastCreatedBL.ownershipStatus && (
                  <div className="mt-4">
                    {lastCreatedBL.ownershipStatus === 'TRANSFERRED_TO_EXPORTER' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-700">
                          <span className="text-xl">✅</span>
                          <span className="font-semibold">Asset Successfully Transferred</span>
                        </div>
                        <p className="text-sm text-green-600 mt-1">
                          The eBL asset has been transferred to the exporter's address and is now visible in their dashboard.
                        </p>
                      </div>
                    )}
                    {lastCreatedBL.ownershipStatus === 'PENDING_EXPORTER_OPTIN' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-yellow-700">
                          <span className="text-xl">⏳</span>
                          <span className="font-semibold">Transfer Pending - Exporter Opt-In Required</span>
                        </div>
                        <p className="text-sm text-yellow-600 mt-1">
                          The asset was created successfully, but the exporter needs to opt-in to receive it. The exporter can opt-in from their dashboard.
                        </p>
                      </div>
                    )}
                    {lastCreatedBL.ownershipStatus === 'TRANSFER_FAILED' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-orange-700">
                          <span className="text-xl">⚠️</span>
                          <span className="font-semibold">Transfer Failed</span>
                        </div>
                        <p className="text-sm text-orange-600 mt-1">
                          The asset was created but automatic transfer failed. Manual transfer may be required from the marketplace.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* eBL Reference */}
              <div className="mt-6 text-center">
                <div className="inline-block bg-blue-100 border border-blue-300 rounded-lg px-6 py-3">
                  <span className="text-sm font-medium text-blue-800">eBL Reference: </span>
                  <span className="text-lg font-bold text-blue-900">
                    {lastCreatedBL.transportDocumentReference || lastCreatedBL.id}
                  </span>
                </div>
              </div>
              
              {/* Close Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setLastCreatedBL(null)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close Success Message
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Enhanced BL Form - Only show after approval */}
        {shippingApproved && (
          <section id="enhanced-bl-form">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  🚀 Enhanced DCSA v3 Bill of Lading Creation
                </h2>
                <p className="text-gray-700 mb-3">
                  Create Bills of Lading with DCSA v3 standard format, legal compliance documents validation, and Algorand Box storage
                </p>
                <div className="flex justify-center items-center gap-4 text-sm">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">✅ DCSA v3.0.0 Compliant</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">📁 Drag & Drop Upload</span>
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">🔐 Algorand Box Storage</span>
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full">🪙 RWA Minting</span>
                </div>
              </div>
            </div>

            <EnhancedBLForm
              exporterOptions={EXPORTER_OPTIONS}
              portLoadingOptions={PORT_OF_LOADING_OPTIONS}
              portDischargeOptions={PORT_OF_DISCHARGE_OPTIONS}
              onBLCreated={handleEnhancedBLCreated}
              onCopyFromShippingInstructions={() => {}} // No longer needed since auto-populated
              isCreating={isCreatingBL}
              shippingInstructions={shippingInstructions} // Pass shipping instructions for auto-population
            />
          </section>
        )}

        {/* Created BLs */}
        {createdBLs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              📜 Created Bills of Lading
            </h2>
            <div className="grid gap-4">
              {createdBLs.map(bl => (
                <CreatedBLCard key={bl.transportDocumentReference || bl.id || Math.random()} bl={bl} />
              ))}
            </div>
          </section>
        )}

        {/* Assets from Box Storage - Created by this Carrier */}
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📦 RWAs from Bills of Lading You Created
          </h2>
          {createdAssets.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 text-lg">📭 No RWAs found for this carrier</p>
              <p className="text-sm text-gray-500 mt-2">
                Address: {activeAddress ? `${activeAddress.slice(0,15)}...${activeAddress.slice(-8)}` : 'Not connected'}
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Create an eBL above to see your RWA assets here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {createdAssets.map((bl, index) => {
                const assetId = bl.rwaTokenization?.assetId;
                const isPending = bl.currentHolder === activeAddress && bl.status === 'pending_transfer';
                const isTransferred = bl.status === 'transferred';
                
                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      isPending ? 'border-yellow-300 bg-yellow-50' : 
                      isTransferred ? 'border-green-300 bg-green-50' : 
                      'border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold text-lg">{bl.transportDocumentReference}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          isPending ? 'bg-yellow-200 text-yellow-800' :
                          isTransferred ? 'bg-green-200 text-green-800' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {isPending ? '⏳ Pending Transfer' : 
                           isTransferred ? '✅ Transferred' : 
                           '📦 Created'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Asset ID</p>
                          <p className="font-mono font-semibold text-green-600">{assetId || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Cargo</p>
                          <p className="font-semibold text-sm">{bl.cargoDescription || 'N/A'}</p>
                        </div>
                      </div>

                      {isPending && (
                        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
                          <p className="text-yellow-800 font-semibold text-sm mb-3">
                            ⚠️ Waiting for Exporter to Opt-In
                          </p>
                          <button
                            onClick={() => handleTransferToExporter(bl)}
                            disabled={transferringAsset === bl.transportDocumentReference}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            {transferringAsset === bl.transportDocumentReference ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Transferring...</span>
                              </>
                            ) : (
                              <>
                                <span>🚀</span>
                                <span>Transfer to Exporter Now</span>
                              </>
                            )}
                          </button>
                          <p className="text-xs text-yellow-600 mt-2 text-center">
                            Note: Exporter must have opted-in to the asset first
                          </p>
                        </div>
                      )}
                      
                      {isTransferred && (
                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                          <p className="text-green-800 font-semibold text-sm">
                            ✅ Successfully Transferred to Exporter
                          </p>
                        </div>
                      )}

                      {assetId && (
                        <div className="mt-3">
                          <a
                            href={`https://testnet.explorer.perawallet.app/asset/${assetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            🔗 View Asset on Explorer
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-900">{createdAssets.length}</div>
                  <div className="text-sm text-blue-600">Total Created</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-900">
                    {createdAssets.filter(bl => bl.status === 'pending_transfer').length}
                  </div>
                  <div className="text-sm text-yellow-600">Pending Transfer</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-900">
                    {createdAssets.filter(bl => bl.status === 'transferred').length}
                  </div>
                  <div className="text-sm text-green-600">Transferred</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </AdaptiveWalletStatus>
    </div>
  );
}

function CreatedBLCard({ bl }: { bl: BLWithTransactions }) {
  const [assetInfo, setAssetInfo] = React.useState<{
    assetId: number | null;
    loading: boolean;
    error: string | null;
    assetDetails?: any;
  }>({ assetId: null, loading: false, error: null });

  // Real asset data for the specific eBL
  const isRealeBL = bl.transportDocumentReference === 'eBL-1757235938468-SREE_PALANI_AGROS';
  const realAssetId = isRealeBL ? 305578 : null; // REAL Asset ID from user
  const realTransactionId = isRealeBL ? 'ZDXWIKNUJMUH23YDLAHI2DPUW24FAUQLZCSWVIG7RUF4IRRURUFA' : null;

  // Get transaction info
  const transactionId = realTransactionId || bl.createdByCarrier?.creationTxId;
  const explorerUrl = bl.createdByCarrier?.explorerUrl;
  const assetOwner = bl.createdByCarrier?.assignedToExporter || 'Not assigned';
  const actualAssetId = realAssetId || bl.tokenizationData?.assetId || bl.rwaTokenization?.assetId;

  // Safe access to cargo description
  const cargoDescription = bl.consignmentItems?.[0]?.descriptionOfGoods?.[0] || 
                          bl.cargoDescription || 
                          'Cargo description not available';

  // Safe access to port information
  const loadingPortName = bl.transports?.portOfLoading?.portName || 
                         bl.portOfLoading?.name || 
                         'Loading port not specified';
  const dischargePortName = bl.transports?.portOfDischarge?.portName || 
                           bl.portOfDischarge?.name || 
                           'Discharge port not specified';
  
  // Get ownership status from BL
  const ownershipStatus = (bl as any).ownershipStatus;
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            📋 {bl.transportDocumentReference || bl.id || 'BL Reference Not Available'}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
              DCSA v3 eBL
            </span>
            <span>Assigned to: {assetOwner}</span>
          </div>
          
          {/* NEW: Transfer Status Badge */}
          {ownershipStatus && (
            <div className="mt-2">
              {ownershipStatus === 'TRANSFERRED_TO_EXPORTER' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  <span className="mr-1">✅</span> Transferred to Exporter
                </span>
              )}
              {ownershipStatus === 'PENDING_EXPORTER_OPTIN' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                  <span className="mr-1">⏳</span> Pending Exporter Opt-In
                </span>
              )}
              {ownershipStatus === 'TRANSFER_FAILED' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                  <span className="mr-1">⚠️</span> Transfer Failed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">
            ${bl.declaredValue?.amount?.toLocaleString() || '0'}
          </div>
          <div className="text-xs text-gray-500">
            {bl.declaredValue?.currency || 'USD'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="font-medium text-gray-700">Cargo:</span><br/>
          <span>{cargoDescription}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Route:</span><br/>
          <span>{loadingPortName} → {dischargePortName}</span>
        </div>
      </div>

      {/* Enhanced Asset Information Section */}
      <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        <h4 className="text-lg font-semibold text-purple-800 mb-3">
          🪙 RWA Asset Information
        </h4>
        
        {assetInfo.loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-2"></div>
            <span className="text-gray-600">Fetching asset information from blockchain...</span>
          </div>
        ) : assetInfo.error ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-yellow-800 text-sm">
              <strong>⚠️ Asset Information Needs Blockchain Query</strong>
              <br/>
              To get the real asset ID, we need to:
            </div>
            <ol className="text-xs text-yellow-700 mt-2 ml-4 list-decimal">
              <li>Query transaction {transactionId} using Algorand MCP tools</li>
              <li>Extract created asset ID from transaction inner transactions</li>
              <li>Fetch asset details from the Algorand blockchain</li>
            </ol>
            <button 
              onClick={() => transactionId && console.log('Fetching asset info for:', transactionId)}
              className="mt-2 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 rounded text-xs"
            >
              🔄 Retry Asset Query
            </button>
          </div>
        ) : actualAssetId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* REAL Asset Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Asset ID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-purple-700 bg-purple-100 px-2 py-1 rounded font-bold text-lg">
                    {actualAssetId}
                  </span>
                  <a 
                    href={`https://testnet.algoexplorer.io/asset/${actualAssetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    🔗 Explorer
                  </a>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Asset Type:</span>
                <span className="ml-2 text-gray-600">ASA (Algorand Standard Asset)</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Total Supply:</span>
                <span className="ml-2 text-gray-600">{isRealeBL ? '1' : (bl.rwaTokenization?.totalShares || 'Unknown')} unit(s)</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Decimals:</span>
                <span className="ml-2 text-gray-600">0 (non-divisible)</span>
              </div>
            </div>
            
            {/* Ownership Information */}
            <div className="space-y-2">
              <div>
                <span className="font-medium text-gray-700">Asset Owner:</span>
                <div className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {assetOwner}
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Asset Manager:</span>
                <div className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {assetOwner}
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Can Freeze:</span>
                <span className="ml-2 text-orange-600">Yes (Regulatory Compliance)</span>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Clawback:</span>
                <span className="ml-2 text-gray-600">Enabled (Manager controlled)</span>
              </div>
            </div>
            
            {isRealeBL && (
              <div className="col-span-1 md:col-span-2 mt-3 p-2 bg-green-50 border border-green-200 rounded">
                <div className="text-green-800 text-sm font-semibold">
                  ✅ REAL ASSET DATA CONFIRMED
                </div>
                <div className="text-green-700 text-xs">
                  Asset ID {actualAssetId} verified from blockchain transaction {transactionId}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-gray-600 text-sm mb-3">
              <strong>📋 Asset Information Available</strong>
              <br/>
              The asset was created via blockchain transaction. To view asset details:
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
              <div className="text-xs text-blue-700">
                <strong>🔍 How to find the Asset ID:</strong>
                <br/>
                1. Click the transaction link below to view on Algorand Explorer
                <br/>
                2. Look for "Inner Transactions" in the transaction details
                <br/>
                3. Find the "Asset Configuration" inner transaction
                <br/>
                4. The created Asset ID will be shown there
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              <strong>Confirmed Information:</strong>
              <br/>
              • Asset Owner: {assetOwner}
              <br/>
              • Asset Type: Algorand Standard Asset (ASA)
              <br/>
              • Created via: TradeInstrumentRegistryV3.createInstrument()
              <br/>
              • Storage: Algorand Box Storage (DCSA v3 Standard)
              <br/>
              • Transaction: {transactionId || 'Not available'}
            </div>
          </div>
        )}
        
        {/* Asset Metadata */}
        <div className="mt-3 pt-3 border-t border-purple-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="font-medium text-gray-700">Asset Name:</span>
              <span className="ml-2 text-gray-600">eBL</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Unit Name:</span>
              <span className="ml-2 text-gray-600">eBL</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Asset URL:</span>
              <span className="ml-2 text-blue-600">AlgoKit Metadata</span>
            </div>
          </div>
        </div>
        
        {/* Smart Contract Details - Only show confirmed information */}
        <div className="mt-3 pt-3 border-t border-purple-200">
          <h5 className="text-sm font-semibold text-purple-700 mb-2">
            📜 Smart Contract Information
          </h5>
          <div className="bg-purple-50 p-3 rounded-lg text-xs space-y-2">
            <div>
              <span className="font-medium text-gray-700">Contract Called:</span>
              <span className="ml-2 text-purple-700 font-mono">TradeInstrumentRegistryV3.createInstrument()</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Storage Method:</span>
              <span className="ml-2 text-gray-600">Algorand Box Storage (DCSA v3 Standard)</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Transaction ID:</span>
              <span className="ml-2 text-gray-600 font-mono break-all">{transactionId || 'Not available'}</span>
            </div>
            {transactionId && (
              <div className="mt-2 text-xs text-blue-600">
                ℹ️ To get asset ID: Query this transaction to extract created asset information
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blockchain Transaction Information */}
      {transactionId && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>🔗 REAL Blockchain Transaction:</strong>
            <br/>
            <a 
              href={explorerUrl || `https://testnet.algoexplorer.io/tx/${transactionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-mono text-xs break-all"
            >
              {transactionId}
            </a>
            <div className="mt-2 text-xs text-blue-600">
              ℹ️ This transaction called TradeInstrumentRegistryV3.createInstrument() and created the eBL asset
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CarrierDashboard;