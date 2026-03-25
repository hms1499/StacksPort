;; bitflow-usdcx-swap-router.clar
;; DCA Swap Router: sBTC -> STX -> aeUSDC -> USDCx via Bitflow
;;
;; Flow (3 hops):
;;   1. dca-vault-sbtc transfers sBTC to this contract
;;   2. Hop 1: xyk-core swap-x-for-y on pool-sbtc-stx (x=sBTC -> y=wSTX)
;;   3. Hop 2: xyk-core swap-x-for-y on pool-stx-aeusdc (x=wSTX -> y=aeUSDC)
;;   4. Hop 3: stableswap-core swap-x-for-y on pool-aeusdc-usdcx (x=aeUSDC -> y=USDCx)
;;   5. USDCx forwarded to recipient

;; ---------------------------------------------------------------
;; Trait declarations
;; ---------------------------------------------------------------
(use-trait dca-sbtc-swap-trait .dca-vault-sbtc.dca-sbtc-swap-trait)
(use-trait sip-010-trait       'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool-trait      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait ss-pool-trait       'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-trait-v-1-4.stableswap-pool-trait)

(impl-trait .dca-vault-sbtc.dca-sbtc-swap-trait)

;; ---------------------------------------------------------------
;; Constants - all Bitflow mainnet addresses
;; ---------------------------------------------------------------
;; Cores
(define-constant XYK-CORE   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant SS-CORE    'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4)

;; Pools
(define-constant POOL-SBTC-STX     'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1)
(define-constant POOL-STX-AEUSDC   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2)
(define-constant POOL-AEUSDC-USDCX 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1)

;; Tokens
(define-constant SBTC   'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant WSTX   'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)
(define-constant AEUSDC 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc)
(define-constant USDCX  'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)

;; ---------------------------------------------------------------
;; swap-sbtc-for-token
;;   amount-in      - sBTC satoshis received from vault
;;   min-amount-out - minimum USDCx to receive
;;   recipient      - plan owner, receives USDCx
;; ---------------------------------------------------------------
(define-public (swap-sbtc-for-token
    (amount-in      uint)
    (min-amount-out uint)
    (recipient      principal))
  (let (
    ;; Hop 1: sBTC -> STX via xyk-pool-sbtc-stx
    ;; swap-x-for-y: x=sBTC -> y=wSTX
    (dy-stx (try! (as-contract
                    (contract-call?
                      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                      swap-x-for-y
                      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
                      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
                      amount-in
                      u1))))

    ;; Hop 2: STX -> aeUSDC via xyk-pool-stx-aeusdc
    ;; swap-x-for-y: x=wSTX -> y=aeUSDC
    (dy-aeusdc (try! (as-contract
                       (contract-call?
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                         swap-x-for-y
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
                         'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
                         'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
                         dy-stx
                         u1))))

    ;; Hop 3: aeUSDC -> USDCx via stableswap-pool-aeusdc-usdcx
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
