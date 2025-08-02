'use client';

import { useState } from 'react';

type CheckerType = 'original' | 'may20' | 'march31';

interface CheckResult {
  found: boolean;
  walletAddress?: string;
  totalEstimatedAirdrop?: number;
  currentPoints?: number;
  initialAirdropAmount?: number;
  quantity?: number;
  airdropAmount?: number;
  message?: string;
}

export default function WalletCheckPage() {
  const [walletAddresses, setWalletAddresses] = useState({
    original: '',
    may20: '',
    march31: ''
  });
  const [isChecking, setIsChecking] = useState({
    original: false,
    may20: false,
    march31: false
  });
  const [results, setResults] = useState<{
    original: CheckResult | null;
    may20: CheckResult | null;
    march31: CheckResult | null;
  }>({
    original: null,
    may20: null,
    march31: null
  });
  const [toastMessage, setToastMessage] = useState('');

  const handleCheck = async (type: CheckerType) => {
    const address = walletAddresses[type].trim();
    if (!address) {
      setToastMessage('Please enter a wallet address');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    setIsChecking(prev => ({ ...prev, [type]: true }));
    setResults(prev => ({ ...prev, [type]: null }));

    try {
      let endpoint = '';
      switch (type) {
        case 'original':
          endpoint = `/api/check-wallet-airdrop?address=${encodeURIComponent(address)}`;
          break;
        case 'may20':
          endpoint = `/api/check-may20-holders?address=${encodeURIComponent(address)}`;
          break;
        case 'march31':
          endpoint = `/api/check-march31-holders?address=${encodeURIComponent(address)}`;
          break;
      }

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      
      const data = await response.json();

      setResults(prev => ({ ...prev, [type]: data }));
      if (data.found) {
        setToastMessage('Wallet found in airdrop data!');
      } else {
        setToastMessage('Wallet not found in airdrop data');
      }
      setTimeout(() => setToastMessage(''), 3000);
    } catch (error) {
      console.error('Error checking wallet:', error);
      setToastMessage('Error checking wallet. Please try again.');
      setResults(prev => ({ 
        ...prev, 
        [type]: { found: false, message: 'Error checking wallet. Please try again.' } 
      }));
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsChecking(prev => ({ ...prev, [type]: false }));
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  const CheckerBox = ({ 
    type, 
    title, 
    copyText 
  }: { 
    type: CheckerType; 
    title: string; 
    copyText: string;
  }) => (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(8px)',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(229, 231, 235, 1)',
      marginBottom: '32px'
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: '16px',
        margin: '0 0 16px 0'
      }}>
        {title}
      </h2>
      
      <p style={{
        fontSize: '16px',
        color: '#374151',
        lineHeight: '1.6',
        marginBottom: '24px'
      }}>
        {copyText}
      </p>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={walletAddresses[type]}
          onChange={(e) => setWalletAddresses(prev => ({ ...prev, [type]: e.target.value }))}
          placeholder="Enter your Solana wallet address..."
          style={{
            width: '100%',
            padding: '16px 128px 16px 16px',
            fontSize: '16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
          disabled={isChecking[type]}
          onKeyPress={(e) => e.key === 'Enter' && handleCheck(type)}
        />
        <button
          onClick={() => handleCheck(type)}
          disabled={isChecking[type] || !walletAddresses[type].trim()}
          style={{
            position: 'absolute',
            right: '8px',
            top: '8px',
            background: isChecking[type] || !walletAddresses[type].trim() ? '#9333ea80' : '#9333ea',
            color: 'white',
            fontWeight: '500',
            padding: '8px 24px',
            borderRadius: '6px',
            border: 'none',
            cursor: isChecking[type] || !walletAddresses[type].trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {isChecking[type] ? 'Checking...' : 'Check'}
        </button>
      </div>

      {/* Results */}
      {results[type] && (
        <div style={{
          marginTop: '24px',
          padding: '20px',
          background: results[type]!.found ? 'rgba(220, 252, 231, 0.5)' : 'rgba(254, 226, 226, 0.5)',
          borderRadius: '8px',
          border: `1px solid ${results[type]!.found ? '#86efac' : '#fca5a5'}`
        }}>
          {results[type]!.found ? (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: '#059669',
                marginBottom: '16px'
              }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span style={{ fontSize: '16px', fontWeight: '600' }}>Wallet Found!</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {type === 'original' && (
                  <>
                    <div>
                      <span style={{ fontWeight: '500', color: '#374151' }}>Total Estimated Airdrop:</span>{' '}
                      <span style={{ fontWeight: 'bold', color: '#059669' }}>
                        {formatNumber(results[type]!.totalEstimatedAirdrop || 0)} DEFAI
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: '500', color: '#374151' }}>Current Points:</span>{' '}
                      <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
                        {formatNumber(results[type]!.currentPoints || 0)}
                      </span>
                    </div>
                    <div style={{ 
                      paddingLeft: '20px', 
                      fontSize: '13px', 
                      color: '#6b7280',
                      fontStyle: 'italic',
                      marginTop: '4px',
                      marginBottom: '8px'
                    }}>
                      <span>Points conversion: {formatNumber(results[type]!.currentPoints || 0)} points → {formatNumber((results[type]!.totalEstimatedAirdrop || 0) - (results[type]!.initialAirdropAmount || 0))} DEFAI</span>
                      <br />
                      <span style={{ fontSize: '12px' }}>
                        (Your Points ÷ Total Community Points) × Airdrop Pool
                      </span>
                    </div>
                    {results[type]!.initialAirdropAmount && results[type]!.initialAirdropAmount! > 0 && (
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Initial Airdrop Amount:</span>{' '}
                        <span style={{ fontWeight: 'bold', color: '#059669' }}>
                          {formatNumber(results[type]!.initialAirdropAmount!)} DEFAI
                        </span>
                      </div>
                    )}
                  </>
                )}
                {type === 'may20' && (
                  <div>
                    <span style={{ fontWeight: '500', color: '#374151' }}>Holdings on May 20:</span>{' '}
                    <span style={{ fontWeight: 'bold', color: '#059669' }}>
                      {formatNumber(results[type]!.quantity || 0)} DEFAI
                    </span>
                  </div>
                )}
                {type === 'march31' && (
                  <div>
                    <span style={{ fontWeight: '500', color: '#374151' }}>Airdrop Amount:</span>{' '}
                    <span style={{ fontWeight: 'bold', color: '#059669' }}>
                      {formatNumber(results[type]!.airdropAmount || 0)} DEFAI
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: '#dc2626',
                marginBottom: '8px'
              }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span style={{ fontSize: '16px', fontWeight: '600' }}>Wallet Not Found</span>
              </div>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
                {results[type]!.message || 'This wallet address was not found in the airdrop data.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f3e8ff, #ffffff, #dbeafe)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px',
      position: 'relative',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Toast Message */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          background: 'black',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 50
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '900px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <img
            src="/logo.png"
            alt="DEFAI Logo"
            width={100}
            height={100}
            style={{ height: '100px', width: '100px' }}
          />
        </div>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ 
            fontSize: '56px', 
            fontWeight: 'bold', 
            color: '#111827',
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            DEFAI Airdrop Checker
          </h1>
          <p style={{
            fontSize: '20px',
            color: '#6b7280',
            margin: 0
          }}>
            Check your eligibility across all DEFAI airdrop programs
          </p>
        </div>

        {/* Checker Boxes */}
        <CheckerBox
          type="original"
          title="Squad Estimated Airdrop"
          copyText="Thank You for Participating in the PreLaunch of DEFAI. Squad is migrating to our main platform and will be available there after launch. Paste your Wallet Address here to view your Estimated Airdrop total."
        />

        <CheckerBox
          type="march31"
          title="March 31 DeFAI Holders (10:1 Airdrop)"
          copyText="Paste Your Address here if you had DeFAI prior to March 31. You will just have to log into defai.gg and these tokens will vest over 90 days. The Squad Estimated Airdrop INCLUDES this supply."
        />

        <CheckerBox
          type="may20"
          title="May 20 DeFAI Holders (1:1 Airdrop)"
          copyText="Paste Your Address here if you had DeFAI on May 20. You must Mint an OG Ticket to receive these tokens which will vest over 90 days. The Squad Estimated Airdrop INCLUDES this supply."
        />

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: '48px' }}>
          <p style={{ margin: 0 }}>Data last updated: July 30, 2025</p>
        </div>
      </div>

      {/* Bottom branding */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px'
      }}>
        <div style={{
          background: 'black',
          color: '#4ade80',
          borderRadius: '8px',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: '500',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          Built with ElizaOS
        </div>
      </div>
    </div>
  );
} 