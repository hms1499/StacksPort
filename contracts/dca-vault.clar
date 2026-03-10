;; SIP-010 Fungible Token Standard
(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; DCA Swap Router — any DEX router implements this trait
(define-trait dca-swap-trait
  (
    (swap-token-for-token (uint uint principal) (response uint uint))
  )
)

(define-constant CO tx-sender)
(define-constant E100 (err u100)) ;; not authorized
(define-constant E101 (err u101)) ;; plan not found
(define-constant E102 (err u102)) ;; plan inactive
(define-constant E103 (err u103)) ;; insufficient balance
(define-constant E104 (err u104)) ;; too early
(define-constant E105 (err u105)) ;; invalid amount
(define-constant E106 (err u106)) ;; invalid interval
(define-constant E107 (err u107)) ;; max plans reached
(define-constant E108 (err u108)) ;; swap failed
(define-constant E109 (err u109)) ;; deposit too small
(define-constant E110 (err u110)) ;; wrong source token

(define-constant BPD u144)
(define-constant BPW u1008)
(define-constant BPM u4320)
(define-constant MSA u1000000)
(define-constant MID u2000000)
(define-constant ERBPS u50)
(define-constant BPSB u10000)
(define-constant MPPU u10)

(define-data-var pc uint u0)
(define-data-var tvol uint u0)
(define-data-var tse uint u0)

(define-map plans uint {
  owner: principal,
  src:   principal,  ;; source token (e.g. USDx)
  token: principal,  ;; target token
  amt:   uint,       ;; source token units per swap
  ivl:   uint,       ;; blocks between swaps
  leb:   uint,       ;; last executed block (0 = never)
  bal:   uint,       ;; source token balance remaining
  tsd:   uint,       ;; total swaps done
  tss:   uint,       ;; total source tokens spent
  active: bool,
  cat:   uint        ;; created at block
})

(define-map uids principal (list 10 uint))

(define-private (exec-reward (a uint)) (/ (* a ERBPS) BPSB))

(define-private (add-uid (u principal) (id uint))
  (let ((ex (default-to (list) (map-get? uids u)))
        (up (unwrap-panic (as-max-len? (append ex id) u10))))
    (map-set uids u up)))

(define-private (interval-passed (p {
    owner: principal, src: principal, token: principal,
    amt: uint, ivl: uint, leb: uint, bal: uint,
    tsd: uint, tss: uint, active: bool, cat: uint
  }))
  (or (is-eq (get leb p) u0)
      (>= (- block-height (get leb p)) (get ivl p))))

;; create-plan: deposit source token and configure DCA parameters
(define-public (create-plan
    (source-token        <sip-010-trait>)
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
    (try! (contract-call? source-token transfer initial-deposit tx-sender (as-contract tx-sender) none))
    (map-set plans id {
      owner: tx-sender, src: (contract-of source-token),
      token: target-token, amt: amount-per-interval,
      ivl: interval-blocks, leb: u0, bal: initial-deposit,
      tsd: u0, tss: u0, active: true, cat: block-height
    })
    (var-set pc id)
    (add-uid tx-sender id)
    (print { event: "plan-created", plan-id: id, owner: tx-sender,
             src: (contract-of source-token), token: target-token,
             amt: amount-per-interval, ivl: interval-blocks, deposit: initial-deposit })
    (ok id)))

;; deposit: add more source tokens to an active plan
(define-public (deposit (plan-id uint) (source-token <sip-010-trait>) (amount uint))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p))                E100)
    (asserts! (get active p)                                  E102)
    (asserts! (>= amount MSA)                                 E105)
    (asserts! (is-eq (contract-of source-token) (get src p)) E110)
    (try! (contract-call? source-token transfer amount tx-sender (as-contract tx-sender) none))
    (map-set plans plan-id (merge p { bal: (+ (get bal p) amount) }))
    (print { event: "deposit", plan-id: plan-id, amount: amount })
    (ok true)))

;; execute-dca: trigger a swap when interval has passed.
;; Caller earns 0.5% of the swap amount in source tokens.
(define-public (execute-dca
    (plan-id        uint)
    (source-token   <sip-010-trait>)
    (swap-router    <dca-swap-trait>)
    (min-amount-out uint))
  (let ((p     (unwrap! (map-get? plans plan-id) E101))
        (sa    (get amt p))
        (er    (exec-reward sa))
        (net   (- sa er))
        (owner (get owner p)))
    (asserts! (get active p)                                  E102)
    (asserts! (>= (get bal p) sa)                             E103)
    (asserts! (interval-passed p)                             E104)
    (asserts! (is-eq (contract-of source-token) (get src p)) E110)
    ;; Pay executor reward in source token
    (as-contract (try! (contract-call? source-token transfer er tx-sender tx-sender none)))
    ;; Transfer net source tokens to swap router
    (as-contract (try! (contract-call? source-token transfer net tx-sender (contract-of swap-router) none)))
    ;; Router swaps and sends target tokens to plan owner
    (as-contract (try! (contract-call? swap-router swap-token-for-token net min-amount-out owner)))
    (let ((nr  (- (get bal p) sa))
          (nd  (+ (get tsd p) u1))
          (ns  (+ (get tss p) sa))
          (act (>= nr (get amt p))))
      (map-set plans plan-id
        (merge p { leb: block-height, bal: nr, tsd: nd, tss: ns, active: act }))
      (var-set tvol (+ (var-get tvol) sa))
      (var-set tse  (+ (var-get tse)  u1))
      (print { event: "dca-executed", plan-id: plan-id, executor: tx-sender,
               owner: owner, net-swapped: net, reward: er,
               swaps-done: nd, bal-remaining: nr, active: act })
      (ok { net-swapped: net, executor-reward: er,
            swaps-done: nd, bal-remaining: nr }))))

;; cancel-plan: cancel and refund remaining source tokens to owner
(define-public (cancel-plan (plan-id uint) (source-token <sip-010-trait>))
  (let ((p (unwrap! (map-get? plans plan-id) E101)))
    (asserts! (is-eq tx-sender (get owner p))                E100)
    (asserts! (get active p)                                  E102)
    (asserts! (is-eq (contract-of source-token) (get src p)) E110)
    (if (> (get bal p) u0)
      (as-contract (try! (contract-call? source-token transfer (get bal p) tx-sender (get owner p) none)))
      true)
    (map-set plans plan-id (merge p { active: false, bal: u0 }))
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
        (ok block-height)
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
