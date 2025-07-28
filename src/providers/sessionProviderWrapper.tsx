"use client";

import { SessionProvider } from "next-auth/react";
import React, { useState, useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

export default function SessionProviderWrapper({ children }: Props) {
  const [isHydrated, setIsHydrated] = useState(false);

  // Fix hydration issues in production
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Don't render session provider until hydrated in production
  if (!isHydrated && typeof window !== 'undefined') {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            border: '2px solid #e5e7eb', 
            borderTop: '2px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Initializing...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <SessionProvider
      // Reduce re-fetch interval in production to prevent constant re-renders
      refetchInterval={process.env.NODE_ENV === 'production' ? 300 : 0}
      // Don't refetch on window focus in production to prevent unnecessary re-renders
      refetchOnWindowFocus={process.env.NODE_ENV !== 'production'}
      // Keep session in sync but reduce frequency
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
} 