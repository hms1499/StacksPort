;; mock-swap-router: Testnet-only router for testing execute-dca.
;; Receives STX, mints mock target tokens 1:1, sends to recipient.
;; NOT for production use.

(use-trait dca-swap-trait .dca-vault-v4.dca-swap-trait)
(impl-trait .dca-vault-v4.dca-swap-trait)

(define-fungible-token mock-target-token)

(define-public (swap-stx-for-token
    (amount-in uint)
    (min-amount-out uint)
    (recipient principal))
  (begin
    (asserts! (>= amount-in min-amount-out) (err u900))
    (try! (ft-mint? mock-target-token amount-in recipient))
    (ok amount-in)))
