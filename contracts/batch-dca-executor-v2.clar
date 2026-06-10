;; batch-dca-executor-v2.clar
;; Orchestrates multiple DCA executions in a single transaction.
;; v2: adds vault-type u2 (STX -> USDCx). Existing vaults are NOT modified.

(define-constant MAX-BATCH u50)
(define-constant MIN-AMOUNT-OUT u1)

;; vault-type = u0: STX -> sBTC
(define-constant VAULT-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault)
(define-constant ROUTER-STX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router)

;; vault-type = u1: sBTC -> USDCx
(define-constant VAULT-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2)
(define-constant ROUTER-SBTC
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-swap-router)

;; vault-type = u2: STX -> USDCx
(define-constant VAULT-STX-USDCX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-stx-usdcx)
(define-constant ROUTER-STX-USDCX
  'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-usdcx-from-stx-router)

(define-constant ERR-EMPTY-LIST (err u100))

(define-private (execute-single
    (item { plan-id: uint, vault-type: uint })
    (acc  { success: uint, failed: uint }))
  (let ((result
    (if (is-eq (get vault-type item) u0)
      (contract-call? VAULT-STX execute-dca
        (get plan-id item) ROUTER-STX MIN-AMOUNT-OUT)
      (if (is-eq (get vault-type item) u1)
        (contract-call? VAULT-SBTC execute-dca
          (get plan-id item) ROUTER-SBTC MIN-AMOUNT-OUT)
        (contract-call? VAULT-STX-USDCX execute-dca
          (get plan-id item) ROUTER-STX-USDCX MIN-AMOUNT-OUT))
    )))
  (match result
    ok-val  { success: (+ (get success acc) u1), failed: (get failed acc) }
    err-val { success: (get success acc), failed: (+ (get failed acc) u1) }
  ))
)

(define-read-only (get-max-batch)
  (ok MAX-BATCH))

(define-public (batch-execute-dca
    (plans (list 50 { plan-id: uint, vault-type: uint })))
  (begin
    (asserts! (> (len plans) u0) ERR-EMPTY-LIST)
    (ok (fold execute-single plans { success: u0, failed: u0 }))
  )
)
