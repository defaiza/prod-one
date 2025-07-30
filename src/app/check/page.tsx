'use client';

import { useState } from 'react';

export default function WalletCheckPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState('');

  const handleCheck = async () => {
    const address = walletAddress.trim();
    if (!address) {
      setToastMessage('Please enter a wallet address');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const response = await fetch(`/api/check-wallet-airdrop?address=${encodeURIComponent(address)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      
      const data = await response.json();

      setResult(data);
      if (data.found) {
        setToastMessage('Wallet found in airdrop data!');
      } else {
        setToastMessage('Wallet not found in airdrop data');
      }
      setTimeout(() => setToastMessage(''), 3000);
    } catch (error) {
      console.error('Error checking wallet:', error);
      setToastMessage('Error checking wallet. Please try again.');
      setResult({ found: false, message: 'Error checking wallet. Please try again.' });
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsChecking(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f3e8ff, #ffffff, #dbeafe)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
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

      <div style={{ width: '100%', maxWidth: '768px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <img
            src="/logo.png"
            alt="DEFAI Logo"
            width={80}
            height={80}
            style={{ height: '80px', width: '80px' }}
          />
        </div>
        
        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '48px', 
            fontWeight: 'bold', 
            color: '#111827',
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            DEFAI Airdrop Checker
          </h1>
          
          {/* Copy text */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(229, 231, 235, 1)',
            marginBottom: '32px'
          }}>
            <p style={{ 
              fontSize: '18px', 
              color: '#374151',
              lineHeight: '1.6',
              margin: '0 0 16px 0'
            }}>
              Thank You for Participating in the PreLaunch of DEFAI. Squad is migrating to our main platform and will be available there after launch.
            </p>
            <p style={{ 
              fontSize: '18px', 
              color: '#374151',
              lineHeight: '1.6',
              margin: 0
            }}>
              Paste your Wallet Address here to view your Estimated Airdrop total.
            </p>
          </div>
        </div>

        {/* Wallet Input */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(229, 231, 235, 1)',
          marginBottom: '32px'
        }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Enter your Solana wallet address..."
              style={{
                width: '100%',
                padding: '16px 128px 16px 16px',
                fontSize: '18px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              disabled={isChecking}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            />
            <button
              onClick={handleCheck}
              disabled={isChecking || !walletAddress.trim()}
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                background: isChecking || !walletAddress.trim() ? '#9333ea80' : '#9333ea',
                color: 'white',
                fontWeight: '500',
                padding: '8px 24px',
                borderRadius: '6px',
                border: 'none',
                cursor: isChecking || !walletAddress.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {isChecking ? 'Checking...' : 'Check Airdrop'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(229, 231, 235, 1)',
            marginBottom: '32px'
          }}>
            {result.found ? (
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#059669',
                  marginBottom: '24px'
                }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>Wallet Found!</span>
                </div>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: '16px'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#7c3aed',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: '0 0 8px 0'
                    }}>
                      Total Estimated Airdrop
                    </h3>
                    <p style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: '#581c87',
                      margin: 0
                    }}>
                      {formatNumber(result.totalEstimatedAirdrop || 0)} DEFAI
                    </p>
                  </div>
                  
                  <div style={{
                    background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#1d4ed8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: '0 0 8px 0'
                    }}>
                      Current Points
                    </h3>
                    <p style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: '#1e3a8a',
                      margin: 0
                    }}>
                      {formatNumber(result.currentPoints || 0)}
                    </p>
                  </div>
                </div>

                {result.initialAirdropAmount && result.initialAirdropAmount > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginTop: '16px'
                  }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: '0 0 8px 0'
                    }}>
                      Initial Airdrop Amount
                    </h3>
                    <p style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: '#14532d',
                      margin: 0
                    }}>
                      {formatNumber(result.initialAirdropAmount)} DEFAI
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#6b7280',
                  marginBottom: '16px'
                }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span style={{ fontSize: '18px', fontWeight: '600' }}>Wallet Not Found</span>
                </div>
                <p style={{ color: '#6b7280', margin: 0 }}>
                  {result.message || 'This wallet address was not found in the airdrop data.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
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