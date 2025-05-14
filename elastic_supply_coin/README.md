# AlgoStable: Algorithmic Stablecoin

AlgoStable (ASTB) is an algorithmic stablecoin implementation built on Clarity smart contracts. It's designed to maintain price stability around a target value of $1.00 through automated supply adjustments.

## Overview

AlgoStable uses a supply expansion and contraction mechanism to maintain price stability. When the price deviates significantly from the target price, the contract automatically rebalances by either minting new tokens (expansion) or burning tokens from the reserve (contraction).

## Key Features

- **Price Stabilization**: Automatically adjusts token supply based on price deviations from the $1.00 target
- **Expansion/Contraction Mechanism**: Increases or decreases supply based on market conditions
- **Governance Controls**: Adjustable parameters for thresholds, rates, and cooldown periods
- **SIP-010 Compatible**: Implements standard token interface for ecosystem compatibility

## Technical Details

### Core Mechanics

- **Target Price**: $1.00 (represented as 1,000,000 micro-units)
- **Expansion Threshold**: Triggers expansion when price exceeds target by 5%
- **Contraction Threshold**: Triggers contraction when price falls below target by 5%
- **Rebalance Cooldown**: 24-hour cooldown between rebalances (measured in blocks)
- **Maximum Adjustment Rates**: Supply can expand or contract by up to 10% per rebalance

### Contract Functions

#### Token Functions
- `get-name`: Returns token name
- `get-symbol`: Returns token symbol
- `get-decimals`: Returns token decimals (6)
- `get-total-supply`: Returns current total supply
- `get-balance`: Returns account balance
- `transfer`: Transfers tokens between accounts

#### Stability Functions
- `update-price-feed`: Updates the price oracle (owner only)
- `get-current-price`: Returns current token price
- `price-deviation`: Calculates deviation from target price
- `needs-rebalance`: Determines if rebalancing is needed
- `rebalance`: Executes supply adjustment based on price conditions

#### Governance Functions
- `update-expansion-threshold`: Changes expansion threshold
- `update-contraction-threshold`: Changes contraction threshold
- `update-rebalance-cooldown`: Changes cooldown period
- `set-approved-contract`: Approves contracts for token transfers
- `update-block-height`: Updates the current block height

## Error Codes

| Code | Description |
|------|-------------|
| 100  | Owner only function |
| 101  | Not authorized |
| 102  | Insufficient balance |
| 103  | Price feed invalid |
| 104  | Expansion failed |
| 105  | Contraction failed |
| 106  | Rebalance not needed |

## Integration

### For Users

To interact with AlgoStable:
1. Acquire ASTB tokens through approved exchanges or mechanisms
2. Use ASTB as a stable medium of exchange
3. Benefit from automatic price stabilization mechanism

### For Developers

To integrate AlgoStable into your applications:
1. Implement the SIP-010 token interface
2. Use the token contract for transfers and balance checks
3. Monitor rebalance events for supply changes

## Future Improvements

- Add decentralized governance mechanism
- Integrate with multiple price oracles for robustness
- Implement more sophisticated supply adjustment algorithms
- Add additional stability mechanisms (e.g., bond system, reserves)
- Develop a DAO for community governance

## Security Considerations

- The contract owner has significant control over parameters
- Price feed accuracy is critical for stability
- Supply adjustments are bounded to prevent extreme changes
- Cooldown periods prevent excessive rebalancing

## License

[Insert appropriate license information here]

## Contact

[Insert contact information here]