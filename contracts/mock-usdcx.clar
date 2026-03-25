;; mock-usdcx: Minimal SIP-010 token for simnet testing (replaces mainnet USDCx)

(define-fungible-token mock-usdcx)

(define-constant ERR_NOT_AUTHORIZED (err u403))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_AUTHORIZED)
    (ft-transfer? mock-usdcx amount sender recipient)))

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-usdcx amount recipient))

(define-read-only (get-name) (ok "Mock USDCx"))
(define-read-only (get-symbol) (ok "mUSDCx"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-usdcx who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-usdcx)))
(define-read-only (get-token-uri) (ok none))
