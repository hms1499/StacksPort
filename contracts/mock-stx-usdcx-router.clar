;; mock-stx-usdcx-router: Test-only swap router that mints mock-usdcx instead of real swaps
;; Implements dca-swap-trait from test-dca-vault-stx-usdcx

(impl-trait .test-dca-vault-stx-usdcx.dca-swap-trait)

(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (begin
    ;; Simulate swap: mint mock-usdcx 1:1 to recipient (ignoring decimals difference)
    (try! (contract-call? .mock-usdcx mint amount-in recipient))
    (ok amount-in)))
