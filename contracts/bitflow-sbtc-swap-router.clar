;; bitflow-sbtc-swap-router.clar
;; DCA Swap Router: STX -> sBTC via Bitflow xyk-pool-sbtc-stx-v-1-1
;;
;; Flow:
;;   1. dca-vault transfers STX to this contract
;;   2. This router calls xyk-core.swap-y-for-x (y=wSTX -> x=sBTC)
;;      token-stx-v-1-2 is a SIP-010 wrapper that uses stx-transfer? internally
;;   3. sBTC lands in this contract, forwarded to recipient
;;
;; Pool layout:
;;   x-token = SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
;;   y-token = SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2

;; ---------------------------------------------------------------
;; Trait declarations
;; ---------------------------------------------------------------
(use-trait dca-swap-trait     .dca-vault.dca-swap-trait)
(use-trait sip-010-trait      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool-trait     'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)

(impl-trait .dca-vault.dca-swap-trait)

;; ---------------------------------------------------------------
;; Constants - all Bitflow mainnet addresses
;; ---------------------------------------------------------------
(define-constant XYK-CORE   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant POOL       'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1)
(define-constant SBTC       'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant WSTX       'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)

;; ---------------------------------------------------------------
;; swap-stx-for-token
;;   amount-in      - uSTX received from vault (6 decimals)
;;   min-amount-out - minimum sBTC to receive (8 decimals / satoshis)
;;   recipient      - plan owner, receives sBTC
;; ---------------------------------------------------------------
(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (let (
    ;; Step 1: swap wSTX -> sBTC via Bitflow pool
    ;; as-contract: tx-sender = this router, so xyk-core pulls STX from us
    (dx (try! (as-contract
                (contract-call?
                  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                  swap-y-for-x
                  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
                  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
                  amount-in
                  min-amount-out))))
  )
    ;; Step 2: forward sBTC from this contract to plan owner
    ;; as-contract: tx-sender = this router (holds the sBTC)
    (try! (as-contract
            (contract-call?
              'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
              transfer dx tx-sender recipient none)))
    (ok dx)))
