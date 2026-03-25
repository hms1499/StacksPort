;; mock-sbtc: Minimal SIP-010 token for simnet testing (replaces mainnet sBTC)

(define-fungible-token mock-sbtc)

(define-constant ERR_NOT_AUTHORIZED (err u403))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_AUTHORIZED)
    (ft-transfer? mock-sbtc amount sender recipient)))

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-sbtc amount recipient))

(define-read-only (get-name) (ok "Mock sBTC"))
(define-read-only (get-symbol) (ok "msBTC"))
(define-read-only (get-decimals) (ok u8))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-sbtc who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-sbtc)))
(define-read-only (get-token-uri) (ok none))
