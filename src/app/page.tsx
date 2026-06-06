'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';
import { connect as stacksConnect } from '@stacks/connect';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Hero from '@/components/landing/Hero';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorks from '@/components/landing/HowItWorks';
import CTASection from '@/components/landing/CTASection';
import TrustSection from '@/components/landing/TrustSection';
import SocialProofStrip from '@/components/dashboard/SocialProofStrip';

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
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (isConnected) router.push('/dashboard');
  }, [isConnected, router]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#060C18', color: '#DDE8F8' }}
    >
      <Navbar onConnectClick={handleConnect} />

      <Hero onConnect={handleConnect} connecting={connecting} />

      {/* Stats strip (live-ticking social proof) */}
      <section style={{ borderTop: '1px solid rgba(28,49,80,0.6)', borderBottom: '1px solid rgba(28,49,80,0.6)' }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
          <SocialProofStrip />
        </div>
      </section>

      <FeaturesSection />

      <HowItWorks />

      <TrustSection />

      <CTASection onConnect={handleConnect} connecting={connecting} />

      <Footer />
    </div>
  );
}
