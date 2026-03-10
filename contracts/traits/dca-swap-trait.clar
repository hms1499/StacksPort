;; DCA Swap Router Trait v2 — Token-to-Token
;; Router receives source tokens first, then swaps to target token
(define-trait dca-swap-trait
  (
    ;; Swap SIP-010 source token (already transferred to this contract) for target token
    ;; amount-in      - source token amount already in this contract
    ;; min-amount-out - minimum target tokens to receive (slippage protection)
    ;; recipient      - address to receive the target tokens
    (swap-token-for-token
      (uint uint principal)
      (response uint uint))
  )
)
