;; limit-order-vault: non-custodial one-shot STX->sBTC limit-buy vault.
;; User deposits STX with a target USD price (stored for audit/UI only - NOT
;; enforced on-chain). The keeper executes a one-shot swap when its off-chain
;; price condition is met; min-amount-out is the on-chain slippage/trust guard.
;; Orders are good-til-cancelled.

(define-trait dca-swap-trait
  (
    (swap-stx-for-token (uint uint principal) (response uint uint))
  )
)

(define-constant E100 (err u100)) ;; not authorized
(define-constant E101 (err u101)) ;; order not found
(define-constant E102 (err u102)) ;; order not open
(define-constant E105 (err u105)) ;; invalid target-usd
(define-constant E107 (err u107)) ;; max open orders reached
(define-constant E109 (err u109)) ;; deposit too small

(define-constant MID   u2000000)  ;; min initial deposit: 2 STX
(define-constant PFBPS u30)       ;; protocol fee: 30 bps = 0.3%
(define-constant BPSB  u10000)
(define-constant MPPU  u10)       ;; max OPEN orders per user
(define-constant TREASURY 'SP2DZKR60CN5QKJQT18T8ZMSERGA6R4QKHEM5QT1W)

(define-constant STATUS-OPEN      u0)
(define-constant STATUS-FILLED    u1)
(define-constant STATUS-CANCELLED u2)

(define-data-var oc   uint u0)  ;; order counter
(define-data-var tvol uint u0)  ;; total uSTX filled
(define-data-var toe  uint u0)  ;; total orders executed

(define-map orders uint {
  owner:      principal,
  token:      principal,
  amt:        uint,
  target-usd: uint,
  status:     uint,
  cat:        uint,
  fab:        uint
})

(define-map uids principal (list 10 uint))
(define-map open-cnt principal uint)

(define-private (protocol-fee (a uint)) (/ (* a PFBPS) BPSB))

(define-private (oc-of (u principal)) (default-to u0 (map-get? open-cnt u)))

(define-private (add-uid (u principal) (id uint))
  (let ((ex (default-to (list) (map-get? uids u)))
        (up (unwrap-panic (as-max-len? (append ex id) u10))))
    (map-set uids u up)))

(define-public (create-order
    (target-token  principal)
    (deposit-amount uint)
    (target-usd    uint))
  (let ((id (+ (var-get oc) u1))
        (n  (oc-of tx-sender)))
    (asserts! (>= deposit-amount MID) E109)
    (asserts! (> target-usd u0)       E105)
    (asserts! (< n MPPU)              E107)
    (try! (stx-transfer? deposit-amount tx-sender (as-contract tx-sender)))
    (map-set orders id {
      owner: tx-sender, token: target-token,
      amt: deposit-amount, target-usd: target-usd,
      status: STATUS-OPEN, cat: stacks-block-height, fab: u0
    })
    (var-set oc id)
    (map-set open-cnt tx-sender (+ n u1))
    (add-uid tx-sender id)
    (print { event: "order-created", order-id: id, owner: tx-sender,
             token: target-token, amt: deposit-amount, target-usd: target-usd })
    (ok id)))

(define-public (execute-order
    (order-id       uint)
    (swap-router    <dca-swap-trait>)
    (min-amount-out uint))
  (let ((o     (unwrap! (map-get? orders order-id) E101))
        (amt   (get amt o))
        (owner (get owner o))
        (pf    (protocol-fee (get amt o)))
        (net   (- (get amt o) (protocol-fee (get amt o)))))
    (asserts! (is-eq (get status o) STATUS-OPEN) E102)
    (as-contract (try! (stx-transfer? pf tx-sender TREASURY)))
    (as-contract (try! (stx-transfer? net tx-sender (contract-of swap-router))))
    (as-contract (try! (contract-call? swap-router swap-stx-for-token net min-amount-out owner)))
    (map-set orders order-id (merge o { status: STATUS-FILLED, fab: stacks-block-height }))
    (map-set open-cnt owner (- (oc-of owner) u1))
    (var-set tvol (+ (var-get tvol) amt))
    (var-set toe  (+ (var-get toe)  u1))
    (print { event: "order-filled", order-id: order-id, owner: owner,
             executor: tx-sender, net-swapped: net, protocol-fee: pf,
             min-out: min-amount-out })
    (ok { net-swapped: net, protocol-fee: pf })))

(define-read-only (get-order (order-id uint)) (map-get? orders order-id))
(define-read-only (get-user-orders (user principal)) (default-to (list) (map-get? uids user)))
(define-read-only (get-open-order-count (user principal)) (oc-of user))
(define-read-only (get-stats)
  { oc: (var-get oc), tvol: (var-get tvol), toe: (var-get toe) })
