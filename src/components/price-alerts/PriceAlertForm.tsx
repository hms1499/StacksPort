'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Plus, Bell } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import { PRICE_ALERT_TOKENS, type PriceAlertCondition } from '@/types/priceAlerts';
import { cn } from '@/lib/utils';

export default function PriceAlertForm() {
  const { addAlert } = usePriceAlertStore();

  const { permission, isSupported, subscribe } = usePushNotifications();
  const [selectedToken, setSelectedToken] = useState(PRICE_ALERT_TOKENS[0]);
  const [condition, setCondition] = useState<PriceAlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [error, setError] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

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
    setJustCreated(true);
  };

  const handleEnablePush = async () => {
    setSubscribing(true);
    await subscribe();
    setSubscribing(false);
    setJustCreated(false);
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
                    ? 'border-[#408A71] bg-[#B0E4CC]/20 text-[#285A48]'
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
              <span className="hidden sm:inline">Price goes above</span>
              <span className="sm:hidden">Above</span>
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
              <span className="hidden sm:inline">Price goes below</span>
              <span className="sm:hidden">Below</span>
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
              className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#408A71] focus:border-transparent text-sm"
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#408A71] hover:bg-[#285A48] text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={16} />
          Create Alert
        </button>
        {justCreated && isSupported && permission !== 'granted' && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-[#B0E4CC]/20 border border-[#408A71]/30 rounded-xl">
            <Bell size={16} className="text-[#408A71] shrink-0" />
            <span className="text-xs text-gray-600 flex-1">
              Nhận alert ngay cả khi đóng app?
            </span>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={subscribing}
              className="text-xs font-medium text-[#408A71] hover:text-[#285A48] disabled:opacity-50"
            >
              {subscribing ? 'Đang bật...' : 'Bật thông báo'}
            </button>
            <button
              type="button"
              onClick={() => setJustCreated(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Bỏ qua
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
