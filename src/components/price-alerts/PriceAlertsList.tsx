'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Trash2, RotateCcw, Bell, BellOff } from 'lucide-react';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import { cn } from '@/lib/utils';

export default function PriceAlertsList() {
  const { alerts, removeAlert, toggleAlert, resetAlert } = usePriceAlertStore();

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
          <Bell size={22} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">No price alerts</p>
        <p className="text-xs text-gray-400">Create an alert above to get notified when a token hits your target</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">
          My Alerts
          <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {alerts.length}
          </span>
        </h2>
      </div>

      <ul className="divide-y divide-gray-50">
        {alerts.map((alert) => {
          const isTriggered = !!alert.triggeredAt;

          return (
            <li
              key={alert.id}
              className={cn(
                'flex items-center gap-4 px-6 py-4 transition-colors',
                !alert.isActive && 'opacity-50'
              )}
            >
              {/* Condition icon */}
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                  alert.condition === 'above' ? 'bg-green-50' : 'bg-red-50'
                )}
              >
                {alert.condition === 'above' ? (
                  <TrendingUp size={18} className="text-green-600" />
                ) : (
                  <TrendingDown size={18} className="text-red-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {alert.tokenSymbol}{' '}
                  <span className="font-normal text-gray-500">
                    {alert.condition === 'above' ? 'above' : 'below'}
                  </span>{' '}
                  ${alert.targetPrice.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isTriggered
                    ? `Triggered ${new Date(alert.triggeredAt!).toLocaleString('vi-VN')}`
                    : `Created ${new Date(alert.createdAt).toLocaleDateString('vi-VN')}`}
                </p>
              </div>

              {/* Status badge */}
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full',
                  isTriggered
                    ? 'bg-[#B0E4CC]/20 text-[#285A48]'
                    : alert.isActive
                      ? 'bg-green-50 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                )}
              >
                {isTriggered ? 'Triggered' : alert.isActive ? 'Active' : 'Paused'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {isTriggered ? (
                  <button
                    onClick={() => resetAlert(alert.id)}
                    title="Reset alert"
                    className="p-1.5 text-gray-400 hover:text-[#285A48] hover:bg-[#B0E4CC]/20 rounded-lg transition-colors"
                  >
                    <RotateCcw size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    title={alert.isActive ? 'Pause alert' : 'Resume alert'}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {alert.isActive ? <BellOff size={15} /> : <Bell size={15} />}
                  </button>
                )}
                <button
                  onClick={() => removeAlert(alert.id)}
                  title="Delete alert"
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
