;; Algorithmic Stablecoin Implementation in Clarity
;; This contract implements a price-stable cryptocurrency that automatically
;; adjusts supply based on price deviations from the target.

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-price-feed-invalid (err u103))
(define-constant err-expansion-failed (err u104))
(define-constant err-contraction-failed (err u105))

;; Token configurations
(define-constant token-name "AlgoStable")
(define-constant token-symbol "ASTB")
(define-constant target-price u1000000) ;; Target price in micro-units (equivalent to $1.00)
(define-data-var expansion-threshold uint u50000) ;; 5% above target
(define-data-var contraction-threshold uint u50000) ;; 5% below target
(define-data-var max-expansion-rate uint u100) ;; Maximum 10% supply expansion per rebalance
(define-data-var max-contraction-rate uint u100) ;; Maximum 10% supply contraction per rebalance
(define-data-var rebalance-cooldown uint u144) ;; ~24 hours (assuming 10 min blocks)

;; Data variables
(define-data-var total-supply uint u1000000000000) ;; Initial supply: 1,000,000 tokens (with 6 decimals)
(define-data-var last-rebalance-height uint u0)
(define-data-var current-block-height uint u0) ;; Track current block height manually
(define-data-var current-price uint target-price) ;; Initial price set to target

;; Data maps
(define-map balances principal uint)
(define-map approved-contracts principal bool)

;; Oracle interface - would connect to an actual price oracle in production
(define-map price-oracle-data (string-ascii 16) uint)

;; Update current block height (would be called by authorized entities)
(define-public (update-block-height (height uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set current-block-height height)
    (ok true)
  )
)

;; Initialize token with owner balance equal to total supply
(define-private (initialize)
  (map-set balances contract-owner (var-get total-supply))
)

;; SIP-010 compatible functions
(define-read-only (get-name)
  (ok token-name)
)

(define-read-only (get-symbol)
  (ok token-symbol)
)

(define-read-only (get-decimals)
  (ok u6) ;; 6 decimal places, consistent with micro-units
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

(define-public (set-approved-contract (contract principal) (approved bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (map-set approved-contracts contract approved))
  )
)

(define-read-only (is-approved-contract (contract principal))
  (default-to false (map-get? approved-contracts contract))
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-approved-contract tx-sender)) err-not-authorized)
    (asserts! (>= (default-to u0 (map-get? balances sender)) amount) err-insufficient-balance)
    
    (map-set balances sender (- (default-to u0 (map-get? balances sender)) amount))
    (map-set balances recipient (+ (default-to u0 (map-get? balances recipient)) amount))
    
    (print {type: "transfer", amount: amount, sender: sender, recipient: recipient})
    
    ;; Handle memo if provided
    (match memo
      memo-data (begin
                  (print {type: "memo", memo: memo-data})
                  true)
      false)
    
    (ok true)
  )
)

;; Simplified price oracle functions (would integrate with actual oracle in production)
(define-public (update-price-feed (price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set current-price price)
    (map-set price-oracle-data "ASTB-USD" price)
    (ok true)
  )
)

(define-read-only (get-current-price)
  (ok (var-get current-price))
)

;; Stability mechanism functions
(define-read-only (price-deviation)
  ;; Calculates current deviation from target price (can be positive or negative)
  (let (
    (price (var-get current-price))
  )
    (if (> price target-price)
      (- price target-price)  ;; Above target (positive deviation)
      (- target-price price)  ;; Below target (negative deviation)
    )
  )
)

(define-read-only (needs-rebalance)
  ;; Determines if rebalancing is needed based on price deviation
  (let (
    (price (var-get current-price))
    (current-height (var-get current-block-height))
    (cooldown-passed (>= (- current-height (var-get last-rebalance-height)) (var-get rebalance-cooldown)))
    (exp-threshold (var-get expansion-threshold))
    (cont-threshold (var-get contraction-threshold))
  )
    (and cooldown-passed
      (or 
        (>= price (+ target-price exp-threshold))
        (<= price (- target-price cont-threshold))
      )
    )
  )
)

(define-private (calculate-expansion-amount)
  ;; Calculate amount of new tokens to mint when price is above target
  (let (
    (price (var-get current-price))
    (current-supply (var-get total-supply))
    (max-exp-rate (var-get max-expansion-rate))
  )
    ;; Higher the price above target, the more we expand, up to max-expansion-rate
    (let (
      (deviation-percent (/ (* (- price target-price) u1000) target-price))
      ;; Implement min function manually with if statement
      (expansion-rate (if (< deviation-percent max-exp-rate) 
                        deviation-percent 
                        max-exp-rate))
    )
      (/ (* current-supply expansion-rate) u1000)
    )
  )
)

(define-private (calculate-contraction-amount)
  ;; Calculate amount of tokens to burn when price is below target
  (let (
    (price (var-get current-price))
    (current-supply (var-get total-supply))
    (max-cont-rate (var-get max-contraction-rate))
  )
    ;; Lower the price below target, the more we contract, up to max-contraction-rate
    (let (
      (deviation-percent (/ (* (- target-price price) u1000) target-price))
      ;; Implement min function manually with if statement
      (contraction-rate (if (< deviation-percent max-cont-rate) 
                         deviation-percent 
                         max-cont-rate))
    )
      (/ (* current-supply contraction-rate) u1000)
    )
  )
)

(define-private (expand-supply (amount uint))
  ;; Increase supply by minting new tokens
  (begin
    (var-set total-supply (+ (var-get total-supply) amount))
    (map-set balances contract-owner (+ (default-to u0 (map-get? balances contract-owner)) amount))
    (print {type: "expansion", amount: amount})
    true
  )
)

(define-private (contract-supply (amount uint))
  ;; Decrease supply by burning tokens from reserve
  (let (
    (reserve-balance (default-to u0 (map-get? balances contract-owner)))
  )
    (if (>= reserve-balance amount)
      (begin
        (var-set total-supply (- (var-get total-supply) amount))
        (map-set balances contract-owner (- reserve-balance amount))
        (print {type: "contraction", amount: amount})
        true
      )
      false
    )
  )
)

(define-public (rebalance)
  ;; Adjusts token supply based on current price deviation
  (let (
    (price (var-get current-price))
    (exp-threshold (var-get expansion-threshold))
    (current-height (var-get current-block-height))
  )
    (asserts! (needs-rebalance) (err u106)) ;; Only rebalance when needed
    
    (if (>= price (+ target-price exp-threshold))
      ;; Price is above target - expand supply to reduce price
      (let (
        (expansion-amount (calculate-expansion-amount))
      )
        (asserts! (expand-supply expansion-amount) err-expansion-failed)
        (var-set last-rebalance-height current-height)
        (ok {action: "expansion", amount: expansion-amount})  
      )
      
      ;; Price is below target - contract supply to increase price
      (let (
        (contraction-amount (calculate-contraction-amount))
      )
        (asserts! (contract-supply contraction-amount) err-contraction-failed)
        (var-set last-rebalance-height current-height)
        (ok {action: "contraction", amount: contraction-amount})
      )
    )
  )
)

;; Governance functions (simplified)
(define-public (update-expansion-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-threshold u0) (err u110))
    (var-set expansion-threshold new-threshold)
    (ok true)
  )
)

(define-public (update-contraction-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-threshold u0) (err u111))
    (var-set contraction-threshold new-threshold)
    (ok true)
  )
)

(define-public (update-rebalance-cooldown (new-cooldown uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-cooldown u0) (err u112))
    (var-set rebalance-cooldown new-cooldown)
    (ok true)
  )
)

;; Initialize the contract
(begin
  (initialize)
)