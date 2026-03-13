'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import { PRICE_ALERT_TOKENS, type PriceAlertCondition } from '@/types/priceAlerts';
import { cn } from '@/lib/utils';

export default function PriceAlertForm() {
  const { addAlert } = usePriceAlertStore();

  const [selectedToken, setSelectedToken] = useState(PRICE_ALERT_TOKENS[0]);
  const [condition, setCondition] = useState<PriceAlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetPrice);
    if (!targetPrice || isNaN(price) || price <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }
    setError('');
    addAlert(selectedToken.symbol, selectedToken.geckoId, condition, price);
    setTargetPrice('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 mb-5">Create Price Alert</h2>

      <div className="space-y-4">
        {/* Token selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token</label>
          <div className="grid grid-cols-3 gap-2">
            {PRICE_ALERT_TOKENS.map((token) => (
              <button
                key={token.geckoId}
                type="button"
                onClick={() => setSelectedToken(token)}
                className={cn(
                  'px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
                  selectedToken.geckoId === token.geckoId
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                {token.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCondition('above')}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                condition === 'above'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <TrendingUp size={16} />
              Price goes above
            </button>
            <button
              type="button"
              onClick={() => setCondition('below')}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                condition === 'below'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <TrendingDown size={16} />
              Price goes below
            </button>
          </div>
        </div>

        {/* Target price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value);
                if (error) setError('');
              }}
              className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>

        {/* Summary */}
        {targetPrice && !isNaN(parseFloat(targetPrice)) && parseFloat(targetPrice) > 0 && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            Alert when <span className="font-semibold text-gray-900">{selectedToken.symbol}</span>{' '}
            {condition === 'above' ? 'rises above' : 'drops below'}{' '}
            <span className="font-semibold text-gray-900">${parseFloat(targetPrice).toLocaleString()}</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={16} />
          Create Alert
        </button>
      </div>
    </form>
  );
}
