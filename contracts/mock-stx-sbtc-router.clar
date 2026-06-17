;; mock-stx-sbtc-router: test-only swap router. Mints mock-sbtc 1:1 to recipient.
;; Asserts the minted amount >= min-amount-out so tests can drive the slippage revert.
(impl-trait .limit-order-vault.dca-swap-trait)

(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (begin
    (asserts! (>= amount-in min-amount-out) (err u999))
    (try! (contract-call? .mock-sbtc mint amount-in recipient))
    (ok amount-in)))
