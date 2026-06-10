;; bitflow-usdcx-from-stx-router.clar
;; DCA Swap Router: STX -> aeUSDC -> USDCx via Bitflow
;;
;; Flow (2 hops):
;;   1. dca-vault-stx-usdcx transfers STX to this contract
;;   2. Hop 1: xyk-core swap-x-for-y on pool-stx-aeusdc (x=wSTX -> y=aeUSDC)
;;   3. Hop 2: stableswap-core swap-x-for-y on pool-aeusdc-usdcx (x=aeUSDC -> y=USDCx)
;;   4. USDCx forwarded to recipient

;; ---------------------------------------------------------------
;; Trait declarations
;; ---------------------------------------------------------------
(use-trait dca-swap-trait  .dca-vault-stx-usdcx.dca-swap-trait)
(use-trait sip-010-trait   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool-trait  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait ss-pool-trait   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-trait-v-1-4.stableswap-pool-trait)

(impl-trait .dca-vault-stx-usdcx.dca-swap-trait)

;; ---------------------------------------------------------------
;; Constants - all Bitflow mainnet addresses
;; ---------------------------------------------------------------
;; Cores
(define-constant XYK-CORE 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant SS-CORE  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4)

;; Pools
(define-constant POOL-STX-AEUSDC   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2)
(define-constant POOL-AEUSDC-USDCX 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1)

;; Tokens
(define-constant WSTX   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)
(define-constant AEUSDC 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc)
(define-constant USDCX  'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)

;; ---------------------------------------------------------------
;; swap-stx-for-token
;;   amount-in      - uSTX received from vault (6 decimals)
;;   min-amount-out - minimum USDCx to receive
;;   recipient      - plan owner, receives USDCx
;; ---------------------------------------------------------------
(define-public (swap-stx-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (let (
    ;; Hop 1: STX -> aeUSDC via xyk-pool-stx-aeusdc
    ;; swap-x-for-y: x=wSTX -> y=aeUSDC
    (dy-aeusdc (try! (as-contract
                       (contract-call?
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                         swap-x-for-y
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
                         'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
                         amount-in
                         u1))))

    ;; Hop 2: aeUSDC -> USDCx via stableswap-pool-aeusdc-usdcx
    ;; swap-x-for-y: x=aeUSDC -> y=USDCx
    (dy-usdcx (try! (as-contract
                      (contract-call?
                        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4
                        swap-x-for-y
                        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
                        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
                        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
                        dy-aeusdc
                        min-amount-out))))
  )
    ;; Forward USDCx from this contract to plan owner
    (try! (as-contract
            (contract-call?
              'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
              transfer dy-usdcx tx-sender recipient none)))
    (ok dy-usdcx)))
