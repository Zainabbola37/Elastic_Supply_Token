import { describe, expect, it, beforeEach, vi } from "vitest";

describe("AlgoStable - Algorithmic Stablecoin Contract Tests", () => {
  // Mock contract state
  let contract;
  let ownerAddress;
  let blockHeight;
  let balances;
  let approvedContracts;
  let totalSupply;
  let currentPrice;
  let lastRebalanceHeight;
  let expansionThreshold;
  let contractionThreshold;
  let rebalanceCooldown;
  
  const TARGET_PRICE = 1000000; // $1.00 in micro-units
  const INITIAL_SUPPLY = 1000000000000; // 1,000,000 tokens with 6 decimals

  beforeEach(() => {
    // Mock contract owner
    ownerAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    
    // Initialize contract state
    blockHeight = 0;
    totalSupply = INITIAL_SUPPLY;
    currentPrice = TARGET_PRICE;
    lastRebalanceHeight = 0;
    expansionThreshold = 50000; // 5%
    contractionThreshold = 50000; // 5%
    rebalanceCooldown = 144; // ~24 hours
    
    // Initialize balances and approved contracts
    balances = new Map();
    balances.set(ownerAddress, INITIAL_SUPPLY);
    approvedContracts = new Map();
    
    // Mock contract interface
    contract = {
      // SIP-010 compatible functions
      getName: () => "AlgoStable",
      getSymbol: () => "ASTB",
      getDecimals: () => 6,
      getTotalSupply: () => totalSupply,
      getBalance: (account) => balances.get(account) || 0,
      
      // Transfer function
      transfer: (amount, sender, recipient, memo = null) => {
        const senderBalance = balances.get(sender) || 0;
        if (senderBalance < amount) {
          return { success: false, error: "u102" }; // err-insufficient-balance
        }
        
        balances.set(sender, senderBalance - amount);
        balances.set(recipient, (balances.get(recipient) || 0) + amount);
        
        return { success: true };
      },
      
      // Authorization functions
      isAuthorized: (sender, caller) => {
        return sender === caller || approvedContracts.get(caller) === true;
      },
      
      setApprovedContract: (caller, contract, approved) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        approvedContracts.set(contract, approved);
        return { success: true };
      },
      
      // Price oracle functions
      updatePriceFeed: (caller, price) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        currentPrice = price;
        return { success: true };
      },
      
      getCurrentPrice: () => currentPrice,
      
      // Block height functions
      updateBlockHeight: (caller, height) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        blockHeight = height;
        return { success: true };
      },
      
      // Stability mechanism functions
      priceDeviation: () => {
        return currentPrice > TARGET_PRICE 
          ? currentPrice - TARGET_PRICE 
          : TARGET_PRICE - currentPrice;
      },
      
      needsRebalance: () => {
        const cooldownPassed = (blockHeight - lastRebalanceHeight) >= rebalanceCooldown;
        return cooldownPassed && (
          currentPrice >= (TARGET_PRICE + expansionThreshold) ||
          currentPrice <= (TARGET_PRICE - contractionThreshold)
        );
      },
      
      calculateExpansionAmount: () => {
        const deviationPercent = Math.floor(((currentPrice - TARGET_PRICE) * 1000) / TARGET_PRICE);
        const expansionRate = Math.min(deviationPercent, 100); // max-expansion-rate is 100 (10%)
        return Math.floor((totalSupply * expansionRate) / 1000);
      },
      
      calculateContractionAmount: () => {
        const deviationPercent = Math.floor(((TARGET_PRICE - currentPrice) * 1000) / TARGET_PRICE);
        const contractionRate = Math.min(deviationPercent, 100); // max-contraction-rate is 100 (10%)
        return Math.floor((totalSupply * contractionRate) / 1000);
      },
      
      rebalance: (caller) => {
        if (!contract.needsRebalance()) {
          return { success: false, error: "u106" }; // Not ready for rebalance
        }
        
        if (currentPrice >= (TARGET_PRICE + expansionThreshold)) {
          // Expansion
          const expansionAmount = contract.calculateExpansionAmount();
          totalSupply += expansionAmount;
          balances.set(ownerAddress, (balances.get(ownerAddress) || 0) + expansionAmount);
          lastRebalanceHeight = blockHeight;
          return { 
            success: true, 
            result: { action: "expansion", amount: expansionAmount } 
          };
        } else {
          // Contraction
          const contractionAmount = contract.calculateContractionAmount();
          const reserveBalance = balances.get(ownerAddress) || 0;
          
          if (reserveBalance < contractionAmount) {
            return { success: false, error: "u105" }; // err-contraction-failed
          }
          
          totalSupply -= contractionAmount;
          balances.set(ownerAddress, reserveBalance - contractionAmount);
          lastRebalanceHeight = blockHeight;
          return { 
            success: true, 
            result: { action: "contraction", amount: contractionAmount } 
          };
        }
      },
      
      // Governance functions
      updateExpansionThreshold: (caller, newThreshold) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        if (newThreshold <= 0) {
          return { success: false, error: "u110" };
        }
        expansionThreshold = newThreshold;
        return { success: true };
      },
      
      updateContractionThreshold: (caller, newThreshold) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        if (newThreshold <= 0) {
          return { success: false, error: "u111" };
        }
        contractionThreshold = newThreshold;
        return { success: true };
      },
      
      updateRebalanceCooldown: (caller, newCooldown) => {
        if (caller !== ownerAddress) {
          return { success: false, error: "u100" }; // err-owner-only
        }
        if (newCooldown <= 0) {
          return { success: false, error: "u112" };
        }
        rebalanceCooldown = newCooldown;
        return { success: true };
      }
    };
  });

  describe("Basic Token Functions", () => {
    it("should return correct token details", () => {
      // Test SIP-010 functions
      expect(contract.getName()).toEqual("AlgoStable");
      expect(contract.getSymbol()).toEqual("ASTB");
      expect(contract.getDecimals()).toEqual(6);
    });

    it("should initialize with correct total supply", () => {
      expect(contract.getTotalSupply()).toEqual(INITIAL_SUPPLY);
    });

    it("should initialize with all tokens assigned to owner", () => {
      expect(contract.getBalance(ownerAddress)).toEqual(INITIAL_SUPPLY);
    });
  });

  describe("Token Transfers", () => {
    const recipientAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
    const transferAmount = 5000000000; // 5,000 tokens

    it("should transfer tokens between accounts", () => {
      // Initial owner balance
      const initialOwnerBalance = contract.getBalance(ownerAddress);

      // Transfer tokens from owner to recipient
      const result = contract.transfer(transferAmount, ownerAddress, recipientAddress, null);
      expect(result.success).toBe(true);

      // Check recipient received the tokens
      const recipientBalance = contract.getBalance(recipientAddress);
      expect(recipientBalance).toEqual(transferAmount);

      // Check owner balance decreased accordingly
      const finalOwnerBalance = contract.getBalance(ownerAddress);
      expect(finalOwnerBalance).toEqual(initialOwnerBalance - transferAmount);
    });

    it("should fail on insufficient balance", () => {
      // Try to transfer more than available balance
      const tooMuchAmount = INITIAL_SUPPLY + 1;
      
      const result = contract.transfer(tooMuchAmount, ownerAddress, recipientAddress, null);
      expect(result.success).toBe(false);
      expect(result.error).toEqual("u102"); // err-insufficient-balance
    });

    it("should fail when sender is not authorized", () => {
      // Try to transfer from owner's account by an unauthorized sender
      const unauthorizedAddress = "ST3MCFZCA4GKYBYKK790X3T1VEWRSBT7ZYYRNSHV3";
      
      // Mock the isAuthorized check to fail by providing different sender and caller
      const mockTransfer = vi.fn().mockImplementation((amount, sender, recipient, memo) => {
        if (!contract.isAuthorized(sender, unauthorizedAddress)) {
          return { success: false, error: "u101" }; // err-not-authorized
        }
        return contract.transfer(amount, sender, recipient, memo);
      });
      
      const result = mockTransfer(transferAmount, ownerAddress, recipientAddress, null);
      
      // Should fail with not authorized error
      expect(result.success).toBe(false);
      expect(result.error).toEqual("u101"); // err-not-authorized
    });
  });

  describe("Price Oracle and Block Height", () => {
    it("should update price feed correctly", () => {
      const newPrice = 1100000; // $1.10
      
      // Update price feed
      const result = contract.updatePriceFeed(ownerAddress, newPrice);
      expect(result.success).toBe(true);

      // Verify price is updated
      expect(contract.getCurrentPrice()).toEqual(newPrice);
    });

    it("should update block height correctly", () => {
      const newHeight = 10000;
      
      // Update block height
      const heightResult = contract.updateBlockHeight(ownerAddress, newHeight);
      expect(heightResult.success).toBe(true);

      // Now update price to trigger rebalance need
      contract.updatePriceFeed(ownerAddress, 1100000); // $1.10, above target + threshold
      
      // Verify needs-rebalance is now true (since we've set a height and changed price)
      expect(contract.needsRebalance()).toBe(true);
    });
  });

  describe("Stability Mechanism", () => {
    beforeEach(() => {
      // Setup block height
      contract.updateBlockHeight(ownerAddress, 1000);
    });

    it("should expand supply when price is above target threshold", () => {
      // Set price 10% above target ($1.10)
      const highPrice = TARGET_PRICE + 100000;
      contract.updatePriceFeed(ownerAddress, highPrice);

      // Get initial supply
      const initialSupply = contract.getTotalSupply();
      
      // Perform rebalance
      const rebalanceResult = contract.rebalance(ownerAddress);
      
      expect(rebalanceResult.success).toBe(true);
      
      // Check that total supply increased
      const finalSupply = contract.getTotalSupply();
      expect(finalSupply).toBeGreaterThan(initialSupply);
      
      // Result should indicate expansion action
      expect(rebalanceResult.result.action).toEqual("expansion");
    });

    it("should contract supply when price is below target threshold", () => {
      // Set price 10% below target ($0.90)
      const lowPrice = TARGET_PRICE - 100000;
      contract.updatePriceFeed(ownerAddress, lowPrice);

      // Get initial supply
      const initialSupply = contract.getTotalSupply();
      
      // Perform rebalance
      const rebalanceResult = contract.rebalance(ownerAddress);
      
      expect(rebalanceResult.success).toBe(true);
      
      // Check that total supply decreased
      const finalSupply = contract.getTotalSupply();
      expect(finalSupply).toBeLessThan(initialSupply);
      
      // Result should indicate contraction action
      expect(rebalanceResult.result.action).toEqual("contraction");
    });

    it("should respect rebalance cooldown period", () => {
      // Set price above threshold
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + 100000);
      
      // First rebalance should succeed
      const firstRebalance = contract.rebalance(ownerAddress);
      expect(firstRebalance.success).toBe(true);
      
      // Immediate second rebalance should fail due to cooldown
      const secondRebalance = contract.rebalance(ownerAddress);
      expect(secondRebalance.success).toBe(false);
      expect(secondRebalance.error).toEqual("u106"); // Assertion failure from needs-rebalance
      
      // Update block height past cooldown (default is 144 blocks)
      contract.updateBlockHeight(ownerAddress, 1200); // Move forward 200 blocks
      
      // Now rebalance should succeed again
      const thirdRebalance = contract.rebalance(ownerAddress);
      expect(thirdRebalance.success).toBe(true);
    });
  });

  describe("Governance Functions", () => {
    it("should update expansion threshold", () => {
      const newThreshold = 75000; // 7.5%
      
      // Update threshold
      const result = contract.updateExpansionThreshold(ownerAddress, newThreshold);
      expect(result.success).toBe(true);
      
      // Test indirectly by setting price just above new threshold
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + newThreshold + 1000);
      
      // Update block height
      contract.updateBlockHeight(ownerAddress, 1000);
      
      // Check needs-rebalance
      expect(contract.needsRebalance()).toBe(true);
    });

    it("should update contraction threshold", () => {
      const newThreshold = 75000; // 7.5%
      
      // Update threshold
      const result = contract.updateContractionThreshold(ownerAddress, newThreshold);
      expect(result.success).toBe(true);
      
      // Test indirectly by setting price just below new threshold
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE - newThreshold - 1000);
      
      // Update block height
      contract.updateBlockHeight(ownerAddress, 1000);
      
      // Check needs-rebalance
      expect(contract.needsRebalance()).toBe(true);
    });

    it("should update rebalance cooldown", () => {
      const newCooldown = 50; // Shorter cooldown
      
      // Update cooldown
      const result = contract.updateRebalanceCooldown(ownerAddress, newCooldown);
      expect(result.success).toBe(true);
      
      // Setup for rebalance
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + 100000);
      contract.updateBlockHeight(ownerAddress, 1000);
      
      // First rebalance
      contract.rebalance(ownerAddress);
      
      // Move forward just past the new cooldown period
      contract.updateBlockHeight(ownerAddress, 1000 + newCooldown + 1);
      
      // Should be able to rebalance again
      const rebalanceResult = contract.rebalance(ownerAddress);
      expect(rebalanceResult.success).toBe(true);
    });

    it("should reject governance updates from non-owner accounts", () => {
      const nonOwner = "ST3MCFZCA4GKYBYKK790X3T1VEWRSBT7ZYYRNSHV3";
      const newThreshold = 60000;
      
      // Try to update expansion threshold from non-owner
      const result = contract.updateExpansionThreshold(nonOwner, newThreshold);
      
      // Should fail with owner-only error
      expect(result.success).toBe(false);
      expect(result.error).toEqual("u100"); // err-owner-only
      
      // Verify threshold didn't change
      expect(expansionThreshold).toEqual(50000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero balance accounts", () => {
      const emptyAccount = "ST3MCFZCA4GKYBYKK790X3T1VEWRSBT7ZYYRNSHV3";
      expect(contract.getBalance(emptyAccount)).toEqual(0);
    });

    it("should handle maximum contraction based on reserve", () => {
      // Transfer most of owner's tokens to another account
      const recipientAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
      const transferAmount = INITIAL_SUPPLY - 10000000000; // Leave only 10,000 tokens in reserve
      
      contract.transfer(transferAmount, ownerAddress, recipientAddress, null);
      
      // Set up for contraction
      contract.updateBlockHeight(ownerAddress, 1000);
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE - 100000); // 10% below target
      
      // Try rebalance
      const rebalanceResult = contract.rebalance(ownerAddress);
      
      // Should succeed but contract only what's available in reserve
      expect(rebalanceResult.success).toBe(true);
      expect(rebalanceResult.result.action).toEqual("contraction");
      
      // Should have contracted some amount but not more than reserve
      const ownerFinalBalance = contract.getBalance(ownerAddress);
      expect(ownerFinalBalance).toBeGreaterThanOrEqual(0);
    });
    
    it("should calculate correct expansion amounts based on price deviation", () => {
      // Set price to different levels and verify expansion amount changes accordingly
      
      // 5% above target
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + 50000);
      const expansionAmount5Percent = contract.calculateExpansionAmount();
      expect(expansionAmount5Percent).toEqual(Math.floor(INITIAL_SUPPLY * 0.05));
      
      // 8% above target
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + 80000);
      const expansionAmount8Percent = contract.calculateExpansionAmount();
      expect(expansionAmount8Percent).toEqual(Math.floor(INITIAL_SUPPLY * 0.08));
      
      // 15% above target (should be capped at 10%)
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE + 150000);
      const expansionAmount15Percent = contract.calculateExpansionAmount();
      expect(expansionAmount15Percent).toBeCloseTo(Math.floor(INITIAL_SUPPLY * 0.1), -6); // Allow some floating point deviation
    });
  });

  describe("Contract Integration", () => {
    it("should allow approved contracts to transfer tokens", () => {
      const approvedContractAddress = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";
      const recipientAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
      const transferAmount = 5000000000; // 5,000 tokens
      
      // Approve the contract
      contract.setApprovedContract(ownerAddress, approvedContractAddress, true);
      
      // The approved contract transfers tokens from owner to recipient
      // Mock this by setting the isAuthorized check manually
      const mockTransfer = vi.fn().mockImplementation((amount, sender, recipient, memo) => {
        if (!contract.isAuthorized(sender, approvedContractAddress)) {
          return { success: false, error: "u101" }; // err-not-authorized
        }
        return contract.transfer(amount, sender, recipient, memo);
      });
      
      const result = mockTransfer(transferAmount, ownerAddress, recipientAddress, null);
      
      // Should succeed
      expect(result.success).toBe(true);
      
      // Recipient should have tokens
      expect(contract.getBalance(recipientAddress)).toEqual(transferAmount);
    });

    it("should handle large rebalancing operations correctly", () => {
      // Set up for a very large expansion (150% price increase)
      contract.updateBlockHeight(ownerAddress, 1000);
      contract.updatePriceFeed(ownerAddress, TARGET_PRICE * 2.5); // 150% above target
      
      // Initial supply
      const initialSupply = contract.getTotalSupply();
      
      // Rebalance
      const rebalanceResult = contract.rebalance(ownerAddress);
      expect(rebalanceResult.success).toBe(true);
      
      // Should have expanded by maximum rate (10%)
      const expectedNewSupply = initialSupply * 1.1;
      expect(contract.getTotalSupply()).toBeCloseTo(expectedNewSupply, -5);
    });
  });
});