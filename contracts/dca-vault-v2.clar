;; dca-vault-v2: Dollar-Cost Averaging vault using STX as source token
;; v2: cancel-plan and execute-dca now remove plan ID from uids, freeing slots

;; DCA Swap Router - router receives STX, swaps to target token, sends to recipient
(define-trait dca-swap-trait
  (
    (swap-stx-for-token (uint uint principal) (response uint uint))
  )
)

(define-constant E100 (err u100)) ;; not authorized
(define-constant E101 (err u101)) ;; plan not found
(define-constant E102 (err u102)) ;; plan inactive
(define-constant E103 (err u103)) ;; insufficient balance
(define-constant E104 (err u104)) ;; too early
(define-constant E105 (err u105)) ;; invalid amount
(define-constant E106 (err u106)) ;; invalid interval
(define-constant E107 (err u107)) ;; max plans reached
(define-constant E109 (err u109)) ;; deposit too small

(define-constant BPD   u144)                                         ;; blocks per day
(define-constant MSA   u1000000)                                     ;; min swap amount: 1 STX
(define-constant MID   u2000000)                                     ;; min initial deposit: 2 STX
(define-constant PFBPS u30)                                          ;; protocol fee: 30 bps = 0.3%
(define-constant BPSB  u10000)
(define-constant MPPU  u10)                                          ;; max plans per user
(define-constant TREASURY 'SP2DZKR60CN5QKJQT18T8ZMSERGA6R4QKHEM5QT1W) ;; protocol treasury

(define-data-var pc   uint u0)  ;; plan counter
(define-data-var tvol uint u0)  ;; total volume (uSTX)
(define-data-var tse  uint u0)  ;; total swaps executed

(define-map plans uint {
  owner:  principal,
  token:  principal, ;; target token contract
  amt:    uint,      ;; uSTX per swap
  ivl:    uint,      ;; blocks between swaps
  leb:    uint,      ;; last executed block (0 = never)
  bal:    uint,      ;; uSTX balance remaining
  tsd:    uint,      ;; total swaps done
  tss:    uint,      ;; total STX spent (uSTX)
  active: bool,
  cat:    uint       ;; created at block
})

(define-map uids principal (list 10 uint))

(define-private (protocol-fee (a uint)) (/ (* a PFBPS) BPSB))

(define-private (add-uid (u principal) (id uint))
  (let ((ex (default-to (list) (map-get? uids u)))
        (up (unwrap-panic (as-max-len? (append ex id) u10))))
    (map-set uids u up)))

;; v2: remove a plan ID from user's uid list
(define-private (remove-uid (u principal) (id uint))
  (let ((ex (default-to (list) (map-get? uids u)))
        (filtered (filter not-eq-id ex)))
    (map-set uids u filtered)))

;; Helper closure for filter -- uses a data-var to pass the target ID
(define-data-var filter-target uint u0)

(define-private (not-eq-id (v uint))
  (not (is-eq v (var-get filter-target))))

;; Wrapper that sets filter-target then calls remove-uid logic
(define-private (remove-uid-safe (u principal) (id uint))
  (begin
    (var-set filter-target id)
    (remove-uid u id)))

(define-private (interval-passed (p {
    owner: principal, token: principal,
    amt: uint, ivl: uint, leb: uint, bal: uint,
    tsd: uint, tss: uint, active: bool, cat: uint
  }))
  (or (is-eq (get leb p) u0)
      (>= (- stacks-block-height (get leb p)) (get ivl p))))

(define-public (create-plan
    (target-token        principal)
    (amount-per-interval uint)
    (interval-blocks     uint)
    (initial-deposit     uint))
  (let ((id (+ (var-get pc) u1))
        (up (default-to (list) (map-get? uids tx-sender))))
    (asserts! (>= amount-per-interval MSA)             E105)
    (asserts! (>= interval-blocks BPD)                 E106)
    (asserts! (>= initial-deposit MID)                 E109)
    (asserts! (>= initial-deposit amount-per-interval) E103)
    (asserts! (< (len up) MPPU)                        E107)
    (try! (stx-transfer? initial-deposit tx-sender (as-contract tx-sender)))
    (map-set plans id {
      owner: tx-sender, token: target-token,
      amt: amount-per-interval, ivl: interval-blocks,
      leb: u0, bal: initial-deposit,
      tsd: u0, tss: u0, active: true, cat: stacks-block-height
    })
    (var-set pc id)
    (add-uid tx-sender id)
    (print { event: "plan-created", plan-id: id, owner: tx-sender,
             token: target-token, amt: amount-per-interval,
             ivl: interval-blocks, deposit: initial-deposit })
    (ok id)))

(define-public (deposit (plan-id uint) (amount uint))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p)) E100)
    (asserts! (get active p)                   E102)
    (asserts! (>= amount MSA)                  E105)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set plans plan-id (merge p { bal: (+ (get bal p) amount) }))
    (print { event: "deposit", plan-id: plan-id, amount: amount })
    (ok true)))

(define-public (execute-dca
    (plan-id        uint)
    (swap-router    <dca-swap-trait>)
    (min-amount-out uint))
  (let ((p    (unwrap! (map-get? plans plan-id) E101))
        (sa   (get amt p))
        (pf   (protocol-fee sa))
        (net  (- sa pf))
        (owner (get owner p)))
    (asserts! (get active p)       E102)
    (asserts! (>= (get bal p) sa)  E103)
    (asserts! (interval-passed p)  E104)
    ;; Transfer 0.3% protocol fee to treasury
    (as-contract (try! (stx-transfer? pf tx-sender TREASURY)))
    ;; Transfer remaining 99.7% to swap router
    (as-contract (try! (stx-transfer? net tx-sender (contract-of swap-router))))
    ;; Router swaps and sends target tokens to plan owner
    (as-contract (try! (contract-call? swap-router swap-stx-for-token net min-amount-out owner)))
    (let ((nr  (- (get bal p) sa))
          (nd  (+ (get tsd p) u1))
          (ns  (+ (get tss p) sa))
          (act (>= nr (get amt p))))
      (map-set plans plan-id
        (merge p { leb: stacks-block-height, bal: nr, tsd: nd, tss: ns, active: act }))
      (var-set tvol (+ (var-get tvol) sa))
      (var-set tse  (+ (var-get tse)  u1))
      ;; v2: remove plan from uids when auto-deactivated (balance exhausted)
      (if (not act)
        (remove-uid-safe owner plan-id)
        true)
      (print { event: "dca-executed", plan-id: plan-id, executor: tx-sender,
               owner: owner, net-swapped: net, protocol-fee: pf,
               swaps-done: nd, bal-remaining: nr, active: act })
      (ok { net-swapped: net, protocol-fee: pf,
            swaps-done: nd, bal-remaining: nr }))))

;; v2: cancel-plan now removes plan ID from uids, freeing the slot
(define-public (cancel-plan (plan-id uint))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p)) E100)
    (if (> (get bal p) u0)
      (as-contract (try! (stx-transfer? (get bal p) tx-sender (get owner p))))
      true)
    (map-set plans plan-id (merge p { active: false, bal: u0 }))
    (remove-uid-safe (get owner p) plan-id)
    (print { event: "plan-cancelled", plan-id: plan-id,
             owner: (get owner p), refunded: (get bal p) })
    (ok (get bal p))))

(define-public (pause-plan (plan-id uint))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p)) E100)
    (asserts! (get active p)                  E102)
    (map-set plans plan-id (merge p { active: false }))
    (print { event: "plan-paused", plan-id: plan-id })
    (ok true)))

(define-public (resume-plan (plan-id uint))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p))  E100)
    (asserts! (not (get active p))             E102)
    (asserts! (>= (get bal p) (get amt p))     E103)
    (map-set plans plan-id (merge p { active: true }))
    ;; v2: re-add to uids on resume
    (add-uid tx-sender plan-id)
    (print { event: "plan-resumed", plan-id: plan-id })
    (ok true)))

(define-read-only (get-plan (plan-id uint)) (map-get? plans plan-id))

(define-read-only (get-user-plans (user principal))
  (default-to (list) (map-get? uids user)))

(define-read-only (can-execute (plan-id uint))
  (match (map-get? plans plan-id)
    p (and (get active p)
           (>= (get bal p) (get amt p))
           (interval-passed p))
    false))

(define-read-only (next-execution-block (plan-id uint))
  (match (map-get? plans plan-id)
    p (if (is-eq (get leb p) u0)
        (ok stacks-block-height)
        (ok (+ (get leb p) (get ivl p))))
    E101))

(define-read-only (remaining-swaps (plan-id uint))
  (match (map-get? plans plan-id)
    p (ok (/ (get bal p) (get amt p)))
    E101))

(define-read-only (get-stats)
  (ok { total-plans: (var-get pc),
        total-volume: (var-get tvol),
        total-executed: (var-get tse) }))
