'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, Repeat2, ArrowRight, TrendingUp, Heart, Zap as ZapIcon } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { connect as stacksConnect } from '@stacks/connect';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const router = useRouter();
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await stacksConnect();
      const stxEntry = result.addresses.find(
        (a) => a.symbol === 'STX' || a.address.startsWith('SP') || a.address.startsWith('ST')
      );
      const btcEntry = result.addresses.find(
        (a) => a.symbol === 'BTC' || (!a.address.startsWith('SP') && !a.address.startsWith('ST'))
      );
      connect(stxEntry?.address ?? result.addresses[0]?.address ?? '', btcEntry?.address ?? '');
    } catch {
      // user cancelled or error — do nothing
    } finally {
      setConnecting(false);
    }
  }

  // Redirect to dashboard if wallet is connected
  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar onConnectClick={handleConnect} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 md:py-20 lg:py-28 px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 items-center">
              {/* Left Column */}
              <div className="md:col-span-6">
                <div className="mb-6">
                  <span className="inline-block px-3 py-1 bg-teal-50 text-teal-600 text-xs font-semibold rounded-full">
                    🚀 Launch Week
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  Smart Portfolio Management for Stacks
                </h1>

                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Automate your token investments with DCA plans, execute instant swaps, and track your portfolio performance all in one platform.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-60"
                  >
                    {connecting ? 'Connecting...' : 'Connect Wallet'}
                    <ArrowRight size={18} />
                  </button>
                </div>

                <p className="text-sm text-gray-500">
                  ✓ No seed phrases required • ✓ Secure wallet integration • ✓ Built on Stacks
                </p>
              </div>

              {/* Right Column - Visual */}
              <div className="md:col-span-6 flex items-center justify-center">
                <div className="space-y-4 w-full max-w-md">
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl p-6 border border-teal-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
                        <Repeat2 size={20} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900">DCA Plans</h3>
                    </div>
                    <p className="text-sm text-gray-600">Auto-invest at regular intervals</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                        <ZapIcon size={20} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Instant Swaps</h3>
                    </div>
                    <p className="text-sm text-gray-600">Trade tokens with real-time rates</p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                        <TrendingUp size={20} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Portfolio Tracking</h3>
                    </div>
                    <p className="text-sm text-gray-600">Monitor holdings and PnL metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 px-4 md:px-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Powerful Features
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Everything you need to manage your Stacks portfolio effectively
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <Repeat2 size={24} className="text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">DCA Automation</h3>
                <p className="text-gray-600 mb-4">
                  Set up automated dollar-cost averaging plans. Invest regularly without lifting a finger.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Custom intervals</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Any token pair</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Auto-execution</li>
                </ul>
              </div>

              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <ZapIcon size={24} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Trading</h3>
                <p className="text-gray-600 mb-4">
                  Execute swaps instantly with competitive rates powered by leading DEXs on Stacks.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Real-time quotes</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Low slippage</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Multiple pairs</li>
                </ul>
              </div>

              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <BarChart3 size={24} className="text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics</h3>
                <p className="text-gray-600 mb-4">
                  Track your portfolio performance with detailed analytics and performance metrics.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Real-time balance</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> PnL tracking</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Performance charts</li>
                </ul>
              </div>

              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <Bell size={24} className="text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Notifications</h3>
                <p className="text-gray-600 mb-4">
                  Get instant alerts for plan executions, swaps, and important portfolio changes.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Real-time alerts</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Smart filters</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> History tracking</li>
                </ul>
              </div>

              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                  <Heart size={24} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure</h3>
                <p className="text-gray-600 mb-4">
                  Your security is our priority. No seed phrases, smart contract audited.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Non-custodial</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Audited contracts</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Stacks consensus</li>
                </ul>
              </div>

              <div className="md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-gray-200 p-8 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  <TrendingUp size={24} className="text-teal-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Community Driven</h3>
                <p className="text-gray-600 mb-4">
                  Join a community of Stacks users optimizing their portfolio strategies.
                </p>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Active community</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Open source</li>
                  <li className="flex items-center gap-2"><span className="text-teal-500">✓</span> Feedback welcome</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 px-4 md:px-6 bg-teal-500">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to optimize your portfolio?
            </h2>
            <p className="text-lg text-teal-100 mb-8">
              Connect your wallet and start building your first DCA plan today.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-teal-600 font-semibold text-lg rounded-xl hover:bg-teal-50 transition-colors shadow-xl active:scale-95 disabled:opacity-60"
            >
              {connecting ? 'Connecting...' : 'Get Started Now'}
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
