;; mock-sbtc-swap-router: Test-only swap router that mints mock-usdcx instead of real swaps
;; Implements dca-sbtc-swap-trait from test-dca-vault-sbtc

(impl-trait .test-dca-vault-sbtc.dca-sbtc-swap-trait)

(define-public (swap-sbtc-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (begin
    ;; Simulate swap: mint mock-usdcx 1:1 to recipient
    (try! (contract-call? .mock-usdcx mint amount-in recipient))
    (ok amount-in)))
